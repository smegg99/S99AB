// net/sse/client.go

package sse

import (
	"bufio"
	"io"
	"strings"
)

// Decoder reads text/event-stream frames for a Go client; it mirrors WriteEvent.
type Decoder struct {
	sc     *bufio.Scanner
	lastID string
}

// maxLine bounds one line so a malformed endpoint cannot grow the scanner without limit.
const maxLine = 1 << 20

func NewDecoder(r io.Reader) *Decoder {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64<<10), maxLine)
	sc.Split(scanLines)
	return &Decoder{sc: sc}
}

// Decode blocks for the next event, skipping comments, or returns io.EOF; an id carries over as the last id.
func (d *Decoder) Decode() (Event, error) {
	var data strings.Builder
	eventType := ""
	id := d.lastID
	pending := false

	for d.sc.Scan() {
		line := d.sc.Text()

		if line == "" {
			// A blank line dispatches the pending event, if any.
			if !pending {
				continue
			}
			d.lastID = id
			return Event{
				ID:   id,
				Type: eventType,
				Data: strings.TrimSuffix(data.String(), "\n"),
			}, nil
		}

		if strings.HasPrefix(line, ":") {
			continue
		}

		field, value, found := strings.Cut(line, ":")
		if found {
			// The format strips one space after the colon.
			value = strings.TrimPrefix(value, " ")
		}

		switch field {
		case "data":
			data.WriteString(value)
			data.WriteByte('\n')
			pending = true
		case "event":
			eventType = value
			pending = true
		case "id":
			// The spec ignores an id containing NUL.
			if !strings.ContainsRune(value, 0) {
				id = value
			}
			pending = true
		case "retry":
			// Ignored: a Go caller owns its own retry.
		}
	}

	if err := d.sc.Err(); err != nil {
		return Event{}, err
	}
	return Event{}, io.EOF
}

// scanLines splits on CRLF, CR or LF, the three line ends the format allows.
func scanLines(data []byte, atEOF bool) (int, []byte, error) {
	for i, c := range data {
		switch c {
		case '\n':
			return i + 1, data[:i], nil
		case '\r':
			if i+1 < len(data) {
				if data[i+1] == '\n' {
					return i + 2, data[:i], nil
				}
				return i + 1, data[:i], nil
			}
			// A CR at the end of the buffer may be the start of a CRLF.
			if atEOF {
				return i + 1, data[:i], nil
			}
			return 0, nil, nil
		}
	}
	if atEOF && len(data) > 0 {
		return len(data), data, nil
	}
	return 0, nil, nil
}
