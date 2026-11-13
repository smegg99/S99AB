// data/outbox/worker.go

package outbox

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/smegg99/s99ab/v2/data/db"
)

type Job struct {
	ID        int64
	Kind      string
	Payload   []byte
	Attempts  int
	LastError string
	lease     string
}

type Worker struct {
	db       *sql.DB
	handlers map[string]Handler
	opts     Options
	stop     chan struct{}
	done     chan struct{}
	// err is a driver the pool could not name; every Start and Drain returns it.
	err error

	mu      sync.Mutex
	started bool
	closed  bool
}

func NewWorker(conn *sql.DB, handlers map[string]Handler, opts Options) *Worker {
	opts.defaults()
	var err error
	if opts.Driver == "" {
		opts.Driver, err = db.Detect(conn)
	}
	return &Worker{
		db:       conn,
		handlers: handlers,
		opts:     opts,
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
		err:      err,
	}
}

// sql rewrites a statement for the worker's driver.
func (w *Worker) sql(query string) string { return db.Rebind(w.opts.Driver, query) }

// Start polls until Close and returns at once; a second call does nothing and a call after Close is ErrClosed.
func (w *Worker) Start(ctx context.Context) error {
	if w.err != nil {
		return w.err
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.closed {
		return ErrClosed
	}
	if w.started {
		return nil
	}
	w.started = true

	go func() {
		defer close(w.done)
		ticker := time.NewTicker(w.opts.Interval)
		defer ticker.Stop()

		for {
			// Drain before the first wait so queued jobs run at once.
			if _, err := w.Drain(ctx); err != nil && ctx.Err() == nil && w.opts.OnError != nil {
				w.opts.OnError(err)
			}

			select {
			case <-ticker.C:
			case <-w.stop:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
	return nil
}

// Close stops the worker and waits for the current pass, returning at once if it never started.
func (w *Worker) Close() error {
	w.mu.Lock()
	started := w.started
	if !w.closed {
		w.closed = true
		close(w.stop)
	}
	w.mu.Unlock()

	if !started {
		return nil
	}
	<-w.done
	return nil
}

// Drain runs one batch and counts successes; a failed handler is a retry, and the error is a claim or record failure.
func (w *Worker) Drain(ctx context.Context) (int, error) {
	if w.err != nil {
		return 0, w.err
	}
	jobs, err := w.candidates(ctx)
	if err != nil {
		return 0, err
	}

	done := 0
	var errs []error
	for _, candidate := range jobs {
		if err := ctx.Err(); err != nil {
			return done, errors.Join(append(errs, err)...)
		}
		job, claimed, err := w.claim(ctx, candidate)
		if err != nil {
			return done, errors.Join(append(errs, err)...)
		}
		if !claimed {
			continue
		}
		ok, err := w.run(ctx, job)
		if err != nil {
			errs = append(errs, err)
		}
		if ok {
			done++
		}
	}
	return done, errors.Join(errs...)
}

// run reports whether the job succeeded; the error is a result it could not record.
func (w *Worker) run(ctx context.Context, job Job) (bool, error) {
	handler, ok := w.handlers[job.Kind]
	if !ok {
		// An unhandled kind uses up attempts so it ends as a dead letter.
		return false, w.fail(ctx, job, fmt.Errorf("%w: %q", ErrNoHandler, job.Kind))
	}

	runCtx, cancel := context.WithTimeout(ctx, w.opts.Lease)
	defer cancel()
	err := call(runCtx, handler, job.Payload)
	if err == nil {
		err = runCtx.Err()
	}
	if err != nil {
		return false, w.fail(ctx, job, err)
	}
	err = w.succeed(ctx, job)
	return err == nil, err
}

// call turns a handler's panic into its error, so one bad job is a failed attempt.
func call(ctx context.Context, handler Handler, payload []byte) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("outbox: handler panicked: %v", r)
		}
	}()
	return handler(ctx, payload)
}

func (w *Worker) succeed(ctx context.Context, job Job) error {
	res, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET done_at = ? WHERE id = ? AND next_try_at = ? AND done_at IS NULL`),
		stamp(w.opts.Now()), job.ID, job.lease)
	if err != nil {
		return fmt.Errorf("outbox: mark done %d: %w", job.ID, err)
	}
	return recorded(res, job.ID)
}

func (w *Worker) fail(ctx context.Context, job Job, cause error) error {
	attempts := job.Attempts + 1
	next := w.opts.Now().Add(w.backoff(attempts))

	res, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET attempts = ?, next_try_at = ?, last_error = ?
          WHERE id = ? AND next_try_at = ? AND done_at IS NULL`),
		attempts, stamp(next), cause.Error(), job.ID, job.lease)
	if err != nil {
		return fmt.Errorf("outbox: mark failed %d: %w", job.ID, err)
	}
	return recorded(res, job.ID)
}

// backoff doubles per attempt, capped at MaxDelay.
func (w *Worker) backoff(attempt int) time.Duration {
	delay := time.Duration(float64(w.opts.BaseDelay) * math.Pow(2, float64(attempt-1)))
	if delay > w.opts.MaxDelay || delay <= 0 {
		return w.opts.MaxDelay
	}
	return delay
}

func recorded(res sql.Result, id int64) error {
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("outbox: record %d: %w", id, err)
	}
	if n != 1 {
		return fmt.Errorf("%w: %d", ErrLeaseLost, id)
	}
	return nil
}
