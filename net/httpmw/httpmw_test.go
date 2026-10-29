// net/httpmw/httpmw_test.go

package httpmw_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/net/httpmw"
)

func init() { gin.SetMode(gin.TestMode) }

type clock struct{ at time.Time }

func newClock() *clock { return &clock{at: time.Now()} }

func (c *clock) now() time.Time      { return c.at }
func (c *clock) add(d time.Duration) { c.at = c.at.Add(d) }

func engine(mw ...gin.HandlerFunc) *gin.Engine {
	r := gin.New()
	r.Use(mw...)
	r.POST("/", func(c *gin.Context) {
		var body map[string]any
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"bind": httpmw.TooLarge(err)})
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	r.GET("/", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	return r
}

func get(r *gin.Engine, ip string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.RemoteAddr = ip + ":12345"
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestUnderTheLimitPasses(t *testing.T) {
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{PerMinute: 60}))

	for i := range 5 {
		if code := get(r, "1.2.3.4", nil).Code; code != http.StatusOK {
			t.Fatalf("request %d = %d, want 200", i, code)
		}
	}
}

func TestOverTheLimitIsRejected(t *testing.T) {
	c := newClock()
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 3, Now: c.now,
	}))

	for i := range 3 {
		if code := get(r, "1.2.3.4", nil).Code; code != http.StatusOK {
			t.Fatalf("burst request %d = %d, want 200", i, code)
		}
	}

	w := get(r, "1.2.3.4", nil)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("code = %d, want 429", w.Code)
	}

	// The frontend maps the envelope code to a message.
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body is not the error envelope: %s", w.Body.String())
	}
	if body["code"] != "rate_limited" {
		t.Fatalf("code = %v", body["code"])
	}

	after := w.Header().Get("Retry-After")
	if after == "" {
		t.Fatal("no Retry-After header")
	}
	if n, err := strconv.Atoi(after); err != nil || n < 1 {
		t.Fatalf("Retry-After = %q", after)
	}
}

func TestBucketRefills(t *testing.T) {
	c := newClock()
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 2, Now: c.now,
	}))

	get(r, "1.2.3.4", nil)
	get(r, "1.2.3.4", nil)
	if get(r, "1.2.3.4", nil).Code != http.StatusTooManyRequests {
		t.Fatal("burst was not exhausted")
	}

	// 60/minute is one per second.
	c.add(time.Second)
	if code := get(r, "1.2.3.4", nil).Code; code != http.StatusOK {
		t.Fatalf("after a refill = %d, want 200", code)
	}
	if get(r, "1.2.3.4", nil).Code != http.StatusTooManyRequests {
		t.Fatal("the refill handed back more than one token")
	}
}

func TestBucketsAreIndependentPerClient(t *testing.T) {
	c := newClock()
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 1, Now: c.now,
	}))

	if get(r, "1.1.1.1", nil).Code != http.StatusOK {
		t.Fatal("first client rejected")
	}
	if get(r, "1.1.1.1", nil).Code != http.StatusTooManyRequests {
		t.Fatal("first client not limited")
	}
	if get(r, "2.2.2.2", nil).Code != http.StatusOK {
		t.Fatal("one client's limit spilled onto another")
	}
}

// gin trusts every proxy by default, so a client-set X-Forwarded-For evades the limit.
func TestSpoofedForwardedForEvadesTheLimitWhenProxiesAreTrusted(t *testing.T) {
	c := newClock()
	r := gin.New()
	// No SetTrustedProxies call: gin's default.
	r.Use(httpmw.RateLimitWith(httpmw.RateLimitOptions{PerMinute: 60, Burst: 1, Now: c.now}))
	r.GET("/", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	for i := range 5 {
		w := get(r, "10.0.0.1", map[string]string{
			"X-Forwarded-For": "9.9.9." + strconv.Itoa(i),
		})
		if w.Code != http.StatusOK {
			t.Fatalf("request %d = %d; the default should be evadable, so this "+
				"test is wrong or gin changed", i, w.Code)
		}
	}
}

func TestTrustedProxiesMakeTheLimitHold(t *testing.T) {
	c := newClock()
	r := gin.New()
	if err := r.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatal(err)
	}
	r.Use(httpmw.RateLimitWith(httpmw.RateLimitOptions{PerMinute: 60, Burst: 1, Now: c.now}))
	r.GET("/", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	// From an untrusted address the header is ignored.
	if get(r, "10.0.0.1", map[string]string{"X-Forwarded-For": "9.9.9.1"}).Code != http.StatusOK {
		t.Fatal("first request rejected")
	}
	w := get(r, "10.0.0.1", map[string]string{"X-Forwarded-For": "9.9.9.2"})
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("code = %d; a spoofed header still evaded the limit", w.Code)
	}
}

func TestSkipExemptsHealthProbes(t *testing.T) {
	c := newClock()
	r := gin.New()
	r.Use(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 1, Now: c.now,
		Skip: func(c *gin.Context) bool { return strings.HasPrefix(c.Request.URL.Path, "/health") },
	}))
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	for i := range 10 {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		req.RemoteAddr = "1.2.3.4:1"
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("probe %d = %d; monitoring must not consume an allowance", i, w.Code)
		}
	}
}

func TestZeroRateDisablesTheLimiter(t *testing.T) {
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{PerMinute: 0}))

	for i := range 20 {
		if code := get(r, "1.2.3.4", nil).Code; code != http.StatusOK {
			t.Fatalf("request %d = %d; a rate of 0 should disable, not block", i, code)
		}
	}
}

func TestKeyOverride(t *testing.T) {
	c := newClock()
	r := gin.New()
	r.Use(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 1, Now: c.now,
		Key: func(c *gin.Context) string { return c.GetHeader("X-User-Id") },
	}))
	r.GET("/", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{}) })

	if get(r, "1.1.1.1", map[string]string{"X-User-Id": "a"}).Code != http.StatusOK {
		t.Fatal("user a rejected")
	}
	// Same user, different address: still limited.
	if get(r, "2.2.2.2", map[string]string{"X-User-Id": "a"}).Code != http.StatusTooManyRequests {
		t.Fatal("the key override was ignored")
	}
	if get(r, "1.1.1.1", map[string]string{"X-User-Id": "b"}).Code != http.StatusOK {
		t.Fatal("a different user was limited")
	}
}

func TestMemoryIsBounded(t *testing.T) {
	c := newClock()
	r := engine(httpmw.RateLimitWith(httpmw.RateLimitOptions{
		PerMinute: 60, Burst: 1, MaxKeys: 10, Now: c.now,
	}))

	// More clients than MaxKeys; each still gets its first request through.
	for i := range 200 {
		ip := "10.0." + strconv.Itoa(i/256) + "." + strconv.Itoa(i%256)
		if code := get(r, ip, nil).Code; code != http.StatusOK {
			t.Fatalf("client %d = %d, want its first request to pass", i, code)
		}
	}
}
