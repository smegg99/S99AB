// work/daemon/socket.go
package daemon

import (
	"os"
	"path/filepath"
)

// afUnixBound stays under sun_path (108 bytes on Linux, 104 on macOS/BSD).
const afUnixBound = 100

// XDGSocket returns $XDG_RUNTIME_DIR/<app>/<file> and creates its directory
// 0700. ok is false when that fails or the path is too long; the caller picks a fallback.
func XDGSocket(app, file string) (string, bool) {
	xdg := os.Getenv("XDG_RUNTIME_DIR")
	if xdg == "" {
		return "", false
	}
	dir := filepath.Join(xdg, app)
	path := filepath.Join(dir, file)
	if len(path) >= afUnixBound {
		return "", false
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", false
	}
	return path, true
}
