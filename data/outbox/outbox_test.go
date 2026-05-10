// data/outbox/outbox_test.go

package outbox_test

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/smegg99/s99ab/data/db"
	"github.com/smegg99/s99ab/data/outbox"
)

func store(t *testing.T) *sql.DB {
	t.Helper()
	conn := db.TestDB(t, nil)
	if err := outbox.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	return conn
}

// clock is moved by hand so a backoff costs no wall time.
type clock struct{ at time.Time }

func (c *clock) now() time.Time      { return c.at }
func (c *clock) add(d time.Duration) { c.at = c.at.Add(d) }

// newClock starts at now because Enqueue stamps rows from the wall clock.
func newClock() *clock {
	return &clock{at: time.Now().UTC()}
}

func count(t *testing.T, conn *sql.DB, where string, args ...any) int {
	t.Helper()
	var n int
	if err := conn.QueryRow(`SELECT COUNT(*) FROM outbox WHERE `+where, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestEnqueueAndDrain(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	if err := outbox.Enqueue(ctx, conn, "email.send", []byte(`{"to":"a"}`)); err != nil {
		t.Fatal(err)
	}

	var got []byte
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"email.send": func(_ context.Context, payload []byte) error { got = payload; return nil },
	}, outbox.Options{})

	done, err := w.Drain(ctx)
	if err != nil || done != 1 {
		t.Fatalf("drained %d, %v; want 1", done, err)
	}
	if string(got) != `{"to":"a"}` {
		t.Fatalf("payload = %s", got)
	}
	if n := count(t, conn, `done_at IS NOT NULL`); n != 1 {
		t.Fatalf("%d rows marked done, want 1", n)
	}
}

func TestEnqueueRollsBackWithItsTransaction(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := outbox.Enqueue(ctx, tx, "email.send", []byte("x")); err != nil {
		t.Fatal(err)
	}
	if err := tx.Rollback(); err != nil {
		t.Fatal(err)
	}

	if n := count(t, conn, `1=1`); n != 0 {
		t.Fatalf("%d rows survived a rollback, want 0", n)
	}
}

func TestEnqueueCommitsWithItsTransaction(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	tx, _ := conn.BeginTx(ctx, nil)
	if err := outbox.Enqueue(ctx, tx, "email.send", []byte("x")); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	if n := count(t, conn, `1=1`); n != 1 {
		t.Fatalf("%d rows after commit, want 1", n)
	}
}

func TestEnqueueRejectsAnEmptyKind(t *testing.T) {
	if err := outbox.Enqueue(context.Background(), store(t), "", []byte("x")); !errors.Is(err, outbox.ErrKind) {
		t.Fatalf("err = %v, want ErrKind", err)
	}
}

func TestFailureRetriesAfterBackoff(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "flaky", []byte("x"))
	c := newClock()

	calls := 0
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"flaky": func(context.Context, []byte) error {
			calls++
			if calls < 3 {
				return errors.New("not yet")
			}
			return nil
		},
	}, outbox.Options{BaseDelay: time.Second, Now: c.now})

	// Fails, then is not due again immediately.
	_, _ = w.Drain(ctx)
	if calls != 1 {
		t.Fatalf("calls = %d, want 1", calls)
	}
	if done, _ := w.Drain(ctx); done != 0 || calls != 1 {
		t.Fatalf("ran again before its backoff elapsed (calls=%d)", calls)
	}

	c.add(2 * time.Second)
	_, _ = w.Drain(ctx)
	if calls != 2 {
		t.Fatalf("calls = %d, want 2 after the backoff", calls)
	}

	c.add(10 * time.Second)
	if done, _ := w.Drain(ctx); done != 1 {
		t.Fatalf("third attempt did not succeed")
	}
	if n := count(t, conn, `done_at IS NOT NULL`); n != 1 {
		t.Fatal("a succeeded job was not marked done")
	}
}

