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

func TestBool(t *testing.T) {
	if got := Bool(ctx("tls=true"), "tls", false); !got {
		t.Error("bool true not read")
	}
	if got := Bool(ctx("tls=bad"), "tls", true); !got {
		t.Error("malformed bool must keep the fallback")
	}
}
