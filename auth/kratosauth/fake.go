// auth/kratosauth/fake.go

package kratosauth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Fake is a Client backed by a whoami endpoint that maps a credential (the whole
// Cookie, X-Session-Token or Authorization header) to an account.
func Fake(t *testing.T, accounts map[string]Identity) *Client {
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

	c, err := New(Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatalf("fake kratos: %v", err)
	}
	return c
}

// credential returns the first credential header set, in Whoami's order.
func credential(r *http.Request) string {
	for _, value := range []string{
		r.Header.Get("Cookie"),
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
func traitsOf(identity Identity) json.RawMessage {
	if len(identity.Traits) == 0 {
		return json.RawMessage(`{}`)
	}
	return identity.Traits
}
