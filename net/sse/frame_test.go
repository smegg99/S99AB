// net/sse/frame_test.go

package sse

import (
	"bufio"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWriteEventRefusesALineBreakInAField(t *testing.T) {
	for _, ev := range []Event{
		{ID: "1\ndata: forged", Data: "x"},
		{Type: "tick\r\nevent: other", Data: "x"},
	} {
		var sb strings.Builder
		if _, err := WriteEvent(&sb, ev); !errors.Is(err, ErrField) || sb.Len() != 0 {
			t.Errorf("WriteEvent(%+v) = %v, wrote %q; want ErrField and nothing written", ev, err, sb.String())
		}
	}
}

// A CR in data ends a line for every reader, so it must start a new data line.
func TestWriteEventSplitsDataOnEveryLineEnd(t *testing.T) {
	var sb strings.Builder
	if _, err := WriteEvent(&sb, Event{Data: "a\rb\r\nc"}); err != nil {
		t.Fatal(err)
	}
	if got := sb.String(); got != "data: a\ndata: b\ndata: c\n\n" {
		t.Fatalf("frame = %q", got)
	}
}

// The format allows CRLF, CR and LF line ends.
func TestDecodeReadsEveryLineEnd(t *testing.T) {
	for name, stream := range map[string]string{
		"crlf": "event: tick\r\ndata: 1\r\n\r\n",
		"cr":   "event: tick\rdata: 1\r\r",
	} {
		ev, err := NewDecoder(strings.NewReader(stream)).Decode()
		if err != nil || ev.Type != "tick" || ev.Data != "1" {
			t.Errorf("%s: event %+v, err %v", name, ev, err)
		}
	}
}

// A bad event is that event's problem: the stream, and every other subscriber's, stays open.
func TestHandlerSkipsAnEventItCannotFrame(t *testing.T) {
	b := NewBroker()
	srv := httptest.NewServer(Handler(b))
	defer srv.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	waitForSubscriber(t, b)
	b.Publish(Event{Type: "bad\nevent: forged", Data: "x"})
	b.Publish(Event{Type: "bad", Data: func() {}})
	b.Publish(Event{Type: "tick", Data: "after"})

	if !scanForLine(bufio.NewScanner(resp.Body), "data: after") {
		t.Fatal("the stream ended at the bad event")
	}
}
