package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine) {
	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"service": "kawin-api",
		})
	})

	v1 := r.Group("/api/v1")
	{
		// Categories
		v1.GET("/categories", getCategories)

		// Workshops
		v1.GET("/workshops", getWorkshops)
		v1.GET("/workshops/:slug", getWorkshop)

		// Auth (placeholder)
		v1.POST("/auth/register", notImplemented)
		v1.POST("/auth/login", notImplemented)
	}
}

func getCategories(c *gin.Context) {
	// TODO: fetch from DB
	c.JSON(http.StatusOK, gin.H{
		"data": []gin.H{
			{"slug": "arte-creatividad", "name": "Arte y Creatividad", "icon": "palette"},
			{"slug": "cocina-gastronomia", "name": "Cocina y Gastronomía", "icon": "chef-hat"},
			{"slug": "musica-danza", "name": "Música y Danza", "icon": "music"},
			{"slug": "bienestar-salud", "name": "Bienestar y Salud", "icon": "heart"},
			{"slug": "tecnologia", "name": "Tecnología", "icon": "code"},
		},
	})
}

func getWorkshops(c *gin.Context) {
	// TODO: fetch from DB with filters
	c.JSON(http.StatusOK, gin.H{
		"data":  []gin.H{},
		"total": 0,
		"page":  1,
	})
}

func getWorkshop(c *gin.Context) {
	slug := c.Param("slug")
	// TODO: fetch from DB
	c.JSON(http.StatusNotFound, gin.H{
		"error": "workshop not found: " + slug,
	})
}

func notImplemented(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{
		"error": "not implemented yet",
	})
}
