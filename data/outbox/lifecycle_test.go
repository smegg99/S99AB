// data/outbox/lifecycle_test.go

package outbox_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/smegg99/s99ab/v2/data/outbox"
)

func TestStartAfterCloseIsRefused(t *testing.T) {
	w := outbox.NewWorker(store(t), nil, outbox.Options{})
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := w.Start(context.Background()); !errors.Is(err, outbox.ErrClosed) {
		t.Fatalf("Start after Close = %v, want ErrClosed", err)
	}
}

func TestAFailedPassIsReported(t *testing.T) {
	conn := store(t)
	reported := make(chan error, 1)
	w := outbox.NewWorker(conn, nil, outbox.Options{
		Interval: time.Hour,
		OnError: func(err error) {
			select {
			case reported <- err:
			default:
			}
		},
	})
	_ = conn.Close()

	if err := w.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	defer w.Close()
	select {
	case err := <-reported:
		if err == nil {
			t.Fatal("reported a nil error")
		}
	case <-time.After(5 * time.Second):
		t.Fatal("a pass that could not claim was never reported")
	}
}

func TestAPanickingHandlerIsAFailedAttempt(t *testing.T) {
	conn := store(t)
	ctx := context.Background()
	_ = outbox.Enqueue(ctx, conn, "boom", []byte("x"))
	w := outbox.NewWorker(conn, map[string]outbox.Handler{
		"boom": func(context.Context, []byte) error { panic("handler bug") },
	}, outbox.Options{})

	if _, err := w.Drain(ctx); err != nil {
		t.Fatal(err)
	}
	if n := count(t, conn, `attempts = 1 AND last_error LIKE '%handler bug%'`); n != 1 {
		t.Fatalf("%d rows record the panic, want 1", n)
	}
}
