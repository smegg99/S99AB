// data/db/version.go

package db

import (
	"context"
	"database/sql"
	"errors"

	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/database"
	"github.com/smegg99/s99ab/v2/data/internal/migratelock"
)

// Goose's Up checks for pending migrations before taking its session lock.
// Initialize its version table under the same lock before that preflight runs.
func initVersion(ctx context.Context, db *sql.DB, dialect database.Dialect, driver string) (err error) {
	store, err := database.NewStore(dialect, goose.DefaultTablename)
	if err != nil {
		return err
	}
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	locker := &migratelock.Locker{Driver: driver}
	if err := locker.SessionLock(ctx, conn); err != nil {
		return err
	}
	defer func() { err = errors.Join(err, locker.SessionUnlock(ctx, conn)) }()
	query := "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?)"
	if driver == Postgres {
		query = "SELECT to_regclass($1) IS NOT NULL"
	}
	var exists bool
	err = conn.QueryRowContext(ctx, query, goose.DefaultTablename).Scan(&exists)
	if err != nil || exists {
		return err
	}
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := store.CreateVersionTable(ctx, tx); err != nil {
		return err
	}
	if err := store.Insert(ctx, tx, database.InsertRequest{Version: 0}); err != nil {
		return err
	}
	return tx.Commit()
}
