// net/sse/sse_test.go
package sse

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSubscribeReceivesPublishedEvent(t *testing.T) {
	b := NewBroker()
	ch, cancel := b.Subscribe()
	defer cancel()

	b.Publish(Event{Type: "progress", Data: map[string]int{"done": 3}})

	select {
	case ev := <-ch:
		if ev.Type != "progress" {
			t.Fatalf("type = %q, want progress", ev.Type)
		}
	case <-time.After(time.Second):
		t.Fatal("no event delivered within a second")
	}
}

func TestPublishFansOutToEverySubscriber(t *testing.T) {
	b := NewBroker()
	a, ca := b.Subscribe()
	defer ca()
	c, cc := b.Subscribe()
	defer cc()

	if n := b.Count(); n != 2 {
		t.Fatalf("Count = %d, want 2", n)
	}
	b.Publish(Event{Data: "x"})

	for i, ch := range []<-chan Event{a, c} {
		select {
		case <-ch:
		case <-time.After(time.Second):
			t.Fatalf("subscriber %d got nothing", i)
		}
	}
}

func TestPublishDropsForASlowSubscriber(t *testing.T) {
	b := NewBroker(WithBuffer(1))
	slow, cancel := b.Subscribe()
	defer cancel()

	// A blocking Publish would hang here.
	done := make(chan struct{})
	go func() {
		for range 100 {
			b.Publish(Event{Data: "flood"})
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Publish blocked on a slow subscriber")
	}

	// Dropping is per frame; the subscription stays.
	if len(slow) == 0 {
		t.Fatal("the buffered event was lost, not just the overflow")
	}
}

func TestCancelUnsubscribesAndCloses(t *testing.T) {
	b := NewBroker()
	ch, cancel := b.Subscribe()
	cancel()

	if n := b.Count(); n != 0 {
		t.Fatalf("Count after cancel = %d, want 0", n)
	}
	if _, ok := <-ch; ok {
		t.Fatal("channel still open after cancel")
	}
	// A second cancel must not panic on a re-close.
	cancel()
}

func TestCloseEndsSubscriptions(t *testing.T) {
	b := NewBroker()
	ch, cancel := b.Subscribe()
	defer cancel()

	b.Close()
	if _, ok := <-ch; ok {
		t.Fatal("channel still open after Close")
	}

	// Subscribing to a closed broker yields an already-closed channel.
	late, cancelLate := b.Subscribe()
	defer cancelLate()
	if _, ok := <-late; ok {
		t.Fatal("late subscriber channel should be closed")
	}
	// Publishing to a closed broker must not panic.
	b.Publish(Event{Data: "ignored"})
}

func TestWriteEventEncodesStructAsJSON(t *testing.T) {
	var sb strings.Builder
	if _, err := WriteEvent(&sb, Event{
		ID:   "7",
		Type: "progress",
		Data: struct {
			Done int `json:"done"`
		}{Done: 3},
	}); err != nil {
		t.Fatalf("WriteEvent: %v", err)
	}

	got := sb.String()
	for _, want := range []string{"id: 7\n", "event: progress\n", `data: {"done":3}`, "\n\n"} {
		if !strings.Contains(got, want) {
			t.Errorf("frame %q missing %q", got, want)
		}
	}
}

func TestWriteEventSplitsMultilineData(t *testing.T) {
	var sb strings.Builder
	if _, err := WriteEvent(&sb, Event{Data: "line one\nline two"}); err != nil {
		t.Fatalf("WriteEvent: %v", err)
	}
	got := sb.String()
	if !strings.Contains(got, "data: line one\n") || !strings.Contains(got, "data: line two\n") {
		t.Errorf("multiline frame not split into two data lines: %q", got)
	}
}

func TestHandlerStreamsEvents(t *testing.T) {
	b := NewBroker()
	srv := httptest.NewServer(Handler(b, WithHeartbeat(0)))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()

	if ct := resp.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("Content-Type = %q, want text/event-stream", ct)
	}

	// Publishing before the handler subscribes drops the event.
	waitForSubscriber(t, b)
	b.Publish(Event{Type: "tick", Data: map[string]int{"n": 1}})

	sc := bufio.NewScanner(resp.Body)
	if !scanForLine(sc, "event: tick") {
		t.Fatal("did not receive the streamed event line")
	}
	if !scanForLine(sc, `data: {"n":1}`) {
		t.Fatal("did not receive the streamed data line")
	}
}

func TestHandlerUnsubscribesOnDisconnect(t *testing.T) {
	b := NewBroker()
	srv := httptest.NewServer(Handler(b, WithHeartbeat(0)))
	defer srv.Close()

	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	waitForSubscriber(t, b)

	cancel()
	resp.Body.Close()

	deadline := time.After(2 * time.Second)
	for b.Count() != 0 {
		select {
		case <-deadline:
			t.Fatalf("subscriber not released after disconnect, Count = %d", b.Count())
		case <-time.After(10 * time.Millisecond):
		}
	}
}

func waitForSubscriber(t *testing.T, b *Broker) {
	t.Helper()
	deadline := time.After(2 * time.Second)
	for b.Count() == 0 {
		select {
		case <-deadline:
			t.Fatal("no subscriber attached in time")
		case <-time.After(5 * time.Millisecond):
		}
	}
}

func scanForLine(sc *bufio.Scanner, want string) bool {
	for sc.Scan() {
		if sc.Text() == want {
			return true
		}
	}
	return false
}
