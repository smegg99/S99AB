// net/httpmw/requestsize_test.go

package httpmw_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/net/httpmw"
)

func TestRequestSizeRejectsByContentLength(t *testing.T) {
	r := engine(httpmw.RequestSize(64))

	body := strings.Repeat("x", 200)
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("code = %d, want 413", w.Code)
	}
	var envelope map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
		t.Fatalf("body = %s", w.Body.String())
	}
	if envelope["code"] != "too_large" {
		t.Fatalf("code = %v", envelope["code"])
	}
}

// A chunked request has no Content-Length, so the reader cap applies.
func TestRequestSizeHoldsWithoutContentLength(t *testing.T) {
	r := engine(httpmw.RequestSize(64))

	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"a":"`+strings.Repeat("x", 500)+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.ContentLength = -1 // as a chunked request arrives

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	var body map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if w.Code == http.StatusOK {
		t.Fatal("an oversized chunked body was accepted")
	}
	if body["bind"] != true {
		t.Fatalf("TooLarge did not recognise the cap error: %s", w.Body.String())
	}
}

func TestRequestSizeAllowsWhatFits(t *testing.T) {
	r := engine(httpmw.RequestSize(1024))

	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"a":1}`))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200: %s", w.Code, w.Body.String())
	}
}

func TestZeroSizeDisablesTheCap(t *testing.T) {
	r := engine(httpmw.RequestSize(0))

	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"a":1}`))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("code = %d; a cap of 0 should disable, not block", w.Code)
	}
}

// gin returns the rightmost untrusted X-Forwarded-For address; only the reverse
// proxy may reach the port, since a trusted peer's header is believed.
func TestForwardedForIsWalkedRightToLeft(t *testing.T) {
	seen := make(chan string, 1)

	r := gin.New()
	if err := r.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatal(err)
	}
	r.GET("/", func(c *gin.Context) {
		seen <- c.ClientIP()
		c.JSON(http.StatusOK, gin.H{})
	})

	// A client-set header, with the proxy appending the real peer.
	get(r, "127.0.0.1", map[string]string{"X-Forwarded-For": "9.9.9.9, 203.0.113.7"})
	if got := <-seen; got != "203.0.113.7" {
		t.Fatalf("ClientIP = %q, want the appended peer, not the client's claim", got)
	}

	// From an untrusted address the header is ignored.
	get(r, "203.0.113.9", map[string]string{"X-Forwarded-For": "9.9.9.9"})
	if got := <-seen; got != "203.0.113.9" {
		t.Fatalf("ClientIP = %q, want the socket address", got)
	}
}
