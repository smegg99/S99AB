// auth/kratosgin/kratosgin_test.go

package kratosgin_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/auth/kratosauth"
	"github.com/smegg99/s99ab/v2/auth/kratosgin"
)

func init() { gin.SetMode(gin.TestMode) }

// fakeKratos stands in for the whoami endpoint.
func fakeKratos(t *testing.T, status int, body string) *kratosauth.Client {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sessions/whoami" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	c, err := kratosauth.New(kratosauth.Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

const activeSession = `{
  "id": "session-1",
  "active": true,
  "identity": {
    "id": "identity-1",
    "traits": {"email": "karol@example.com", "name": "Karol"}
  }
}`

// engine mounts Session, and Require on a protected subgroup.
func engine(c *kratosauth.Client) *gin.Engine {
	r := gin.New()
	r.Use(kratosgin.Session(c))

	r.GET("/public", func(ctx *gin.Context) {
		identity, ok := kratosgin.From(ctx)
		if !ok {
			ctx.JSON(http.StatusOK, gin.H{"who": "anonymous"})
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"who": identity.Email()})
	})

	private := r.Group("", kratosgin.Require())
	private.GET("/private", func(ctx *gin.Context) {
		identity, _ := kratosgin.From(ctx)
		ctx.JSON(http.StatusOK, gin.H{"id": identity.ID})
	})
	return r
}

func do(r *gin.Engine, path string, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestActiveSessionResolvesAnIdentity(t *testing.T) {
	r := engine(fakeKratos(t, http.StatusOK, activeSession))

	w := do(r, "/private", "ory_kratos_session=abc")
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d: %s", w.Code, w.Body.String())
	}

	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["id"] != "identity-1" {
		t.Fatalf("id = %v", body["id"])
	}
}

func TestTraitsAreReadable(t *testing.T) {
	r := engine(fakeKratos(t, http.StatusOK, activeSession))

	w := do(r, "/public", "ory_kratos_session=abc")
	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)

	if body["who"] != "karol@example.com" {
		t.Fatalf("email = %v", body["who"])
	}
}

func TestNoSessionIsAnonymousNotRejected(t *testing.T) {
	r := engine(fakeKratos(t, http.StatusUnauthorized, `{"error":{"code":401}}`))

	w := do(r, "/public", "")
	if w.Code != http.StatusOK {
		t.Fatalf("public route = %d", w.Code)
	}

	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["who"] != "anonymous" {
		t.Fatalf("who = %v", body["who"])
	}
}

func TestIdentityReachesCodeThatOnlyHasAContext(t *testing.T) {
	r := gin.New()
	r.Use(kratosgin.Session(fakeKratos(t, http.StatusOK, activeSession)))

	var deep *kratosauth.Identity
	r.GET("/deep", func(ctx *gin.Context) {
		deep, _ = kratosauth.FromContext(ctx.Request.Context())
		ctx.Status(http.StatusOK)
	})

	if code := do(r, "/deep", "ory_kratos_session=abc").Code; code != http.StatusOK {
		t.Fatalf("code = %d", code)
	}
	if deep == nil || deep.ID != "identity-1" {
		t.Fatalf("identity = %+v; the request context never carried it", deep)
	}
}

func TestMustFromAnswersForTheHandler(t *testing.T) {
	r := gin.New()
	r.Use(kratosgin.Session(fakeKratos(t, http.StatusUnauthorized, `{}`)))
	r.GET("/who", func(ctx *gin.Context) {
		identity, ok := kratosgin.MustFrom(ctx)
		if !ok {
			return
		}
		ctx.JSON(http.StatusOK, gin.H{"id": identity.ID})
	})

	w := do(r, "/who", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401", w.Code)
	}
	if !strings.Contains(w.Body.String(), "auth.required") {
		t.Fatalf("body is not the envelope: %s", w.Body.String())
	}
}

