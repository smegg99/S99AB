// data/storage/temp.go

package storage

import "testing"

// TempLocal is a LocalDir in the test's temp directory, removed when the test
// ends.
func TempLocal(t *testing.T) *LocalDir {
	t.Helper()
	return NewLocalDir(t.TempDir(), "/api/v1/files")
}
