// data/storage/bucket_test.go

package storage_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/smegg99/s99ab/data/storage"
)

// The bucket tests need a real S3 endpoint and skip without one.
// S99AB_MINIO_ENDPOINT overrides the default:
//
//	docker run -d --name s99ab-minio -p 9400:9000 \
//	  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
//	  quay.io/minio/minio server /data
const defaultEndpoint = "127.0.0.1:9400"

func endpoint() string {
	if v := os.Getenv("S99AB_MINIO_ENDPOINT"); v != "" {
		return v
	}
	return defaultEndpoint
}

func reachable(addr string) bool {
	client := http.Client{Timeout: 750 * time.Millisecond}

	resp, err := client.Get("http://" + addr + "/minio/health/live")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// bucket returns a Bucket backed by a freshly created, uniquely named bucket.
func bucket(t *testing.T) *storage.Bucket {
	t.Helper()

	addr := endpoint()
	if !reachable(addr) {
		t.Skipf("no S3 endpoint at %s; see the comment in bucket_test.go", addr)
	}

	name := "test-" + strings.ToLower(strings.ReplaceAll(t.Name(), "_", "-"))
	if len(name) > 60 {
		name = name[:60]
	}

	ctx := context.Background()
	admin, err := minio.New(addr, &minio.Options{
		Creds: credentials.NewStaticV4("minioadmin", "minioadmin", ""),
	})
	if err != nil {
		t.Fatal(err)
	}

	_ = admin.RemoveBucket(ctx, name)
	if err := admin.MakeBucket(ctx, name, minio.MakeBucketOptions{}); err != nil {
		t.Fatalf("create bucket %s: %v", name, err)
	}
	t.Cleanup(func() {
		for obj := range admin.ListObjects(ctx, name, minio.ListObjectsOptions{Recursive: true}) {
			_ = admin.RemoveObject(ctx, name, obj.Key, minio.RemoveObjectOptions{})
		}
		_ = admin.RemoveBucket(ctx, name)
	})

	b, err := storage.NewBucket(ctx, storage.BucketConfig{
		Endpoint:  addr,
		Bucket:    name,
		AccessKey: "minioadmin",
		SecretKey: "minioadmin",
	})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func key(body string) string {
	sum := sha256.Sum256([]byte(body))
	k, _ := storage.Key("uploads", hex.EncodeToString(sum[:]))
	return k
}

func TestBucketPutGet(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()

	const body = "the bytes"
	k := key(body)

	if err := b.Put(ctx, k, strings.NewReader(body), "text/plain"); err != nil {
		t.Fatal(err)
	}

	r, err := b.Get(ctx, k)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	got, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != body {
		t.Fatalf("got %q, want %q", got, body)
	}
}

// GetObject is lazy, so Get must force the round trip.
func TestBucketGetMissingIsNotFound(t *testing.T) {
	b := bucket(t)

	_, err := b.Get(context.Background(), key("nothing here"))
	if !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestBucketExists(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()
	k := key("present")

	ok, err := b.Exists(ctx, k)
	if err != nil || ok {
		t.Fatalf("exists before put = %v, %v", ok, err)
	}

	if err := b.Put(ctx, k, strings.NewReader("present"), "text/plain"); err != nil {
		t.Fatal(err)
	}

	ok, err = b.Exists(ctx, k)
	if err != nil || !ok {
		t.Fatalf("exists after put = %v, %v", ok, err)
	}
}

func TestBucketDelete(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()
	k := key("temporary")

	if err := b.Put(ctx, k, strings.NewReader("temporary"), "text/plain"); err != nil {
		t.Fatal(err)
	}
	if err := b.Delete(ctx, k); err != nil {
		t.Fatal(err)
	}

	ok, err := b.Exists(ctx, k)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("object survived a delete")
	}
}

func TestBucketDeleteMissingIsFine(t *testing.T) {
	if err := bucket(t).Delete(context.Background(), key("never existed")); err != nil {
		t.Fatalf("err = %v", err)
	}
}
