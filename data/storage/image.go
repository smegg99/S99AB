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

// maxDimension caps a requested resize.
const maxDimension = 4096

// maxPixels caps a decoded image: a small file can declare a canvas that needs gigabytes.
const maxPixels = 40_000_000

var ErrNotImage = fmt.Errorf("storage: not an image")

// Sanitise re-encodes an image after applying its EXIF orientation, dropping metadata such as GPS.
func Sanitise(r io.Reader) (*bytes.Buffer, string, error) {
	img, err := decode(r)
	if err != nil {
		return nil, "", err
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
	if o.Width > maxDimension || o.Height > maxDimension {
		return fmt.Errorf("%w: over %d px", ErrTooLarge, maxDimension)
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

	img, err := decode(src)
	if err != nil {
		return "", err
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

// decode reads the header first and refuses a canvas over MaxPixels before allocating it.
func decode(r io.Reader) (image.Image, error) {
	var head bytes.Buffer
	cfg, _, err := image.DecodeConfig(io.TeeReader(r, &head))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNotImage, err)
	}
	if int64(cfg.Width)*int64(cfg.Height) > maxPixels {
		return nil, fmt.Errorf("%w: %dx%d px", ErrTooLarge, cfg.Width, cfg.Height)
	}
	img, err := imaging.Decode(io.MultiReader(&head, r), imaging.AutoOrientation(true))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrNotImage, err)
	}
	return img, nil
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
