// data/internal/testservice/postgres.go

// Package testservice isolates integration tests from other database contents.
package testservice

import (
	"context"
	"crypto/rand"
	"database/sql"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Postgres(t *testing.T) *sql.DB {
	t.Helper()
	conn, err := sql.Open("pgx", PostgresDSN(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func PostgresDSN(t *testing.T) string {
	t.Helper()
	raw := os.Getenv("S99AB_TEST_PG_DSN")
	if raw == "" {
		if os.Getenv("S99AB_REQUIRE_INTEGRATION") == "1" {
			t.Fatal("S99AB_TEST_PG_DSN is required")
		}
		t.Skip("run just test-services for PostgreSQL coverage")
	}
	admin, err := sql.Open("pgx", raw)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	schema := "s99ab_" + strings.ToLower(rand.Text())
	if _, err := admin.ExecContext(t.Context(), "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := admin.ExecContext(ctx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("clean schema: %v", err)
		}
	})
	endpoint, err := url.Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	query := endpoint.Query()
	query.Set("search_path", schema)
	endpoint.RawQuery = query.Encode()
	return endpoint.String()
}
