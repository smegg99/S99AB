// data/storage/containment_test.go

package storage_test

import (
	"context"
	"errors"
	"github.com/smegg99/s99ab/data/storage"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLocalDirRefusesEscapingSymlinks(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "object"), []byte("original"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "linked")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	st := storage.NewLocalDir(root, "/files")
	ctx := t.Context()
	if err := st.Put(ctx, "linked/object", strings.NewReader("changed"), "text/plain"); err == nil {
		t.Error("Put escaped")
	}
	if reader, err := st.Get(ctx, "linked/object"); err == nil {
		reader.Close()
		t.Error("Get escaped")
	}
	if _, err := st.Exists(ctx, "linked/object"); err == nil {
		t.Error("Exists escaped")
	}
	if err := st.Delete(ctx, "linked/object"); err == nil {
		t.Error("Delete escaped")
	}
	if data, err := os.ReadFile(filepath.Join(outside, "object")); err != nil || string(data) != "original" {
		t.Fatalf("outside changed: %q, %v", data, err)
	}
}

func TestCancelledLocalWritePreservesExistingObject(t *testing.T) {
	st := local(t)
	if err := st.Put(t.Context(), "object", strings.NewReader("original"), "text/plain"); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := st.Put(ctx, "object", strings.NewReader("changed"), "text/plain"); !errors.Is(err, context.Canceled) {
		t.Fatalf("Put = %v", err)
	}
	reader, err := st.Get(t.Context(), "object")
	if err != nil {
		t.Fatal(err)
	}
	defer reader.Close()
	data, err := io.ReadAll(reader)
	if err != nil || string(data) != "original" {
		t.Fatalf("content = %q, %v", data, err)
	}
}
