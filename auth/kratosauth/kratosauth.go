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

// FromContext returns the identity WithIdentity stored on ctx.
func FromContext(ctx context.Context) (*Identity, bool) {
	identity, ok := ctx.Value(identityKey).(*Identity)
	return identity, ok
}

// WithIdentity puts an identity on a context.
func WithIdentity(ctx context.Context, identity *Identity) context.Context {
	return context.WithValue(ctx, identityKey, identity)
}
