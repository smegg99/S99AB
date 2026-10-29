// api/apierr/gin.go

package apierr

import "github.com/gin-gonic/gin"

// Deny answers 404 for both "not yours" and "not there", so ids cannot be
// enumerated.
func Deny(c *gin.Context, messageKey string) {
	Respond(c, New(NotFound, messageKey))
}

// callerGone checks the request context, not the error chain, so a handler's
// own cancelled work still gets an answer.
func callerGone(c *gin.Context) bool {
	return c.Request != nil && c.Request.Context().Err() != nil
}

// body must match contracts/schemas/error.yaml, which sets additionalProperties
// to false.
type body struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

// Respond writes err as the shared envelope and aborts. The cause goes to
// c.Error for the logging middleware, never to the response.
func Respond(c *gin.Context, err error) {
	// The client is gone: nothing to send and nothing to log.
	if callerGone(c) {
		c.AbortWithStatus(statusClientClosedRequest)
		return
	}

	e := kindOf(err)

	if cause := e.Unwrap(); cause != nil {
		_ = c.Error(cause)
	} else if e.Kind == Internal {
		_ = c.Error(e)
	}

	c.AbortWithStatusJSON(e.Kind.Status, body{
		Code:    e.Kind.Code,
		Message: e.Message,
		Details: e.Details,
	})
}
