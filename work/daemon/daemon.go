// work/daemon/daemon.go

// Package daemon runs HTTP over a unix socket and starts the daemon on demand.
package daemon

import (
	"context"
	"errors"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// ErrRunning is returned by Listen when a live process already answers on the socket.
var ErrRunning = errors.New("daemon: already running on this socket")

// dialTimeout bounds the liveness probe against a socket whose owner has died.
const dialTimeout = 500 * time.Millisecond

// Transport returns an http.Transport that dials the unix socket at path for
// every URL host.
func Transport(path string) *http.Transport {
	return &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", path)
		},
	}
}

// Dial returns an http.Client for the unix socket at path; the URL host is ignored.
func Dial(path string) *http.Client {
	return &http.Client{Transport: Transport(path)}
}

// Listen listens on the unix socket at path, returning ErrRunning if a live
// process owns it and removing a stale one. The directory is 0700, the socket 0600.
func Listen(path string) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}

	// A socket that exists but does not answer is left over from a crash.
	if _, err := os.Stat(path); err == nil {
		if live(path) {
			return nil, ErrRunning
		}
		if err := os.Remove(path); err != nil {
			return nil, err
		}
	}

	ln, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	if err := os.Chmod(path, 0o600); err != nil {
		_ = ln.Close()
		return nil, err
	}
	return ln, nil
}

// live reports whether something is accepting connections on the socket.
func live(path string) bool {
	conn, err := net.DialTimeout("unix", path, dialTimeout)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}
