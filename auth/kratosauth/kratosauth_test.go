// auth/kratosauth/kratosauth_test.go

package kratosauth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/smegg99/s99ab/auth/kratosauth"
)

// whoami returns a client whose Kratos answers every call with status and body.
func whoami(t *testing.T, status int, body string) *kratosauth.Client {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)

	client, err := kratosauth.New(kratosauth.Options{PublicURL: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	return client
}

// request carries a session cookie; Whoami makes no call without a credential.
func request() *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Cookie", "ory_kratos_session=abc")
	return r
}

// An anonymous request must not cost a round trip, nor fail when Kratos is down.
func TestWhoamiWithoutCredentialsMakesNoCall(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)
	client, err := kratosauth.New(kratosauth.Options{PublicURL: server.URL})
	if err != nil {
		t.Fatal(err)
	}

	_, err = client.Whoami(context.Background(), httptest.NewRequest(http.MethodGet, "/", nil))
	if !errors.Is(err, kratosauth.ErrNoSession) || calls != 0 {
		t.Fatalf("err = %v after %d calls, want ErrNoSession and no call", err, calls)
	}
}

func TestWhoamiResolvesAnActiveSession(t *testing.T) {
	client := whoami(t, http.StatusOK, `{"id":"sess-1","active":true,"identity":{
		"id":"id-1","traits":{"email":"a@example.com"},"metadata_public":{"role":"admin"}}}`)

	identity, err := client.Whoami(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	if identity.ID != "id-1" || identity.SessionID != "sess-1" {
		t.Fatalf("identity = %+v", identity)
	}
	if identity.Email() != "a@example.com" {
		t.Errorf("email = %q", identity.Email())
	}
	var role string
	if err := identity.Meta("role", &role); err != nil || role != "admin" {
		t.Errorf("role = %q (err %v)", role, err)
	}
}

// Kratos answers 200 for an ended session, so the active flag decides.
func TestWhoamiInactiveSessionIsNoSession(t *testing.T) {
	client := whoami(t, http.StatusOK, `{"active":false,"identity":{"id":"id-1","traits":{}}}`)

	if _, err := client.Whoami(context.Background(), request()); !errors.Is(err, kratosauth.ErrNoSession) {
		t.Fatalf("err = %v, want ErrNoSession", err)
	}
}

// An undecodable answer is an upstream failure, not ErrNoSession.
func TestWhoamiUndecodableAnswerIsAnOutage(t *testing.T) {
	client := whoami(t, http.StatusOK, `<html>gateway</html>`)

	_, err := client.Whoami(context.Background(), request())
	if err == nil || errors.Is(err, kratosauth.ErrNoSession) {
		t.Fatalf("err = %v, want a decode failure that is not ErrNoSession", err)
	}
}

func TestWhoamiUnauthorizedIsNoSession(t *testing.T) {
	client := whoami(t, http.StatusUnauthorized, `{}`)

	if _, err := client.Whoami(context.Background(), request()); !errors.Is(err, kratosauth.ErrNoSession) {
		t.Fatalf("err = %v, want ErrNoSession", err)
	}
}

func TestMissingPublicURLIsRejected(t *testing.T) {
	if _, err := kratosauth.New(kratosauth.Options{}); err == nil {
		t.Fatal("a client with no PublicURL was accepted")
	}
}

// Traits are user-editable, so a role there must not pass HasMeta.
func TestHasMetaReadsMetadataNotTraits(t *testing.T) {
	staff := &kratosauth.Identity{
		Traits:         json.RawMessage(`{"role":"admin"}`),
		MetadataPublic: json.RawMessage(`{"role":"staff"}`),
	}
	if kratosauth.HasMeta(staff, "role", "admin") {
		t.Error("a role in traits opened the gate")
	}
	if !kratosauth.HasMeta(staff, "role", "staff", "admin") {
		t.Error("a role in metadata_public did not open the gate")
	}
}

func TestIdentityRoundTripsThroughAContext(t *testing.T) {
	want := &kratosauth.Identity{ID: "id-1"}
	got, ok := kratosauth.FromContext(kratosauth.WithIdentity(context.Background(), want))
	if !ok || got != want {
		t.Fatalf("got %+v ok=%v", got, ok)
	}
}

// Kratos sets a csrf cookie on every anonymous visitor who opens a flow; that is not a session.
func TestWhoamiWithOnlyUnrelatedCookiesMakesNoCall(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls++
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	t.Cleanup(server.Close)
	client, err := kratosauth.New(kratosauth.Options{PublicURL: server.URL})
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Cookie", "csrf_token_806060ca=abc; theme=dark")

	if _, err := client.Whoami(context.Background(), r); !errors.Is(err, kratosauth.ErrNoSession) || calls != 0 {
		t.Fatalf("err = %v after %d calls, want ErrNoSession and no call", err, calls)
	}
}

func TestWhoamiSeesAnOryNetworkSessionCookie(t *testing.T) {
	client := whoami(t, http.StatusOK, `{"id":"s","active":true,"identity":{"id":"id-1","traits":{}}}`)
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.Header.Set("Cookie", "ory_session_coolproject=abc")

	if _, err := client.Whoami(context.Background(), r); err != nil {
		t.Fatalf("err = %v, want the session resolved", err)
	}
}
