package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/handlers"
	"github.com/pedrodonoso/kawin/api/internal/middleware"
)

func Register(r *gin.Engine) {
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "kawin-api"})
	})

	v1 := r.Group("/api/v1")
	{
		// Public
		v1.GET("/categories", handlers.GetCategories)
		v1.GET("/workshops", handlers.GetWorkshops)
		v1.GET("/workshops/:slug", handlers.GetWorkshop)
		v1.POST("/auth/register", handlers.Register)
		v1.POST("/auth/login", handlers.Login)

		// Protected
		auth := v1.Group("/", middleware.Auth())
		{
			auth.GET("/my-workshops", handlers.GetMyWorkshops)
			auth.POST("/workshops", handlers.CreateWorkshop)
		}
	}
}
