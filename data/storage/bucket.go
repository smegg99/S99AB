// data/storage/bucket.go

package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// BucketConfig points at an S3-compatible endpoint such as MinIO or S3.
type BucketConfig struct {
	// Endpoint is host:port, without a scheme. UseSSL decides the scheme.
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
	Region    string
	UseSSL    bool

	// PublicEndpoint is the host presigned URLs use when the browser cannot
	// reach Endpoint. Empty means Endpoint.
	PublicEndpoint string
}

// Bucket stores objects in an S3-compatible bucket and serves them through
// presigned URLs.
type Bucket struct {
	client *minio.Client
	cfg    BucketConfig
	// presign is bound to the public endpoint because a signature covers the
	// host.
	presign *minio.Client
}

// NewBucket connects and verifies the bucket exists, so a wrong name fails at
// boot.
func NewBucket(ctx context.Context, cfg BucketConfig) (*Bucket, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, fmt.Errorf("storage: endpoint and bucket are required")
	}

	client, err := newClient(cfg, cfg.Endpoint)
	if err != nil {
		return nil, err
	}

	ok, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("storage: reach bucket %q: %w", cfg.Bucket, err)
	}
	if !ok {
		return nil, fmt.Errorf("storage: bucket %q does not exist", cfg.Bucket)
	}

	b := &Bucket{client: client, cfg: cfg, presign: client}

	if cfg.PublicEndpoint != "" && cfg.PublicEndpoint != cfg.Endpoint {
		signer, err := newClient(cfg, cfg.PublicEndpoint)
		if err != nil {
			return nil, err
		}
		b.presign = signer
	}
	return b, nil
}

func newClient(cfg BucketConfig, endpoint string) (*minio.Client, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("storage: client for %s: %w", endpoint, err)
	}
	return client, nil
}

func (b *Bucket) Put(ctx context.Context, key string, r io.Reader, mime string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if mime == "" {
		mime = "application/octet-stream"
	}

	// Size -1 streams without knowing the length.
	_, err := b.client.PutObject(ctx, b.cfg.Bucket, key, r, -1,
		minio.PutObjectOptions{ContentType: mime})
	if err != nil {
		return fmt.Errorf("storage: put %s: %w", key, err)
	}
	return nil
}

func (b *Bucket) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	if err := checkKey(key); err != nil {
		return nil, err
	}

	obj, err := b.client.GetObject(ctx, b.cfg.Bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("storage: get %s: %w", key, err)
	}

	// GetObject is lazy; Stat forces the round trip so a missing object fails
	// here.
	if _, err := obj.Stat(); err != nil {
		obj.Close()
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, key)
		}
		return nil, fmt.Errorf("storage: stat %s: %w", key, err)
	}
	return obj, nil
}

// URL presigns a time-limited GET.
func (b *Bucket) URL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if err := checkKey(key); err != nil {
		return "", err
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}

	signed, err := b.presign.PresignedGetObject(ctx, b.cfg.Bucket, key, ttl, url.Values{})
	if err != nil {
		return "", fmt.Errorf("storage: presign %s: %w", key, err)
	}
	return signed.String(), nil
}

func (b *Bucket) Delete(ctx context.Context, key string) error {
	if err := checkKey(key); err != nil {
		return err
	}

	err := b.client.RemoveObject(ctx, b.cfg.Bucket, key, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("storage: delete %s: %w", key, err)
	}
	return nil
}

func (b *Bucket) Exists(ctx context.Context, key string) (bool, error) {
	if err := checkKey(key); err != nil {
		return false, err
	}

	_, err := b.client.StatObject(ctx, b.cfg.Bucket, key, minio.StatObjectOptions{})
	if err == nil {
		return true, nil
	}
	if isNotFound(err) {
		return false, nil
	}
	return false, fmt.Errorf("storage: exists %s: %w", key, err)
}

// isNotFound reads the S3 error code; messages differ between MinIO and S3.
func isNotFound(err error) bool {
	var resp minio.ErrorResponse
	if errors.As(err, &resp) {
		return resp.Code == "NoSuchKey" || resp.Code == "NoSuchBucket" || resp.StatusCode == 404
	}
	return false
}

var _ Storage = (*Bucket)(nil)
