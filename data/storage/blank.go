// data/storage/blank.go

package storage

import (
	"image"
	"math"
)

// BlankVarianceThreshold is the mean per-channel variance below which an image
// is treated as a single flat colour.
const BlankVarianceThreshold = 12.0

// IsBlank reports whether Variance(img) is below BlankVarianceThreshold.
func IsBlank(img image.Image) bool {
	return Variance(img) < BlankVarianceThreshold
}

// Variance is the mean of the per-channel (R,G,B) variances over a ~10k-pixel
// sample of img. Zero for an empty image.
func Variance(img image.Image) float64 {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	total := w * h
	if total == 0 {
		return 0
	}
	step := 1
	if total > 10000 {
		step = total / 10000
	}

	var sumR, sumG, sumB, sumR2, sumG2, sumB2, n float64
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			idx := (y-bounds.Min.Y)*w + (x - bounds.Min.X)
			if idx%step != 0 {
				continue
			}
			r, g, b, _ := img.At(x, y).RGBA()
			rf, gf, bf := float64(r>>8), float64(g>>8), float64(b>>8)
			sumR += rf
			sumG += gf
			sumB += bf
			sumR2 += rf * rf
			sumG2 += gf * gf
			sumB2 += bf * bf
			n++
		}
	}
	if n == 0 {
		return 0
	}
	varR := (sumR2 / n) - math.Pow(sumR/n, 2)
	varG := (sumG2 / n) - math.Pow(sumG/n, 2)
	varB := (sumB2 / n) - math.Pow(sumB/n, 2)
	return (varR + varG + varB) / 3.0
}
