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

	"github.com/smegg99/s99ab/data/db"
)

type Job struct {
	ID        int64
	Kind      string
	Payload   []byte
	Attempts  int
	LastError string
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
	jobs, err := w.claim(ctx)
	if err != nil {
		return 0, err
	}

	done := 0
	var errs []error
	for _, job := range jobs {
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

// claim takes due jobs with an optimistic update that leases next_try_at, since SQLite has no SKIP LOCKED.
func (w *Worker) claim(ctx context.Context) ([]Job, error) {
	now := w.opts.Now()
	due := stamp(now)
	lease := stamp(now.Add(w.opts.Lease))

	rows, err := w.db.QueryContext(ctx, w.sql(
		`SELECT id, kind, payload, attempts, COALESCE(last_error, ''), next_try_at
		   FROM outbox
		  WHERE done_at IS NULL AND attempts < ? AND next_try_at <= ?
		  ORDER BY id
		  LIMIT ?`),
		w.opts.MaxAttempts, due, w.opts.BatchSize)
	if err != nil {
		return nil, fmt.Errorf("outbox: claim: %w", err)
	}

	type candidate struct {
		job  Job
		seen string
	}
	var found []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.job.ID, &c.job.Kind, &c.job.Payload, &c.job.Attempts, &c.job.LastError, &c.seen); err != nil {
			rows.Close()
			return nil, fmt.Errorf("outbox: scan: %w", err)
		}
		found = append(found, c)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	// Closed before the updates: SQLite will not write while a read cursor is
	// open over the same table.
	if err := rows.Close(); err != nil {
		return nil, fmt.Errorf("outbox: claim: %w", err)
	}

	var jobs []Job
	for _, c := range found {
		res, err := w.db.ExecContext(ctx, w.sql(
			`UPDATE outbox SET next_try_at = ?
			  WHERE id = ? AND next_try_at = ? AND done_at IS NULL`),
			lease, c.job.ID, c.seen)
		if err != nil {
			return nil, fmt.Errorf("outbox: claim %d: %w", c.job.ID, err)
		}
		// A driver that cannot count rows must not count as claimed.
		n, err := res.RowsAffected()
		if err != nil {
			return nil, fmt.Errorf("outbox: claim %d: %w", c.job.ID, err)
		}
		if n == 1 {
			jobs = append(jobs, c.job)
		}
	}
	return jobs, nil
}

// run reports whether the job succeeded; the error is a result it could not record.
func (w *Worker) run(ctx context.Context, job Job) (bool, error) {
	handler, ok := w.handlers[job.Kind]
	if !ok {
		// An unhandled kind uses up attempts so it ends as a dead letter.
		return false, w.fail(ctx, job, fmt.Errorf("%w: %q", ErrNoHandler, job.Kind))
	}

	if err := call(ctx, handler, job.Payload); err != nil {
		return false, w.fail(ctx, job, err)
	}
	return true, w.succeed(ctx, job)
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
	_, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET done_at = ? WHERE id = ?`),
		stamp(w.opts.Now()), job.ID)
	if err != nil {
		return fmt.Errorf("outbox: mark done %d: %w", job.ID, err)
	}
	return nil
}

func (w *Worker) fail(ctx context.Context, job Job, cause error) error {
	attempts := job.Attempts + 1
	next := w.opts.Now().Add(w.backoff(attempts))

	_, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET attempts = ?, next_try_at = ?, last_error = ? WHERE id = ?`),
		attempts, stamp(next), cause.Error(), job.ID)
	if err != nil {
		return fmt.Errorf("outbox: mark failed %d: %w", job.ID, err)
	}
	return nil
}

// backoff doubles per attempt, capped at MaxDelay.
func (w *Worker) backoff(attempt int) time.Duration {
	delay := time.Duration(float64(w.opts.BaseDelay) * math.Pow(2, float64(attempt-1)))
	if delay > w.opts.MaxDelay || delay <= 0 {
		return w.opts.MaxDelay
	}
	return delay
}

// DeadLetters lists jobs that exhausted their attempts. They stay in the table.
func DeadLetters(ctx context.Context, conn *sql.DB, maxAttempts int) ([]Job, error) {
	if maxAttempts <= 0 {
		maxAttempts = 5
	}

	driver, err := db.Detect(conn)
	if err != nil {
		return nil, fmt.Errorf("outbox: dead letters: %w", err)
	}
	rows, err := conn.QueryContext(ctx, db.Rebind(driver,
		`SELECT id, kind, payload, attempts, COALESCE(last_error, '')
		   FROM outbox
		  WHERE done_at IS NULL AND attempts >= ?
		  ORDER BY id`), maxAttempts)
	if err != nil {
		return nil, fmt.Errorf("outbox: dead letters: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		var job Job
		if err := rows.Scan(&job.ID, &job.Kind, &job.Payload, &job.Attempts, &job.LastError); err != nil {
			return nil, fmt.Errorf("outbox: scan: %w", err)
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

// Retry puts a dead letter back in the queue. An unknown id is an error.
func Retry(ctx context.Context, conn *sql.DB, id int64) error {
	driver, err := db.Detect(conn)
	if err != nil {
		return fmt.Errorf("outbox: retry %d: %w", id, err)
	}
	res, err := conn.ExecContext(ctx, db.Rebind(driver,
		`UPDATE outbox SET attempts = 0, next_try_at = ?, last_error = NULL
		  WHERE id = ? AND done_at IS NULL`),
		stamp(time.Now()), id)
	if err != nil {
		return fmt.Errorf("outbox: retry %d: %w", id, err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return fmt.Errorf("%w: %d", ErrNotFound, id)
	}
	return nil
}
