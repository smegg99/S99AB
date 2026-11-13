// api/apireleases/apireleases.go

// Package apireleases serves a releases.Service over HTTP.
package apireleases

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/smegg99/s99ab/v2/release/releases"
)

// Register mounts /releases, /releases/latest, /downloads and /repo, answering 200 with empty results when GitHub is unreachable.
func Register(group gin.IRoutes, svc *releases.Service) {
	group.GET("/releases", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"releases": svc.List(c.Request.Context(), locale(c))})
	})

	group.GET("/releases/latest", func(c *gin.Context) {
		c.JSON(http.StatusOK, svc.Latest(c.Request.Context(), locale(c)))
	})

	group.GET("/downloads", func(c *gin.Context) {
		c.JSON(http.StatusOK, svc.Downloads(c.Request.Context(), locale(c)))
	})

	group.GET("/repo", func(c *gin.Context) {
		c.JSON(http.StatusOK, svc.RepoStats(c.Request.Context()))
	})
}

// locale may be empty; the service resolves it to its default.
func locale(c *gin.Context) string {
	return c.Query("locale")
}
