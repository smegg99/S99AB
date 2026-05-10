// release/releases/releases.go

// Package releases turns GitHub releases into per-platform downloads and localized notes.
package releases

import (
	"context"
	"net/http"
	"time"

	"github.com/smegg99/s99ab/common/ttlcache"
	"github.com/smegg99/s99ab/release/ghreleases"
	"github.com/smegg99/s99ab/release/mdlocale"
)

const (
	defaultTTL     = 5 * time.Minute
	defaultHistory = 30
	defaultLocale  = "en"
)

type Options struct {
	Owner string
	Repo  string

	/*
		Token only raises the rate limit, and is optional: unauthenticated is 60
		requests an hour per address, which one call per TTL never approaches.

		A credential - source it from the environment, never a config file. With
		repo scope GitHub also returns unpublished drafts; ghreleases drops them.
	*/
	Token string

	// APIBase defaults to GitHub's public API.
	APIBase string
	// UserAgent should name the application, as GitHub asks.
	UserAgent string

	// TTL defaults to 5 minutes.
	TTL time.Duration
	// HistoryLimit defaults to 30; GitHub caps it at 100.
	HistoryLimit int
	// DefaultLocale is the language unmarked release notes are written in.
	DefaultLocale string

	HTTPClient *http.Client

	/*
		Reports a failed refresh. The cache serves the last good value and
		returns no error, so without this a repository that has gone unreachable
		is invisible.

		A hook rather than a logger: the package has no opinion on where a line
		goes, and an app already has one.
	*/
	Observe func(error)
}

type Service struct {
	client        *ghreleases.Client
	defaultLocale string
	observe       func(error)

	releases *ttlcache.Cached[[]parsed]
	repo     *ttlcache.Cached[ghreleases.Repo]
}

// parsed caches the locale split so it is not redone per request.
type parsed struct {
	rel   ghreleases.Release
	notes mdlocale.Sections
}

func New(opts Options) *Service {
	if opts.TTL <= 0 {
		opts.TTL = defaultTTL
	}
	if opts.HistoryLimit <= 0 {
		opts.HistoryLimit = defaultHistory
	}
	if opts.DefaultLocale == "" {
		opts.DefaultLocale = defaultLocale
	}

	client := ghreleases.New(ghreleases.Options{
		Owner:      opts.Owner,
		Repo:       opts.Repo,
		BaseURL:    opts.APIBase,
		Token:      opts.Token,
		UserAgent:  opts.UserAgent,
		HTTPClient: opts.HTTPClient,
	})

	s := &Service{
		client:        client,
		defaultLocale: opts.DefaultLocale,
		observe:       opts.Observe,
	}

	s.releases = ttlcache.New(opts.TTL, func(ctx context.Context) ([]parsed, error) {
		all, err := client.List(ctx, opts.HistoryLimit)
		if err != nil {
			s.report(err)
			return nil, err
		}

		stable := ghreleases.Stable(all)
		out := make([]parsed, 0, len(stable))
		for _, r := range stable {
			out = append(out, parsed{rel: r, notes: mdlocale.Split(r.Body)})
		}
		return out, nil
	})

	s.repo = ttlcache.New(opts.TTL, func(ctx context.Context) (ghreleases.Repo, error) {
		info, err := client.Repo(ctx)
		if err != nil {
			s.report(err)
		}
		return info, err
	})

	return s
}

func (s *Service) report(err error) {
	if s.observe != nil {
		s.observe(err)
	}
}

type Release struct {
	Available   bool               `json:"available"`
	Version     string             `json:"version"`
	Name        string             `json:"name"`
	PublishedAt string             `json:"published_at"`
	HTMLURL     string             `json:"html_url"`
	Assets      []ghreleases.Asset `json:"assets"`
	Source      []ghreleases.Asset `json:"source"`

	Notes string `json:"notes"`
	// NotesLocale differs from the requested locale when the body had no section for it.
	NotesLocale string `json:"notes_locale"`
}

/*
Latest is the newest stable release.

The first of List rather than GitHub's own /releases/latest, so the download
card and the changelog cannot disagree - they are one fetch. The two differ
only where a repository pins an older release with "Set as latest".
*/
func (s *Service) Latest(ctx context.Context, locale string) Release {
	list := s.List(ctx, locale)
	if len(list) == 0 {
		return Release{Available: false}
	}
	return list[0]
}

// List returns stable releases, newest first; empty when none exist or GitHub is
// unreachable with nothing cached.
func (s *Service) List(ctx context.Context, locale string) []Release {
	items, err := s.releases.Get(ctx)
	if err != nil {
		return nil
	}

	out := make([]Release, 0, len(items))
	for _, p := range items {
		out = append(out, s.resolve(p, locale))
	}
	return out
}

// RepoStats reports unavailable instead of an error when the counters cannot be fetched.
func (s *Service) RepoStats(ctx context.Context) RepoStats {
	info, err := s.repo.Get(ctx)
	if err != nil {
		return RepoStats{Available: false}
	}
	return RepoStats{
		Available: true,
		Stars:     info.Stars,
		Forks:     info.Forks,
		HTMLURL:   info.HTMLURL,
	}
}

type RepoStats struct {
	Available bool   `json:"available"`
	Stars     int    `json:"stars"`
	Forks     int    `json:"forks"`
	HTMLURL   string `json:"html_url"`
}

func (s *Service) resolve(p parsed, locale string) Release {
	if locale == "" {
		locale = s.defaultLocale
	}

	notes, matched := p.notes.For(locale)
	notesLocale := locale
	if !matched {
		// Unmarked notes are written in the default locale.
		notesLocale = s.defaultLocale
	}

	return Release{
		Available:   true,
		Version:     p.rel.Version,
		Name:        p.rel.Name,
		PublishedAt: p.rel.PublishedAt,
		HTMLURL:     p.rel.HTMLURL,
		Assets:      p.rel.Assets,
		Source:      p.rel.Source,
		Notes:       notes,
		NotesLocale: notesLocale,
	}
}