func TestRequireRejectsWithoutASession(t *testing.T) {
	r := engine(fakeKratos(t, http.StatusUnauthorized, `{}`))

	w := do(r, "/private", "")
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("code = %d, want 401", w.Code)
	}
	if !strings.Contains(w.Body.String(), "unauthorized") {
		t.Fatalf("body is not the envelope: %s", w.Body.String())
	}
}

// Kratos answers 200 for an expired session.
func TestInactiveSessionIsNotAnIdentity(t *testing.T) {
	const expired = `{"id":"s","active":false,"identity":{"id":"i","traits":{}}}`
	r := engine(fakeKratos(t, http.StatusOK, expired))

	if code := do(r, "/private", "ory_kratos_session=abc").Code; code != http.StatusUnauthorized {
		t.Fatalf("code = %d; an inactive session was accepted", code)
	}
}

func TestUnreachableKratosIs503NotAnonymous(t *testing.T) {
	c, err := kratosauth.New(kratosauth.Options{
		PublicURL: "http://127.0.0.1:1",
		Timeout:   500 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}

	w := do(engine(c), "/public", "ory_kratos_session=abc")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503", w.Code)
	}
}

// A cancelled browser request looks like an outage at the transport layer.
func TestCanceledRequestIsNotAnOutage(t *testing.T) {
	// Blocks until the caller gives up.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer srv.Close()

	c, err := kratosauth.New(kratosauth.Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/public", nil).WithContext(ctx)
	req.Header.Set("Cookie", "ory_kratos_session=abc")

	go func() {
		time.Sleep(20 * time.Millisecond)
		cancel()
	}()

	w := httptest.NewRecorder()
	engine(c).ServeHTTP(w, req)

	if w.Code == http.StatusServiceUnavailable {
		t.Fatal("code = 503: a caller that walked away was reported as an outage")
	}
	if w.Code != clientClosedRequest {
		t.Fatalf("code = %d, want %d", w.Code, clientClosedRequest)
	}
	// A client that is gone gets no body.
	if body := w.Body.String(); body != "" {
		t.Fatalf("body = %q; want nothing written", body)
	}
}

// nginx's 499.
const clientClosedRequest = 499

func TestCredentialsAreForwarded(t *testing.T) {
	var seen http.Header

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.Header.Clone()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(activeSession))
	}))
	defer srv.Close()

	c, err := kratosauth.New(kratosauth.Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Cookie", "ory_kratos_session=abc")
	req.Header.Set("X-Session-Token", "token-value")

	r := engine(c)
	r.ServeHTTP(httptest.NewRecorder(), req)

	if seen.Get("Cookie") != "ory_kratos_session=abc" {
		t.Fatalf("cookie not forwarded: %q", seen.Get("Cookie"))
	}
	if seen.Get("X-Session-Token") != "token-value" {
		t.Fatalf("token not forwarded: %q", seen.Get("X-Session-Token"))
	}
}

func TestMissingPublicURLIsRejected(t *testing.T) {
	if _, err := kratosauth.New(kratosauth.Options{}); err == nil {
		t.Fatal("a client with no PublicURL was accepted")
	}
}

func TestTraitDecodesArbitraryFields(t *testing.T) {
	c := fakeKratos(t, http.StatusOK, activeSession)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Cookie", "ory_kratos_session=abc")
	identity, err := c.Whoami(req.Context(), req)
	if err != nil {
		t.Fatal(err)
	}

	var name string
	if err := identity.Trait("name", &name); err != nil {
		t.Fatal(err)
	}
	if name != "Karol" {
		t.Fatalf("name = %q", name)
	}
	if err := identity.Trait("nope", &name); err == nil {
		t.Fatal("a missing trait returned no error")
	}
}

// A 200 whose body does not decode (a gateway page, a truncated answer) is an outage.
func TestUndecodableWhoamiIs503NotAnonymous(t *testing.T) {
	r := engine(fakeKratos(t, http.StatusOK, `<html>502 Bad Gateway</html>`))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/public", nil)
	req.Header.Set("Cookie", "ory_kratos_session=abc")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503; a caller was served as anonymous during an outage", w.Code)
	}
}
