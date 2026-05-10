// mail/mailer/mailer_test.go

package mailer_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/smegg99/s99ab/mail/mailer"
)

func templates(t *testing.T, files fstest.MapFS) *mailer.Templates {
	t.Helper()
	set, err := mailer.Parse(files, "*.html", "*.txt")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	return set
}

// html/template would escape the ampersand in the plain body.
func TestRenderDoesNotHTMLEscapeThePlainAlternative(t *testing.T) {
	set := templates(t, fstest.MapFS{
		"order.html": {Data: []byte(`<p>{{ .Name }}</p>`)},
		"order.txt":  {Data: []byte(`{{ .Name }}`)},
	})

	msg, err := set.Render("order", map[string]string{"Name": "Kawa & Herbata"})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if !strings.Contains(msg.Text, "Kawa & Herbata") {
		t.Errorf("text = %q, want the ampersand left alone", msg.Text)
	}
	if !strings.Contains(msg.HTML, "Kawa &amp; Herbata") {
		t.Errorf("html = %q, want the ampersand escaped", msg.HTML)
	}
}

func TestRenderRefusesADocumentWithNoPlainAlternative(t *testing.T) {
	set := templates(t, fstest.MapFS{
		"order.html": {Data: []byte(`<p>hi</p>`)},
		"other.txt":  {Data: []byte(`hi`)},
	})

	if _, err := set.Render("order", nil); err == nil {
		t.Fatal("rendered a document with no .txt half")
	}
	if _, err := set.Render("missing", nil); err == nil {
		t.Fatal("rendered a name that does not exist")
	}
}

func TestNamesListsOnlyCompletePairs(t *testing.T) {
	set := templates(t, fstest.MapFS{
		"a.html": {Data: []byte(`a`)},
		"a.txt":  {Data: []byte(`a`)},
		"b.html": {Data: []byte(`b`)},
		"c.txt":  {Data: []byte(`c`)},
	})

	names := set.Names()
	if len(names) != 1 || names[0] != "a" {
		t.Fatalf("names = %v, want only the pair that has both halves", names)
	}
}

func TestNewRefusesAnUnconfiguredTransport(t *testing.T) {
	if _, err := mailer.New(mailer.Config{From: "a@b.c"}, mailer.Options{}); !errors.Is(err, mailer.ErrHost) {
		t.Errorf("err = %v, want ErrHost", err)
	}
	if _, err := mailer.New(mailer.Config{Host: "localhost"}, mailer.Options{}); !errors.Is(err, mailer.ErrFrom) {
		t.Errorf("err = %v, want ErrFrom", err)
	}
	if _, err := mailer.New(mailer.Config{Host: "localhost", From: "a@b.c"}, mailer.Options{}); err != nil {
		t.Errorf("a complete config was refused: %v", err)
	}
}

func TestDiscardObservesAndStillValidates(t *testing.T) {
	var seen mailer.Sent
	d := mailer.Discard(mailer.Options{Observe: func(s mailer.Sent) { seen = s }})

	if err := d.Send(context.Background(), mailer.Message{To: []string{"a@b.c"}, Subject: "Zamówienie"}); err != nil {
		t.Fatalf("send: %v", err)
	}
	if !seen.Discarded || seen.Subject != "Zamówienie" {
		t.Errorf("observed = %+v, want the discarded send reported", seen)
	}
	if err := d.Send(context.Background(), mailer.Message{Subject: "nobody"}); !errors.Is(err, mailer.ErrTo) {
		t.Errorf("err = %v, want ErrTo", err)
	}
}
