// auth/kratosgin/kratosgin.go

// Package kratosgin mounts kratosauth on a Gin router, keeping Gin out of kratosauth.
package kratosgin

import (
	"errors"

	"github.com/gin-gonic/gin"

	"github.com/smegg99/s99ab/api/apierr"
	"github.com/smegg99/s99ab/auth/kratosauth"
)

// Session resolves a session when one is present and lets the request through
// either way. Require rejects anonymous requests.
func Session(c *kratosauth.Client) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		identity, err := c.Whoami(ctx.Request.Context(), ctx.Request)

		switch {
		case err == nil:
			// Stored on the request context so FromContext sees it too.
			ctx.Request = ctx.Request.WithContext(
				kratosauth.WithIdentity(ctx.Request.Context(), identity))

		case errors.Is(err, kratosauth.ErrCallerGone):
			// Respond sees the request is over and writes the status only.
			apierr.Respond(ctx, err)
			return

		case errors.Is(err, kratosauth.ErrNoSession):
			// Anonymous: continue with no identity.

		case errors.Is(err, kratosauth.ErrUpstream):
			// 503 instead of anonymous, so protected routes do not turn public.
			apierr.Respond(ctx, apierr.Wrap(err, apierr.Unavailable, "auth.unavailable"))
			return

		default:
			// Request build and decode errors are outages too.
			apierr.Respond(ctx, apierr.Wrap(err, apierr.Unavailable, "auth.unavailable"))
			return
		}
		ctx.Next()
	}
}

// Require rejects a request with no identity. Mount it after Session.
func Require() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if _, ok := From(ctx); !ok {
			apierr.Respond(ctx, apierr.New(apierr.Unauthorized, "auth.required"))
			ctx.Abort()
			return
		}
		ctx.Next()
	}
}

// From returns the identity Session stored on the request context.
func From(c *gin.Context) (*kratosauth.Identity, bool) {
	if c.Request == nil {
		return nil, false
	}
	return kratosauth.FromContext(c.Request.Context())
}

// MustFrom is From for handlers behind Require; it answers 401 itself when the
// identity is missing.
func MustFrom(c *gin.Context) (*kratosauth.Identity, bool) {
	identity, ok := From(c)
	if !ok {
		apierr.Respond(c, apierr.New(apierr.Unauthorized, "auth.required"))
		return nil, false
	}
	return identity, true
}

// RequireFunc admits only an identity the predicate accepts. A rejected caller
// gets a 404 so the route's existence is not confirmed.
func RequireFunc(ok func(*kratosauth.Identity) bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		identity, found := From(c)
		if !found {
			apierr.Respond(c, apierr.New(apierr.Unauthorized, "auth.required"))
			c.Abort()
			return
		}
		if !ok(identity) {
			apierr.Deny(c, "auth.forbidden")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireMeta admits an identity whose public metadata field, a string or a
// list of strings, holds one of the allowed values.
func RequireMeta(name string, allowed ...string) gin.HandlerFunc {
	return RequireFunc(func(i *kratosauth.Identity) bool { return kratosauth.HasMeta(i, name, allowed...) })
}
