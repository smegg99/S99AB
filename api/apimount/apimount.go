// api/apimount/apimount.go

// Package apimount wires an API group's middleware in order and returns route groups.
package apimount

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apihealth"
	"github.com/smegg99/s99ab/auth/kratosauth"
	"github.com/smegg99/s99ab/net/httpmw"
)

const defaultPrefix = "/api/v1"

type Options struct {
	// Prefix is where the versioned group mounts. Zero means /api/v1.
	Prefix string

	// RateLimitPerMinute is the whole group's allowance. Zero disables the limiter.
	RateLimitPerMinute int

	// Health is registered before authentication.
	Health apihealth.Options

	// Kratos resolves a session when the request carries one. Nil leaves
	// Groups.Guarded and Groups.GuardedUploads nil.
	Kratos *kratosauth.Client

	// MaxRequestSize caps a JSON body, MaxUploadSize an upload. Zero means
	// uncapped. The caps cannot nest, so they apply to sibling groups.
	MaxRequestSize int64
	MaxUploadSize  int64

	// TrustedProxies is who may set X-Forwarded-For. Nil means loopback only.
	// Pass an empty non-nil slice to trust nothing and read the peer directly.
	TrustedProxies []string
}

// Groups are the mount points a route file takes.
type Groups struct {
	// Root is the versioned group, with no size cap.
	Root *gin.RouterGroup
	// Sized carries MaxRequestSize. Every JSON route belongs here.
	Sized *gin.RouterGroup
	// Uploads carries MaxUploadSize.
	Uploads *gin.RouterGroup
	// Guarded is Sized plus kratosauth.Require. Nil when Options.Kratos is nil.
	Guarded *gin.RouterGroup
	// GuardedUploads is Uploads plus kratosauth.Require. Nil when Options.Kratos
	// is nil. Uploads alone has no authentication.
	GuardedUploads *gin.RouterGroup
}

// Mount builds the group and returns where routes go. The middleware order
// below matters; each step says why.
func Mount(r *gin.Engine, opts Options) (Groups, error) {
	if opts.Prefix == "" {
		opts.Prefix = defaultPrefix
	}

	// gin trusts every proxy by default, which lets a client spoof ClientIP and
	// evade the limiter. The app must also bind to loopback only.
	if opts.TrustedProxies == nil {
		opts.TrustedProxies = []string{"127.0.0.1", "::1"}
	}
	if err := r.SetTrustedProxies(opts.TrustedProxies); err != nil {
		return Groups{}, fmt.Errorf("apimount: trusted proxies: %w", err)
	}

	// One limiter for the whole group: per-subgroup limiters give each its own allowance.
	root := r.Group(opts.Prefix)
	root.Use(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: opts.RateLimitPerMinute,
		Skip:      apihealth.IsProbe(opts.Prefix),
	}))

	// Before Session, so an unreachable Kratos cannot fail /health.
	apihealth.Register(root, opts.Health)

	// Before any Group(): gin copies the handler chain when a child is made.
	if opts.Kratos != nil {
		root.Use(kratosauth.Session(opts.Kratos))
	}

	// Siblings, not nested: an outer size cap would trip before a larger inner one.
	groups := Groups{
		Root:    root,
		Sized:   root.Group("", httpmw.RequestSize(opts.MaxRequestSize)),
		Uploads: root.Group("", httpmw.RequestSize(opts.MaxUploadSize)),
	}
	if opts.Kratos != nil {
		groups.Guarded = groups.Sized.Group("", kratosauth.Require())
		groups.GuardedUploads = groups.Uploads.Group("", kratosauth.Require())
	}
	return groups, nil
}
