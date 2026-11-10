// data/storage/presign_test.go

package storage_test

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/smegg99/s99ab/data/storage"
)

func TestPresignedURLServesTheBytes(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()

	const body = "presigned content"
	k := key(body)
	if err := b.Put(ctx, k, strings.NewReader(body), "text/plain"); err != nil {
		t.Fatal(err)
	}

	link, err := b.URL(ctx, k, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(link, "X-Amz-Signature") {
		t.Fatalf("not a presigned URL: %s", link)
	}

	resp, err := http.Get(link)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("presigned GET = %d", resp.StatusCode)
	}
	got, _ := io.ReadAll(resp.Body)
	if string(got) != body {
		t.Fatalf("got %q, want %q", got, body)
	}
}

func TestUnsignedFetchIsRefused(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()

	k := key("private")
	if err := b.Put(ctx, k, strings.NewReader("private"), "text/plain"); err != nil {
		t.Fatal(err)
	}

	link, err := b.URL(ctx, k, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	bare, _, _ := strings.Cut(link, "?")

	resp, err := http.Get(bare)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		t.Fatal("the object is readable without a signature")
	}
}

func TestBucketRejectsBadKeys(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()

	for _, k := range []string{"../escape", "/absolute", ""} {
		if err := b.Put(ctx, k, strings.NewReader("x"), "text/plain"); !errors.Is(err, storage.ErrKey) {
			t.Errorf("Put(%q) = %v, want ErrKey", k, err)
		}
		if _, err := b.Get(ctx, k); !errors.Is(err, storage.ErrKey) {
			t.Errorf("Get(%q) = %v, want ErrKey", k, err)
		}
		if _, err := b.Exists(ctx, k); !errors.Is(err, storage.ErrKey) {
			t.Errorf("Exists(%q) = %v, want ErrKey", k, err)
		}
	}
}

func TestMissingBucketFailsAtConstruction(t *testing.T) {
	addr := s3Endpoint(t)

	_, err := storage.NewBucket(context.Background(), storage.BucketConfig{
		Endpoint:  addr,
		Bucket:    "does-not-exist-at-all",
		AccessKey: os.Getenv("S99AB_TEST_S3_ACCESS_KEY"),
		SecretKey: os.Getenv("S99AB_TEST_S3_SECRET_KEY"),
	})
	if err == nil {
		t.Fatal("a missing bucket was accepted; the failure would surface under a user's upload")
	}
	if !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("err = %v", err)
	}
}

// Accept and Derive take the interface, so both implementations share a path.
func TestAcceptAndDeriveWorkAgainstABucket(t *testing.T) {
	b := bucket(t)
	ctx := context.Background()

	png := pngBytes(t, 120, 90)

	obj, err := storage.Accept(ctx, b, bytes.NewReader(png), storage.AcceptOptions{
		MaxBytes: 1 << 20,
		Allow:    []string{"image/png"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if obj.Mime != "image/png" {
		t.Fatalf("mime = %q", obj.Mime)
	}

	derived, err := storage.Derive(ctx, b, obj.Key, storage.ResizeOptions{Width: 40})
	if err != nil {
		t.Fatal(err)
	}
	if derived == obj.Key {
		t.Fatal("the derivative shares the original's key")
	}

	ok, err := b.Exists(ctx, derived)
	if err != nil || !ok {
		t.Fatalf("derivative missing: %v, %v", ok, err)
	}

	// Second call is a cache hit.
	again, err := storage.Derive(ctx, b, obj.Key, storage.ResizeOptions{Width: 40})
	if err != nil || again != derived {
		t.Fatalf("second derive = %q, %v", again, err)
	}
}
