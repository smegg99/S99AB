// data/outbox/claim.go

package outbox

import (
	"context"
	"fmt"
)

type candidate struct {
	job  Job
	seen string
}

func (w *Worker) candidates(ctx context.Context) ([]candidate, error) {
	rows, err := w.db.QueryContext(ctx, w.sql(
		`SELECT id, kind, payload, attempts, COALESCE(last_error, ''), next_try_at
           FROM outbox
          WHERE done_at IS NULL AND attempts < ? AND next_try_at <= ?
          ORDER BY id LIMIT ?`), w.opts.MaxAttempts, stamp(w.opts.Now()), w.opts.BatchSize)
	if err != nil {
		return nil, fmt.Errorf("outbox: candidates: %w", err)
	}
	defer rows.Close()
	var found []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.job.ID, &c.job.Kind, &c.job.Payload, &c.job.Attempts, &c.job.LastError, &c.seen); err != nil {
			return nil, fmt.Errorf("outbox: scan: %w", err)
		}
		found = append(found, c)
	}
	return found, rows.Err()
}

// Each new lease is later than the due value it replaces, so it also fences result writes.
func (w *Worker) claim(ctx context.Context, c candidate) (Job, bool, error) {
	now := w.opts.Now()
	c.job.lease = stamp(now.Add(w.opts.Lease))
	res, err := w.db.ExecContext(ctx, w.sql(
		`UPDATE outbox SET next_try_at = ?
          WHERE id = ? AND next_try_at = ? AND next_try_at <= ? AND done_at IS NULL AND attempts = ?`),
		c.job.lease, c.job.ID, c.seen, stamp(now), c.job.Attempts)
	if err != nil {
		return Job{}, false, fmt.Errorf("outbox: claim %d: %w", c.job.ID, err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return Job{}, false, fmt.Errorf("outbox: claim %d: %w", c.job.ID, err)
	}
	return c.job, n == 1, nil
}
