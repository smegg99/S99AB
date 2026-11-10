// data/storage/bucket_test.go

package storage_test

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"github.com/smegg99/s99ab/data/storage"
)

func s3Endpoint(t *testing.T) string {
	t.Helper()
	addr := os.Getenv("S99AB_TEST_S3_ENDPOINT")
	if addr == "" {
		if os.Getenv("S99AB_REQUIRE_INTEGRATION") == "1" {
			t.Fatal("S99AB_TEST_S3_ENDPOINT is required")
		}
		t.Skip("run just test-services for SeaweedFS coverage")
	}
	return addr
}

func bucketConfig(t *testing.T) storage.BucketConfig {
	t.Helper()
	addr := s3Endpoint(t)
	name := "s99ab-" + strings.ToLower(rand.Text())
	ctx := context.Background()
	admin := s3.New(s3.Options{
		BaseEndpoint: aws.String("http://" + addr), Region: "us-east-1", UsePathStyle: true,
		Credentials: credentials.NewStaticCredentialsProvider(os.Getenv("S99AB_TEST_S3_ACCESS_KEY"), os.Getenv("S99AB_TEST_S3_SECRET_KEY"), ""),
	})

	if _, err := admin.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: aws.String(name)}); err != nil {
		t.Fatalf("create bucket %s: %v", name, err)
	}
	t.Cleanup(func() {
		pages := s3.NewListObjectsV2Paginator(admin, &s3.ListObjectsV2Input{Bucket: aws.String(name)})
		for pages.HasMorePages() {
			page, err := pages.NextPage(ctx)
			if err != nil {
				t.Errorf("list owned bucket: %v", err)
				break
			}
			for _, obj := range page.Contents {
				if _, err := admin.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(name), Key: obj.Key}); err != nil {
					t.Errorf("delete owned object: %v", err)
				}
			}
		}
		if _, err := admin.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(name)}); err != nil {
			t.Errorf("remove owned bucket: %v", err)
		}
	})

	return storage.BucketConfig{
		Endpoint:  addr,
		Bucket:    name,
		AccessKey: os.Getenv("S99AB_TEST_S3_ACCESS_KEY"),
		SecretKey: os.Getenv("S99AB_TEST_S3_SECRET_KEY"),
	}
}

func bucket(t *testing.T) *storage.Bucket {
	t.Helper()
	b, err := storage.NewBucket(t.Context(), bucketConfig(t))
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
