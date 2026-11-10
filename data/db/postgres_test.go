// data/db/postgres_test.go

package db_test

import (
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/data/db"
	"github.com/smegg99/s99ab/data/internal/testservice"
	"github.com/smegg99/s99ab/data/outbox"
)

func TestPostgresConcurrentSchemaStartup(t *testing.T) {
	conn := testservice.Postgres(t)
	set := fstest.MapFS{"000001_init.sql": &fstest.MapFile{Data: []byte("-- +goose Up\nSELECT pg_sleep(0.05);\nCREATE TABLE startup_once(id INTEGER);\n")}}
	for range 2 {
		done := make(chan error, 4)
		for range 4 {
			go func() {
				if err := outbox.Migrate(t.Context(), conn); err != nil {
					done <- err
					return
				}
				done <- db.Migrate(t.Context(), conn, set, db.Postgres)
			}()
		}
		for range 4 {
			if err := <-done; err != nil {
				t.Fatal(err)
			}
		}
	}
}
