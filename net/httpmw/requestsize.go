// net/httpmw/requestsize.go

package httpmw

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/api/apierr"
)

// RequestSize caps the body: Content-Length rejects early and MaxBytesReader holds when the header lies.
func RequestSize(maxBytes int64) gin.HandlerFunc {
	if maxBytes <= 0 {
		// Unset: no cap.
		return func(c *gin.Context) { c.Next() }
	}

	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			apierr.Respond(c, apierr.New(apierr.TooLarge, "error.requestTooLarge"))
			c.Abort()
			return
		}

		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}

// TooLarge reports whether an error came from the body cap.
func TooLarge(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr)
}
