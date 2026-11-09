// data/internal/migratelock/lock.go

// Package migratelock serializes schema changes across processes sharing a database.
package migratelock

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/gofrs/flock"
	"github.com/pressly/goose/v3/lock"
)

// In-memory SQLite databases have no file; serialize their migrations within the process.
var memory = make(chan struct{}, 1)

type Locker struct {
	Driver   string
	file     *flock.Flock
	inMemory bool
}

func (l *Locker) SessionLock(ctx context.Context, conn *sql.Conn) error {
	if l.Driver == "postgres" {
		_, err := conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", lock.DefaultLockID)
		return err
	}
	var path string
	if err := conn.QueryRowContext(ctx, "SELECT file FROM pragma_database_list WHERE name = 'main'").Scan(&path); err != nil {
		return err
	}
	if path == "" {
		select {
		case memory <- struct{}{}:
			l.inMemory = true
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	path, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	l.file = flock.New(path+".migrate.lock", flock.SetPermissions(0o600))
	ok, err := l.file.TryLockContext(ctx, 20*time.Millisecond)
	if err != nil || !ok {
		err = errors.Join(err, l.file.Close())
		l.file = nil
		if err == nil {
			err = ctx.Err()
		}
		return err
	}
	return nil
}

func (l *Locker) SessionUnlock(ctx context.Context, conn *sql.Conn) error {
	if l.Driver == "postgres" {
		// Unlock even after migration cancellation, without returning a locked connection to the pool.
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		var unlocked bool
		err := conn.QueryRowContext(cleanup, "SELECT pg_advisory_unlock($1)", lock.DefaultLockID).Scan(&unlocked)
		if err != nil || !unlocked {
			_ = conn.Raw(func(any) error { return driver.ErrBadConn })
			return errors.Join(err, fmt.Errorf("db: migration lock was not released"))
		}
		return nil
	}
	if l.inMemory {
		<-memory
		l.inMemory = false
	}
	if l.file != nil {
		err := l.file.Close()
		l.file = nil
		return err
	}
	return nil
}
