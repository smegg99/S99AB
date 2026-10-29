// net/sse/client_test.go

package sse

import (
	"io"
	"strings"
	"testing"
)

func TestDecodeNamedEvent(t *testing.T) {
	d := NewDecoder(strings.NewReader("id: 7\nevent: progress\ndata: {\"done\":3}\n\n"))

	ev, err := d.Decode()
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if ev.ID != "7" || ev.Type != "progress" {
		t.Fatalf("got id=%q type=%q, want 7/progress", ev.ID, ev.Type)
	}

	var body struct {
		Done int `json:"done"`
	}
	if err := ev.Unmarshal(&body); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if body.Done != 3 {
		t.Errorf("done = %d, want 3", body.Done)
	}
}

func TestDecodeSkipsCommentsAndHeartbeats(t *testing.T) {
	d := NewDecoder(strings.NewReader(":ok\n\n:\n\nevent: tick\ndata: 1\n\n"))

	ev, err := d.Decode()
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if ev.Type != "tick" {
		t.Fatalf("type = %q, want tick (comments should have been skipped)", ev.Type)
	}
}

func TestDecodeJoinsMultilineData(t *testing.T) {
	d := NewDecoder(strings.NewReader("data: line one\ndata: line two\n\n"))

	ev, err := d.Decode()
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if got, ok := ev.Data.(string); !ok || got != "line one\nline two" {
		t.Errorf("data = %q, want the two lines joined", ev.Data)
	}
}

func TestDecodeCarriesLastID(t *testing.T) {
	d := NewDecoder(strings.NewReader("id: 42\ndata: a\n\ndata: b\n\n"))

	first, _ := d.Decode()
	second, err := d.Decode()
	if err != nil {
		t.Fatalf("second Decode: %v", err)
	}
	if first.ID != "42" || second.ID != "42" {
		t.Errorf("ids = %q, %q, want both 42", first.ID, second.ID)
	}
}

func TestDecodeEOF(t *testing.T) {
	d := NewDecoder(strings.NewReader("data: only\n\n"))
	if _, err := d.Decode(); err != nil {
		t.Fatalf("first Decode: %v", err)
	}
	if _, err := d.Decode(); err != io.EOF {
		t.Errorf("second Decode err = %v, want io.EOF", err)
	}
}

func TestWriteEventDecodeRoundTrip(t *testing.T) {
	type progress struct {
		Done  int `json:"done"`
		Total int `json:"total"`
	}
	want := progress{Done: 4, Total: 10}

	var buf strings.Builder
	if _, err := WriteEvent(&buf, Event{ID: "1", Type: "progress", Data: want}); err != nil {
		t.Fatalf("WriteEvent: %v", err)
	}

	ev, err := NewDecoder(strings.NewReader(buf.String())).Decode()
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	if ev.Type != "progress" || ev.ID != "1" {
		t.Fatalf("got id=%q type=%q, want 1/progress", ev.ID, ev.Type)
	}
	var got progress
	if err := ev.Unmarshal(&got); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if got != want {
		t.Errorf("round-trip = %+v, want %+v", got, want)
	}
}
