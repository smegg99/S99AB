// data/outbox/worker.go

package outbox

import (
	"context"
	"database/sql"
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

	mu      sync.Mutex
	started bool
}

func NewWorker(conn *sql.DB, handlers map[string]Handler, opts Options) *Worker {
	opts.defaults()
	if opts.Driver == "" {
		opts.Driver = db.Detect(context.Background(), conn)
	}
	return &Worker{
		db:       conn,
		handlers: handlers,
		opts:     opts,
		stop:     make(chan struct{}),
		done:     make(chan struct{}),
	}
}

// sql rewrites a statement for the worker's driver.
func (w *Worker) sql(query string) string { return db.Rebind(w.opts.Driver, query) }

// Start polls until Close. It returns immediately; a second call does nothing.
func (w *Worker) Start(ctx context.Context) {
	w.mu.Lock()
	if w.started {
		w.mu.Unlock()
		return
	}
	w.started = true
	w.mu.Unlock()

	go func() {
		defer close(w.done)
		ticker := time.NewTicker(w.opts.Interval)
		defer ticker.Stop()

		for {
			// Drain before the first wait so queued jobs run at once.
			_, _ = w.Drain(ctx)

			select {
			case <-ticker.C:
			case <-w.stop:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

// Close stops the worker and waits for the current pass. It returns at once
// for a worker that was never started.
func (w *Worker) Close() error {
	w.mu.Lock()
	started := w.started
	w.mu.Unlock()

	select {
	case <-w.stop:
	default:
		close(w.stop)
	}

	if !started {
		return nil
	}
	<-w.done
	return nil
}

// Drain processes one batch and reports how many succeeded.
func (w *Worker) Drain(ctx context.Context) (int, error) {
	jobs, err := w.claim(ctx)
	if err != nil {
		return 0, err
	}

	done := 0
	for _, job := range jobs {
		if err := w.run(ctx, job); err != nil {
			continue
		}
		done++
	}
	return done, nil
}

// claim returns the due jobs this worker won, via an optimistic update that
// pushes next_try_at a lease ahead (SQLite has no SKIP LOCKED).
func (w *Worker) claim(ctx context.Context) ([]Job, error) {
	now := w.opts.Now()
	due := now.Format(time.RFC3339Nano)
	lease := now.Add(w.opts.Lease).Format(time.RFC3339Nano)

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

func (w *Worker) run(ctx context.Context, job Job) error {
	handler, ok := w.handlers[job.Kind]
	if !ok {
		// An unhandled kind uses up attempts so it ends as a dead letter.
		return w.fail(ctx, job, fmt.Errorf("%w: %q", ErrNoHandler, job.Kind))
	}

	if err := handler(ctx, job.Payload); err != nil {
		return w.fail(ctx, job, err)
	}
	return w.succeed(ctx, job)
}

func (w *Worker) succeed(ctx context.Context, job Job) error {
	_, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET done_at = ? WHERE id = ?`),
		w.opts.Now().Format(time.RFC3339Nano), job.ID)
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
		attempts, next.Format(time.RFC3339Nano), cause.Error(), job.ID)
	if err != nil {
		return fmt.Errorf("outbox: mark failed %d: %w", job.ID, err)
	}
	return cause
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

	rows, err := conn.QueryContext(ctx, db.Rebind(db.Detect(ctx, conn),
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
	res, err := conn.ExecContext(ctx, db.Rebind(db.Detect(ctx, conn),
		`UPDATE outbox SET attempts = 0, next_try_at = ?, last_error = NULL
		  WHERE id = ? AND done_at IS NULL`),
		time.Now().UTC().Format(time.RFC3339Nano), id)
	if err != nil {
		return fmt.Errorf("outbox: retry %d: %w", id, err)
	}
	if n, err := res.RowsAffected(); err == nil && n == 0 {
		return fmt.Errorf("%w: %d", ErrNotFound, id)
	}
	return nil
}
