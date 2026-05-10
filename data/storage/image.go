// data/storage/image.go

package storage

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"io"
	"strconv"

	"github.com/disintegration/imaging"
)

// MaxDimension caps a requested resize.
const MaxDimension = 4096

var ErrNotImage = fmt.Errorf("storage: not an image")

// Sanitise re-encodes an image to drop metadata such as EXIF GPS, applying the
// EXIF orientation first.
func Sanitise(r io.Reader) (*bytes.Buffer, string, error) {
	img, err := imaging.Decode(r, imaging.AutoOrientation(true))
	if err != nil {
		return nil, "", fmt.Errorf("%w: %v", ErrNotImage, err)
	}

	var out bytes.Buffer
	if err := imaging.Encode(&out, img, imaging.JPEG, imaging.JPEGQuality(90)); err != nil {
		return nil, "", fmt.Errorf("storage: encode: %w", err)
	}
	return &out, "image/jpeg", nil
}

type ResizeOptions struct {
	Width  int
	Height int
}

func (o ResizeOptions) variant() string {
	return "w" + strconv.Itoa(o.Width) + "h" + strconv.Itoa(o.Height)
}

func (o ResizeOptions) valid() error {
	if o.Width <= 0 && o.Height <= 0 {
		return fmt.Errorf("storage: resize needs a width or a height")
	}
	if o.Width > MaxDimension || o.Height > MaxDimension {
		return fmt.Errorf("%w: over %d px", ErrTooLarge, MaxDimension)
	}
	return nil
}

// Derive returns a resized variant, generating and caching it on first request.
func Derive(ctx context.Context, st Storage, key string, opts ResizeOptions) (string, error) {
	if err := opts.valid(); err != nil {
		return "", err
	}

	derived := DerivedKey(key, opts.variant())
	exists, err := st.Exists(ctx, derived)
	if err != nil {
		return "", err
	}
	if exists {
		return derived, nil
	}

	src, err := st.Get(ctx, key)
	if err != nil {
		return "", err
	}
	defer src.Close()

	img, err := imaging.Decode(src, imaging.AutoOrientation(true))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrNotImage, err)
	}

	var out bytes.Buffer
	if err := imaging.Encode(&out, fit(img, opts), imaging.JPEG, imaging.JPEGQuality(85)); err != nil {
		return "", fmt.Errorf("storage: encode: %w", err)
	}
	if err := st.Put(ctx, derived, &out, "image/jpeg"); err != nil {
		return "", err
	}
	return derived, nil
}

// fit never enlarges.
func fit(img image.Image, opts ResizeOptions) image.Image {
	bounds := img.Bounds()
	w, h := opts.Width, opts.Height

	if w > bounds.Dx() {
		w = bounds.Dx()
	}
	if h > bounds.Dy() {
		h = bounds.Dy()
	}
	return imaging.Fit(img, orZero(w, bounds.Dx()), orZero(h, bounds.Dy()), imaging.Lanczos)
}

func orZero(value, fallback int) int {
	if value <= 0 {
		return fallback
	}
	return value
}
