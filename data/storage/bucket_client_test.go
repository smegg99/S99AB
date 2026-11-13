// data/storage/bucket_client_test.go

package storage_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/smegg99/s99ab/v2/data/storage"
)

func TestBucketStreamsMultipartAndEmptyObjects(t *testing.T) {
	b := bucket(t)
	for _, size := range []int{0, 6<<20 + 137} {
		data := bytes.Repeat([]byte("x"), size)
		k := key(string(data))
		if err := b.Put(t.Context(), k, struct{ io.Reader }{bytes.NewReader(data)}, ""); err != nil {
			t.Fatal(err)
		}
		reader, err := b.Get(t.Context(), k)
		if err != nil {
			t.Fatal(err)
		}
		got, err := io.ReadAll(reader)
		_ = reader.Close()
		if err != nil || !bytes.Equal(got, data) {
			t.Fatalf("streamed %d bytes: read error %v, got %d", size, err, len(got))
		}
	}
}

type failingReader struct {
	err    error
	cancel context.CancelFunc
}

func (r failingReader) Read([]byte) (int, error) {
	if r.cancel != nil {
		r.cancel()
	}
	return 0, r.err
}

func TestBucketAbortsFailedMultipartUploads(t *testing.T) {
	for _, cancelled := range []bool{false, true} {
		t.Run(map[bool]string{false: "read failure", true: "cancelled"}[cancelled], func(t *testing.T) {
			cfg := bucketConfig(t)
			b, err := storage.NewBucket(t.Context(), cfg)
			if err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			want := errors.New("source read failed")
			failure := failingReader{err: want}
			if cancelled {
				want = context.Canceled
				failure = failingReader{err: want, cancel: cancel}
			}
			body := io.MultiReader(bytes.NewReader(bytes.Repeat([]byte("x"), 6<<20)), failure)
			k := key("incomplete upload")
			if err := b.Put(ctx, k, body, "text/plain"); !errors.Is(err, want) {
				t.Fatalf("upload error = %v, want %v", err, want)
			}
			if exists, err := b.Exists(t.Context(), k); err != nil || exists {
				t.Fatalf("failed upload became visible: %v, %v", exists, err)
			}
			admin := s3.New(s3.Options{BaseEndpoint: aws.String("http://" + cfg.Endpoint), Region: "us-east-1", UsePathStyle: true,
				Credentials: credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")})
			pending, err := admin.ListMultipartUploads(t.Context(), &s3.ListMultipartUploadsInput{Bucket: aws.String(cfg.Bucket)})
			if err != nil || len(pending.Uploads) != 0 {
				t.Fatalf("multipart cleanup failed: %v", err)
			}
		})
	}
}

func TestBucketSignsThePublicEndpoint(t *testing.T) {
	cfg := bucketConfig(t)
	target, _ := url.Parse("http://" + cfg.Endpoint)
	proxy := httptest.NewServer(httputil.NewSingleHostReverseProxy(target))
	t.Cleanup(proxy.Close)
	cfg.PublicEndpoint = strings.TrimPrefix(proxy.URL, "http://")
	b, err := storage.NewBucket(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	k := key("public endpoint signing")
	if err := b.Put(t.Context(), k, strings.NewReader("signed content"), "text/plain"); err != nil {
		t.Fatal(err)
	}
	link, err := b.URL(t.Context(), k, 0)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(link)
	if u.Host != cfg.PublicEndpoint || u.Query().Get("X-Amz-Expires") != "300" {
		t.Fatal("public endpoint or default expiry differs")
	}
	response, err := http.Get(link)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(response.Body)
	_ = response.Body.Close()
	if err != nil || response.StatusCode != 200 || string(data) != "signed content" {
		t.Fatalf("public signed request: status %d, error %v", response.StatusCode, err)
	}
	if _, err := b.URL(t.Context(), k, 7*24*time.Hour+time.Second); err == nil {
		t.Fatal("accepted an expiry longer than seven days")
	}
}

func TestBucketRejectsInvalidEndpoints(t *testing.T) {
	for _, endpoint := range []string{"http://localhost:8333", "localhost/path", "user:secret@localhost", "localhost?x=y", "localhost#fragment", "localhost:bad"} {
		if _, err := storage.NewBucket(t.Context(), storage.BucketConfig{Endpoint: endpoint, Bucket: "uploads"}); err == nil {
			t.Fatalf("accepted invalid endpoint %q", endpoint)
		}
	}
}
