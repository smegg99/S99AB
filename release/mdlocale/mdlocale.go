// release/mdlocale/mdlocale.go

// Package mdlocale splits markdown into per-locale sections opened by <!-- lang:xx --> lines.
package mdlocale

import (
	"regexp"
	"strings"
)

// marker must sit on its own line; the trailing class admits the \r of GitHub's CRLF bodies.
var marker = regexp.MustCompile(`(?im)^[ \t]*<!--[ \t]*lang:[ \t]*([A-Za-z0-9_-]+)[ \t]*-->[ \t\r]*$`)

type Sections struct {
	// byLocale is keyed by lowercased tag.
	byLocale map[string]string
	// untagged is the text before the first marker.
	untagged string
}

// Split never fails; a document with no markers is untagged in full.
func Split(md string) Sections {
	s := Sections{byLocale: map[string]string{}}

	loc := marker.FindAllStringSubmatchIndex(md, -1)
	if len(loc) == 0 {
		s.untagged = strings.TrimSpace(md)
		return s
	}

	s.untagged = strings.TrimSpace(md[:loc[0][0]])

	for i, m := range loc {
		tag := strings.ToLower(md[m[2]:m[3]])

		end := len(md)
		if i+1 < len(loc) {
			end = loc[i+1][0]
		}
		body := strings.TrimSpace(md[m[1]:end])

		// A repeated tag appends rather than overwrites.
		if prev, ok := s.byLocale[tag]; ok && prev != "" {
			if body != "" {
				body = prev + "\n\n" + body
			} else {
				body = prev
			}
		}
		s.byLocale[tag] = body
	}

	return s
}

// For returns the locale's section, or the untagged text with matched false. An
// empty section counts as none.
func (s Sections) For(locale string) (text string, matched bool) {
	if body, ok := s.byLocale[strings.ToLower(locale)]; ok && body != "" {
		return body, true
	}
	return s.untagged, false
}

// Locales lists the sectioned locales in no order, for diagnostics.
func (s Sections) Locales() []string {
	out := make([]string, 0, len(s.byLocale))
	for k, v := range s.byLocale {
		if v != "" {
			out = append(out, k)
		}
	}
	return out
}
