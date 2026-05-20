// auth/kratosauth/kratosauth.go

// Package kratosauth resolves an Ory Kratos session into an identity.
package kratosauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apierr"
)

var (
	ErrNoSession = errors.New("kratosauth: no active session")
	ErrUpstream  = errors.New("kratosauth: kratos is unreachable")
	// ErrCallerGone means the request ended before Kratos answered.
	ErrCallerGone = errors.New("kratosauth: the caller stopped waiting")
)

// callerGone separates a cancelled caller from an unreachable Kratos, which
// Client.Do reports alike; the client Timeout leaves ctx untouched.
func callerGone(ctx context.Context, err error) error {
	if cause := ctx.Err(); cause != nil {
		return fmt.Errorf("%w: %v", ErrCallerGone, cause)
	}
	return fmt.Errorf("%w: %v", ErrUpstream, err)
}

// Identity is the part of a Kratos session an app authorizes on. Traits stay
// raw JSON because the schema belongs to the app.
type Identity struct {
	ID     string          `json:"id"`
	Traits json.RawMessage `json:"traits"`
	// SessionID distinguishes two sessions of the same identity.
	SessionID string `json:"session_id"`

	// MetadataPublic holds roles: users can edit their own traits, while
	// metadata_public is written only through the admin API.
	MetadataPublic json.RawMessage `json:"metadata_public"`
}

// Trait decodes one field out of the identity's traits.
func (i Identity) Trait(name string, into any) error {
	var traits map[string]json.RawMessage
	if err := json.Unmarshal(i.Traits, &traits); err != nil {
		return fmt.Errorf("kratosauth: traits: %w", err)
	}

	raw, ok := traits[name]
	if !ok {
		return fmt.Errorf("kratosauth: no trait %q", name)
	}
	return json.Unmarshal(raw, into)
}

// Meta decodes one field out of the identity's public metadata, which only the
// admin API writes.
func (i Identity) Meta(name string, into any) error {
	var meta map[string]json.RawMessage
	if len(i.MetadataPublic) == 0 {
		return fmt.Errorf("kratosauth: no metadata %q", name)
	}
	if err := json.Unmarshal(i.MetadataPublic, &meta); err != nil {
		return fmt.Errorf("kratosauth: metadata: %w", err)
	}

	raw, ok := meta[name]
	if !ok {
		return fmt.Errorf("kratosauth: no metadata %q", name)
	}
	return json.Unmarshal(raw, into)
}

// Email returns the email trait, or "" when it is missing.
func (i Identity) Email() string {
	var email string
	_ = i.Trait("email", &email)
	return email
}

type Options struct {
	// PublicURL is Kratos's public endpoint, e.g. http://127.0.0.1:4433.
	PublicURL string
	Client    *http.Client
	// Timeout bounds the whoami call.
	Timeout time.Duration
}

func (o *Options) defaults() {
	if o.Timeout <= 0 {
		o.Timeout = 5 * time.Second
	}
	if o.Client == nil {
		o.Client = &http.Client{Timeout: o.Timeout}
	}
}

// Client talks to Kratos.
type Client struct {
	opts Options
}

func New(opts Options) (*Client, error) {
	if opts.PublicURL == "" {
		return nil, fmt.Errorf("kratosauth: PublicURL is required")
	}
	opts.defaults()
	return &Client{opts: opts}, nil
}

// Whoami validates the request's cookie or session token with Kratos.
func (c *Client) Whoami(ctx context.Context, r *http.Request) (*Identity, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.opts.PublicURL+"/sessions/whoami", nil)
	if err != nil {
		return nil, fmt.Errorf("kratosauth: request: %w", err)
	}

	if cookie := r.Header.Get("Cookie"); cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	if token := r.Header.Get("X-Session-Token"); token != "" {
		req.Header.Set("X-Session-Token", token)
	}
	if auth := r.Header.Get("Authorization"); auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := c.opts.Client.Do(req)
	if err != nil {
		return nil, callerGone(ctx, err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
	case http.StatusUnauthorized, http.StatusForbidden:
		return nil, ErrNoSession
	default:
		return nil, fmt.Errorf("%w: whoami returned %d", ErrUpstream, resp.StatusCode)
	}

	var session struct {
		ID       string `json:"id"`
		Active   bool   `json:"active"`
		Identity struct {
			ID             string          `json:"id"`
			Traits         json.RawMessage `json:"traits"`
			MetadataPublic json.RawMessage `json:"metadata_public"`
		} `json:"identity"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("kratosauth: decode session: %w", err)
	}

	// Kratos answers 200 for an inactive session.
	if !session.Active {
		return nil, ErrNoSession
	}

	return &Identity{
		ID:             session.Identity.ID,
		Traits:         session.Identity.Traits,
		MetadataPublic: session.Identity.MetadataPublic,
		SessionID:      session.ID,
	}, nil
}

type contextKey struct{}

var identityKey = contextKey{}

// Session resolves a session when one is present and lets the request through
// either way. Require rejects anonymous requests.
func Session(c *Client) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		identity, err := c.Whoami(ctx.Request.Context(), ctx.Request)

		switch {
		case err == nil:
			// Stored on the request context so FromContext sees it too.
			ctx.Request = ctx.Request.WithContext(
				WithIdentity(ctx.Request.Context(), identity))

		case errors.Is(err, ErrCallerGone):
			// Respond sees the request is over and writes the status only.
			apierr.Respond(ctx, err)
			return

		case errors.Is(err, ErrNoSession):
			// Anonymous: continue with no identity.

		case errors.Is(err, ErrUpstream):
			// An unreachable Kratos must not downgrade protected routes to public.
			apierr.Respond(ctx, apierr.Wrap(err, apierr.Unavailable, "auth.unavailable"))
			return

		default:
			// Request build and decode errors are outages too; only ErrNoSession
			// means anonymous.
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
func From(c *gin.Context) (*Identity, bool) {
	if c.Request == nil {
		return nil, false
	}
	return FromContext(c.Request.Context())
}

// MustFrom is From for handlers behind Require; it answers 401 itself when the
// identity is missing.
func MustFrom(c *gin.Context) (*Identity, bool) {
	identity, ok := From(c)
	if !ok {
		apierr.Respond(c, apierr.New(apierr.Unauthorized, "auth.required"))
		return nil, false
	}
	return identity, true
}

// FromContext is From for code that only has a context.Context.
func FromContext(ctx context.Context) (*Identity, bool) {
	identity, ok := ctx.Value(identityKey).(*Identity)
	return identity, ok
}

// WithIdentity puts an identity on a context.
func WithIdentity(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}
