// auth/kratosauth/authorize_test.go

package kratosauth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/auth/kratosauth"
	"github.com/smegg99/s99ab/auth/kratosauth/kratosauthtest"
)

// router mounts Session for everyone and a role gate on /admin.
func router(t *testing.T, accounts map[string]kratosauth.Identity) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(kratosauth.Session(kratosauthtest.Fake(t, accounts)))

	guarded := r.Group("", kratosauth.Require())
	guarded.GET("/me", func(c *gin.Context) { c.String(http.StatusOK, "me") })

	admin := guarded.Group("", kratosauth.RequireMeta("role", "staff", "owner"))
	admin.GET("/admin/orders", func(c *gin.Context) { c.String(http.StatusOK, "orders") })
	return r
}

func get(t *testing.T, r *gin.Engine, path, credential string) int {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if credential != "" {
		req.Header.Set("X-Session-Token", credential)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestASignedInCustomerIsNotAnAdministrator(t *testing.T) {
	r := router(t, map[string]kratosauth.Identity{
		"customer": {ID: "id-customer"},
		"staff": {ID: "id-staff", MetadataPublic: kratosauth.Metadata(
			map[string]any{"role": "staff"})},
	})

	if got := get(t, r, "/me", "customer"); got != http.StatusOK {
		t.Errorf("a customer could not reach their own page: %d", got)
	}
	// 404, not 403, so the route is not confirmed.
	if got := get(t, r, "/admin/orders", "customer"); got != http.StatusNotFound {
		t.Errorf("customer reaching /admin/orders = %d, want 404", got)
	}
	if got := get(t, r, "/admin/orders", "staff"); got != http.StatusOK {
		t.Errorf("staff reaching /admin/orders = %d, want 200", got)
	}
	if got := get(t, r, "/admin/orders", ""); got != http.StatusUnauthorized {
		t.Errorf("anonymous reaching /admin/orders = %d, want 401", got)
	}
}

// Traits are user-editable, so a role there must not count.
func TestARoleInTraitsDoesNotOpenTheGate(t *testing.T) {
	r := router(t, map[string]kratosauth.Identity{
		"liar": {ID: "id-liar", Traits: []byte(`{"email":"a@b.c","role":"staff"}`)},
	})

	if got := get(t, r, "/admin/orders", "liar"); got != http.StatusNotFound {
		t.Errorf("a self-declared staff trait reached the back office: %d", got)
	}
}

func TestRequireMetaReadsAListAsWellAsAString(t *testing.T) {
	r := router(t, map[string]kratosauth.Identity{
		"many": {ID: "id-many", MetadataPublic: kratosauth.Metadata(
			map[string]any{"role": []string{"editor", "owner"}})},
		"none": {ID: "id-none", MetadataPublic: kratosauth.Metadata(
			map[string]any{"role": []string{"editor"}})},
	})

	if got := get(t, r, "/admin/orders", "many"); got != http.StatusOK {
		t.Errorf("an identity holding owner among its roles = %d, want 200", got)
	}
	if got := get(t, r, "/admin/orders", "none"); got != http.StatusNotFound {
		t.Errorf("an identity holding only editor = %d, want 404", got)
	}
}

func TestHasMetaDoesNotMatchOnAPrefix(t *testing.T) {
	identity := &kratosauth.Identity{MetadataPublic: kratosauth.Metadata(
		map[string]any{"role": "staff-applicant"})}

	if kratosauth.HasMeta(identity, "role", "staff") {
		t.Error("staff-applicant was admitted as staff")
	}
}

func TestHasMetaOnAnIdentityWithNoMetadata(t *testing.T) {
	if kratosauth.HasMeta(&kratosauth.Identity{}, "role", "staff") {
		t.Error("an identity with no metadata at all was admitted")
	}
}
