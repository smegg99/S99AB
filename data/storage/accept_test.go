// data/storage/accept_test.go

package storage_test

import (
	"bytes"
	"context"
	"errors"
	"image/color"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/disintegration/imaging"
	"github.com/smegg99/s99ab/data/storage"
)

func TestAcceptStoresAndHashes(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	obj, err := storage.Accept(ctx, st, bytes.NewReader(pngBytes(t, 8, 8)), storage.AcceptOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if obj.Mime != "image/png" {
		t.Fatalf("mime = %q, want image/png", obj.Mime)
	}
	if len(obj.SHA256) != 64 {
		t.Fatalf("sha256 = %q, want 64 hex chars", obj.SHA256)
	}
	if ok, _ := st.Exists(ctx, obj.Key); !ok {
		t.Fatal("Accept did not store the object")
	}
}

func TestAcceptSniffsRatherThanTrusting(t *testing.T) {
	st := local(t)

	obj, err := storage.Accept(context.Background(), st,
		strings.NewReader("just text pretending to be a png"), storage.AcceptOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasPrefix(obj.Mime, "image/") {
		t.Fatalf("mime = %q, want it sniffed as text", obj.Mime)
	}
}

func TestAcceptEnforcesTheAllowList(t *testing.T) {
	st := local(t)

	_, err := storage.Accept(context.Background(), st,
		strings.NewReader("plain text"), storage.AcceptOptions{Allow: []string{"image/png"}})
	if !errors.Is(err, storage.ErrMimeType) {
		t.Fatalf("err = %v, want ErrMimeType", err)
	}

	if _, err := storage.Accept(context.Background(), st,
		bytes.NewReader(pngBytes(t, 4, 4)), storage.AcceptOptions{Allow: []string{"image/png"}}); err != nil {
		t.Fatalf("an allowed type was rejected: %v", err)
	}
}

func TestAcceptEnforcesTheSizeLimit(t *testing.T) {
	st := local(t)

	_, err := storage.Accept(context.Background(), st,
		bytes.NewReader(make([]byte, 5000)), storage.AcceptOptions{MaxBytes: 1024})
	if !errors.Is(err, storage.ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
}

func TestAcceptDeduplicates(t *testing.T) {
	st := local(t)
	ctx := context.Background()
	data := pngBytes(t, 6, 6)

	first, err := storage.Accept(ctx, st, bytes.NewReader(data), storage.AcceptOptions{})
	if err != nil {
		t.Fatal(err)
	}
	second, err := storage.Accept(ctx, st, bytes.NewReader(data), storage.AcceptOptions{})
	if err != nil {
		t.Fatal(err)
	}

	if first.Key != second.Key {
		t.Fatalf("keys differ for identical bytes: %s vs %s", first.Key, second.Key)
	}
}

// jpegWithExif injects a real APP1 Exif segment.
func jpegWithExif(t *testing.T) []byte {
	t.Helper()

	var plain bytes.Buffer
	if err := imaging.Encode(&plain, imaging.New(10, 10, color.NRGBA{255, 0, 0, 255}), imaging.JPEG); err != nil {
		t.Fatal(err)
	}
	raw := plain.Bytes()

	// A minimal Exif payload carrying a recognisable GPS-ish marker.
	payload := append([]byte("Exif\x00\x00"), []byte("SECRETGPSDATA")...)
	segment := []byte{0xFF, 0xE1, byte((len(payload) + 2) >> 8), byte((len(payload) + 2) & 0xff)}

	out := append([]byte{}, raw[:2]...) // SOI
	out = append(out, segment...)
	out = append(out, payload...)
	return append(out, raw[2:]...)
}

func TestSanitiseStripsMetadata(t *testing.T) {
	withExif := jpegWithExif(t)

	// Confirm the fixture carries the marker.
	if !bytes.Contains(withExif, []byte("SECRETGPSDATA")) {
		t.Fatal("fixture has no Exif payload to strip")
	}

	clean, mime, err := storage.Sanitise(bytes.NewReader(withExif))
	if err != nil {
		t.Fatal(err)
	}
	if mime != "image/jpeg" {
		t.Fatalf("mime = %q, want image/jpeg", mime)
	}
	if bytes.Contains(clean.Bytes(), []byte("SECRETGPSDATA")) {
		t.Fatal("the re-encoded image still carries the Exif payload")
	}
	if bytes.Contains(clean.Bytes(), []byte("Exif")) {
		t.Fatal("the re-encoded image still has an Exif marker")
	}
}

func TestSanitiseRejectsNonImages(t *testing.T) {
	if _, _, err := storage.Sanitise(strings.NewReader("not an image")); !errors.Is(err, storage.ErrNotImage) {
		t.Fatalf("err = %v, want ErrNotImage", err)
	}
}

func TestDeriveResizesAndCaches(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	obj, err := storage.Accept(ctx, st, bytes.NewReader(pngBytes(t, 200, 100)), storage.AcceptOptions{})
	if err != nil {
		t.Fatal(err)
	}

	derived, err := storage.Derive(ctx, st, obj.Key, storage.ResizeOptions{Width: 50})
	if err != nil {
		t.Fatal(err)
	}
	if ok, _ := st.Exists(ctx, derived); !ok {
		t.Fatal("Derive did not store the variant")
	}

	r, _ := st.Get(ctx, derived)
	defer r.Close()
	img, err := imaging.Decode(r)
	if err != nil {
		t.Fatal(err)
	}
	if img.Bounds().Dx() != 50 {
		t.Fatalf("width = %d, want 50", img.Bounds().Dx())
	}

	// A second call returns the cached key.
	again, err := storage.Derive(ctx, st, obj.Key, storage.ResizeOptions{Width: 50})
	if err != nil || again != derived {
		t.Fatalf("second Derive = %q, %v; want the cached key", again, err)
	}
}

func TestDeriveNeverEnlarges(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	obj, _ := storage.Accept(ctx, st, bytes.NewReader(pngBytes(t, 20, 20)), storage.AcceptOptions{})
	derived, err := storage.Derive(ctx, st, obj.Key, storage.ResizeOptions{Width: 500})
	if err != nil {
		t.Fatal(err)
	}

	r, _ := st.Get(ctx, derived)
	defer r.Close()
	img, _ := imaging.Decode(r)

	if img.Bounds().Dx() > 20 {
		t.Fatalf("width = %d, want no bigger than the 20px source", img.Bounds().Dx())
	}
}

func TestDeriveCapsTheRequestedSize(t *testing.T) {
	st := local(t)
	ctx := context.Background()

	obj, _ := storage.Accept(ctx, st, bytes.NewReader(pngBytes(t, 10, 10)), storage.AcceptOptions{})
	_, err := storage.Derive(ctx, st, obj.Key, storage.ResizeOptions{Width: 99999})

	if !errors.Is(err, storage.ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
}

func TestURLIsServedByTheApp(t *testing.T) {
	url, err := local(t).URL(context.Background(), "uploads/ab/cd/thing", 0)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(url, "/api/v1/files/") {
		t.Fatalf("url = %q, want the app-served base", url)
	}
}

// Escaping the whole key would turn its slashes into %2F.
func TestLocalURLEscapesSegmentsNotSeparators(t *testing.T) {
	l := storage.NewLocalDir(t.TempDir(), "/api/v1/files")

	got, err := l.URL(context.Background(), "uploads/ab/cd/deadbeef", time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if got != "/api/v1/files/uploads/ab/cd/deadbeef" {
		t.Fatalf("URL = %q", got)
	}
	if strings.Contains(got, "%2F") {
		t.Fatalf("separators were escaped: %q", got)
	}
}

// Relative means the app serves it; absolute means the client fetches it.
func TestLocalURLIsRelative(t *testing.T) {
	l := storage.NewLocalDir(t.TempDir(), "/api/v1/files")

	got, err := l.URL(context.Background(), "uploads/ab/cd/deadbeef", time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if u.IsAbs() {
		t.Fatalf("URL = %q, want a relative path", got)
	}
}
