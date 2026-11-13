// auth/keto/keto_test.go

package keto_test

import (
	"context"
	"crypto/rand"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"testing"
	"time"

	"github.com/smegg99/s99ab/v2/auth/keto"
)

func reachable(readURL string) bool {
	client := http.Client{Timeout: 750 * time.Millisecond}

	resp, err := client.Get(readURL + "/health/ready")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

func client(t *testing.T) *keto.Client {
	t.Helper()
	readURL, writeURL := os.Getenv("S99AB_TEST_KETO_READ_URL"), os.Getenv("S99AB_TEST_KETO_WRITE_URL")
	if readURL == "" || writeURL == "" {
		if os.Getenv("S99AB_REQUIRE_INTEGRATION") == "1" {
			t.Fatal("Keto test URLs are required")
		}
		t.Skip("run just test-services for Keto coverage")
	}
	if !reachable(readURL) {
		t.Fatal("configured Keto is unavailable")
	}
	c, err := keto.New(keto.Options{ReadURL: readURL, WriteURL: writeURL})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

// object names each test's own object, so tests never see each other's tuples.
func object(t *testing.T) string { return "item-" + t.Name() + "-" + rand.Text() }

func grant(t *testing.T, c *keto.Client, obj, subject string, rel keto.Relation) {
	t.Helper()
	tuple := keto.Tuple{Namespace: "item", Object: obj, Relation: rel, Subject: subject}

	if err := c.Write(context.Background(), tuple); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = c.Delete(context.Background(), tuple) })
}

func check(t *testing.T, c *keto.Client, obj, subject string, rel keto.Relation) bool {
	t.Helper()
	ok, err := c.Check(context.Background(), keto.Tuple{
		Namespace: "item", Object: obj, Relation: rel, Subject: subject,
	})
	if err != nil {
		t.Fatal(err)
	}
	return ok
}

func TestWriteThenCheck(t *testing.T) {
	c := client(t)
	obj := object(t)

	if check(t, c, obj, "alice", keto.RelOwner) {
		t.Fatal("alice owns it before anything was written")
	}

	grant(t, c, obj, "alice", keto.RelOwner)

	if !check(t, c, obj, "alice", keto.RelOwner) {
		t.Fatal("the tuple did not take effect")
	}
}

func TestPermissionsDoNotLeakBetweenObjectsOrSubjects(t *testing.T) {
	c := client(t)
	obj := object(t)

	grant(t, c, obj, "alice", keto.RelOwner)

	if check(t, c, obj, "bob", keto.RelOwner) {
		t.Fatal("bob inherited alice's ownership")
	}
	if check(t, c, obj+"-other", "alice", keto.RelOwner) {
		t.Fatal("ownership leaked to another object")
	}
	// The test namespace config does not make owner imply viewer.
	if check(t, c, obj, "alice", keto.RelViewer) {
		t.Fatal("owner silently implied viewer")
	}
}

func TestAllowedAcceptsAnyRelation(t *testing.T) {
	c := client(t)
	obj := object(t)

	grant(t, c, obj, "carol", keto.RelEditor)

	ok, err := c.Allowed(context.Background(),
		keto.Tuple{Namespace: "item", Object: obj, Subject: "carol"},
		keto.RelOwner, keto.RelEditor)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("editor did not satisfy owner-or-editor")
	}

	ok, err = c.Allowed(context.Background(),
		keto.Tuple{Namespace: "item", Object: obj, Subject: "dave"},
		keto.RelOwner, keto.RelEditor)
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("a subject with no tuple was allowed")
	}
}

func TestDeleteRevokes(t *testing.T) {
	c := client(t)
	obj := object(t)
	ctx := context.Background()

	tuple := keto.Tuple{Namespace: "item", Object: obj, Relation: keto.RelViewer, Subject: "erin"}
	if err := c.Write(ctx, tuple); err != nil {
		t.Fatal(err)
	}
	if !check(t, c, obj, "erin", keto.RelViewer) {
		t.Fatal("grant did not take")
	}

	if err := c.Delete(ctx, tuple); err != nil {
		t.Fatal(err)
	}
	if check(t, c, obj, "erin", keto.RelViewer) {
		t.Fatal("access survived a revoke")
	}
}

func TestWriteAndDeleteAreIdempotent(t *testing.T) {
	c := client(t)
	obj := object(t)
	ctx := context.Background()

	tuple := keto.Tuple{Namespace: "item", Object: obj, Relation: keto.RelViewer, Subject: "frank"}

	for range 2 {
		if err := c.Write(ctx, tuple); err != nil {
			t.Fatalf("repeat write: %v", err)
		}
	}
	if !check(t, c, obj, "frank", keto.RelViewer) {
		t.Fatal("two writes left no access")
	}

	for range 2 {
		if err := c.Delete(ctx, tuple); err != nil {
			t.Fatalf("repeat delete: %v", err)
		}
	}
	if check(t, c, obj, "frank", keto.RelViewer) {
		t.Fatal("access survived two revokes")
	}
}

