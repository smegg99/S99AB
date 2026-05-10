// auth/kratosauth/admin.go

package kratosauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
)

var ErrNoIdentity = errors.New("kratosauth: no such identity")

// Admin talks to Kratos's admin API, which must stay on loopback or a private
// network because it can read and modify every identity.
type Admin struct {
	baseURL string
	client  *http.Client
}

func NewAdmin(baseURL string, client *http.Client) (*Admin, error) {
	if baseURL == "" {
		return nil, fmt.Errorf("kratosauth: admin base URL is required")
	}
	if client == nil {
		client = &http.Client{}
	}
	return &Admin{baseURL: baseURL, client: client}, nil
}

// Account is the part of an identity a sharing screen needs.
type Account struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

// FindByEmail resolves an address to an identity. Store the ID, not the
// email: an email can change hands.
func (a *Admin) FindByEmail(ctx context.Context, email string) (*Account, error) {
	query := url.Values{}
	query.Set("credentials_identifier", email)

	list, err := a.list(ctx, query)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrNoIdentity, email)
	}
	return &list[0], nil
}

// Get resolves an identity ID to an account.
func (a *Admin) Get(ctx context.Context, id string) (*Account, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		a.baseURL+"/admin/identities/"+url.PathEscape(id), nil)
	if err != nil {
		return nil, fmt.Errorf("kratosauth: request: %w", err)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, callerGone(ctx, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("%w: %s", ErrNoIdentity, id)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: identities returned %d", ErrUpstream, resp.StatusCode)
	}

	var raw identityJSON
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("kratosauth: decode identity: %w", err)
	}
	return raw.account(), nil
}

func (a *Admin) list(ctx context.Context, query url.Values) ([]Account, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		a.baseURL+"/admin/identities?"+query.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("kratosauth: request: %w", err)
	}

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, callerGone(ctx, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: identities returned %d", ErrUpstream, resp.StatusCode)
	}

	var raw []identityJSON
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("kratosauth: decode identities: %w", err)
	}

	out := make([]Account, 0, len(raw))
	for _, r := range raw {
		out = append(out, *r.account())
	}
	return out, nil
}

type identityJSON struct {
	ID     string `json:"id"`
	Traits struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	} `json:"traits"`
}

func (r identityJSON) account() *Account {
	return &Account{ID: r.ID, Email: r.Traits.Email, Name: r.Traits.Name}
}
