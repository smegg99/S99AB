// api/apierr/apierr.go

// Package apierr writes the error envelope from contracts/schemas/error.yaml.
package apierr

import (
	"errors"
	"fmt"
	"net/http"
)

// Kind pairs an error code with its HTTP status. Clients branch on Code.
type Kind struct {
	Code   string
	Status int
}

var (
	Validation   = Kind{"validation", http.StatusUnprocessableEntity}
	Unauthorized = Kind{"unauthorized", http.StatusUnauthorized}
	Forbidden    = Kind{"forbidden", http.StatusForbidden}
	NotFound     = Kind{"not_found", http.StatusNotFound}
	Conflict     = Kind{"conflict", http.StatusConflict}
	TooLarge     = Kind{"too_large", http.StatusRequestEntityTooLarge}
	RateLimited  = Kind{"rate_limited", http.StatusTooManyRequests}
	Unavailable  = Kind{"unavailable", http.StatusServiceUnavailable}
	Internal     = Kind{"internal", http.StatusInternalServerError}
)

// statusClientClosedRequest is nginx's 499, sent with no envelope when the caller is gone.
const statusClientClosedRequest = 499

// Error carries a Kind to the client and the cause to the log only.
type Error struct {
	Kind    Kind
	Message string            // i18n key, resolved by the client
	Details map[string]string // field path to code, validation only
	cause   error
}

// New builds an error with no cause, for a condition the app detected itself.
func New(k Kind, messageKey string) *Error {
	return &Error{Kind: k, Message: messageKey}
}

// Wrap attaches an API kind to a domain error; the cause is logged, not sent.
func Wrap(cause error, k Kind, messageKey string) *Error {
	return &Error{Kind: k, Message: messageKey, cause: cause}
}

// WithDetails attaches field-level codes, which the client renders.
func (e *Error) WithDetails(d map[string]string) *Error {
	e.Details = d
	return e
}

func (e *Error) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("apierr: %s (%s): %v", e.Kind.Code, e.Message, e.cause)
	}
	return fmt.Sprintf("apierr: %s (%s)", e.Kind.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.cause }

// kindOf maps an error that is not an *Error to 500 internal.
func kindOf(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return &Error{Kind: Internal, Message: "error.internal", cause: err}
}
