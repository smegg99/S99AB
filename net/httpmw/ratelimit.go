// net/httpmw/ratelimit.go

// Package httpmw holds shared gin middleware.
package httpmw

import (
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apierr"
)

type RateLimitOptions struct {
	// PerMinute is the sustained rate. Zero disables the middleware.
	PerMinute int

	// Burst is how many requests may arrive at once. Zero means PerMinute.
	Burst int

	// Key identifies a client, default c.ClientIP(). Without SetTrustedProxies a
	// spoofed X-Forwarded-For evades the limit; behind a loopback proxy, trust only loopback.
	Key func(*gin.Context) string

	// Skip exempts a request, such as a health probe.
	Skip func(*gin.Context) bool

	// MaxKeys bounds the number of tracked clients. Zero means 10000.
	MaxKeys int

	Now func() time.Time
}

func (o *RateLimitOptions) defaults() {
	if o.Burst <= 0 {
		o.Burst = o.PerMinute
	}
	if o.Key == nil {
		o.Key = func(c *gin.Context) string { return c.ClientIP() }
	}
	if o.MaxKeys <= 0 {
		o.MaxKeys = 10000
	}
	if o.Now == nil {
		o.Now = time.Now
	}
}

func RateLimitWith(opts RateLimitOptions) gin.HandlerFunc {
	opts.defaults()

	// An unset rate disables the limiter.
	if opts.PerMinute <= 0 {
		return func(c *gin.Context) { c.Next() }
	}

	l := newLimiter(opts)

	return func(c *gin.Context) {
		if opts.Skip != nil && opts.Skip(c) {
			c.Next()
			return
		}

		ok, retryAfter := l.allow(opts.Key(c))
		if !ok {
			c.Header("Retry-After", strconv.Itoa(int(retryAfter.Seconds()+0.999)))
			apierr.Respond(c, apierr.New(apierr.RateLimited, "error.rateLimited"))
			c.Abort()
			return
		}
		c.Next()
	}
}

// bucket is a token bucket refilled lazily, so an idle key needs no goroutine.
type bucket struct {
	tokens float64
	last   time.Time
}

type limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	opts    RateLimitOptions
	rate    float64 // tokens per second
}

func newLimiter(opts RateLimitOptions) *limiter {
	return &limiter{
		buckets: map[string]*bucket{},
		opts:    opts,
		rate:    float64(opts.PerMinute) / 60,
	}
}

// allow spends a token, reporting how long until the next one if empty.
func (l *limiter) allow(key string) (bool, time.Duration) {
	now := l.opts.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		l.evictIfFull(now)
		b = &bucket{tokens: float64(l.opts.Burst), last: now}
		l.buckets[key] = b
	}

	b.tokens += now.Sub(b.last).Seconds() * l.rate
	if b.tokens > float64(l.opts.Burst) {
		b.tokens = float64(l.opts.Burst)
	}
	b.last = now

	if b.tokens < 1 {
		wait := time.Duration((1 - b.tokens) / l.rate * float64(time.Second))
		return false, wait
	}
	b.tokens--
	return true, 0
}

// evictIfFull drops fully refilled buckets first, since they equal a new one.
func (l *limiter) evictIfFull(now time.Time) {
	if len(l.buckets) < l.opts.MaxKeys {
		return
	}

	full := float64(l.opts.Burst)
	for key, b := range l.buckets {
		if b.tokens+now.Sub(b.last).Seconds()*l.rate >= full {
			delete(l.buckets, key)
		}
	}

	// All buckets are in use: drop one anyway, giving that client a fresh allowance.
	if len(l.buckets) >= l.opts.MaxKeys {
		for key := range l.buckets {
			delete(l.buckets, key)
			break
		}
	}
}
