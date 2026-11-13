// data/outbox/letters.go

package outbox

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/smegg99/s99ab/v2/data/db"
)

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
