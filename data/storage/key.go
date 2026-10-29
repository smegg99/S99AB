// data/storage/key.go

package storage

import (
	"fmt"
	"regexp"
	"strings"
)

// Key builds prefix/ab/cd/abcd... from a lowercase SHA-256 hex digest.
func Key(prefix, sha256Hex string) (string, error) {
	if !sha256Digest.MatchString(sha256Hex) {
		return "", fmt.Errorf("%w: %q is not a sha256 hex digest", ErrKey, sha256Hex)
	}
	prefix = strings.Trim(prefix, "/")
	if prefix == "" {
		prefix = "uploads"
	}
	return fmt.Sprintf("%s/%s/%s/%s", prefix, sha256Hex[0:2], sha256Hex[2:4], sha256Hex), nil
}

var sha256Digest = regexp.MustCompile(`^[0-9a-f]{64}$`)

// DerivedKey names a generated variant, such as a resize, beside the original.
func DerivedKey(key, variant string) string {
	return "derived/" + strings.TrimPrefix(key, "uploads/") + "-" + variant
}

// validKey refuses absolute paths, traversal and backslashes on every operation.
var validKey = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._/-]*$`)

func checkKey(key string) error {
	switch {
	case key == "":
		return fmt.Errorf("%w: empty", ErrKey)
	case strings.Contains(key, ".."):
		return fmt.Errorf("%w: %q traverses", ErrKey, key)
	case strings.Contains(key, `\`):
		return fmt.Errorf("%w: %q has a backslash", ErrKey, key)
	case strings.HasPrefix(key, "/"):
		return fmt.Errorf("%w: %q is absolute", ErrKey, key)
	case !validKey.MatchString(key):
		return fmt.Errorf("%w: %q", ErrKey, key)
	}
	return nil
}
