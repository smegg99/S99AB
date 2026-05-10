// api/apihealth/apihealth_test.go

package apihealth_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apihealth"
)

func TestHealthIgnoresDependencies(t *testing.T) {
	r := router(apihealth.Options{
		Checks: []apihealth.Check{{
			Name: "db",
			Fn:   func(context.Context) error { return errors.New("db: down") },
		}},
	})

	if code, _ := get(r, "/api/v1/health"); code != http.StatusOK {
		t.Fatalf("health = %d, want 200 with a failing dependency", code)
	}
}

func TestReadyReportsWhichDependencyIsDown(t *testing.T) {
	r := router(apihealth.Options{
		Checks: []apihealth.Check{
			{Name: "db", Fn: func(context.Context) error { return errors.New("db: connection refused") }},
			{Name: "cache", Fn: func(context.Context) error { return nil }},
		},
	})

	code, body := get(r, "/api/v1/ready")
	if code != http.StatusServiceUnavailable {
		t.Fatalf("ready = %d, want 503", code)
	}

	var got struct {
		Code    string            `json:"code"`
		Details map[string]string `json:"details"`
	}
	if err := json.Unmarshal([]byte(body), &got); err != nil {
		t.Fatalf("body is not the envelope: %v (%s)", err, body)
	}
	if got.Code != "unavailable" {
		t.Fatalf("code = %q, want unavailable", got.Code)
	}
	if got.Details["db"] != "unavailable" {
		t.Fatalf("details = %v, want db named", got.Details)
	}
	if _, ok := got.Details["cache"]; ok {
		t.Fatal("a passing check was reported as failing")
	}
	if strings.Contains(body, "connection refused") {
		t.Fatalf("body leaked the real error: %s", body)
	}
}

func TestReadyPassesWithNoChecks(t *testing.T) {
	if code, _ := get(router(apihealth.Options{}), "/api/v1/ready"); code != http.StatusOK {
		t.Fatalf("ready = %d, want 200", code)
	}
}

// A dev build has no ldflags metadata, so every field is empty.
func TestVersionReportsEmptyRatherThanInventing(t *testing.T) {
	code, body := get(router(apihealth.Options{}), "/api/v1/version")
	if code != http.StatusOK {
		t.Fatalf("version = %d, want 200", code)
	}

	var got map[string]string
	if err := json.Unmarshal([]byte(body), &got); err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"version", "commit", "build_time"} {
		if v, ok := got[k]; !ok || v != "" {
			t.Fatalf("%s = %q (present=%v), want empty and present", k, v, ok)
		}
	}
}

func TestReadyIsBoundedByTimeout(t *testing.T) {
	r := router(apihealth.Options{
		Timeout: 30 * time.Millisecond,
		Checks: []apihealth.Check{{
			Name: "slow",
			Fn: func(ctx context.Context) error {
				<-ctx.Done()
				return ctx.Err()
			},
		}},
	})

	done := make(chan int, 1)
	go func() { code, _ := get(r, "/api/v1/ready"); done <- code }()

	select {
	case code := <-done:
		if code != http.StatusServiceUnavailable {
			t.Fatalf("ready = %d, want 503", code)
		}
	case <-time.After(time.Second):
		t.Fatal("ready hung on a stuck dependency")
	}
}

func router(opts apihealth.Options) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	apihealth.Register(r.Group("/api/v1"), opts)
	return r
}

func get(r *gin.Engine, path string) (int, string) {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
	return w.Code, w.Body.String()
}
