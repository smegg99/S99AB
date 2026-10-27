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

// Rebind converts `?` placeholders to the driver's own form, skipping quoted
// string literals.
func Rebind(driver, query string) string {
	if driver != Postgres {
		return query
	}

	var b strings.Builder
	b.Grow(len(query) + 8)

	n := 0
	inString := false
	for i := 0; i < len(query); i++ {
		c := query[i]
		switch {
		case c == '\'':
			// '' inside a string is an escaped quote, not the end of one.
			if inString && i+1 < len(query) && query[i+1] == '\'' {
				b.WriteString("''")
				i++
				continue
			}
			inString = !inString
			b.WriteByte(c)
		case c == '?' && !inString:
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
