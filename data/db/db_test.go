// data/db/db_test.go

package db_test

import (
	"context"
	"embed"
	"errors"
	"io/fs"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/v2/data/db"
)

//go:embed testdata/migrations/*.sql
var migrationsRoot embed.FS

func migrations(t *testing.T) fs.FS {
	t.Helper()
	sub, err := fs.Sub(migrationsRoot, "testdata/migrations")
	if err != nil {
		t.Fatal(err)
	}
	return sub
}

// Without foreign_keys SQLite accepts the constraint and ignores it.
func TestForeignKeysAreEnforced(t *testing.T) {
	conn := db.TestDB(t, migrations(t))

	_, err := conn.Exec(`INSERT INTO child (id, parent_id) VALUES (1, 999)`)
	if err == nil {
		t.Fatal("insert with a missing parent succeeded; foreign_keys is off")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "foreign key") {
		t.Fatalf("err = %v, want a foreign key violation", err)
	}
}

func TestWALIsOn(t *testing.T) {
	conn := db.TestDB(t, nil)

	var mode string
	if err := conn.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil {
		t.Fatal(err)
	}
	if !strings.EqualFold(mode, "wal") {
		t.Fatalf("journal_mode = %q, want wal", mode)
	}
}

func TestMigrateIsRepeatable(t *testing.T) {
	conn := db.TestDB(t, migrations(t))

	if err := db.Migrate(context.Background(), conn, migrations(t), db.SQLite); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	if _, err := conn.Exec(`INSERT INTO parent (id) VALUES (1)`); err != nil {
		t.Fatalf("schema missing after repeat migrate: %v", err)
	}
}

// A later Migrate runs only its own set, never an earlier caller's.
func TestMigrateDoesNotLeakBaseFS(t *testing.T) {
	_ = db.TestDB(t, migrations(t))

	second, err := db.Open(context.Background(), db.Config{Driver: db.SQLite, DSN: filepath.Join(t.TempDir(), "b.db")})
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()

	other := fstest.MapFS{
		"000001_other.sql": &fstest.MapFile{
			Data: []byte("-- +goose Up\nCREATE TABLE other (id INTEGER PRIMARY KEY);\n"),
		},
	}
	if err := db.Migrate(context.Background(), second, other, db.SQLite); err != nil {
		t.Fatalf("migrate with a different fs: %v", err)
	}

	if _, err := second.Exec(`INSERT INTO other (id) VALUES (1)`); err != nil {
		t.Fatalf("the requested migration did not run: %v", err)
	}
	if _, err := second.Exec(`INSERT INTO parent (id) VALUES (1)`); err == nil {
		t.Fatal("the previous caller's migrations leaked into this database")
	}
}

// An empty FS usually means a wrong embed path.
func TestEmptyMigrationsIsAnError(t *testing.T) {
	conn := db.TestDB(t, nil)

	if err := db.Migrate(context.Background(), conn, fstest.MapFS{}, db.SQLite); err == nil {
		t.Fatal("empty migration set was accepted; a wrong //go:embed path would pass")
	}
}

func TestUnsupportedDriverIsRejected(t *testing.T) {
	if _, err := db.Open(context.Background(), db.Config{Driver: "mysql", DSN: "x"}); !errors.Is(err, db.ErrDriver) {
		t.Fatalf("err = %v, want ErrDriver", err)
	}
	if err := db.Verify("mysql"); !errors.Is(err, db.ErrDriver) {
		t.Fatalf("Verify = %v, want ErrDriver", err)
	}
	if err := db.Verify(db.Postgres); err != nil {
		t.Fatalf("Verify(postgres) = %v, want nil", err)
	}
}

func TestOpenCreatesParentDir(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "deeper", "app.db")

	conn, err := db.Open(context.Background(), db.Config{Driver: db.SQLite, DSN: path})
	if err != nil {
		t.Fatalf("open in a missing dir: %v", err)
	}
	conn.Close()
}

func TestOpenPreservesAnExistingQueryString(t *testing.T) {
	dsn := "file:" + filepath.Join(t.TempDir(), "nested", "a.db") + "?mode=rwc"

	conn, err := db.Open(context.Background(), db.Config{Driver: db.SQLite, DSN: dsn})
	if err != nil {
		t.Fatalf("open with an existing query string: %v", err)
	}
	defer conn.Close()

	var fk int
	if err := conn.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil {
		t.Fatal(err)
	}
	if fk != 1 {
		t.Fatalf("foreign_keys = %d, want 1 - the managed pragmas were lost", fk)
	}
}

func TestCallerCannotOverrideAManagedPragma(t *testing.T) {
	dsn := filepath.Join(t.TempDir(), "b.db") + "?_pragma=foreign_keys(0)"

	conn, err := db.Open(context.Background(), db.Config{Driver: db.SQLite, DSN: dsn})
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	defer conn.Close()

	var fk int
	if err := conn.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil {
		t.Fatal(err)
	}
	if fk != 1 {
		t.Fatalf("foreign_keys = %d, want 1 - a caller disabled a managed pragma", fk)
	}
}
