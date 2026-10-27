// data/db/testdb.go

package db

import (
	"database/sql"
	"io/fs"
	"path/filepath"
	"testing"
)

// TestDB returns a migrated SQLite database in the test's temp directory. On
// disk because :memory: gives each pooled connection its own database.
func TestDB(t *testing.T, migrations fs.FS) *sql.DB {
	t.Helper()

	conn, err := Open(t.Context(), Config{
		Driver: SQLite,
		DSN:    filepath.Join(t.TempDir(), "test.db"),
	})
	if err != nil {
		t.Fatalf("test db: %v", err)
	}
	t.Cleanup(func() { conn.Close() })

	if migrations != nil {
		if err := Migrate(t.Context(), conn, migrations, SQLite); err != nil {
			t.Fatalf("test db migrate: %v", err)
		}
	}
	return conn
}