func TestSubjectsListsWhoHasAccess(t *testing.T) {
	c := client(t)
	obj := object(t)

	grant(t, c, obj, "gina", keto.RelViewer)
	grant(t, c, obj, "hank", keto.RelViewer)
	grant(t, c, obj, "iris", keto.RelOwner)

	got, err := c.Subjects(context.Background(), "item", obj, keto.RelViewer)
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(got)

	if !slices.Equal(got, []string{"gina", "hank"}) {
		t.Fatalf("viewers = %v, want gina and hank only", got)
	}
}

func TestObjectsListsWhatASubjectCanSee(t *testing.T) {
	c := client(t)
	base := object(t)

	grant(t, c, base+"-a", "jane", keto.RelViewer)
	grant(t, c, base+"-b", "jane", keto.RelViewer)
	grant(t, c, base+"-c", "kyle", keto.RelViewer)

	got, err := c.Objects(context.Background(), "item", "jane", keto.RelViewer)
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(got)

	if !slices.Equal(got, []string{base + "-a", base + "-b"}) {
		t.Fatalf("objects = %v", got)
	}
}

func TestUnreachableKetoIsAnErrorNotAllow(t *testing.T) {
	c, err := keto.New(keto.Options{
		ReadURL:  "http://127.0.0.1:1",
		WriteURL: "http://127.0.0.1:1",
		Timeout:  500 * time.Millisecond,
	})
	if err != nil {
		t.Fatal(err)
	}

	ok, err := c.Check(context.Background(), keto.Tuple{
		Namespace: "item", Object: "x", Relation: keto.RelOwner, Subject: "y",
	})
	if err == nil {
		t.Fatal("an unreachable Keto returned no error")
	}
	if ok {
		t.Fatal("an unreachable Keto allowed the request")
	}
}

func TestMissingURLsAreRejected(t *testing.T) {
	if _, err := keto.New(keto.Options{ReadURL: "http://127.0.0.1:1"}); err == nil {
		t.Fatal("a client with no write URL was accepted")
	}
}

// A stub here: the real server would need more than a page of tuples per run.
func TestListFollowsEveryPage(t *testing.T) {
	pages := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("page_token")
		w.Header().Set("Content-Type", "application/json")

		switch token {
		case "":
			pages++
			_, _ = w.Write([]byte(`{"relation_tuples":[
				{"namespace":"doc","object":"a","relation":"viewer","subject_id":"alice"}],
				"next_page_token":"second"}`))
		case "second":
			pages++
			_, _ = w.Write([]byte(`{"relation_tuples":[
				{"namespace":"doc","object":"b","relation":"viewer","subject_id":"alice"}],
				"next_page_token":""}`))
		default:
			t.Errorf("asked for an unknown page %q", token)
		}
	}))
	defer srv.Close()

	c, err := keto.New(keto.Options{ReadURL: srv.URL, WriteURL: srv.URL})
	if err != nil {
		t.Fatalf("new: %v", err)
	}

	got, err := c.Objects(context.Background(), "doc", "alice", keto.RelViewer)
	if err != nil {
		t.Fatalf("objects: %v", err)
	}
	if pages != 2 {
		t.Fatalf("read %d pages, want both", pages)
	}
	if !slices.Equal(got, []string{"a", "b"}) {
		t.Fatalf("objects = %v, want [a b] - the second page was dropped", got)
	}
}

// Keto matches an empty field as any value, so these would delete or list far more than meant.
func TestEmptySelectorsAreRefusedBeforeAnyRequest(t *testing.T) {
	requests := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		_, _ = w.Write([]byte(`{"relation_tuples":[]}`))
	}))
	defer srv.Close()
	c, err := keto.New(keto.Options{ReadURL: srv.URL, WriteURL: srv.URL})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	ctx := context.Background()

	calls := map[string]error{
		"delete without subject":  c.Delete(ctx, keto.Tuple{Namespace: "doc", Object: "a", Relation: keto.RelViewer}),
		"delete without relation": c.Delete(ctx, keto.Tuple{Namespace: "doc", Object: "a", Subject: "alice"}),
		"delete without object":   c.Delete(ctx, keto.Tuple{Namespace: "doc", Relation: keto.RelViewer, Subject: "alice"}),
	}
	_, calls["subjects without object"] = c.Subjects(ctx, "doc", "", keto.RelViewer)
	_, calls["objects without subject"] = c.Objects(ctx, "doc", "", keto.RelViewer)
	_, calls["objects without namespace"] = c.Objects(ctx, "", "alice", keto.RelViewer)
	for name, err := range calls {
		if !errors.Is(err, keto.ErrSelector) {
			t.Errorf("%s: err = %v, want ErrSelector", name, err)
		}
	}
	if requests != 0 {
		t.Fatalf("%d requests reached Keto", requests)
	}
}
