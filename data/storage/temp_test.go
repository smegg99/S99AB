// data/storage/temp_test.go

package storage_test

import (
	"context"
	"io"
	"net/url"
	"strings"
	"testing"

	"github.com/smegg99/s99ab/v2/data/storage"
)

func TestTempLocalStoresAndReadsBack(t *testing.T) {
	st := storage.TempLocal(t)
	ctx := context.Background()

	const key = "uploads/ab/cd/deadbeef"
	if err := st.Put(ctx, key, strings.NewReader("hello"), "text/plain"); err != nil {
		t.Fatalf("put: %v", err)
	}

	r, err := st.Get(ctx, key)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer r.Close()

	body, err := io.ReadAll(r)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "hello" {
		t.Fatalf("body = %q, want hello", body)
	}
}

// A handler streams the bytes itself when URL is relative.
func TestTempLocalReturnsARelativeURL(t *testing.T) {
	st := storage.TempLocal(t)

	link, err := st.URL(context.Background(), "uploads/ab/cd/deadbeef", 0)
	if err != nil {
		t.Fatalf("url: %v", err)
	}

	u, err := url.Parse(link)
	if err != nil {
		t.Fatalf("parse %q: %v", link, err)
	}
	if u.IsAbs() {
		t.Fatalf("url = %q; a store that cannot presign must not look like one that can", link)
	}
}

func TestTwoTempStoresAreSeparate(t *testing.T) {
	first, second := storage.TempLocal(t), storage.TempLocal(t)
	ctx := context.Background()

	const key = "uploads/ab/cd/deadbeef"
	if err := first.Put(ctx, key, strings.NewReader("x"), "text/plain"); err != nil {
		t.Fatalf("put: %v", err)
	}

	exists, err := second.Exists(ctx, key)
	if err != nil {
		t.Fatalf("exists: %v", err)
	}
	if exists {
		t.Fatal("the second store saw the first store's object")
	}
}
