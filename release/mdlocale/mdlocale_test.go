// release/mdlocale/mdlocale_test.go
package mdlocale

import (
	"sort"
	"strings"
	"testing"
)

// Unmarked prose belongs to every locale.
func TestNoMarkersIsUntaggedForEveryLocale(t *testing.T) {
	const body = "## What's Changed\n* Fixed a thing by @smegg99"

	s := Split(body)

	for _, locale := range []string{"en", "pl", "de"} {
		text, matched := s.For(locale)
		if matched {
			t.Errorf("%s: matched = true, want false; nothing was marked", locale)
		}
		if text != body {
			t.Errorf("%s: text = %q, want the whole document", locale, text)
		}
	}
}

func TestSplitsOnMarkers(t *testing.T) {
	s := Split("<!-- lang:en -->\nWhat's new\n\n<!-- lang:pl -->\nCo nowego")

	en, ok := s.For("en")
	if !ok || en != "What's new" {
		t.Errorf("en = %q (matched %v), want \"What's new\"", en, ok)
	}
	pl, ok := s.For("pl")
	if !ok || pl != "Co nowego" {
		t.Errorf("pl = %q (matched %v), want \"Co nowego\"", pl, ok)
	}
}

func TestUnknownLocaleFallsBackToUntagged(t *testing.T) {
	s := Split("Shared preamble.\n\n<!-- lang:en -->\nEnglish only")

	text, matched := s.For("pl")
	if matched {
		t.Error("matched = true, want false")
	}
	if text != "Shared preamble." {
		t.Errorf("text = %q, want the untagged preamble", text)
	}
}

// A marker with nothing under it is treated as absent.
func TestEmptySectionCountsAsNoSection(t *testing.T) {
	s := Split("Preamble.\n\n<!-- lang:pl -->\n\n<!-- lang:en -->\nEnglish")

	text, matched := s.For("pl")
	if matched {
		t.Error("matched = true for an empty section, want false")
	}
	if text != "Preamble." {
		t.Errorf("text = %q, want the untagged preamble", text)
	}
}

func TestMarkerSyntaxIsForgiving(t *testing.T) {
	bodies := map[string]string{
		"canonical":       "<!-- lang:pl -->\nCo nowego",
		"no spaces":       "<!--lang:pl-->\nCo nowego",
		"extra spaces":    "<!--   lang:   pl   -->\nCo nowego",
		"uppercase tag":   "<!-- lang:PL -->\nCo nowego",
		"uppercase LANG":  "<!-- LANG:pl -->\nCo nowego",
		"leading indent":  "  <!-- lang:pl -->\nCo nowego",
		"trailing spaces": "<!-- lang:pl -->   \nCo nowego",
		"crlf":            "<!-- lang:pl -->\r\nCo nowego",
	}

	for name, body := range bodies {
		t.Run(name, func(t *testing.T) {
			text, matched := Split(body).For("pl")
			if !matched {
				t.Fatalf("matched = false for %q", body)
			}
			if strings.TrimSpace(text) != "Co nowego" {
				t.Errorf("text = %q, want \"Co nowego\"", text)
			}
		})
	}
}

func TestMarkerMidLineIsNotAMarker(t *testing.T) {
	s := Split("Write `<!-- lang:pl -->` to start a section.")

	if locales := s.Locales(); len(locales) != 0 {
		t.Errorf("locales = %v, want none; the marker was inline prose", locales)
	}
	text, matched := s.For("pl")
	if matched {
		t.Error("matched = true, want false")
	}
	if !strings.Contains(text, "to start a section") {
		t.Errorf("text = %q, want the prose kept whole", text)
	}
}

func TestRepeatedLocaleAppends(t *testing.T) {
	s := Split("<!-- lang:en -->\nFirst\n\n<!-- lang:pl -->\nPolskie\n\n<!-- lang:en -->\nSecond")

	text, matched := s.For("en")
	if !matched {
		t.Fatal("matched = false")
	}
	if text != "First\n\nSecond" {
		t.Errorf("text = %q, want both English parts", text)
	}
}

func TestLocalesListsOnlyNonEmptySections(t *testing.T) {
	s := Split("<!-- lang:en -->\nEnglish\n<!-- lang:pl -->\n\n<!-- lang:de -->\nDeutsch")

	got := s.Locales()
	sort.Strings(got)
	want := []string{"de", "en"}
	if len(got) != len(want) {
		t.Fatalf("locales = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("locales = %v, want %v", got, want)
		}
	}
}

func TestEmptyDocument(t *testing.T) {
	text, matched := Split("").For("en")
	if matched || text != "" {
		t.Errorf("text = %q, matched = %v; want empty and unmatched", text, matched)
	}
}
