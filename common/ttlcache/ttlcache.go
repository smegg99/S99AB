// common/ttlcache/ttlcache.go

// Package ttlcache holds one value behind a TTL; concurrent misses share one fetch.
package ttlcache

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// Cached is one value refreshed by fetch when stale. Use New; the zero value is unusable.
type Cached[T any] struct {
	ttl   time.Duration
	fetch func(context.Context) (T, error)

	group singleflight.Group

	mu     sync.Mutex
	value  T
	at     time.Time
	loaded bool
}

// New returns a cache that refetches once the value is older than ttl. A zero
// ttl refetches on every Get.
func New[T any](ttl time.Duration, fetch func(context.Context) (T, error)) *Cached[T] {
	return &Cached[T]{ttl: ttl, fetch: fetch}
}

// Get returns the value, refreshing it when stale. A failed refresh returns the
// last good value with no error, if there is one.
func (c *Cached[T]) Get(ctx context.Context) (T, error) {
	if v, ok := c.fresh(); ok {
		return v, nil
	}

	// The fetch is shared, so it drops the starting caller's cancellation but keeps its values.
	shared := context.WithoutCancel(ctx)

	v, err, _ := c.group.Do("", func() (any, error) {
		// A racing caller may have refreshed while this one waited.
		if v, ok := c.fresh(); ok {
			return v, nil
		}
		v, err := c.fetch(shared)
		if err != nil {
			return nil, err
		}
		c.put(v)
		return v, nil
	})
	if err != nil {
		if stale, ok := c.last(); ok {
			return stale, nil
		}
		var zero T
		return zero, err
	}

	return v.(T), nil
}

func (c *Cached[T]) fresh() (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.loaded || time.Since(c.at) >= c.ttl {
		var zero T
		return zero, false
	}
	return c.value, true
}

func (c *Cached[T]) last() (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if !c.loaded {
		var zero T
		return zero, false
	}
	return c.value, true
}

func (c *Cached[T]) put(v T) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.value = v
	c.at = time.Now()
	c.loaded = true
}
