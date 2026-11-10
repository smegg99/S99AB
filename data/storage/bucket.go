// data/storage/bucket.go

package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/transfermanager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"
)

// BucketConfig points at an S3-compatible endpoint such as SeaweedFS or S3.
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

// Bucket stores objects in an S3-compatible bucket and serves presigned URLs.
type Bucket struct {
	client *s3.Client
	cfg    BucketConfig
	upload *transfermanager.Client
	// The signature covers the host, so public URLs need their own signer.
	presign *s3.PresignClient
}

// NewBucket connects and checks the bucket exists, so a wrong name fails at boot.
func NewBucket(ctx context.Context, cfg BucketConfig) (*Bucket, error) {
	if cfg.Endpoint == "" || cfg.Bucket == "" {
		return nil, fmt.Errorf("storage: endpoint and bucket are required")
	}

	client, err := newClient(cfg, cfg.Endpoint)
	if err != nil {
		return nil, err
	}

	_, err = client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(cfg.Bucket)})
	if err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("storage: bucket %q does not exist", cfg.Bucket)
		}
		return nil, fmt.Errorf("storage: reach bucket %q: %w", cfg.Bucket, err)
	}

	b := &Bucket{client: client, cfg: cfg, presign: s3.NewPresignClient(client)}
	b.upload = transfermanager.New(client, func(o *transfermanager.Options) {
		o.PartSizeBytes = 5 << 20
		o.Concurrency = 1
		o.FailTimeout = 5 * time.Second
	})

	if cfg.PublicEndpoint != "" && cfg.PublicEndpoint != cfg.Endpoint {
		signer, err := newClient(cfg, cfg.PublicEndpoint)
		if err != nil {
			return nil, err
		}
		b.presign = s3.NewPresignClient(signer)
	}
	return b, nil
}

func newClient(cfg BucketConfig, endpoint string) (*s3.Client, error) {
	scheme := "http"
	if cfg.UseSSL {
		scheme = "https"
	}
	u, err := url.Parse(scheme + "://" + endpoint)
	if err != nil || u.Host == "" || u.Host != endpoint || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
		return nil, fmt.Errorf("storage: endpoint must be a host with an optional port")
	}
	region := cfg.Region
	if region == "" {
		region = "us-east-1"
	}
	return s3.New(s3.Options{
		BaseEndpoint: aws.String(u.String()), UsePathStyle: true, Region: region,
		Credentials: credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	}), nil
}

func (b *Bucket) Put(ctx context.Context, key string, r io.Reader, mime string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if mime == "" {
		mime = "application/octet-stream"
	}

	_, err := b.upload.UploadObject(ctx, &transfermanager.UploadObjectInput{
		Bucket: aws.String(b.cfg.Bucket), Key: aws.String(key), Body: r, ContentType: aws.String(mime),
	})
	if err != nil {
		return fmt.Errorf("storage: put %s: %w", key, err)
	}
	return nil
}

func (b *Bucket) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	if err := checkKey(key); err != nil {
		return nil, err
	}

	obj, err := b.client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(b.cfg.Bucket), Key: aws.String(key)})
	if err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, key)
		}
		return nil, fmt.Errorf("storage: get %s: %w", key, err)
	}
	return obj.Body, nil
}

// URL presigns a time-limited GET.
func (b *Bucket) URL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	if err := checkKey(key); err != nil {
		return "", err
	}
	if ttl <= 0 {
		ttl = 5 * time.Minute
	}
	if ttl > 7*24*time.Hour {
		return "", fmt.Errorf("storage: presigned URL lifetime exceeds seven days")
	}

	signed, err := b.presign.PresignGetObject(ctx,
		&s3.GetObjectInput{Bucket: aws.String(b.cfg.Bucket), Key: aws.String(key)},
		func(o *s3.PresignOptions) { o.Expires = ttl })
	if err != nil {
		return "", fmt.Errorf("storage: presign %s: %w", key, err)
	}
	return signed.URL, nil
}

func (b *Bucket) Delete(ctx context.Context, key string) error {
	if err := checkKey(key); err != nil {
		return err
	}

	_, err := b.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(b.cfg.Bucket), Key: aws.String(key)})
	if err != nil {
		return fmt.Errorf("storage: delete %s: %w", key, err)
	}
	return nil
}

func (b *Bucket) Exists(ctx context.Context, key string) (bool, error) {
	if err := checkKey(key); err != nil {
		return false, err
	}

	_, err := b.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(b.cfg.Bucket), Key: aws.String(key)})
	if err == nil {
		return true, nil
	}
	if isNotFound(err) {
		return false, nil
	}
	return false, fmt.Errorf("storage: exists %s: %w", key, err)
}

// HEAD responses may omit the S3 error body.
func isNotFound(err error) bool {
	var api smithy.APIError
	if errors.As(err, &api) && (api.ErrorCode() == "NoSuchKey" || api.ErrorCode() == "NoSuchBucket" || api.ErrorCode() == "NotFound") {
		return true
	}
	var response *smithyhttp.ResponseError
	return errors.As(err, &response) && response.HTTPStatusCode() == 404
}

var _ Storage = (*Bucket)(nil)
