// data/db/rebind.go

package db

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/stdlib"
	"modernc.org/sqlite"
)

// Rebind converts `?` placeholders to the driver's own form. It skips string literals, quoted
// identifiers, comments and the jsonb ?| and ?& operators; write jsonb's bare ? as jsonb_exists().
func Rebind(driver, query string) string {
	if driver != Postgres {
		return query
	}

	var b strings.Builder
	b.Grow(len(query) + 8)

	n := 0
	for i := 0; i < len(query); i++ {
		c := query[i]
		switch {
		case c == '\'' || c == '"':
			// A doubled quote inside is an escaped one, not the end.
			j := i + 1
			for j < len(query) {
				if query[j] == c {
					if j+1 < len(query) && query[j+1] == c {
						j += 2
						continue
					}
					break
				}
				j++
			}
			end := min(j+1, len(query))
			b.WriteString(query[i:end])
			i = end - 1
		case c == '-' && strings.HasPrefix(query[i:], "--"):
			end := strings.IndexByte(query[i:], '\n')
			if end < 0 {
				end = len(query) - i
			}
			b.WriteString(query[i : i+end])
			i += end - 1
		case c == '/' && strings.HasPrefix(query[i:], "/*"):
			end := strings.Index(query[i+2:], "*/")
			if end < 0 {
				end = len(query) - i - 2
			} else {
				end += 2
			}
			b.WriteString(query[i : i+2+end])
			i += 2 + end - 1
		case c == '?' && i+1 < len(query) && (query[i+1] == '|' || query[i+1] == '&'):
			b.WriteString(query[i : i+2])
			i++
		case c == '?':
			n++
			b.WriteByte('$')
			b.WriteString(strconv.Itoa(n))
		default:
			b.WriteByte(c)
		}
	}
	return b.String()
}

// Placeholders builds an `(?, ?, ?)` list for an IN clause of n values.
func Placeholders(n int) string {
	if n <= 0 {
		return "()"
	}
	return "(" + strings.Repeat("?, ", n-1) + "?)"
}

// Detect names the driver behind an open pool from its type, without a query.
func Detect(conn *sql.DB) (string, error) {
	switch d := conn.Driver().(type) {
	case *stdlib.Driver:
		return Postgres, nil
	case *sqlite.Driver:
		return SQLite, nil
	default:
		return "", fmt.Errorf("%w: %T", ErrDriver, d)
	}
}
