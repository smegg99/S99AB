// data/db/migrate.go

package db

import (
	"context"
	"database/sql"
	"fmt"
	"io/fs"

	"github.com/pressly/goose/v3"
	"github.com/smegg99/s99ab/data/internal/migratelock"
)

// Migrate applies embedded SQL under a database-scoped migration lock.
func Migrate(ctx context.Context, conn *sql.DB, fsys fs.FS, driver string) error {
	p, err := provider(ctx, conn, fsys, driver)
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
	p, err := provider(ctx, conn, fsys, driver)
	if err != nil {
		return err
	}
	if _, err := p.Down(ctx); err != nil {
		return fmt.Errorf("db: migrate down: %w", err)
	}
	return nil
}

func provider(ctx context.Context, conn *sql.DB, fsys fs.FS, driver string) (*goose.Provider, error) {
	dialect := goose.DialectSQLite3
	switch driver {
	case SQLite:
	case Postgres:
		dialect = goose.DialectPostgres
	default:
		return nil, fmt.Errorf("%w: %q", ErrDriver, driver)
	}
	p, err := goose.NewProvider(dialect, conn, fsys, goose.WithSessionLocker(&migratelock.Locker{Driver: driver}))
	if err != nil {
		return nil, fmt.Errorf("db: migrate: %w", err)
	}
	if err := initVersion(ctx, conn, dialect, driver); err != nil {
		return nil, fmt.Errorf("db: migration version table: %w", err)
	}
	return p, nil
}
