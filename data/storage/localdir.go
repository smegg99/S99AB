// data/storage/localdir.go

package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// LocalDir keeps objects as files under a root, for desktop apps, development and tests.
type LocalDir struct {
	root string
	// base prefixes the app-served path URL returns.
	base string
}

func NewLocalDir(root, base string) *LocalDir {
	return &LocalDir{root: root, base: base}
}

func (l *LocalDir) path(key string) (string, error) {
	if err := checkKey(key); err != nil {
		return "", err
	}
	return filepath.Join(l.root, filepath.FromSlash(key)), nil
}

func (l *LocalDir) Put(_ context.Context, key string, r io.Reader, _ string) error {
	path, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("storage: create %s: %w", filepath.Dir(path), err)
	}

	// Temp file and rename, so a crash cannot leave a truncated object.
	tmp, err := os.CreateTemp(filepath.Dir(path), ".put-*")
	if err != nil {
		return fmt.Errorf("storage: temp file: %w", err)
	}
	defer os.Remove(tmp.Name())

	if _, err := io.Copy(tmp, r); err != nil {
		tmp.Close()
		return fmt.Errorf("storage: write %s: %w", key, err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("storage: close %s: %w", key, err)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return fmt.Errorf("storage: commit %s: %w", key, err)
	}
	return nil
}

func (l *LocalDir) Get(_ context.Context, key string) (io.ReadCloser, error) {
	path, err := l.path(key)
	if err != nil {
		return nil, err
	}

	f, err := os.Open(path)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("%w: %q", ErrNotFound, key)
	}
	if err != nil {
		return nil, fmt.Errorf("storage: open %s: %w", key, err)
	}
	return f, nil
}

// URL returns a relative app-served path and ignores ttl; Bucket returns an absolute URL.
func (l *LocalDir) URL(_ context.Context, key string, _ time.Duration) (string, error) {
	if err := checkKey(key); err != nil {
		return "", err
	}

	// Escape each segment; escaping the whole key turns slashes into %2F.
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return l.base + "/" + strings.Join(parts, "/"), nil
}

func (l *LocalDir) Delete(_ context.Context, key string) error {
	path, err := l.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("storage: delete %s: %w", key, err)
	}
	// Deleting a missing object succeeds.
	return nil
}

func (l *LocalDir) Exists(_ context.Context, key string) (bool, error) {
	path, err := l.path(key)
	if err != nil {
		return false, err
	}
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("storage: stat %s: %w", key, err)
	}
	return true, nil
}

var _ Storage = (*LocalDir)(nil)
