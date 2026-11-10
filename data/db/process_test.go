// data/db/process_test.go

package db_test

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/data/db"
	"github.com/smegg99/s99ab/data/internal/testservice"
	"github.com/smegg99/s99ab/data/outbox"
)

func TestMigrationsAcrossProcesses(t *testing.T) {
	for _, driver := range []string{db.SQLite, db.Postgres} {
		t.Run(driver, func(t *testing.T) {
			dsn := filepath.Join(t.TempDir(), "shared.db")
			if driver == db.Postgres {
				dsn = testservice.PostgresDSN(t)
			}
			conn, err := db.Open(t.Context(), db.Config{Driver: driver, DSN: dsn})
			if err != nil {
				t.Fatal(err)
			}
			conn.Close()
			binary, err := os.Executable()
			if err != nil {
				t.Fatal(err)
			}
			for range 2 { // Fresh schema, then already-applied migrations.
				var commands []*exec.Cmd
				var logs []*bytes.Buffer
				for range 2 {
					cmd := exec.CommandContext(t.Context(), binary, "-test.run=^TestMigrationProcess$", "-test.timeout=20s")
					cmd.Env = append(os.Environ(), "S99AB_MIGRATE_DSN="+dsn, "S99AB_MIGRATE_DRIVER="+driver)
					log := new(bytes.Buffer)
					cmd.Stdout, cmd.Stderr = log, log
					if err := cmd.Start(); err != nil {
						t.Fatal(err)
					}
					commands, logs = append(commands, cmd), append(logs, log)
				}
				for i, cmd := range commands {
					if err := cmd.Wait(); err != nil {
						t.Errorf("migration process: %v\n%s", err, logs[i])
					}
				}
			}
		})
	}
}

func TestMigrationProcess(t *testing.T) {
	dsn := os.Getenv("S99AB_MIGRATE_DSN")
	if dsn == "" {
		t.Skip("child of TestMigrationsAcrossProcesses")
	}
	driver := os.Getenv("S99AB_MIGRATE_DRIVER")
	conn, err := db.Open(t.Context(), db.Config{Driver: driver, DSN: dsn, MaxOpenConns: 1})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	set := fstest.MapFS{"000001_init.sql": &fstest.MapFile{Data: []byte("-- +goose Up\nCREATE TABLE process_once(id INTEGER);\n")}}
	if err := outbox.Migrate(t.Context(), conn); err != nil {
		t.Fatal(err)
	}
	if err := db.Migrate(t.Context(), conn, set, driver); err != nil {
		t.Fatal(err)
	}
}
