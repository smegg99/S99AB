// data/db/migrate_test.go

package db_test

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/data/db"
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
