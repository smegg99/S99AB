// data/storage/bomb_test.go

package storage_test

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"testing"

	"github.com/smegg99/s99ab/v2/data/storage"
)

// bombPNG is a PNG header that declares a width x height canvas and carries no pixels.
func bombPNG(width, height uint32) []byte {
	var b bytes.Buffer
	b.WriteString("\x89PNG\r\n\x1a\n")
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], width)
	binary.BigEndian.PutUint32(ihdr[4:], height)
	ihdr[8], ihdr[9] = 8, 6
	chunk := append([]byte("IHDR"), ihdr...)
	_ = binary.Write(&b, binary.BigEndian, uint32(len(ihdr)))
	b.Write(chunk)
	_ = binary.Write(&b, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return b.Bytes()
}

func TestSanitiseRefusesADecompressionBomb(t *testing.T) {
	_, _, err := storage.Sanitise(bytes.NewReader(bombPNG(65535, 65535)))
	if !errors.Is(err, storage.ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge before any pixels are decoded", err)
	}
}

func TestKeyRefusesADigestThatIsNotSHA256(t *testing.T) {
	for _, digest := range []string{"", "ab", "zz" + string(bytes.Repeat([]byte("0"), 62))} {
		if _, err := storage.Key("uploads", digest); !errors.Is(err, storage.ErrKey) {
			t.Errorf("Key(%q) err = %v, want ErrKey", digest, err)
		}
	}
	key, err := storage.Key("", string(bytes.Repeat([]byte("ab"), 32)))
	if err != nil || key != "uploads/ab/ab/"+string(bytes.Repeat([]byte("ab"), 32)) {
		t.Fatalf("Key = %q, %v", key, err)
	}
}
