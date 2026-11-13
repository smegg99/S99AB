// data/db/rebind_test.go

package db_test

import (
	"testing"

	"github.com/smegg99/s99ab/v2/data/db"
)

func TestRebind(t *testing.T) {
	cases := []struct{ name, in, want string }{
		{"placeholders", `SELECT * FROM t WHERE a = ? AND b = ?`, `SELECT * FROM t WHERE a = $1 AND b = $2`},
		{"string literal", `SELECT '?' , ?`, `SELECT '?' , $1`},
		{"escaped quote", `SELECT 'it''s ?', ?`, `SELECT 'it''s ?', $1`},
		{"quoted identifier", `SELECT "odd?name" FROM t WHERE a = ?`, `SELECT "odd?name" FROM t WHERE a = $1`},
		{"line comment", "SELECT a -- why?\nFROM t WHERE a = ?", "SELECT a -- why?\nFROM t WHERE a = $1"},
		{"block comment", `SELECT /* a? b? */ a FROM t WHERE a = ?`, `SELECT /* a? b? */ a FROM t WHERE a = $1`},
		{"string concatenation", `SELECT * FROM t WHERE a LIKE '%'||?||'%' AND b = ?`, `SELECT * FROM t WHERE a LIKE '%'||$1||'%' AND b = $2`},
		{"jsonb any and all keys", `SELECT * FROM t WHERE tags ?| ? AND tags ?& ?`, `SELECT * FROM t WHERE tags ?| $1 AND tags ?& $2`},
	}
	for _, c := range cases {
		if got := db.Rebind(db.Postgres, c.in); got != c.want {
			t.Errorf("%s: Rebind = %q, want %q", c.name, got, c.want)
		}
	}
	if got := db.Rebind(db.SQLite, cases[0].in); got != cases[0].in {
		t.Errorf("sqlite query changed: %q", got)
	}
}
