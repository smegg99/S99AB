// auth/kratosgin/fake_test.go

package kratosgin_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/smegg99/s99ab/auth/kratosauth"
	"github.com/smegg99/s99ab/auth/kratosauth/kratosauthtest"
)

var fakeAccounts = map[string]kratosauth.Identity{
	"alice-token": {ID: "id-alice", Traits: json.RawMessage(`{"email":"alice@example.com"}`)},
	"bob-token":   {ID: "id-bob", Traits: json.RawMessage(`{"email":"bob@example.com"}`)},
}

func TestFakeTellsAccountsApart(t *testing.T) {
	r := engine(kratosauthtest.Fake(t, fakeAccounts))

	for credential, want := range map[string]string{
		"alice-token": "alice@example.com",
		"bob-token":   "bob@example.com",
	} {
		w := do(r, "/public", credential)

		var body map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &body)
		if body["who"] != want {
			t.Fatalf("%s resolved to %v, want %s", credential, body["who"], want)
		}
	}
}

func TestFakeRejectsAnUnknownCredential(t *testing.T) {
	r := engine(kratosauthtest.Fake(t, fakeAccounts))

	if code := do(r, "/private", "nobody-token").Code; code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401", code)
	}

	w := do(r, "/public", "")
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["who"] != "anonymous" {
		t.Fatalf("who = %v, want anonymous", body["who"])
	}
}

func TestFakeAcceptsASessionToken(t *testing.T) {
	r := engine(kratosauthtest.Fake(t, fakeAccounts))

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("X-Session-Token", "alice-token")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d: %s", w.Code, w.Body.String())
	}
}

func TestFakeAccountWithoutTraitsIsUsable(t *testing.T) {
	r := engine(kratosauthtest.Fake(t, map[string]kratosauth.Identity{"t": {ID: "id-plain"}}))

	w := do(r, "/private", "t")
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d: %s", w.Code, w.Body.String())
	}

	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["id"] != "id-plain" {
		t.Fatalf("id = %v, want id-plain", body["id"])
	}
}
