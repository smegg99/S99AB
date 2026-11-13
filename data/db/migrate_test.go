// data/db/migrate_test.go

package db_test

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/v2/data/db"
)

// Two apps in one process (tests, a daemon and its admin tool) migrate at the same time.
func TestConcurrentMigrationsKeepTheirOwnSets(t *testing.T) {
	var wg sync.WaitGroup
	for i := range 4 {
		wg.Go(func() {
			conn, err := db.Open(context.Background(), db.Config{Driver: db.SQLite, DSN: filepath.Join(t.TempDir(), "c.db")})
			if err != nil {
				t.Error(err)
				return
			}
			defer conn.Close()
			table := fmt.Sprintf("t%d", i)
			set := fstest.MapFS{"000001_init.sql": &fstest.MapFile{
				Data: []byte("-- +goose Up\nCREATE TABLE " + table + " (id INTEGER PRIMARY KEY);\n"),
			}}
			if err := db.Migrate(context.Background(), conn, set, db.SQLite); err != nil {
				t.Error(err)
				return
			}
			if _, err := conn.Exec("INSERT INTO " + table + " (id) VALUES (1)"); err != nil {
				t.Errorf("set %d did not run: %v", i, err)
			}
		})
	}
	wg.Wait()
}

func TestSameSQLiteDatabaseSerializesMigrations(t *testing.T) {
	path := filepath.Join(t.TempDir(), "shared.db")
	first, err := db.Open(t.Context(), db.Config{Driver: db.SQLite, DSN: path})
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, err := db.Open(t.Context(), db.Config{Driver: db.SQLite, DSN: path})
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	set := fstest.MapFS{"000001_init.sql": &fstest.MapFile{Data: []byte("-- +goose Up\nCREATE TABLE single (id INTEGER);\n")}}
	done := make(chan error, 2)
	for _, conn := range []*sql.DB{first, second} {
		go func() { done <- db.Migrate(t.Context(), conn, set, db.SQLite) }()
	}
	for range 2 {
		if err := <-done; err != nil {
			t.Fatal(err)
		}
	}
}
