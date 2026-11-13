// auth/kratosauth/kratosauthtest/fake.go

// Package kratosauthtest is a Kratos stand-in for tests, apart so kratosauth does not import testing.
package kratosauthtest

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/smegg99/s99ab/v2/auth/kratosauth"
)

// Fake is a Client whose whoami maps a credential (session cookie value, X-Session-Token or Authorization) to an account.
func Fake(t *testing.T, accounts map[string]kratosauth.Identity) *kratosauth.Client {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identity, ok := accounts[credential(r)]
		if !ok {
			// What Kratos answers for an unknown credential.
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":     "session-" + identity.ID,
			"active": true,
			"identity": map[string]any{
				"id":              identity.ID,
				"traits":          traitsOf(identity),
				"metadata_public": identity.MetadataPublic,
			},
		})
	}))
	t.Cleanup(srv.Close)

	c, err := kratosauth.New(kratosauth.Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatalf("fake kratos: %v", err)
	}
	return c
}

// credential returns the first credential header set, in Whoami's order.
func credential(r *http.Request) string {
	session := ""
	if cookie, err := r.Cookie("ory_kratos_session"); err == nil {
		session = cookie.Value
	}
	for _, value := range []string{
		session,
		r.Header.Get("X-Session-Token"),
		r.Header.Get("Authorization"),
	} {
		if value != "" {
			return value
		}
	}
	return ""
}

// traitsOf returns {} for empty traits; null fails every Identity.Trait call.
func traitsOf(identity kratosauth.Identity) json.RawMessage {
	if len(identity.Traits) == 0 {
		return json.RawMessage(`{}`)
	}
	return identity.Traits
}
