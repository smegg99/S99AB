// data/outbox/worker_test.go

package outbox_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/smegg99/s99ab/data/outbox"
)

func TestBatchSizeBoundsOnePass(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	for range 5 {
		_ = outbox.Enqueue(ctx, conn, "work", []byte("x"))
	}
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"work": func(context.Context, []byte) error { return nil },
	}, outbox.Options{BatchSize: 2})

	if done, _ := w.Drain(ctx); done != 2 {
		t.Fatalf("first pass did %d, want the batch size of 2", done)
	}
	if n := count(t, conn, `done_at IS NULL`); n != 3 {
		t.Fatalf("%d left, want 3", n)
	}
}

func TestSucceededJobIsNotClaimedAgain(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	_ = outbox.Enqueue(ctx, conn, "once", []byte("x"))
	calls := 0
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"once": func(context.Context, []byte) error { calls++; return nil },
	}, outbox.Options{})

	_, _ = w.Drain(ctx)
	_, _ = w.Drain(ctx)

	if calls != 1 {
		t.Fatalf("handler ran %d times, want 1", calls)
	}
}

func TestMigrateIsRepeatable(t *testing.T) {
	conn := store(t)
	if err := outbox.Migrate(context.Background(), conn); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

func TestWorkerStartsAndStops(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	_ = outbox.Enqueue(ctx, conn, "work", []byte("x"))
	ran := make(chan struct{}, 1)

	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"work": func(context.Context, []byte) error {
			select {
			case ran <- struct{}{}:
			default:
			}
			return nil
		},
	}, outbox.Options{Interval: 10 * time.Millisecond})

	w.Start(ctx)
	select {
	case <-ran:
	case <-time.After(2 * time.Second):
		t.Fatal("the worker never ran a queued job")
	}

	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	// Close is idempotent.
	if err := w.Close(); err != nil {
		t.Fatalf("second Close: %v", err)
	}
}

func TestCloseWithoutStartDoesNotBlock(t *testing.T) {
	w := outbox.NewWorker(store(t), map[string]outbox.Handler{}, outbox.Options{})

	done := make(chan error, 1)
	go func() { done <- w.Close() }()

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Close blocked on a worker that was never started")
	}
}

func TestSecondStartIsIgnored(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "work", []byte("x"))

	var mu sync.Mutex
	calls := 0

	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"work": func(context.Context, []byte) error {
			mu.Lock()
			defer mu.Unlock()
			calls++
			return nil
		},
	}, outbox.Options{Interval: 10 * time.Millisecond})

	w.Start(ctx)
	w.Start(ctx)
	defer w.Close()

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := calls
		mu.Unlock()
		if n > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}

	mu.Lock()
	defer mu.Unlock()
	if calls != 1 {
		t.Fatalf("handler ran %d times, want 1", calls)
	}
}

func TestAJobIsClaimedByOneWorkerOnly(t *testing.T) {
	conn := store(t)
	ctx := context.Background()

	_ = outbox.Enqueue(ctx, conn, "once", []byte("x"))

	var mu sync.Mutex
	runs := 0
	// Held open until both workers are inside, so timing cannot hide a duplicate.
	inside := make(chan struct{}, 2)
	release := make(chan struct{})
	handlers := map[string]outbox.Handler{
		"once": func(context.Context, []byte) error {
			mu.Lock()
			runs++
			mu.Unlock()
			inside <- struct{}{}
			<-release
			return nil
		},
	}

	var wg sync.WaitGroup
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _ = outbox.NewWorker(conn, handlers, outbox.Options{}).Drain(ctx)
		}()
	}

	// Whichever workers got in, let them finish.
	time.Sleep(150 * time.Millisecond)
	close(release)
	wg.Wait()

	mu.Lock()
	got := runs
	mu.Unlock()
	if got != 1 {
		t.Fatalf("the job ran %d times, want exactly 1", got)
	}
}
