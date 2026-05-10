// api/apipage/apipage_test.go

package apipage_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apipage"
)

func init() { gin.SetMode(gin.TestMode) }

func TestAbsentParametersAreTheContractDefaults(t *testing.T) {
	got := apipage.Parse(ctx(t, "/items"), apipage.Options{})

	if got.Page != 1 {
		t.Fatalf("page = %d, want 1", got.Page)
	}
	if got.Limit != 25 {
		t.Fatalf("limit = %d, want 25", got.Limit)
	}
	if got.Sort != "" || got.Search != "" {
		t.Fatalf("got %+v, want empty sort and search", got)
	}
}

func TestNonsenseIsClampedNotRejected(t *testing.T) {
	for _, tc := range []struct {
		query string
		page  int
		limit int
	}{
		{"page=0&limit=10", 1, 10},
		{"page=-3&limit=10", 1, 10},
		{"page=abc&limit=10", 1, 10},
		{"page=2&limit=0", 2, 25},
		{"page=2&limit=-1", 2, 25},
		{"page=2&limit=nope", 2, 25},
		{"page=2&limit=10000", 2, 200},
	} {
		got := apipage.Parse(ctx(t, "/items?"+tc.query), apipage.Options{})

		if got.Page != tc.page || got.Limit != tc.limit {
			t.Fatalf("%s -> page %d limit %d, want %d and %d",
				tc.query, got.Page, got.Limit, tc.page, tc.limit)
		}
	}
}

func TestAnEndpointCanCapLowerThanTheContract(t *testing.T) {
	opts := apipage.Options{DefaultLimit: 5, MaxLimit: 20}

	if got := apipage.Parse(ctx(t, "/items"), opts); got.Limit != 5 {
		t.Fatalf("limit = %d, want the endpoint default of 5", got.Limit)
	}
	if got := apipage.Parse(ctx(t, "/items?limit=500"), opts); got.Limit != 20 {
		t.Fatalf("limit = %d, want the endpoint cap of 20", got.Limit)
	}
}

func TestOffsetCountsFromTheFirstPage(t *testing.T) {
	for _, tc := range []struct {
		query string
		want  int
	}{
		{"page=1&limit=25", 0},
		{"page=2&limit=25", 25},
		{"page=3&limit=10", 20},
	} {
		if got := apipage.Parse(ctx(t, "/items?"+tc.query), apipage.Options{}).Offset(); got != tc.want {
			t.Fatalf("%s -> offset %d, want %d", tc.query, got, tc.want)
		}
	}
}

// useServerTable calls it search internally but sends it as q.
func TestSearchArrivesUnderQ(t *testing.T) {
	got := apipage.Parse(ctx(t, "/items?q=widget"), apipage.Options{})

	if got.Search != "widget" {
		t.Fatalf("search = %q, want widget", got.Search)
	}
}

func ctx(t *testing.T, target string) *gin.Context {
	t.Helper()
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodGet, target, nil)
	return c
}
