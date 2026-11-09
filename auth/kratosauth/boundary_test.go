// auth/kratosauth/boundary_test.go

package kratosauth_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/smegg99/s99ab/auth/kratosauth"
)

func TestMalformedSessionsAreUpstreamFailures(t *testing.T) {
	for _, body := range []string{`{}`, `null`, `{"active":true}`, `{"id":"s","active":true,"identity":{"id":"i"}}`,
		`{"id":"s","active":true,"identity":{"id":"i","traits":[]}}`, `{"active":false} {}`, strings.Repeat(" ", 1<<20) + `{}`} {
		client := whoami(t, 200, body)
		if _, err := client.Whoami(t.Context(), request()); !errors.Is(err, kratosauth.ErrUpstream) {
			t.Errorf("malformed response = %v", err)
		}
	}
}

func TestWhoamiBoundsACustomClient(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-r.Context().Done() }))
	defer server.Close()
	client, err := kratosauth.New(kratosauth.Options{PublicURL: server.URL, Client: &http.Client{}, Timeout: 20 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	if _, err := client.Whoami(t.Context(), request()); !errors.Is(err, kratosauth.ErrUpstream) {
		t.Fatalf("timeout = %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatal("custom client bypassed timeout")
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := client.Whoami(ctx, request()); !errors.Is(err, kratosauth.ErrCallerGone) {
		t.Fatalf("caller cancel = %v", err)
	}
}

func TestWhoamiDoesNotForwardUnrelatedCookiesOrRedirect(t *testing.T) {
	requests := make(chan *http.Request, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests <- r
		http.Redirect(w, r, "/other", http.StatusFound)
	}))
	defer server.Close()
	supplied := &http.Client{}
	client, err := kratosauth.New(kratosauth.Options{PublicURL: server.URL, Client: supplied})
	if err != nil {
		t.Fatal(err)
	}
	req := request()
	req.AddCookie(&http.Cookie{Name: "unrelated", Value: "private"})
	if _, err := client.Whoami(t.Context(), req); !errors.Is(err, kratosauth.ErrUpstream) {
		t.Fatalf("redirect=%v", err)
	}
	sent := <-requests
	if got := sent.Header.Get("Cookie"); got != "ory_kratos_session=abc" {
		t.Fatalf("forwarded cookies=%q", got)
	}
	select {
	case <-requests:
		t.Fatal("followed redirect")
	default:
	}
	if supplied.CheckRedirect != nil {
		t.Fatal("modified caller's client")
	}
}
