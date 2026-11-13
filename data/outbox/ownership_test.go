// data/outbox/ownership_test.go

package outbox_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/smegg99/s99ab/v2/data/db"
	"github.com/smegg99/s99ab/v2/data/outbox"
)

func ownership(t *testing.T, conn *sql.DB) {
	t.Helper()
	for _, staleFails := range []bool{false, true} {
		name := "stale success"
		if staleFails {
			name = "stale failure"
		}
		t.Run(name, func(t *testing.T) {
			ctx := t.Context()
			if _, err := conn.ExecContext(ctx, "DELETE FROM outbox"); err != nil {
				t.Fatal(err)
			}
			if err := outbox.Enqueue(ctx, conn, "work", []byte("x"), outbox.For(driver(t, conn))); err != nil {
				t.Fatal(err)
			}
			base := time.Now().Add(time.Second)
			entered, release := make(chan struct{}), make(chan struct{})
			old := outbox.NewWorker(conn, map[string]outbox.Handler{"work": func(context.Context, []byte) error {
				close(entered)
				<-release
				if staleFails {
					return errors.New("stale")
				}
				return nil
			}}, outbox.Options{Now: func() time.Time { return base }, Lease: time.Second})
			result := make(chan error, 1)
			go func() {
				done, err := old.Drain(ctx)
				if done != 0 {
					err = errors.Join(err, errors.New("counted stale success"))
				}
				result <- err
			}()
			<-entered
			current := outbox.NewWorker(conn, map[string]outbox.Handler{"work": func(context.Context, []byte) error { return nil }},
				outbox.Options{Now: func() time.Time { return base.Add(2 * time.Second) }, Lease: time.Second})
			done, err := current.Drain(ctx)
			close(release)
			if err != nil || done != 1 {
				t.Fatalf("current drain = %d, %v", done, err)
			}
			if err := <-result; !errors.Is(err, outbox.ErrLeaseLost) {
				t.Fatalf("stale result = %v", err)
			}
			if n := count(t, conn, "done_at IS NOT NULL AND attempts = 0 AND last_error IS NULL"); n != 1 {
				t.Fatalf("stale worker changed the completed row: %d", n)
			}
		})
	}
}

func TestExpiredWorkerCannotChangeNewResult(t *testing.T) { ownership(t, store(t)) }

func staleRetry(t *testing.T, conn *sql.DB) {
	t.Helper()
	if err := outbox.Enqueue(t.Context(), conn, "retry", []byte("x"), outbox.For(driver(t, conn))); err != nil {
		t.Fatal(err)
	}
	base := time.Now().Add(time.Second)
	entered, release := make(chan struct{}), make(chan struct{})
	old := outbox.NewWorker(conn, map[string]outbox.Handler{"retry": func(context.Context, []byte) error {
		close(entered)
		<-release
		return errors.New("stale")
	}}, outbox.Options{Now: func() time.Time { return base }, Lease: time.Second})
	result := make(chan error, 1)
	go func() { _, err := old.Drain(t.Context()); result <- err }()
	<-entered
	for attempt := 1; attempt <= 2; attempt++ {
		current := outbox.NewWorker(conn, map[string]outbox.Handler{"retry": func(context.Context, []byte) error {
			return errors.New("current")
		}}, outbox.Options{Now: func() time.Time { return base.Add(time.Duration(attempt) * time.Hour) }})
		if _, err := current.Drain(t.Context()); err != nil {
			close(release)
			t.Fatal(err)
		}
	}
	close(release)
	if err := <-result; !errors.Is(err, outbox.ErrLeaseLost) {
		t.Fatalf("stale result = %v", err)
	}
	if n := count(t, conn, "kind = 'retry' AND attempts = 2 AND last_error = 'current' AND done_at IS NULL"); n != 1 {
		t.Fatalf("stale failure rolled back current retry bookkeeping: %d", n)
	}
}

func TestExpiredFailureCannotRollBackRetries(t *testing.T) { staleRetry(t, store(t)) }

func TestHandlerReceivesLeaseDeadline(t *testing.T) {
	conn := store(t)
	if err := outbox.Enqueue(t.Context(), conn, "slow", []byte("x")); err != nil {
		t.Fatal(err)
	}
	worker := outbox.NewWorker(conn, map[string]outbox.Handler{"slow": func(ctx context.Context, _ []byte) error {
		if _, ok := ctx.Deadline(); !ok {
			t.Fatal("handler has no lease deadline")
		}
		<-ctx.Done()
		return nil
	}}, outbox.Options{Lease: 10 * time.Millisecond})
	if done, err := worker.Drain(t.Context()); done != 0 || err != nil {
		t.Fatalf("expired handler = %d, %v", done, err)
	}
	if n := count(t, conn, "attempts = 1 AND last_error = 'context deadline exceeded' AND done_at IS NULL"); n != 1 {
		t.Fatalf("expired attempt was not retried: %d", n)
	}
}

func TestWaitingBatchJobsRemainAvailable(t *testing.T) {
	conn := store(t)
	for _, kind := range []string{"first", "second"} {
		if err := outbox.Enqueue(t.Context(), conn, kind, []byte("x")); err != nil {
			t.Fatal(err)
		}
	}
	entered, release := make(chan struct{}), make(chan struct{})
	old := outbox.NewWorker(conn, map[string]outbox.Handler{
		"first":  func(context.Context, []byte) error { close(entered); <-release; return nil },
		"second": func(context.Context, []byte) error { t.Error("waiting job was already handled"); return nil },
	}, outbox.Options{BatchSize: 2})
	result := make(chan error, 1)
	go func() { _, err := old.Drain(t.Context()); result <- err }()
	<-entered
	current := outbox.NewWorker(conn, map[string]outbox.Handler{"second": func(context.Context, []byte) error { return nil }}, outbox.Options{})
	done, err := current.Drain(t.Context())
	close(release)
	if done != 1 || err != nil {
		t.Fatalf("waiting job was leased before execution: %d, %v", done, err)
	}
	if err := <-result; err != nil {
		t.Fatal(err)
	}
}

func driver(t *testing.T, conn *sql.DB) string {
	t.Helper()
	value, err := db.Detect(conn)
	if err != nil {
		t.Fatal(err)
	}
	return value
}
