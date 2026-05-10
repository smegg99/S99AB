// data/db/migrate.go

package db

import (
	"database/sql"
	"fmt"
	"io/fs"

	"github.com/pressly/goose/v3"
)

// Migrate applies ordered .sql files from an embedded FS through goose as a
// library, so no CLI is needed.
func Migrate(conn *sql.DB, fsys fs.FS, driver string) error {
	if err := Verify(driver); err != nil {
		return err
	}

	goose.SetBaseFS(fsys)
	defer goose.SetBaseFS(nil) // package-level state; leaving it set breaks the next caller

	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect(driver); err != nil {
		return fmt.Errorf("db: goose dialect %s: %w", driver, err)
	}
	if err := goose.Up(conn, "."); err != nil {
		return fmt.Errorf("db: migrate: %w", err)
	}
	return nil
}

// MigrateDown rolls back one migration. For local recovery, not deploys.
func MigrateDown(conn *sql.DB, fsys fs.FS, driver string) error {
	if err := Verify(driver); err != nil {
		return err
	}

	goose.SetBaseFS(fsys)
	defer goose.SetBaseFS(nil)

	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect(driver); err != nil {
		return fmt.Errorf("db: goose dialect %s: %w", driver, err)
	}
	if err := goose.Down(conn, "."); err != nil {
		return fmt.Errorf("db: migrate down: %w", err)
	}
	return nil
}
