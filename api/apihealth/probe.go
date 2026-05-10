// api/apihealth/probe.go

package apihealth

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// names must match what Register mounts; TestTheExemptSetIsWhatRegisterMounts
// checks it.
var names = []string{"health", "ready", "version"}

// Paths returns the probe endpoints under prefix. Register cannot know its
// mount point, and a suffix match would also exempt an app's /items/health.
func Paths(prefix string) []string {
	prefix = strings.TrimSuffix(prefix, "/")

	full := make([]string, 0, len(names))
	for _, name := range names {
		full = append(full, prefix+"/"+name)
	}
	return full
}

// IsProbe matches the probe paths, for httpmw.RateLimitOptions.Skip.
func IsProbe(prefix string) func(*gin.Context) bool {
	exempt := make(map[string]bool, len(names))
	for _, full := range Paths(prefix) {
		exempt[full] = true
	}
	return func(c *gin.Context) bool { return exempt[c.Request.URL.Path] }
}
