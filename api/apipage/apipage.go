// api/apipage/apipage.go

// Package apipage parses the parameters in contracts/parameters/pagination.yaml.
package apipage

import (
	"math"
	"strconv"

	"github.com/gin-gonic/gin"
)

// Defaults from the contract.
const (
	defaultLimit = 25
	maxLimit     = 200
)

// Query is one clamped page request. Sort is raw and must go through Order.
type Query struct {
	Page   int // 1-indexed, never below 1
	Limit  int // between 1 and the endpoint's cap
	Sort   string
	Search string
}

// Offset is the row to start at. It saturates at math.MaxInt because Page is
// uncapped and an overflowed negative OFFSET is a database error.
func (q Query) Offset() int {
	if q.Page <= 1 || q.Limit <= 0 {
		return 0
	}
	if rows := q.Page - 1; rows <= math.MaxInt/q.Limit {
		return rows * q.Limit
	}
	return math.MaxInt
}

type Options struct {
	// DefaultLimit is the page size when the client asks for none. Zero means 25.
	DefaultLimit int
	// MaxLimit caps what a client may ask for. Zero means 200.
	MaxLimit int
}

// Parse reads and clamps the four parameters. Invalid values fall back to
// defaults instead of a 422, so stale bookmarks keep working.
func Parse(c *gin.Context, opts Options) Query {
	if opts.DefaultLimit <= 0 {
		opts.DefaultLimit = defaultLimit
	}
	if opts.MaxLimit <= 0 {
		opts.MaxLimit = maxLimit
	}

	limit := intOr(c.Query("limit"), opts.DefaultLimit)
	if limit > opts.MaxLimit {
		limit = opts.MaxLimit
	}

	return Query{
		Page:   intOr(c.Query("page"), 1),
		Limit:  limit,
		Sort:   c.Query("sort"),
		Search: c.Query("q"),
	}
}

// intOr returns fallback for anything that is not a positive number.
func intOr(raw string, fallback int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	return value
}
