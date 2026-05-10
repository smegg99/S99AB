// api/apiquery/apiquery.go

// Package apiquery reads a scalar parameter from the query, falling back to the body value.
package apiquery

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

// String returns the query value for key when non-empty, else fallback.
// WebKitGTK's wails:// handler drops POST/PATCH bodies, so webviews use the query.
func String(c *gin.Context, key, fallback string) string {
	if v := c.Query(key); v != "" {
		return v
	}
	return fallback
}

// Int returns the query value for key as an int when valid, else fallback.
func Int(c *gin.Context, key string, fallback int) int {
	if v := c.Query(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// Int64 is Int for int64 fields.
func Int64(c *gin.Context, key string, fallback int64) int64 {
	if v := c.Query(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}

// Bool returns the query value for key as a bool when valid, else fallback.
func Bool(c *gin.Context, key string, fallback bool) bool {
	if v := c.Query(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
