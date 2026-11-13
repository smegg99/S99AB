// api/apihealth/probe_test.go

package apihealth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/api/apihealth"
)

func TestEveryMountedProbeIsExempt(t *testing.T) {
	skip := apihealth.IsProbe("/api/v1")

	for _, path := range []string{"/api/v1/health", "/api/v1/ready", "/api/v1/version"} {
		if !skip(request(t, path)) {
			t.Fatalf("%s is not exempt", path)
		}
	}
}

func TestAnAppRouteNamedHealthIsNotAProbe(t *testing.T) {
	skip := apihealth.IsProbe("/api/v1")

	for _, path := range []string{"/api/v1/items/health", "/api/v1/items", "/health"} {
		if skip(request(t, path)) {
			t.Fatalf("%s was treated as a probe", path)
		}
	}
}

func TestATrailingSlashIsTheSameMount(t *testing.T) {
	if skip := apihealth.IsProbe("/api/v1/"); !skip(request(t, "/api/v1/health")) {
		t.Fatal("a trailing slash produced a different path set")
	}
}

func TestPathsReportsAllThree(t *testing.T) {
	got := apihealth.Paths("/api/v1")

	want := []string{"/api/v1/health", "/api/v1/ready", "/api/v1/version"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
}

func TestTheExemptSetIsWhatRegisterMounts(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	apihealth.Register(r.Group("/api/v1"), apihealth.Options{})

	mounted := map[string]bool{}
	for _, route := range r.Routes() {
		mounted[route.Path] = true
	}

	exempt := apihealth.Paths("/api/v1")
	for _, path := range exempt {
		if !mounted[path] {
			delete(mounted, path)
			t.Fatalf("%s is exempt from the rate limit but Register does not serve it", path)
		}
		delete(mounted, path)
	}
	for path := range mounted {
		t.Fatalf("Register serves %s, which the rate limiter does not exempt", path)
	}
}

func request(t *testing.T, path string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, path, nil)
	return c
}
