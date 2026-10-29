// net/sse/handler.go

package sse

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// heartbeat keeps idle proxies from closing the stream.
const heartbeat = 20 * time.Second

// Handler streams b's events until the client disconnects or b closes. The opening
// comment fires onopen at once; X-Accel-Buffering: no stops proxy buffering.
func Handler(b *Broker) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		flusher, ok := w.(http.Flusher)
		if !ok {
			// Without Flush nothing reaches the client until the handler returns.
			http.Error(w, "sse: streaming unsupported", http.StatusInternalServerError)
			return
		}

		h := w.Header()
		h.Set("Content-Type", "text/event-stream")
		h.Set("Cache-Control", "no-cache")
		h.Set("Connection", "keep-alive")
		h.Set("X-Accel-Buffering", "no")
		w.WriteHeader(http.StatusOK)

		if _, err := io.WriteString(w, ":ok\n\n"); err != nil {
			return
		}
		flusher.Flush()

		events, cancel := b.Subscribe()
		defer cancel()

		ticker := time.NewTicker(heartbeat)
		defer ticker.Stop()
		beat := ticker.C

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case ev, ok := <-events:
				if !ok {
					return
				}
				// A bad event is skipped; only a failed write means the client is gone.
				if _, err := WriteEvent(w, ev); errors.Is(err, ErrField) || errors.Is(err, ErrEncode) {
					continue
				} else if err != nil {
					return
				}
				flusher.Flush()
			case <-beat:
				if _, err := io.WriteString(w, ":\n\n"); err != nil {
					return
				}
				flusher.Flush()
			}
		}
	})
}

var (
	// ErrField refuses an id or event type with a line break, which would end the field and start a forged one.
	ErrField = errors.New("sse: line break in id or event type")
	// ErrEncode is data that could not be encoded as JSON.
	ErrEncode = errors.New("sse: cannot encode data")
)

// WriteEvent writes one text/event-stream event, one `data:` line per payload line.
func WriteEvent(w io.Writer, ev Event) (int, error) {
	if bytes.ContainsAny([]byte(ev.ID+ev.Type), "\r\n") {
		return 0, ErrField
	}
	var buf bytes.Buffer
	if ev.ID != "" {
		buf.WriteString("id: ")
		buf.WriteString(ev.ID)
		buf.WriteByte('\n')
	}
	if ev.Type != "" {
		buf.WriteString("event: ")
		buf.WriteString(ev.Type)
		buf.WriteByte('\n')
	}

	payload, err := encode(ev.Data)
	if err != nil {
		return 0, fmt.Errorf("%w: %w", ErrEncode, err)
	}
	// A data-less event is still a valid keep-alive frame.
	if payload == nil {
		buf.WriteString("data\n")
	} else {
		payload = bytes.ReplaceAll(bytes.ReplaceAll(payload, []byte("\r\n"), []byte("\n")), []byte("\r"), []byte("\n"))
		for _, line := range bytes.Split(payload, []byte{'\n'}) {
			buf.WriteString("data: ")
			buf.Write(line)
			buf.WriteByte('\n')
		}
	}
	buf.WriteByte('\n')

	return w.Write(buf.Bytes())
}

// encode writes []byte, json.RawMessage and string as-is and JSON-encodes the rest.
func encode(data any) ([]byte, error) {
	switch d := data.(type) {
	case nil:
		return nil, nil
	case json.RawMessage:
		return d, nil
	case []byte:
		return d, nil
	case string:
		return []byte(d), nil
	default:
		return json.Marshal(d)
	}
}
