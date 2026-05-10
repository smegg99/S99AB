// work/jobs/jobs_test.go

package jobs_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/smegg99/s99ab/work/jobs"
)

// recorder collects runs, since Observe fires from cron's goroutines.
type recorder struct {
	mu   sync.Mutex
	runs []jobs.Run
}

func (r *recorder) observe(run jobs.Run) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.runs = append(r.runs, run)
}

func (r *recorder) all() []jobs.Run {
	r.mu.Lock()
	defer r.mu.Unlock()
	return append([]jobs.Run(nil), r.runs...)
}

func (r *recorder) count(pred func(jobs.Run) bool) int {
	n := 0
	for _, run := range r.all() {
		if pred(run) {
			n++
		}
	}
	return n
}

func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func noop(context.Context) error { return nil }

func TestAddRejectsBadInput(t *testing.T) {
	s := jobs.New(jobs.Options{})

	if err := s.Add("", "@every 1m", noop); !errors.Is(err, jobs.ErrName) {
		t.Fatalf("empty name: %v, want ErrName", err)
	}
	if err := s.Add("ok", "not a schedule", noop); err == nil {
		t.Fatal("a nonsense schedule was accepted")
	}
	if err := s.Add("dup", "@every 1m", noop); err != nil {
		t.Fatal(err)
	}
	if err := s.Add("dup", "@every 1m", noop); !errors.Is(err, jobs.ErrDuplicate) {
		t.Fatalf("duplicate: %v, want ErrDuplicate", err)
	}
}

// A bad spec must not leave a half-registered job behind.
func TestBadSpecRegistersNothing(t *testing.T) {
	s := jobs.New(jobs.Options{})
	_ = s.Add("broken", "* * * *", noop)

	if got := s.Jobs(); len(got) != 0 {
		t.Fatalf("registered %v after a rejected schedule", got)
	}
}

func TestAddAfterStartIsRefused(t *testing.T) {
	s := jobs.New(jobs.Options{})
	s.Start(context.Background())
	defer s.Close()

	if err := s.Add("late", "@every 1m", noop); !errors.Is(err, jobs.ErrRunning) {
		t.Fatalf("err = %v, want ErrRunning", err)
	}
}

func TestJobsListsWhatWasWired(t *testing.T) {
	s := jobs.New(jobs.Options{})
	_ = s.Add("refresh", "@every 5m", noop)
	_ = s.Add("cleanup", "0 3 * * *", noop)

	got := s.Jobs()
	if len(got) != 2 {
		t.Fatalf("%d jobs, want 2", len(got))
	}
	if got[0].Name != "cleanup" || got[0].Spec != "0 3 * * *" {
		t.Fatalf("first = %+v, want cleanup sorted first with its spec", got[0])
	}
}

func TestRunNowReturnsTheJobError(t *testing.T) {
	boom := errors.New("boom")
	var rec recorder

	s := jobs.New(jobs.Options{Observe: rec.observe})
	_ = s.Add("failing", "@every 1h", func(context.Context) error { return boom })

	if err := s.RunNow(context.Background(), "failing"); !errors.Is(err, boom) {
		t.Fatalf("err = %v, want boom", err)
	}

	runs := rec.all()
	if len(runs) != 1 {
		t.Fatalf("%d observed runs, want 1", len(runs))
	}
	if !errors.Is(runs[0].Err, boom) {
		t.Fatalf("observed err = %v", runs[0].Err)
	}
	if runs[0].Started.IsZero() {
		t.Fatal("an observed run with no start time cannot be correlated")
	}
}

func TestRunNowRejectsAnUnknownJob(t *testing.T) {
	s := jobs.New(jobs.Options{})
	if err := s.RunNow(context.Background(), "ghost"); !errors.Is(err, jobs.ErrNoJob) {
		t.Fatalf("err = %v, want ErrNoJob", err)
	}
}

func TestScheduleFires(t *testing.T) {
	var rec recorder
	s := jobs.New(jobs.Options{Observe: rec.observe})
	_ = s.Add("tick", "@every 50ms", noop)

	s.Start(context.Background())
	defer s.Close()

	waitFor(t, "the first scheduled run", func() bool { return len(rec.all()) > 0 })
}

// By default cron fires a job again while the previous run is still going.
func TestOverlappingTickSkips(t *testing.T) {
	var rec recorder
	release := make(chan struct{})
	entered := make(chan struct{}, 1)

	s := jobs.New(jobs.Options{Observe: rec.observe})
	_ = s.Add("slow", "@every 30ms", func(context.Context) error {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-release
		return nil
	})

	s.Start(context.Background())
	defer s.Close()
	// Runs before Close, which waits on the job, so a failed assertion cannot deadlock.
	defer close(release)

	<-entered
	waitFor(t, "a skipped tick", func() bool {
		return rec.count(func(r jobs.Run) bool { return r.Skipped }) > 0
	})

	if n := rec.count(func(r jobs.Run) bool { return !r.Skipped }); n != 0 {
		t.Fatalf("%d runs completed while one was still blocked", n)
	}
}

func TestRunNowWaitsRatherThanSkipping(t *testing.T) {
	var rec recorder
	release := make(chan struct{})
	entered := make(chan struct{})
	calls := make(chan struct{}, 4)

	s := jobs.New(jobs.Options{Observe: rec.observe})
	first := true
	_ = s.Add("slow", "@every 1h", func(context.Context) error {
		calls <- struct{}{}
		if first {
			first = false
			close(entered)
			<-release
		}
		return nil
	})

	go func() { _ = s.RunNow(context.Background(), "slow") }()
	<-entered

	done := make(chan error, 1)
	go func() { done <- s.RunNow(context.Background(), "slow") }()

	select {
	case <-done:
		t.Fatal("the second RunNow did not wait for the first")
	case <-time.After(50 * time.Millisecond):
	}

	close(release)
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if len(calls) != 2 {
		t.Fatalf("%d calls, want 2", len(calls))
	}
}

func TestCloseCancelsARunningJob(t *testing.T) {
	cancelled := make(chan struct{})
	entered := make(chan struct{}, 1)

	s := jobs.New(jobs.Options{})
	_ = s.Add("long", "@every 20ms", func(ctx context.Context) error {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-ctx.Done()
		close(cancelled)
		return ctx.Err()
	})

	s.Start(context.Background())
	<-entered

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-cancelled:
	default:
		t.Fatal("Close returned while a job was still running")
	}
}

func TestParentCancellationStopsJobs(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	seen := make(chan struct{})
	entered := make(chan struct{}, 1)

	s := jobs.New(jobs.Options{})
	_ = s.Add("long", "@every 20ms", func(jobCtx context.Context) error {
		select {
		case entered <- struct{}{}:
		default:
		}
		<-jobCtx.Done()
		close(seen)
		return nil
	})

	s.Start(ctx)
	defer s.Close()

	<-entered
	cancel()

	select {
	case <-seen:
	case <-time.After(2 * time.Second):
		t.Fatal("cancelling the parent context did not reach the job")
	}
}

func TestStartAndCloseAreIdempotent(t *testing.T) {
	s := jobs.New(jobs.Options{})
	_ = s.Add("tick", "@every 1h", noop)

	ctx := context.Background()
	s.Start(ctx)
	s.Start(ctx)

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("second Close: %v", err)
	}
}
