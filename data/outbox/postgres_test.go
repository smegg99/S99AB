// data/outbox/postgres_test.go

package outbox_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/smegg99/s99ab/data/db"
	"github.com/smegg99/s99ab/data/outbox"
)

// TestQueueOnPostgres covers the schema and placeholders SQLite accepts and
// Postgres rejects. Set S99AB_TEST_PG_DSN to run it.
func TestQueueOnPostgres(t *testing.T) {
	dsn := os.Getenv("S99AB_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("S99AB_TEST_PG_DSN not set")
	}

	ctx := context.Background()
	conn, err := db.Open(db.Config{Driver: db.Postgres, DSN: dsn})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer conn.Close()

	if _, err := conn.ExecContext(ctx, `DROP TABLE IF EXISTS outbox`); err != nil {
		t.Fatalf("drop: %v", err)
	}

	// The driver is detected, not passed.
	if err := outbox.Migrate(ctx, conn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if got := db.Detect(ctx, conn); got != db.Postgres {
		t.Fatalf("Detect = %q, want postgres", got)
	}

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	if err := outbox.Enqueue(ctx, tx, "mail.send", []byte(`{"id":"1"}`),
		outbox.For(db.Postgres)); err != nil {
		t.Fatalf("enqueue: %v", err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	var seen []byte
	worker := outbox.NewWorker(conn, map[string]outbox.Handler{
		"mail.send": func(_ context.Context, payload []byte) error {
			seen = payload
			return nil
		},
	}, outbox.Options{MaxAttempts: 3, Driver: db.Postgres})

	done, err := worker.Drain(ctx)
	if err != nil {
		t.Fatalf("drain: %v", err)
	}
	if done != 1 {
		t.Fatalf("drained %d, want 1", done)
	}
	if string(seen) != `{"id":"1"}` {
		t.Fatalf("payload = %q", seen)
	}

	// The failure UPDATE has the most placeholders in the package.
	if _, err := conn.ExecContext(ctx, `DELETE FROM outbox`); err != nil {
		t.Fatalf("clear: %v", err)
	}
	tx, _ = conn.BeginTx(ctx, nil)
	_ = outbox.Enqueue(ctx, tx, "mail.send", []byte(`{}`), outbox.For(db.Postgres))
	_ = tx.Commit()

	failing := outbox.NewWorker(conn, map[string]outbox.Handler{
		"mail.send": func(context.Context, []byte) error { return context.DeadlineExceeded },
	}, outbox.Options{MaxAttempts: 3, Driver: db.Postgres, BaseDelay: time.Millisecond})
	if _, err := failing.Drain(ctx); err != nil {
		t.Fatalf("drain failing: %v", err)
	}

	var attempts int
	if err := conn.QueryRowContext(ctx,
		`SELECT attempts FROM outbox LIMIT 1`).Scan(&attempts); err != nil {
		t.Fatalf("read attempts: %v", err)
	}
	if attempts != 1 {
		t.Fatalf("attempts = %d, want 1", attempts)
	}
}
