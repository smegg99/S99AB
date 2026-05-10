// net/httpmw/requestsize.go

package httpmw

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apierr"
)

// RequestSize caps the request body. Content-Length rejects early; MaxBytesReader
// enforces the cap when the header is absent or wrong.
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

// MapBindError maps a binding failure to Validation, or TooLarge when the size cap tripped.
func MapBindError(err error) error {
	if TooLarge(err) {
		return apierr.Wrap(err, apierr.TooLarge, "error.requestTooLarge")
	}
	return apierr.Wrap(err, apierr.Validation, "error.badRequest")
}
