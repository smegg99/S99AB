// data/storage/accept.go

package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/gabriel-vasile/mimetype"
)

type AcceptOptions struct {
	// MaxBytes is enforced while reading.
	MaxBytes int64
	// Allow lists permitted media types. Empty means anything.
	Allow []string
	// Prefix for the key. Defaults to "uploads".
	Prefix string
}

// Accept sniffs, size-limits and stores an upload, typing it from the bytes, never the client.
func Accept(ctx context.Context, st Storage, r io.Reader, opts AcceptOptions) (*Object, error) {
	head := make([]byte, 3072)
	n, err := io.ReadFull(r, head)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, fmt.Errorf("storage: read: %w", err)
	}
	head = head[:n]

	detected := mimetype.Detect(head)
	mime := detected.String()
	if !allowed(mime, detected, opts.Allow) {
		return nil, fmt.Errorf("%w: %s", ErrMimeType, mime)
	}

	// Put the sniffed head back in front.
	body := io.MultiReader(bytes.NewReader(head), r)

	// Buffered because the key is the content hash; MaxBytes bounds it.
	var buf bytes.Buffer
	limit := opts.MaxBytes
	if limit <= 0 {
		limit = 32 << 20
	}

	size, err := io.Copy(&buf, io.LimitReader(body, limit+1))
	if err != nil {
		return nil, fmt.Errorf("storage: read: %w", err)
	}
	if size > limit {
		return nil, fmt.Errorf("%w: over %d bytes", ErrTooLarge, limit)
	}

	sum := sha256.Sum256(buf.Bytes())
	digest := hex.EncodeToString(sum[:])
	key, err := Key(opts.Prefix, digest)
	if err != nil {
		return nil, err
	}

	// Identical bytes are already stored.
	exists, err := st.Exists(ctx, key)
	if err != nil {
		return nil, err
	}
	if !exists {
		if err := st.Put(ctx, key, bytes.NewReader(buf.Bytes()), mime); err != nil {
			return nil, err
		}
	}

	return &Object{Key: key, Mime: mime, Size: size, SHA256: digest}, nil
}

// allowed matches a media type or any of its mimetype parents against the list.
func allowed(mime string, detected *mimetype.MIME, list []string) bool {
	if len(list) == 0 {
		return true
	}
	for _, want := range list {
		if mime == want || detected.Is(want) {
			return true
		}
	}
	return false
}
