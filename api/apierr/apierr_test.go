// api/apierr/apierr_test.go

package apierr_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/api/apierr"
)

var errDomain = errors.New("datastore: row is gone")

func TestUnmappedErrorIsHiddenBehindInternal(t *testing.T) {
	w, c := ctx()
	apierr.Respond(c, errDomain)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	got := decode(t, w)
	if got.Code != "internal" {
		t.Fatalf("code = %q, want internal", got.Code)
	}
	if strings.Contains(w.Body.String(), "row is gone") {
		t.Fatalf("body leaked the cause: %s", w.Body.String())
	}
	if len(c.Errors) != 1 {
		t.Fatalf("c.Errors = %d, want the cause recorded for the logger", len(c.Errors))
	}
}

func TestWrappedErrorSendsKindNotCause(t *testing.T) {
	w, c := ctx()
	apierr.Respond(c, apierr.Wrap(errDomain, apierr.NotFound, "item.notFound"))

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
	got := decode(t, w)
	if got.Code != "not_found" || got.Message != "item.notFound" {
		t.Fatalf("got %+v, want not_found / item.notFound", got)
	}
	if strings.Contains(w.Body.String(), "row is gone") {
		t.Fatalf("body leaked the cause: %s", w.Body.String())
	}
}

func TestWrapKeepsCauseReachable(t *testing.T) {
	err := apierr.Wrap(errDomain, apierr.NotFound, "item.notFound")

	if !errors.Is(err, errDomain) {
		t.Fatal("errors.Is lost the cause")
	}
	var e *apierr.Error
	if !errors.As(err, &e) || e.Kind != apierr.NotFound {
		t.Fatal("the kind is not reachable through errors.As")
	}
}

// The schema forbids stray fields, so empty details are omitted.
func TestDetailsOmittedWhenAbsent(t *testing.T) {
	w, c := ctx()
	apierr.Respond(c, apierr.New(apierr.Validation, "item.invalid"))

	if strings.Contains(w.Body.String(), "details") {
		t.Fatalf("empty details were serialised: %s", w.Body.String())
	}

	w, c = ctx()
	apierr.Respond(c, apierr.New(apierr.Validation, "item.invalid").
		WithDetails(map[string]string{"name": "too_short"}))

	if got := decode(t, w).Details["name"]; got != "too_short" {
		t.Fatalf("details[name] = %q, want too_short", got)
	}
}

func TestCallerThatLeftGetsAStatusAndNothingElse(t *testing.T) {
	w, c := ctx()
	c.Request = c.Request.WithContext(canceled())

	apierr.Respond(c, context.Canceled)

	if w.Code != 499 {
		t.Fatalf("code = %d, want 499", w.Code)
	}
	if body := w.Body.String(); body != "" {
		t.Fatalf("body = %q, want nothing written", body)
	}
	if len(c.Errors) != 0 {
		t.Fatalf("c.Errors = %d; a caller leaving is not worth logging", len(c.Errors))
	}
}

// kratosauth.ErrCallerGone hides its cause, so only the request context shows the caller left.
func TestAnyErrorOnADeadRequestIsTheCallerLeaving(t *testing.T) {
	sentinel := errors.New("kratosauth: the caller stopped waiting")

	for _, err := range []error{
		fmt.Errorf("%w: %v", sentinel, context.Canceled), // cause unreachable
		errors.New("datastore: connection reset"),        // no cancellation at all
		apierr.Wrap(errDomain, apierr.NotFound, "item.notFound"),
	} {
		w, c := ctx()
		c.Request = c.Request.WithContext(canceled())

		apierr.Respond(c, err)

		if w.Code != 499 {
			t.Fatalf("code = %d for %v, want 499 - the request is over", w.Code, err)
		}
		if body := w.Body.String(); body != "" {
			t.Fatalf("body = %q for %v, want nothing written", body, err)
		}
	}
}

func TestCancellationOnALiveRequestStillAnswers(t *testing.T) {
	w, c := ctx()

	apierr.Respond(c, apierr.Wrap(context.Canceled, apierr.Unavailable, "item.busy"))

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503 - the caller is still there", w.Code)
	}
}

// A deadline on a live request is a server timeout and must not become 499.
func TestDeadlineOnALiveRequestIsStillAFailure(t *testing.T) {
	w, c := ctx()

	apierr.Respond(c, context.DeadlineExceeded)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("code = %d, want 500", w.Code)
	}
}

func TestDenyIsIndistinguishableFromNotFound(t *testing.T) {
	w, c := ctx()
	apierr.Deny(c, "item.notFound")

	if w.Code != http.StatusNotFound {
		t.Fatalf("code = %d, want 404", w.Code)
	}
	got := decode(t, w)
	if got.Code != "not_found" || got.Message != "item.notFound" {
		t.Fatalf("got %+v, want not_found / item.notFound", got)
	}

	other, oc := ctx()
	apierr.Respond(oc, apierr.New(apierr.NotFound, "item.notFound"))

	if other.Body.String() != w.Body.String() || other.Code != w.Code {
		t.Fatalf("deny = %d %s, missing = %d %s; the two are distinguishable",
			w.Code, w.Body.String(), other.Code, other.Body.String())
	}
}

func ctx() (*httptest.ResponseRecorder, *gin.Context) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return w, c
}

// canceled returns a context that is already done.
func canceled() context.Context {
	c, cancel := context.WithCancel(context.Background())
	cancel()
	return c
}

type wire struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details"`
}

func decode(t *testing.T, w *httptest.ResponseRecorder) wire {
	t.Helper()
	var got wire
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatalf("body is not the envelope: %v (%s)", err, w.Body.String())
	}
	return got
}
