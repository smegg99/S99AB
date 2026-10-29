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

// Bool returns the query value for key as a bool when valid, else fallback.
func Bool(c *gin.Context, key string, fallback bool) bool {
	if v := c.Query(key); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}
