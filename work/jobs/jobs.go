// work/jobs/jobs.go

// Package jobs runs in-process cron jobs without overlap. Use outbox for durable work.
package jobs

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
)

var (
	ErrName      = errors.New("jobs: name is required")
	ErrDuplicate = errors.New("jobs: name is already registered")
	ErrNoJob     = errors.New("jobs: no such job")
	ErrRunning   = errors.New("jobs: scheduler already started")
	ErrClosed    = errors.New("jobs: scheduler is closed")
)

// Func is one job's work.
type Func func(ctx context.Context) error

// Run is what happened, handed to Options.Observe.
type Run struct {
	Name    string
	Started time.Time
	Took    time.Duration
	Err     error
	// Skipped is true when the previous run of this job was still going.
	Skipped bool
}

type Options struct {
	// Observe sees every run, including skips.
	Observe func(Run)
	// Location for schedule strings. Nil means UTC.
	Location *time.Location
}

type entry struct {
	name string
	spec string
	fn   Func
	mu   sync.Mutex // held for a whole run
}

type Scheduler struct {
	cron    *cron.Cron
	opts    Options
	mu      sync.Mutex
	entries map[string]*entry
	started bool
	closed  bool
	ctx     context.Context
	cancel  context.CancelFunc
}

func New(opts Options) *Scheduler {
	if opts.Location == nil {
		opts.Location = time.UTC
	}
	return &Scheduler{
		cron:    cron.New(cron.WithLocation(opts.Location)),
		opts:    opts,
		entries: map[string]*entry{},
	}
}

// Add registers a job. Take the spec from config.
func (s *Scheduler) Add(name, spec string, fn Func) error {
	if name == "" {
		return ErrName
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.started {
		return ErrRunning
	}
	if _, ok := s.entries[name]; ok {
		return fmt.Errorf("%w: %q", ErrDuplicate, name)
	}

	e := &entry{name: name, spec: spec, fn: fn}
	if _, err := s.cron.AddFunc(spec, func() { s.tick(e) }); err != nil {
		return fmt.Errorf("jobs: %q schedule %q: %w", name, spec, err)
	}
	s.entries[name] = e
	return nil
}

// Registered is a job as wired up.
type Registered struct {
	Name string `json:"name"`
	Spec string `json:"spec"`
}

// Jobs lists what is registered, sorted by name.
func (s *Scheduler) Jobs() []Registered {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := make([]Registered, 0, len(s.entries))
	for _, e := range s.entries {
		out = append(out, Registered{Name: e.name, Spec: e.spec})
	}
	slices.SortFunc(out, func(a, b Registered) int { return strings.Compare(a.Name, b.Name) })
	return out
}

// Start begins ticking; a second call does nothing, a call after Close is ErrClosed, and ctx stops every job.
func (s *Scheduler) Start(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return ErrClosed
	}
	if s.started {
		return nil
	}
	s.started = true
	s.ctx, s.cancel = context.WithCancel(ctx)
	s.cron.Start()
	return nil
}

// Close stops the schedule, cancels the running jobs' context and waits for them.
func (s *Scheduler) Close() error {
	s.mu.Lock()
	cancel := s.cancel
	s.closed = true
	s.mu.Unlock()

	stopped := s.cron.Stop()
	if cancel != nil {
		cancel()
	}
	<-stopped.Done()
	return nil
}

// RunNow runs a job now and waits; it never overlaps a scheduled run.
func (s *Scheduler) RunNow(ctx context.Context, name string) error {
	s.mu.Lock()
	e, ok := s.entries[name]
	s.mu.Unlock()

	if !ok {
		return fmt.Errorf("%w: %q", ErrNoJob, name)
	}
	return s.call(ctx, e)
}

// tick skips when the previous run is still going.
func (s *Scheduler) tick(e *entry) {
	if !e.mu.TryLock() {
		s.observe(Run{Name: e.name, Skipped: true})
		return
	}
	defer e.mu.Unlock()

	s.mu.Lock()
	ctx := s.ctx
	s.mu.Unlock()
	if ctx == nil {
		ctx = context.Background()
	}

	s.exec(ctx, e)
}

// call waits for the previous run instead of skipping.
func (s *Scheduler) call(ctx context.Context, e *entry) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return s.exec(ctx, e)
}

func (s *Scheduler) exec(ctx context.Context, e *entry) (err error) {
	started := time.Now()

	func() {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("jobs: %q panicked: %v", e.name, r)
			}
		}()
		err = e.fn(ctx)
	}()

	s.observe(Run{Name: e.name, Started: started, Took: time.Since(started), Err: err})
	return err
}

func (s *Scheduler) observe(r Run) {
	if s.opts.Observe != nil {
		s.opts.Observe(r)
	}
}
