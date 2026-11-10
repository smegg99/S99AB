// data/storage/localdir.go

package storage

import (
	"context"
	"crypto/rand"
	"errors"
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

func (l *LocalDir) open(ctx context.Context, key string, create bool) (*os.Root, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := checkKey(key); err != nil {
		return nil, err
	}
	if create {
		if err := os.MkdirAll(l.root, 0o755); err != nil {
			return nil, err
		}
	}
	return os.OpenRoot(l.root)
}

// Put flushes file data before an atomic rename; callers must supply a reader that can stop on cancellation.
func (l *LocalDir) Put(ctx context.Context, key string, r io.Reader, _ string) error {
	root, err := l.open(ctx, key, true)
	if err != nil {
		return err
	}
	defer root.Close()
	path := filepath.FromSlash(key)
	dir := filepath.Dir(path)
	if err := root.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("storage: create directory: %w", err)
	}
	name := filepath.Join(dir, ".put-"+rand.Text())
	tmp, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("storage: temp file: %w", err)
	}
	defer root.Remove(name)
	_, copyErr := io.Copy(tmp, &cancelReader{ctx: ctx, reader: r})
	if copyErr == nil {
		copyErr = ctx.Err()
	}
	if copyErr == nil {
		copyErr = tmp.Sync()
	}
	closeErr := tmp.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		return fmt.Errorf("storage: write %s: %w", key, err)
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := root.Rename(name, path); err != nil {
		return fmt.Errorf("storage: commit %s: %w", key, err)
	}
	return nil
}

type cancelReader struct {
	ctx    context.Context
	reader io.Reader
}

func (r *cancelReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.reader.Read(p)
}

func (l *LocalDir) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	root, err := l.open(ctx, key, false)
	if os.IsNotExist(err) {
		return nil, fmt.Errorf("%w: %q", ErrNotFound, key)
	}
	if err != nil {
		return nil, err
	}
	defer root.Close()
	f, err := root.Open(filepath.FromSlash(key))
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

func (l *LocalDir) Delete(ctx context.Context, key string) error {
	root, err := l.open(ctx, key, false)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer root.Close()
	if err := root.Remove(filepath.FromSlash(key)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("storage: delete %s: %w", key, err)
	}
	return nil
}

func (l *LocalDir) Exists(ctx context.Context, key string) (bool, error) {
	root, err := l.open(ctx, key, false)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer root.Close()
	_, err = root.Stat(filepath.FromSlash(key))
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("storage: stat %s: %w", key, err)
	}
	return true, nil
}

var _ Storage = (*LocalDir)(nil)
