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
		v1.GET("/workshops/:id", handlers.GetWorkshop)
		v1.POST("/auth/register", handlers.Register)
		v1.POST("/auth/login", handlers.Login)

		// Protected
		auth := v1.Group("/", middleware.Auth())
		{
			auth.GET("/my-workshops", handlers.GetMyWorkshops)
			auth.GET("/my-workshops/:id", handlers.GetMyWorkshop)
			auth.POST("/workshops", handlers.CreateWorkshop)
			auth.PUT("/workshops/:id", handlers.UpdateWorkshop)
			auth.DELETE("/workshops/:id", handlers.DeleteWorkshop)

			// Schedules (Sprint 1)
			auth.POST("/workshops/:id/schedules", handlers.CreateSchedule)
			auth.GET("/workshops/:id/schedules", handlers.GetSchedules)
			auth.DELETE("/schedules/:id", handlers.DeleteSchedule)

			// Bookings (Sprint 3)
			auth.POST("/bookings", handlers.CreateBooking)
			auth.GET("/my-bookings", handlers.GetMyBookings)

			// Sprint 4
			auth.PUT("/schedules/:id", handlers.UpdateSchedule)
			auth.GET("/schedules/:id/affected-bookings", handlers.GetAffectedBookings)
			auth.POST("/bookings/:id/migrate", handlers.MigrateBooking)
			auth.POST("/bookings/:id/refund", handlers.RefundBooking)
			auth.POST("/schedules/:id/bulk-action", handlers.BulkAction)

			// Sprint 5
			auth.POST("/sessions/cancel", handlers.CancelSession)
			auth.GET("/instructor-bookings", handlers.GetInstructorBookings)
		}
	}
}
