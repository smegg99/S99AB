// mail/mailcatch/client_test.go

package mailcatch

import (
	"bytes"
	"io"
	"testing"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-message/mail"
)

func TestParseBodyExtractsTextPlainFromMultipart(t *testing.T) {
	raw := buildMultipartMail(t, "your code is 445566", "<p>your code is 445566</p>")

	got := parseBody(raw)
	if got != "your code is 445566" {
		t.Fatalf("got %q, want the text/plain part", got)
	}
}

func TestParseBodyNonMIMEIsReturnedAsIs(t *testing.T) {
	raw := []byte("plain unstructured body 123456")

	got := parseBody(raw)
	if got != string(raw) {
		t.Fatalf("got %q, want the raw body back unchanged", got)
	}
}

func TestExtractAddresses(t *testing.T) {
	addrs := []imap.Address{
		{Name: "Alice", Mailbox: "a", Host: "b.com"},
		{Name: "Bob", Mailbox: "c", Host: "d.com"},
	}

	got := extractAddresses(addrs)
	want := []string{"a@b.com", "c@d.com"}

	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

// buildMultipartMail returns a raw message with text/plain and text/html inline parts.
func buildMultipartMail(t *testing.T, plain, html string) []byte {
	t.Helper()

	var b bytes.Buffer
	var h mail.Header
	h.SetSubject("verification")

	mw, err := mail.CreateWriter(&b, h)
	if err != nil {
		t.Fatalf("CreateWriter: %v", err)
	}

	tw, err := mw.CreateInline()
	if err != nil {
		t.Fatalf("CreateInline: %v", err)
	}

	var plainHeader mail.InlineHeader
	plainHeader.Set("Content-Type", "text/plain")
	pw, err := tw.CreatePart(plainHeader)
	if err != nil {
		t.Fatalf("CreatePart(text/plain): %v", err)
	}
	if _, err := io.WriteString(pw, plain); err != nil {
		t.Fatalf("write text/plain: %v", err)
	}
	if err := pw.Close(); err != nil {
		t.Fatalf("close text/plain: %v", err)
	}

	var htmlHeader mail.InlineHeader
	htmlHeader.Set("Content-Type", "text/html")
	hw, err := tw.CreatePart(htmlHeader)
	if err != nil {
		t.Fatalf("CreatePart(text/html): %v", err)
	}
	if _, err := io.WriteString(hw, html); err != nil {
		t.Fatalf("write text/html: %v", err)
	}
	if err := hw.Close(); err != nil {
		t.Fatalf("close text/html: %v", err)
	}

	if err := tw.Close(); err != nil {
		t.Fatalf("close inline writer: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close mail writer: %v", err)
	}

	return b.Bytes()
}