func TestBackoffGrows(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "always", []byte("x"))
	c := newClock()
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"always": func(context.Context, []byte) error { return errors.New("nope") },
	}, outbox.Options{BaseDelay: time.Second, MaxDelay: time.Hour, Now: c.now})

	_, _ = w.Drain(ctx) // attempt 1, next in ~1s
	c.add(time.Second)
	_, _ = w.Drain(ctx) // attempt 2, next in ~2s

	// One second later it is not due, because the second wait is longer.
	c.add(time.Second)
	if done, _ := w.Drain(ctx); done != 0 {
		t.Fatal("ran before the doubled backoff elapsed")
	}
	if n := count(t, conn, `attempts = 2`); n != 1 {
		t.Fatalf("attempts = not 2 after two failures")
	}
}

// Past MaxAttempts a job stops being claimed and stays in the table.
func TestExhaustedJobBecomesADeadLetter(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "always", []byte("x"))
	c := newClock()
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"always": func(context.Context, []byte) error { return errors.New("still broken") },
	}, outbox.Options{MaxAttempts: 3, BaseDelay: time.Second, Now: c.now})

	for range 5 {
		_, _ = w.Drain(ctx)
		c.add(time.Hour)
	}

	dead, err := outbox.DeadLetters(ctx, conn, 3)
	if err != nil {
		t.Fatal(err)
	}
	if len(dead) != 1 {
		t.Fatalf("%d dead letters, want 1", len(dead))
	}
	if dead[0].Attempts != 3 {
		t.Fatalf("attempts = %d, want it to stop at 3", dead[0].Attempts)
	}
	if dead[0].LastError == "" {
		t.Fatal("a dead letter with no recorded error is undiagnosable")
	}
	if n := count(t, conn, `1=1`); n != 1 {
		t.Fatal("the dead letter was deleted")
	}
}

func TestRetryRevivesADeadLetter(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "flaky", []byte("x"))
	c := newClock()
	fail := true
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"flaky": func(context.Context, []byte) error {
			if fail {
				return errors.New("broken")
			}
			return nil
		},
	}, outbox.Options{MaxAttempts: 2, BaseDelay: time.Second, Now: c.now})

	for range 3 {
		_, _ = w.Drain(ctx)
		c.add(time.Hour)
	}
	dead, _ := outbox.DeadLetters(ctx, conn, 2)
	if len(dead) != 1 {
		t.Fatalf("%d dead letters, want 1", len(dead))
	}

	fail = false
	if err := outbox.Retry(ctx, conn, dead[0].ID); err != nil {
		t.Fatal(err)
	}
	if done, _ := w.Drain(ctx); done != 1 {
		t.Fatal("a retried job did not run")
	}
}

func TestRetryRejectsAnUnknownJob(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	if err := outbox.Retry(ctx, conn, 999); !errors.Is(err, outbox.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}

	_ = outbox.Enqueue(ctx, conn, "once", []byte("x"))
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"once": func(context.Context, []byte) error { return nil },
	}, outbox.Options{})
	_, _ = w.Drain(ctx)

	// Already delivered, so not retryable.
	if err := outbox.Retry(ctx, conn, 1); !errors.Is(err, outbox.ErrNotFound) {
		t.Fatalf("retrying a done job: %v, want ErrNotFound", err)
	}
}

// A kind with no handler must dead-letter, not spin or be marked done.
func TestUnknownKindDeadLettersRatherThanSpinning(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "nobody.handles.this", []byte("x"))
	c := newClock()
	w := outbox.NewWorker(conn, map[string]outbox.Handler{}, outbox.Options{
		MaxAttempts: 2, BaseDelay: time.Second, Now: c.now,
	})

	for range 4 {
		_, _ = w.Drain(ctx)
		c.add(time.Hour)
	}

	dead, _ := outbox.DeadLetters(ctx, conn, 2)
	if len(dead) != 1 {
		t.Fatalf("%d dead letters, want 1", len(dead))
	}
	if n := count(t, conn, `done_at IS NOT NULL`); n != 0 {
		t.Fatal("an unhandled job was marked done")
	}
}
