// release/releases/downloads_test.go

package releases

import (
	"encoding/json"
	"testing"

	"github.com/smegg99/s99ab/release/ghreleases"
	"github.com/smegg99/s99ab/release/mdlocale"
)

func rel(version string, platforms ...string) parsed {
	r := ghreleases.Release{Version: version, PublishedAt: version + "-date"}
	for _, p := range platforms {
		r.Assets = append(r.Assets, ghreleases.Asset{
			Name:     version + "-" + p,
			Platform: p,
		})
	}
	return parsed{rel: r, notes: mdlocale.Split(r.Body)}
}

func platformOf(t *testing.T, ps []Platform, name string) Platform {
	t.Helper()
	for _, p := range ps {
		if p.Platform == name {
			return p
		}
	}
	t.Fatalf("no %s platform in %+v", name, ps)
	return Platform{}
}

// A release that skipped macOS must not blank out the macOS build before it.
func TestPlatformBehindKeepsItsNewestBuild(t *testing.T) {
	items := []parsed{
		rel("v1.0.1", "linux", "windows"),
		rel("v1.0.0", "linux", "windows", "macos"),
	}

	got := newestByPlatform(items)

	mac := platformOf(t, got, "macos")
	if mac.Version != "v1.0.0" {
		t.Errorf("macos version = %q, want v1.0.0 carried forward", mac.Version)
	}
	if mac.Current {
		t.Error("macos current = true, want false: it is behind the newest release")
	}
	if len(mac.Assets) != 1 || mac.Assets[0].Name != "v1.0.0-macos" {
		t.Errorf("macos assets = %+v, want the v1.0.0 build", mac.Assets)
	}

	linux := platformOf(t, got, "linux")
	if linux.Version != "v1.0.1" || !linux.Current {
		t.Errorf("linux = %q current=%v, want v1.0.1 current", linux.Version, linux.Current)
	}
}

// A platform takes all its files from one release.
func TestPlatformNeverMixesReleases(t *testing.T) {
	newer := rel("v2.0.0")
	newer.rel.Assets = []ghreleases.Asset{
		{Name: "new.dmg", Platform: "macos", Kind: "dmg"},
	}
	older := rel("v1.0.0")
	older.rel.Assets = []ghreleases.Asset{
		{Name: "old.dmg", Platform: "macos", Kind: "dmg"},
		{Name: "old.zip", Platform: "macos", Kind: "zip"},
	}

	got := newestByPlatform([]parsed{newer, older})

	mac := platformOf(t, got, "macos")
	if len(mac.Assets) != 1 || mac.Assets[0].Name != "new.dmg" {
		t.Errorf("macos assets = %+v, want only v2.0.0's own", mac.Assets)
	}
}

// Checksums and signatures must not become a platform tab of their own.
func TestUnclassifiedAssetsAreNotPlatforms(t *testing.T) {
	items := []parsed{rel("v1.0.0", "linux", ghreleases.PlatformOther)}

	got := newestByPlatform(items)

	for _, p := range got {
		if p.Platform == ghreleases.PlatformOther {
			t.Errorf("%q became a platform", ghreleases.PlatformOther)
		}
	}
	if len(got) != 1 {
		t.Errorf("platforms = %+v, want linux only", got)
	}
}

// A checksum describes only its own release, so extras are not carried forward.
func TestExtrasComeFromTheNewestReleaseOnly(t *testing.T) {
	newest := ghreleases.Release{
		Version: "v1.0.1",
		Assets: []ghreleases.Asset{
			{Name: "checksums.txt", Platform: ghreleases.PlatformOther},
			{Name: "app.AppImage", Platform: "linux"},
		},
	}

	got := extrasOf(newest)

	if len(got) != 1 || got[0].Name != "checksums.txt" {
		t.Errorf("extras = %+v, want only checksums.txt", got)
	}
}

func TestNoReleasesMeansNothingToOffer(t *testing.T) {
	if got := newestByPlatform(nil); len(got) != 0 {
		t.Errorf("platforms = %+v, want none", got)
	}
}

// A nil slice marshals to JSON null and the page maps over these lists.
func TestEmptyListsMarshalAsListsNotNull(t *testing.T) {
	rel := ghreleases.Release{
		Version: "v1.0.1",
		Assets:  []ghreleases.Asset{{Name: "app.AppImage", Platform: "linux"}},
	}

	body, err := json.Marshal(map[string]any{
		"extras":    extrasOf(rel),
		"platforms": newestByPlatform([]parsed{{rel: rel}}),
	})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var got map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	for _, k := range []string{"extras", "platforms"} {
		if got[k] == nil {
			t.Errorf("%s marshalled to null, want []", k)
		}
	}
}

func TestAllCurrentWhenTheNewestReleaseShipsEverything(t *testing.T) {
	items := []parsed{
		rel("v2.0.0", "linux", "windows", "macos"),
		rel("v1.0.0", "linux", "windows", "macos"),
	}

	for _, p := range newestByPlatform(items) {
		if !p.Current || p.Version != "v2.0.0" {
			t.Errorf("%s = %q current=%v, want v2.0.0 current", p.Platform, p.Version, p.Current)
		}
	}
}
