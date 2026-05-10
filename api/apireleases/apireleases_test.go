// api/apireleases/apireleases_test.go

package apireleases_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apireleases"
	"github.com/smegg99/s99ab/release/releases"
)

func init() { gin.SetMode(gin.TestMode) }

// One release with per-locale notes.
const payload = `[{
  "tag_name": "v1.2.0",
  "name": "1.2.0",
  "published_at": "2026-07-01T10:00:00Z",
  "html_url": "https://example.test/releases/v1.2.0",
  "body": "<!-- lang:en -->\nWhat's new\n<!-- lang:pl -->\nCo nowego",
  "assets": [{
    "name": "App-1.2.0-x86_64.AppImage",
    "size": 42,
    "browser_download_url": "https://example.test/a"
  }]
}]`

func TestAllFourRoutesAnswer(t *testing.T) {
	r := mount(t, github(t, http.StatusOK, payload))

	for path, want := range map[string]string{
		"/api/v1/releases":        "releases",
		"/api/v1/releases/latest": "version",
		"/api/v1/downloads":       "available",
		"/api/v1/repo":            "",
	} {
		w := get(r, path)
		if w.Code != http.StatusOK {
			t.Fatalf("%s = %d, want 200: %s", path, w.Code, w.Body.String())
		}

		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("%s is not an object: %v (%s)", path, err, w.Body.String())
		}
		if want != "" {
			if _, ok := body[want]; !ok {
				t.Fatalf("%s has no %q: %s", path, want, w.Body.String())
			}
		}
	}
}

func TestGitHubBeingDownIsNotAServerError(t *testing.T) {
	r := mount(t, github(t, http.StatusInternalServerError, `{"message":"upstream is unwell"}`))

	for _, path := range []string{
		"/api/v1/releases",
		"/api/v1/releases/latest",
		"/api/v1/downloads",
		"/api/v1/repo",
	} {
		if code := get(r, path).Code; code != http.StatusOK {
			t.Fatalf("%s = %d with GitHub down, want 200", path, code)
		}
	}

	var downloads struct {
		Available bool `json:"available"`
	}
	if err := json.Unmarshal(get(r, "/api/v1/downloads").Body.Bytes(), &downloads); err != nil {
		t.Fatal(err)
	}
	if downloads.Available {
		t.Fatal("downloads claims to be available with nothing behind it")
	}
}

func TestAnUnreachableGitHubStillAnswers(t *testing.T) {
	svc := releases.New(releases.Options{
		Owner: "smegg99", Repo: "s99ab",
		APIBase: "http://127.0.0.1:1",
	})

	if code := get(mount(t, svc), "/api/v1/downloads").Code; code != http.StatusOK {
		t.Fatalf("code = %d with GitHub unreachable, want 200", code)
	}
}

// The response reports the language it actually returned.
func TestLocaleSelectsTheNotes(t *testing.T) {
	r := mount(t, github(t, http.StatusOK, payload))

	for locale, want := range map[string]string{"en": "What's new", "pl": "Co nowego"} {
		var latest struct {
			Notes       string `json:"notes"`
			NotesLocale string `json:"notes_locale"`
		}
		if err := json.Unmarshal(get(r, "/api/v1/releases/latest?locale="+locale).Body.Bytes(), &latest); err != nil {
			t.Fatal(err)
		}

		if latest.Notes != want {
			t.Fatalf("locale=%s gave notes %q, want %q", locale, latest.Notes, want)
		}
		if latest.NotesLocale != locale {
			t.Fatalf("locale=%s reported notes_locale %q", locale, latest.NotesLocale)
		}
	}
}

// github stands in for the API, answering the releases endpoint with body.
func github(t *testing.T, status int, body string) *releases.Service {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)

	return releases.New(releases.Options{
		Owner: "smegg99", Repo: "s99ab",
		APIBase:       srv.URL,
		DefaultLocale: "en",
	})
}

func mount(t *testing.T, svc *releases.Service) *gin.Engine {
	t.Helper()
	r := gin.New()
	apireleases.Register(r.Group("/api/v1"), svc)
	return r
}

func get(r *gin.Engine, path string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w
}
