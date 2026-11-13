// data/storage/storage_test.go

package storage_test

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/smegg99/s99ab/v2/data/storage"
)

func local(t *testing.T) *storage.LocalDir {
	t.Helper()
	return storage.NewLocalDir(t.TempDir(), "/api/v1/files")
}

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := range w {
		for y := range h {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), 0, 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestPutGetRoundTrip(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	if err := st.Put(ctx, "uploads/ab/cd/thing", strings.NewReader("hello"), "text/plain"); err != nil {
		t.Fatal(err)
	}

	r, err := st.Get(ctx, "uploads/ab/cd/thing")
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()

	got, _ := io.ReadAll(r)
	if string(got) != "hello" {
		t.Fatalf("got %q, want hello", got)
	}
}

func TestGetMissingIsTyped(t *testing.T) {
	if _, err := local(t).Get(context.Background(), "uploads/no/pe/nope"); !errors.Is(err, storage.ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestDeleteIsIdempotent(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	if err := st.Delete(ctx, "uploads/ab/cd/gone"); err != nil {
		t.Fatalf("first delete: %v", err)
	}
	if err := st.Delete(ctx, "uploads/ab/cd/gone"); err != nil {
		t.Fatalf("second delete: %v", err)
	}
}

func TestKeysThatEscapeAreRejected(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	for _, key := range []string{
		"../escape",
		"uploads/../../etc/passwd",
		"/etc/passwd",
		`uploads\windows`,
		"",
	} {
		if err := st.Put(ctx, key, strings.NewReader("x"), "text/plain"); !errors.Is(err, storage.ErrKey) {
			t.Fatalf("Put(%q) = %v, want ErrKey", key, err)
		}
		if _, err := st.Get(ctx, key); !errors.Is(err, storage.ErrKey) {
			t.Fatalf("Get(%q) = %v, want ErrKey", key, err)
		}
	}
}

func TestKeyIsContentAddressed(t *testing.T) {
	digest := "abcd" + strings.Repeat("0", 60)
	key, err := storage.Key("uploads", digest)

	if err != nil || key != "uploads/ab/cd/"+digest {
		t.Fatalf("key = %q, want the two-level fan-out", key)
	}
}

func TestPutIsAtomic(t *testing.T) {
	root := t.TempDir()
	st := storage.NewLocalDir(root, "/files")
	ctx := context.Background()

	failing := io.MultiReader(strings.NewReader("start"), errReader{})
	if err := st.Put(ctx, "uploads/ab/cd/partial", failing, "text/plain"); err == nil {
		t.Fatal("a failing read reported success")
	}

	if ok, _ := st.Exists(ctx, "uploads/ab/cd/partial"); ok {
		t.Fatal("a failed write left an object behind")
	}
	// The temp file goes too.
	entries, _ := os.ReadDir(filepath.Join(root, "uploads", "ab", "cd"))
	if len(entries) != 0 {
		t.Fatalf("%d files left behind, want none", len(entries))
	}
}

type errReader struct{}

func (errReader) Read([]byte) (int, error) { return 0, errors.New("boom") }
