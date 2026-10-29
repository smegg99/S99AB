// data/storage/storage.go

// Package storage stores uploaded bytes in a local directory or an S3 bucket.
package storage

import (
	"context"
	"errors"
	"io"
	"time"
)

var (
	ErrNotFound = errors.New("storage: no such object")
	ErrTooLarge = errors.New("storage: object is too large")
	ErrMimeType = errors.New("storage: content type is not allowed")
	ErrKey      = errors.New("storage: invalid key")
)

// Storage is implemented by LocalDir and Bucket.
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, mime string) error
	Get(ctx context.Context, key string) (io.ReadCloser, error)
	// URL is a presigned link, or a relative app-served path for LocalDir.
	URL(ctx context.Context, key string, ttl time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
	Exists(ctx context.Context, key string) (bool, error)
}

// Object describes an accepted upload for the caller to store beside its own metadata.
type Object struct {
	Key    string `json:"key"`
	Mime   string `json:"mime"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}
