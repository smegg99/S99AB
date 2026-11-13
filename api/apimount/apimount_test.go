// api/apimount/apimount_test.go

package apimount_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/api/apimount"
	"github.com/smegg99/s99ab/v2/auth/kratosauth"
	"github.com/smegg99/s99ab/v2/auth/kratosgin"
)

func init() { gin.SetMode(gin.TestMode) }

// gin copies the parent chain into each child group, so Session must be mounted before any Group().
func TestGuardedRoutesSeeTheSessionMiddleware(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{Kratos: upKratos(t)})

	gs.Guarded.GET("/items", func(c *gin.Context) {
		identity, _ := kratosgin.From(c)
		c.JSON(http.StatusOK, gin.H{"id": identity.ID})
	})

	w := get(r, "/api/v1/items", "ory_kratos_session=abc")
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "identity-1") {
		t.Fatalf("body = %s; the guarded group never saw the session", w.Body.String())
	}
}

func TestHealthAnswersWhileKratosIsDown(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{Kratos: downKratos(t)})
	gs.Sized.GET("/items", func(c *gin.Context) { c.Status(http.StatusOK) })

	if code := get(r, "/api/v1/health", "").Code; code != http.StatusOK {
		t.Fatalf("health = %d, want 200 with Kratos down", code)
	}
	if code := get(r, "/api/v1/items", "ory_kratos_session=abc").Code; code != http.StatusServiceUnavailable {
		t.Fatalf("items with a session = %d, want 503 with Kratos down", code)
	}
	if code := get(r, "/api/v1/items", "").Code; code != http.StatusOK {
		t.Fatalf("anonymous items = %d, want 200: no credential needs no Kratos", code)
	}
}

// Nested caps would fail every upload at the JSON limit.
func TestAnUploadIsNotCappedAtTheJSONLimit(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{MaxRequestSize: 16, MaxUploadSize: 1024})

	gs.Sized.POST("/items", func(c *gin.Context) { c.Status(http.StatusOK) })
	gs.Uploads.POST("/files", func(c *gin.Context) { c.Status(http.StatusOK) })

	body := strings.Repeat("x", 512)
	if code := post(r, "/api/v1/files", body).Code; code != http.StatusOK {
		t.Fatalf("upload = %d, want 200 - 512 bytes is under the upload cap", code)
	}
	if code := post(r, "/api/v1/items", body).Code; code == http.StatusOK {
		t.Fatal("a 512-byte JSON body passed a 16-byte cap")
	}
}

func TestGuardedUploadsRejectAnAnonymousUpload(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{Kratos: upKratos(t), MaxUploadSize: 1024})

	gs.Uploads.POST("/open", func(c *gin.Context) { c.Status(http.StatusOK) })
	gs.GuardedUploads.POST("/covers", func(c *gin.Context) { c.Status(http.StatusOK) })

	if code := post(r, "/api/v1/open", "x").Code; code != http.StatusOK {
		t.Fatalf("unguarded upload = %d, want 200 - Uploads is deliberately open", code)
	}
	if code := post(r, "/api/v1/covers", "x").Code; code != http.StatusUnauthorized {
		t.Fatalf("guarded upload = %d, want 401 without a session", code)
	}
}

func TestGuardedUploadsKeepTheUploadCap(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{
		Kratos: upKratos(t), MaxRequestSize: 16, MaxUploadSize: 1024,
	})
	gs.GuardedUploads.POST("/covers", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := postWith(r, "/api/v1/covers", strings.Repeat("x", 512), "ory_kratos_session=abc")
	if w.Code != http.StatusOK {
		t.Fatalf("code = %d: 512 bytes is under the upload cap: %s", w.Code, w.Body.String())
	}
}

func TestWithoutKratosThereIsNoGuardedGroup(t *testing.T) {
	gs := mount(t, gin.New(), apimount.Options{})

	if gs.Guarded != nil {
		t.Fatal("Guarded exists with no Kratos client; it could only ever 401")
	}
	if gs.GuardedUploads != nil {
		t.Fatal("GuardedUploads exists with no Kratos client; it could only ever 401")
	}
	if gs.Sized == nil || gs.Uploads == nil || gs.Root == nil {
		t.Fatal("the unguarded groups are missing")
	}
}

// gin trusts every proxy by default, so ClientIP would take X-Forwarded-For.
func TestForwardedForIsNotTrustedFromAnArbitraryPeer(t *testing.T) {
	r := gin.New()
	gs := mount(t, r, apimount.Options{})

	var seen string
	gs.Sized.GET("/who", func(c *gin.Context) {
		seen = c.ClientIP()
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/who", nil)
	req.RemoteAddr = "203.0.113.9:1234" // not loopback, so not a trusted proxy
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	r.ServeHTTP(httptest.NewRecorder(), req)

	if seen == "1.2.3.4" {
		t.Fatal("ClientIP returned the header a stranger sent")
	}
}

func mount(t *testing.T, r *gin.Engine, opts apimount.Options) apimount.Groups {
	t.Helper()
	gs, err := apimount.Mount(r, opts)
	if err != nil {
		t.Fatal(err)
	}
	return gs
}

const activeSession = `{
  "id": "session-1",
  "active": true,
  "identity": {"id": "identity-1", "traits": {"email": "karol@example.com"}}
}`

func upKratos(t *testing.T) *kratosauth.Client {
	t.Helper()
	// Answers 401 without a cookie, so guarded and open routes differ.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Cookie") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(activeSession))
	}))
	t.Cleanup(srv.Close)

	c, err := kratosauth.New(kratosauth.Options{PublicURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// downKratos points at a port nothing is listening on.
func downKratos(t *testing.T) *kratosauth.Client {
	t.Helper()
	c, err := kratosauth.New(kratosauth.Options{PublicURL: "http://127.0.0.1:1"})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func get(r *gin.Engine, path, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func post(r *gin.Engine, path, body string) *httptest.ResponseRecorder {
	return postWith(r, path, body, "")
}

func postWith(r *gin.Engine, path, body, cookie string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}
