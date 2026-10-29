// data/db/db.go

// Package db opens and migrates SQLite and Postgres as *sql.DB.
package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

const (
	SQLite   = "sqlite"
	Postgres = "postgres"
)

var ErrDriver = fmt.Errorf("db: unsupported driver")

type Config struct {
	Driver string // SQLite or Postgres
	DSN    string // file path for SQLite, connection URL for Postgres

	// Pool limits. Zero keeps the driver default, except MaxOpenConns on
	// Postgres, which defaults to 25.
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// Open connects and, on SQLite, forces WAL, foreign_keys and busy_timeout.
func Open(ctx context.Context, cfg Config) (*sql.DB, error) {
	var (
		conn *sql.DB
		err  error
	)

	switch cfg.Driver {
	case SQLite:
		if dir := filepath.Dir(sqlitePath(cfg.DSN)); dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0o755); err != nil {
				return nil, fmt.Errorf("db: create %s: %w", dir, err)
			}
		}
		conn, err = sql.Open("sqlite", sqliteDSN(cfg.DSN))

	case Postgres:
		conn, err = sql.Open("pgx", cfg.DSN)

	default:
		return nil, fmt.Errorf("%w: %q", ErrDriver, cfg.Driver)
	}
	if err != nil {
		return nil, fmt.Errorf("db: open %s: %w", cfg.Driver, err)
	}

	applyPool(conn, cfg)

	if err := conn.PingContext(ctx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("db: ping %s: %w", cfg.Driver, err)
	}
	return conn, nil
}

func applyPool(conn *sql.DB, cfg Config) {
	if cfg.MaxIdleConns > 0 {
		conn.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime > 0 {
		conn.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}

	switch {
	case cfg.MaxOpenConns > 0:
		conn.SetMaxOpenConns(cfg.MaxOpenConns)
	case cfg.Driver == Postgres:
		conn.SetMaxOpenConns(25)
	}
	// SQLite stays unlimited: WAL and busy_timeout handle contention, and a cap
	// of 1 would serialise reads.
}

// sqlitePath strips the file: prefix and query from a DSN.
func sqlitePath(raw string) string {
	path, _, _ := strings.Cut(raw, "?")
	return strings.TrimPrefix(path, "file:")
}

// managed are the pragmas this package owns; a caller cannot override them.
var managed = []string{
	"journal_mode(WAL)",
	"foreign_keys(1)",
	"busy_timeout(5000)",
	"synchronous(NORMAL)",
}

// sqliteDSN merges the managed pragmas into the query by hand, since url.Values escapes and reorders them.
func sqliteDSN(raw string) string {
	base, query, hasQuery := strings.Cut(raw, "?")

	kept := make([]string, 0, 4)
	if hasQuery {
		for _, param := range strings.Split(query, "&") {
			if param == "" {
				continue
			}
			// Drop a caller pragma that names a managed one.
			if value, ok := strings.CutPrefix(param, "_pragma="); ok && isManaged(value) {
				continue
			}
			kept = append(kept, param)
		}
	}

	for _, pragma := range managed {
		kept = append(kept, "_pragma="+pragma)
	}
	return base + "?" + strings.Join(kept, "&")
}

func isManaged(value string) bool {
	name, _, _ := strings.Cut(value, "(")
	for _, pragma := range managed {
		if managedName, _, _ := strings.Cut(pragma, "("); managedName == name {
			return true
		}
	}
	return false
}

// Verify reports whether this package handles the driver.
func Verify(driver string) error {
	switch driver {
	case SQLite, Postgres:
		return nil
	default:
		return fmt.Errorf("%w: %q", ErrDriver, driver)
	}
}
