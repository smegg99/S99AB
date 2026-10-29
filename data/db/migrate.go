// data/db/migrate.go

package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"

	"github.com/pressly/goose/v3"
)

// Migrate applies the embedded .sql files with a goose provider of its own, so concurrent callers share no state.
func Migrate(ctx context.Context, conn *sql.DB, fsys fs.FS, driver string) error {
	p, err := provider(conn, fsys, driver)
	if err != nil {
		return err
	}
	if _, err := p.Up(ctx); err != nil {
		return fmt.Errorf("db: migrate: %w", err)
	}
	return nil
}

// MigrateDown rolls back one migration. For local recovery, not deploys.
func MigrateDown(ctx context.Context, conn *sql.DB, fsys fs.FS, driver string) error {
	p, err := provider(conn, fsys, driver)
	if err != nil {
		return err
	}
	if _, err := p.Down(ctx); err != nil {
		return fmt.Errorf("db: migrate down: %w", err)
	}
	return nil
}

func provider(conn *sql.DB, fsys fs.FS, driver string) (*goose.Provider, error) {
	dialect := goose.DialectSQLite3
	switch driver {
	case SQLite:
	case Postgres:
		dialect = goose.DialectPostgres
	default:
		return nil, fmt.Errorf("%w: %q", ErrDriver, driver)
	}
	p, err := goose.NewProvider(dialect, conn, fsys)
	if err != nil {
		return nil, fmt.Errorf("db: migrate: %w", err)
	}
	return p, nil
}
