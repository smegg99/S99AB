// mail/mailcatch/client_test.go

package mailcatch

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/emersion/go-imap/v2"
	"github.com/emersion/go-message/mail"
)

func TestParseBodyExtractsTextPlainFromMultipart(t *testing.T) {
	raw := buildMultipartMail(t, "your code is 445566", "<p>your code is 445566</p>")

	got, err := parseBody(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got != "your code is 445566" {
		t.Fatalf("got %q, want the text/plain part", got)
	}
}

func TestParseBodyNonMIMEIsReturnedAsIs(t *testing.T) {
	raw := []byte("plain unstructured body 123456")

	got, err := parseBody(raw)
	if err != nil {
		t.Fatal(err)
	}
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

func TestHTMLBeforePlainDoesNotHidePlainText(t *testing.T) {
	raw := "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=x\r\n\r\n--x\r\nContent-Type: text/html\r\n\r\n<b>wrong 111111</b>\r\n--x\r\nContent-Type: text/plain\r\n\r\nright 222222\r\n--x--\r\n"
	value, err := parseBody([]byte(raw))
	if err != nil || value != "right 222222" {
		t.Fatalf("body = %q, %v", value, err)
	}
}

func TestReadBodyRejectsOversizeAndReadErrors(t *testing.T) {
	if _, err := readBody(strings.NewReader(strings.Repeat("x", maxMessageBytes+1))); err == nil {
		t.Fatal("accepted oversized message")
	}
	if _, err := readBody(brokenReader{}); !errors.Is(err, io.ErrUnexpectedEOF) {
		t.Fatalf("read error=%v", err)
	}
}

type brokenReader struct{}

func (brokenReader) Read([]byte) (int, error) { return 0, io.ErrUnexpectedEOF }

func TestMalformedMultipartIsAnError(t *testing.T) {
	raw := "MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=x\r\n\r\n--x\r\nContent-Type: text/plain\r\n\r\ntruncated"
	if _, err := parseBody([]byte(raw)); err == nil {
		t.Fatal("accepted truncated MIME body")
	}
}

func TestMalformedHeaderDoesNotBecomeRawBody(t *testing.T) {
	for _, raw := range []string{
		"Subject: code\r\nInvalid header\r\n\r\n123456",
		"Content-Type: text/plain; charset=does-not-exist\r\n\r\n123456",
	} {
		if _, err := parseBody([]byte(raw)); err == nil {
			t.Fatal("accepted malformed MIME headers")
		}
	}
}
