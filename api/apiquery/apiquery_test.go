// api/apiquery/apiquery_test.go
package apiquery

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func ctx(rawQuery string) *gin.Context {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/x?"+rawQuery, nil)
	return c
}

func TestStringQueryWinsElseFallback(t *testing.T) {
	if got := String(ctx("email=q@x"), "email", "body@x"); got != "q@x" {
		t.Errorf("query present: got %q, want q@x", got)
	}
	if got := String(ctx(""), "email", "body@x"); got != "body@x" {
		t.Errorf("query absent: got %q, want the body fallback", got)
	}
}

func TestIntParsesElseFallback(t *testing.T) {
	if got := Int(ctx("n=42"), "n", 7); got != 42 {
		t.Errorf("valid query: got %d, want 42", got)
	}
	if got := Int(ctx("n=nope"), "n", 7); got != 7 {
		t.Errorf("malformed query must fall back, not zero: got %d, want 7", got)
	}
	if got := Int(ctx(""), "n", 7); got != 7 {
		t.Errorf("absent query: got %d, want 7", got)
	}
}

func TestInt64AndBool(t *testing.T) {
	if got := Int64(ctx("id=9000000000"), "id", 1); got != 9000000000 {
		t.Errorf("int64: got %d", got)
	}
	if got := Bool(ctx("tls=true"), "tls", false); !got {
		t.Error("bool true not read")
	}
	if got := Bool(ctx("tls=bad"), "tls", true); !got {
		t.Error("malformed bool must keep the fallback")
	}
}
