// data/outbox/outbox.go

// Package outbox queues work in the same transaction as the business change.
package outbox

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/smegg99/s99ab/data/db"
)

var (
	ErrNoHandler = errors.New("outbox: no handler for kind")
	ErrKind      = errors.New("outbox: kind is required")
	ErrNotFound  = errors.New("outbox: no such job")
)

// Handler does the work. It must be idempotent: a crash after the work but
// before the row is marked done means it runs again.
type Handler func(ctx context.Context, payload []byte) error

type Options struct {
	// MaxAttempts before a job becomes a dead letter. Zero means 5.
	MaxAttempts int
	// BaseDelay for the first retry. Doubles each attempt, capped by MaxDelay.
	BaseDelay time.Duration
	MaxDelay  time.Duration
	// Interval between polls when the table is empty.
	Interval time.Duration
	// BatchSize claimed per pass.
	BatchSize int
	// Now must stay consistent with the wall clock Enqueue stamps rows with:
	// move it forward only, or nothing is ever due.
	Now func() time.Time
	// Driver selects the placeholder style. Empty means detect it from the pool.
	Driver string
	// Lease is how long a claimed job stays invisible to other workers; it must
	// outlast the slowest handler. Zero means 5 minutes.
	Lease time.Duration
}

func (o *Options) defaults() {
	if o.MaxAttempts <= 0 {
		o.MaxAttempts = 5
	}
	if o.BaseDelay <= 0 {
		o.BaseDelay = time.Second
	}
	if o.MaxDelay <= 0 {
		o.MaxDelay = 10 * time.Minute
	}
	if o.Interval <= 0 {
		o.Interval = 5 * time.Second
	}
	if o.BatchSize <= 0 {
		o.BatchSize = 20
	}
	if o.Lease <= 0 {
		o.Lease = 5 * time.Minute
	}
	if o.Now == nil {
		o.Now = func() time.Time { return time.Now().UTC() }
	}
}

// The table per dialect: SQLite and Postgres spell the auto-increment key and
// byte column differently.
const schemaSQLite = `
CREATE TABLE IF NOT EXISTS outbox (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	kind        TEXT NOT NULL,
	payload     BLOB NOT NULL,
	attempts    INTEGER NOT NULL DEFAULT 0,
	next_try_at TEXT NOT NULL,
	created_at  TEXT NOT NULL,
	done_at     TEXT,
	last_error  TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_claim ON outbox (done_at, next_try_at);
`

const schemaPostgres = `
CREATE TABLE IF NOT EXISTS outbox (
	id          BIGSERIAL PRIMARY KEY,
	kind        TEXT NOT NULL,
	payload     BYTEA NOT NULL,
	attempts    INTEGER NOT NULL DEFAULT 0,
	next_try_at TEXT NOT NULL,
	created_at  TEXT NOT NULL,
	done_at     TEXT,
	last_error  TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_claim ON outbox (done_at, next_try_at);
`

func schemaFor(driver string) string {
	if driver == db.Postgres {
		return schemaPostgres
	}
	return schemaSQLite
}

// Migrate creates the table for the driver detected from the pool. Idempotent
// DDL keeps it out of the app's migration version sequence.
func Migrate(ctx context.Context, conn *sql.DB) error {
	return MigrateWith(ctx, conn, db.Detect(ctx, conn))
}

// MigrateWith is Migrate with a known driver, skipping the probe.
func MigrateWith(ctx context.Context, conn *sql.DB, driver string) error {
	if _, err := conn.ExecContext(ctx, schemaFor(driver)); err != nil {
		return fmt.Errorf("outbox: migrate: %w", err)
	}
	return nil
}

// Tx is the subset Enqueue needs, so it takes either a *sql.Tx or a *sql.DB.
type Tx interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Option adjusts a single Enqueue.
type Option func(*settings)

type settings struct{ driver string }

// For names the transaction's driver so the placeholders match. Required on
// Postgres because a Tx cannot report its driver.
func For(driver string) Option {
	return func(s *settings) { s.driver = driver }
}

// Enqueue records the job. Pass the same transaction as the business change.
func Enqueue(ctx context.Context, tx Tx, kind string, payload []byte, opts ...Option) error {
	if kind == "" {
		return ErrKind
	}
	var s settings
	for _, opt := range opts {
		opt(&s)
	}
	now := time.Now().UTC().Format(time.RFC3339Nano)

	_, err := tx.ExecContext(ctx, db.Rebind(s.driver,
		`INSERT INTO outbox (kind, payload, attempts, next_try_at, created_at)
		 VALUES (?, ?, 0, ?, ?)`),
		kind, payload, now, now)
	if err != nil {
		return fmt.Errorf("outbox: enqueue %s: %w", kind, err)
	}
	return nil
}
