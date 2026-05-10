// net/sse/sse.go

// Package sse fans server events out to EventSource clients over plain net/http.
package sse

import (
	"encoding/json"
	"fmt"
	"sync"
)

// Event is one stream message. Empty Type means "message"; nil Data writes a data-less event.
type Event struct {
	ID   string
	Type string
	Data any
}

// Unmarshal decodes Data as JSON into v; nil Data leaves v untouched.
func (e Event) Unmarshal(v any) error {
	switch d := e.Data.(type) {
	case nil:
		return nil
	case string:
		return json.Unmarshal([]byte(d), v)
	case []byte:
		return json.Unmarshal(d, v)
	case json.RawMessage:
		return json.Unmarshal(d, v)
	default:
		// Round-trip a value so in-process and decoded subscribers behave the same.
		b, err := json.Marshal(d)
		if err != nil {
			return fmt.Errorf("sse: re-encode event data: %w", err)
		}
		return json.Unmarshal(b, v)
	}
}

// Broker fans events out without blocking; a slow subscriber loses frames, so a
// client that must not miss one reads a snapshot first.
type Broker struct {
	// mu guards subs and closed.
	mu     sync.RWMutex
	subs   map[*subscriber]struct{}
	closed bool

	buf int
}

type subscriber struct {
	ch   chan Event
	once sync.Once
}

// close is idempotent so cancel and Broker.Close can both call it.
func (s *subscriber) close() { s.once.Do(func() { close(s.ch) }) }

type Option func(*Broker)

// WithBuffer sets how far a subscriber may fall behind before frames drop. Default 16.
func WithBuffer(n int) Option {
	return func(b *Broker) {
		if n > 0 {
			b.buf = n
		}
	}
}

func NewBroker(opts ...Option) *Broker {
	b := &Broker{subs: map[*subscriber]struct{}{}, buf: 16}
	for _, o := range opts {
		o(b)
	}
	return b
}

// Subscribe returns an event channel and its cancel func. On a closed Broker the
// channel is already closed.
func (b *Broker) Subscribe() (<-chan Event, func()) {
	s := &subscriber{ch: make(chan Event, b.buf)}

	b.mu.Lock()
	if b.closed {
		b.mu.Unlock()
		s.close()
		return s.ch, func() {}
	}
	b.subs[s] = struct{}{}
	b.mu.Unlock()

	return s.ch, func() {
		b.mu.Lock()
		delete(b.subs, s)
		b.mu.Unlock()
		s.close()
	}
}

// Publish skips subscribers with a full buffer. Sending under the read lock cannot
// hit a closed channel, since channels close only after removal under the write lock.
func (b *Broker) Publish(ev Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for s := range b.subs {
		select {
		case s.ch <- ev:
		default:
		}
	}
}

// Close ends every subscription and refuses new ones. Idempotent.
func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	b.closed = true
	for s := range b.subs {
		delete(b.subs, s)
		s.close()
	}
}

// Count is the number of live subscribers.
func (b *Broker) Count() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.subs)
}
