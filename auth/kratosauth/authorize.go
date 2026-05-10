// auth/kratosauth/authorize.go

package kratosauth

import (
	"encoding/json"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/api/apierr"
)

// RequireFunc admits only an identity the predicate accepts. A rejected caller
// gets a 404 so the route's existence is not confirmed.
func RequireFunc(ok func(*Identity) bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		identity, found := From(c)
		if !found {
			apierr.Respond(c, apierr.New(apierr.Unauthorized, "auth.required"))
			c.Abort()
			return
		}
		if !ok(identity) {
			apierr.Deny(c, "auth.forbidden")
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequireMeta admits an identity whose public metadata field, a string or a
// list of strings, holds one of the allowed values.
func RequireMeta(name string, allowed ...string) gin.HandlerFunc {
	return RequireFunc(func(i *Identity) bool { return HasMeta(i, name, allowed...) })
}

// HasMeta is the predicate behind RequireMeta, for use inside a handler.
func HasMeta(i *Identity, name string, allowed ...string) bool {
	if i == nil || len(allowed) == 0 {
		return false
	}

	var one string
	if err := i.Meta(name, &one); err == nil {
		return contains(allowed, one)
	}

	var many []string
	if err := i.Meta(name, &many); err == nil {
		for _, value := range many {
			if contains(allowed, value) {
				return true
			}
		}
	}
	return false
}

// contains matches exactly, so "staff" does not admit "staff-applicant".
func contains(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}

// Metadata builds a metadata_public document.
func Metadata(fields map[string]any) json.RawMessage {
	raw, err := json.Marshal(fields)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return raw
}
