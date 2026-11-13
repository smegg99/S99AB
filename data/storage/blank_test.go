// data/storage/blank_test.go

package storage_test

import (
	"image"
	"image/color"
	"testing"

	"github.com/smegg99/s99ab/v2/data/storage"
)

// a single flat colour has ~zero variance and reads as blank
func TestIsBlankFlatImage(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	fill := color.RGBA{R: 120, G: 130, B: 140, A: 255}
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			img.Set(x, y, fill)
		}
	}

	if !storage.IsBlank(img) {
		t.Fatal("IsBlank = false, want true for a single flat colour")
	}
	if v := storage.Variance(img); v > 0.001 {
		t.Fatalf("Variance = %v, want ~0 for a single flat colour", v)
	}
}

// pixels alternating black and white carry well above the blank threshold
func TestIsBlankNoisyImage(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 100; x++ {
			c := color.RGBA{A: 255}
			if (x+y)%2 == 0 {
				c.R, c.G, c.B = 255, 255, 255
			}
			img.Set(x, y, c)
		}
	}

	if storage.IsBlank(img) {
		t.Fatal("IsBlank = true, want false for an alternating black/white image")
	}
	if v := storage.Variance(img); v <= 12 {
		t.Fatalf("Variance = %v, want above the blank threshold of 12 for an alternating black/white image", v)
	}
}
