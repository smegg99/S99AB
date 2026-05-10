// release/ghreleases/classify_test.go
package ghreleases

import "testing"

func TestClassify(t *testing.T) {
	tests := []struct {
		name     string
		file     string
		platform string
		arch     string
		kind     string
	}{
		{"linux appimage", "SmeggTuner-1.0.0-x86_64.AppImage", "linux", "x86_64", "appimage"},
		{"linux deb", "SmeggTuner_1.0.0_amd64.deb", "linux", "x86_64", "deb"},
		{"linux rpm no arch", "SmeggTuner-1.0.0.rpm", "linux", "", "rpm"},
		{"linux tarball", "SmeggTuner-1.0.0-linux-x86_64.tar.gz", "linux", "x86_64", "tar.gz"},
		{"linux tgz", "SmeggTuner-1.0.0-linux.tgz", "linux", "", "tar.gz"},
		{"windows installer", "SmeggTuner-1.0.0-setup.exe", "windows", "", "exe"},
		{"windows msix", "SmeggTuner-1.0.0.msix", "windows", "", "msix"},
		{"windows zip", "SmeggTuner-1.0.0-windows-x64.zip", "windows", "x86_64", "zip"},
		{"bare zip defaults to windows", "SmeggTuner-1.0.0.zip", "windows", "", "zip"},
		{"macos dmg arm", "SmeggTuner-1.0.0-macos-arm64.dmg", "macos", "arm64", "dmg"},
		{"macos universal dmg", "SmeggTuner-1.0.0-universal.dmg", "macos", "universal", "dmg"},

		// A macOS zip must not be reported as a windows build.
		{"macos zip", "SmeggTuner-1.0.0-macos-universal.zip", "macos", "universal", "zip"},
		{"darwin zip", "SmeggTuner-1.0.0-darwin-x86_64.zip", "macos", "x86_64", "zip"},

		// "apple" must not imply arm64.
		{"apple intel is x86_64", "SmeggTuner-1.0.0-apple-intel.dmg", "macos", "x86_64", "dmg"},
		{"apple silicon is arm64", "SmeggTuner-1.0.0-apple-silicon.dmg", "macos", "arm64", "dmg"},
		{"aarch64 is arm64", "SmeggTuner-1.0.0-linux-aarch64.tar.gz", "linux", "arm64", "tar.gz"},

		// Strict naming: <app>-<ver>-<os>-<arch>[.<ext>], and -installer.exe for NSIS.
		{"bare linux binary", "smeggtuner-1.0.0-linux-amd64", "linux", "x86_64", "binary"},
		{"arch package", "smeggtuner-1.0.0-linux-amd64.pkg.tar.zst", "linux", "x86_64", "pkg.tar.zst"},
		{"nsis installer", "smeggtuner-1.0.0-windows-amd64-installer.exe", "windows", "x86_64", "installer"},
		{"portable exe", "smeggtuner-1.0.0-windows-amd64.exe", "windows", "x86_64", "exe"},

		{"unknown extension", "checksums.txt", "other", "", "txt"},
		{"no extension", "LICENSE", "other", "", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			platform, arch, kind := classify(tc.file)
			if platform != tc.platform {
				t.Errorf("platform = %q, want %q", platform, tc.platform)
			}
			if arch != tc.arch {
				t.Errorf("arch = %q, want %q", arch, tc.arch)
			}
			if kind != tc.kind {
				t.Errorf("kind = %q, want %q", kind, tc.kind)
			}
		})
	}
}
