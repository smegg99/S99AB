// auth/kratosauth/authorize.go

package kratosauth

import "encoding/json"

// HasMeta is the predicate behind kratosgin.RequireMeta, for use inside a handler.
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
