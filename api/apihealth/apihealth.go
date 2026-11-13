// api/apihealth/apihealth.go

// Package apihealth serves the health, ready and version endpoints.
package apihealth

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/smegg99/s99ab/v2/api/apierr"
)

// Check is one readiness dependency. Name reaches the client on failure.
type Check struct {
	Name string
	Fn   func(context.Context) error
}

type Options struct {
	// Build metadata, empty in a dev build.
	Version   string
	Commit    string
	BuildTime string

	Checks []Check

	// Timeout bounds all readiness checks together.
	Timeout time.Duration
}

type versionBody struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	BuildTime string `json:"build_time"`
}

type readyBody struct {
	Ready bool `json:"ready"`
}

// Register mounts health, ready and version on group.
func Register(group gin.IRoutes, opts Options) {
	if opts.Timeout <= 0 {
		opts.Timeout = 5 * time.Second
	}

	// health checks the process only, so a slow dependency cannot trigger restarts.
	group.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	group.GET("/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, versionBody{
			Version:   opts.Version,
			Commit:    opts.Commit,
			BuildTime: opts.BuildTime,
		})
	})

	group.GET("/ready", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), opts.Timeout)
		defer cancel()

		failed := map[string]string{}
		for _, ch := range opts.Checks {
			if err := ch.Fn(ctx); err != nil {
				failed[ch.Name] = "unavailable"
				_ = c.Error(err) // logged, not sent
			}
		}

		// The frontend reads this 503 as "not ready".
		if len(failed) > 0 {
			apierr.Respond(c, apierr.New(apierr.Unavailable, "error.notReady").
				WithDetails(failed))
			return
		}
		c.JSON(http.StatusOK, readyBody{Ready: true})
	})
}
