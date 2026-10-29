// release/releases/downloads.go

package releases

import (
	"context"

	"github.com/smegg99/s99ab/release/ghreleases"
)

/*
Downloads is a download card's whole model, resolved for one reader.

Each platform keeps its own newest build rather than only the newest release's
assets. A release that ships without a macOS build must not take the macOS
download off the page - it means "nothing new for macOS", not "no macOS".
*/
type Downloads struct {
	Available bool `json:"available"`

	// Version is the newest stable release.
	Version     string `json:"version"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Notes       string `json:"notes"`
	NotesLocale string `json:"notes_locale"`

	// Platforms holds each platform's newest build, not always from that release.
	Platforms []Platform `json:"platforms"`

	// Source and Extras come from the newest release only.
	Source []ghreleases.Asset `json:"source"`
	Extras []ghreleases.Asset `json:"extras"`
}

type Platform struct {
	Platform    string `json:"platform"`
	Version     string `json:"version"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`

	// Current is false when this build predates the newest release.
	Current bool `json:"current"`

	Assets []ghreleases.Asset `json:"assets"`
}

// Downloads returns the newest stable release plus each platform's newest build.
func (s *Service) Downloads(ctx context.Context, locale string) Downloads {
	items, err := s.releases.Get(ctx)
	if err != nil || len(items) == 0 {
		return Downloads{Available: false}
	}

	newest := s.resolve(items[0], locale)

	return Downloads{
		Available:   true,
		Version:     newest.Version,
		PublishedAt: newest.PublishedAt,
		HTMLURL:     newest.HTMLURL,
		Notes:       newest.Notes,
		NotesLocale: newest.NotesLocale,
		Source:      items[0].rel.Source,
		Extras:      extrasOf(items[0].rel),
		Platforms:   newestByPlatform(items),
	}
}

// extrasOf returns non-OS files from this release only; non-nil so JSON gets [].
func extrasOf(rel ghreleases.Release) []ghreleases.Asset {
	out := make([]ghreleases.Asset, 0, len(rel.Assets))
	for _, a := range rel.Assets {
		if a.Platform == ghreleases.PlatformOther {
			out = append(out, a)
		}
	}
	return out
}

/*
newestByPlatform walks the releases newest first and gives each platform the
assets of the first release that has any for it.

All of a platform's files come from that one release. Mixing them would offer
a 2.1 installer beside a 2.0 portable build under one heading, and whichever
the reader picked would be the one they did not mean.
*/
func newestByPlatform(items []parsed) []Platform {
	byPlatform := map[string]*Platform{}
	var order []string

	for _, p := range items {
		for _, a := range p.rel.Assets {
			if a.Platform == "" || a.Platform == ghreleases.PlatformOther {
				continue
			}

			got, seen := byPlatform[a.Platform]
			if !seen {
				got = &Platform{
					Platform:    a.Platform,
					Version:     p.rel.Version,
					PublishedAt: p.rel.PublishedAt,
					HTMLURL:     p.rel.HTMLURL,
					Current:     p.rel.Version == items[0].rel.Version,
				}
				byPlatform[a.Platform] = got
				order = append(order, a.Platform)
			}
			// Pinned to one release; skip the same platform's older assets.
			if got.Version != p.rel.Version {
				continue
			}
			got.Assets = append(got.Assets, a)
		}
	}

	out := make([]Platform, 0, len(order))
	for _, k := range order {
		out = append(out, *byPlatform[k])
	}
	return out
}
