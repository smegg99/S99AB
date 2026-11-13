// data/outbox/postgres_test.go

package outbox_test

import (
	"context"
	"testing"
	"time"

	"github.com/smegg99/s99ab/v2/data/db"
	"github.com/smegg99/s99ab/v2/data/internal/testservice"
	"github.com/smegg99/s99ab/v2/data/outbox"
)

// Covers what SQLite accepts and Postgres rejects; set S99AB_TEST_PG_DSN to run it.
func TestQueueOnPostgres(t *testing.T) {
	ctx := t.Context()
	conn := testservice.Postgres(t)

	// The driver is detected, not passed.
	if err := outbox.Migrate(ctx, conn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	if got, _ := db.Detect(conn); got != db.Postgres {
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

func TestPostgresExpiredWorkerCannotChangeNewResult(t *testing.T) {
	conn := testservice.Postgres(t)
	if err := outbox.Migrate(t.Context(), conn); err != nil {
		t.Fatal(err)
	}
	ownership(t, conn)
	staleRetry(t, conn)
}
