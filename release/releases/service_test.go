// release/releases/service_test.go

package releases_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/smegg99/s99ab/v2/release/releases"
)

const body = `Untagged preamble.

<!-- lang:en -->
## What's new
Fixed the thing.

<!-- lang:pl -->
## Co nowego
Naprawiono to coś.`

// github serves one page of releases: a draft, a prerelease and two stable ones.
func github(t *testing.T, hits *int) string {
	t.Helper()
	return githubWith(t, hits, body)
}

// githubWith is github with the newest stable release's notes set to body.
func githubWith(t *testing.T, hits *int, body string) string {
	t.Helper()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if hits != nil {
			*hits++
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[
		  {"tag_name":"v9.9.9","draft":true,"assets":[]},
		  {"tag_name":"v2.1.0-rc1","prerelease":true,"assets":[]},
		  {"tag_name":"v2.0.0","published_at":"2026-07-01T00:00:00Z","html_url":"https://example.test/v2","body":` + quote(body) + `,
		    "assets":[{"name":"app-2.0.0-linux-x86_64.AppImage","size":10,"browser_download_url":"https://d/appimage","digest":"sha256:abc"}]},
		  {"tag_name":"v1.0.0","published_at":"2026-06-01T00:00:00Z","html_url":"https://example.test/v1",
		    "assets":[{"name":"app-1.0.0-macos-arm64.dmg","size":20,"browser_download_url":"https://d/dmg"}]}
		]`))
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func quote(s string) string {
	out := []byte{'"'}
	for _, r := range s {
		switch r {
		case '"':
			out = append(out, '\\', '"')
		case '\n':
			out = append(out, '\\', 'n')
		default:
			out = append(out, string(r)...)
		}
	}
	return string(append(out, '"'))
}

func service(t *testing.T, base string) *releases.Service {
	t.Helper()
	return releases.New(releases.Options{
		Owner: "smegg99", Repo: "Thing",
		APIBase:       base,
		DefaultLocale: "en",
	})
}

func TestLatestIsTheNewestStableRelease(t *testing.T) {
	svc := service(t, github(t, nil))

	latest := svc.Latest(context.Background(), "en")
	if !latest.Available || latest.Version != "v2.0.0" {
		t.Fatalf("latest = %+v, want v2.0.0", latest)
	}
	// The draft and the prerelease come first in GitHub's order.
	for _, r := range svc.List(context.Background(), "en") {
		if r.Version == "v9.9.9" || r.Version == "v2.1.0-rc1" {
			t.Fatalf("%s is in the list; drafts and prereleases must not be", r.Version)
		}
	}
}

func TestNotesResolveToTheReadersLanguage(t *testing.T) {
	svc := service(t, github(t, nil))

	pl := svc.Latest(context.Background(), "pl")
	if pl.NotesLocale != "pl" || pl.Notes != "## Co nowego\nNaprawiono to coś." {
		t.Fatalf("pl notes = %q (%s)", pl.Notes, pl.NotesLocale)
	}

	// A locale with no section gets the default locale's section, not the shorter preamble.
	de := svc.Latest(context.Background(), "de")
	if de.NotesLocale != "en" || de.Notes != "## What's new\nFixed the thing." {
		t.Fatalf("de notes = %q (%s), want the en section", de.Notes, de.NotesLocale)
	}
}

// Notes that open with a marker have no preamble: a locale with no section reads the default's.
func TestNotesWithoutAPreambleReadTheDefaultSection(t *testing.T) {
	svc := service(t, githubWith(t, nil, "<!-- lang:en -->\nEnglish notes\n<!-- lang:pl -->\nPolskie notatki"))

	if de := svc.Latest(context.Background(), "de"); de.Notes != "English notes" || de.NotesLocale != "en" {
		t.Fatalf("de notes = %q (%s), want the en section", de.Notes, de.NotesLocale)
	}
	if pl := svc.Latest(context.Background(), "pl-PL"); pl.Notes != "Polskie notatki" || pl.NotesLocale != "pl" {
		t.Fatalf("pl-PL notes = %q (%s), want the pl section", pl.Notes, pl.NotesLocale)
	}
}

func TestOnePlatformPerBuildEvenWhenARelaseSkipsIt(t *testing.T) {
	svc := service(t, github(t, nil))

	d := svc.Downloads(context.Background(), "en")
	if !d.Available || d.Version != "v2.0.0" {
		t.Fatalf("downloads = %+v", d)
	}
	if len(d.Platforms) != 2 {
		t.Fatalf("platforms = %+v, want linux from v2 and macos carried from v1", d.Platforms)
	}

	for _, p := range d.Platforms {
		switch p.Platform {
		case "linux":
			if p.Version != "v2.0.0" || !p.Current {
				t.Errorf("linux = %s current=%v, want v2.0.0 current", p.Version, p.Current)
			}
		case "macos":
			if p.Version != "v1.0.0" || p.Current {
				t.Errorf("macos = %s current=%v, want v1.0.0 not current", p.Version, p.Current)
			}
		}
	}
}

// One fetch feeds every view.
func TestTheListIsFetchedOnce(t *testing.T) {
	hits := 0
	svc := service(t, github(t, &hits))

	svc.List(context.Background(), "en")
	svc.Latest(context.Background(), "pl")
	svc.Downloads(context.Background(), "en")

	if hits != 1 {
		t.Fatalf("github was called %d times, want 1", hits)
	}
}

// Unreachable with nothing cached reports unavailable instead of an error.
func TestAnUnreachableGithubReportsUnavailable(t *testing.T) {
	var seen error
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	svc := releases.New(releases.Options{
		Owner: "o", Repo: "r", APIBase: srv.URL,
		Observe: func(err error) { seen = err },
	})

	if got := svc.Latest(context.Background(), "en"); got.Available {
		t.Errorf("latest = %+v, want unavailable", got)
	}
	if got := svc.Downloads(context.Background(), "en"); got.Available {
		t.Errorf("downloads = %+v, want unavailable", got)
	}
	if len(svc.List(context.Background(), "en")) != 0 {
		t.Error("list is not empty")
	}
	// The cache serves stale, so Observe is the only place the failure shows.
	if seen == nil {
		t.Error("Observe was never called; a failed refresh would be invisible")
	}
}
