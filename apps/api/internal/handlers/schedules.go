package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

// Schedule represents a recurring rule for a class workshop.
type Schedule struct {
	ID          string  `json:"id"`
	WorkshopID  string  `json:"workshop_id"`
	DaysOfWeek  []int   `json:"days_of_week"` // 0=Sun, 1=Mon, ..., 6=Sat
	TimeStart   string  `json:"time_start"`   // "HH:MM"
	DurationMin int     `json:"duration_min"`
	ValidFrom   string  `json:"valid_from"`
	ValidUntil  *string `json:"valid_until"` // nil = active indefinitely
	CreatedAt   string  `json:"created_at"`
}

// createScheduleInput is the request body for POST /workshops/:id/schedules.
type createScheduleInput struct {
	DaysOfWeek  []int  `json:"days_of_week"  binding:"required"`
	TimeStart   string `json:"time_start"    binding:"required"`
	DurationMin int    `json:"duration_min"`
	ValidFrom   string `json:"valid_from"`
}

// CreateSchedule handles POST /api/v1/workshops/:id/schedules.
// Only the workshop owner can create schedules.
func CreateSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	workshopID := c.Param("id")

	// Verify ownership
	var ownerID string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT instructor_id FROM workshops WHERE id = $1`, workshopID,
	).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar este taller"})
		return
	}

	var input createScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// Validate days_of_week: must be non-empty, values 0-6
	if len(input.DaysOfWeek) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "days_of_week no puede estar vacío"})
		return
	}
	for _, d := range input.DaysOfWeek {
		if d < 0 || d > 6 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "days_of_week debe contener valores entre 0 (Dom) y 6 (Sáb)"})
			return
		}
	}

	// Validate time_start format (simple check — Postgres will validate properly)
	if len(input.TimeStart) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "time_start inválido, usa formato HH:MM"})
		return
	}

	if input.DurationMin <= 0 {
		input.DurationMin = 60
	}

	// valid_from defaults to today if not provided
	validFrom := input.ValidFrom
	if validFrom == "" {
		validFrom = "today"
	}

	var scheduleID string
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
		 VALUES ($1, $2, $3, $4, $5::date)
		 RETURNING id`,
		workshopID, input.DaysOfWeek, input.TimeStart, input.DurationMin, validFrom,
	).Scan(&scheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear schedule: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": scheduleID}})
}

// GetSchedules handles GET /api/v1/workshops/:id/schedules.
// Returns active schedules (valid_until IS NULL or >= today).
func GetSchedules(c *gin.Context) {
	workshopID := c.Param("id")

	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, workshop_id, days_of_week, time_start::text, duration_min,
		        valid_from::text, valid_until::text, created_at::text
		 FROM schedules
		 WHERE workshop_id = $1
		   AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
		 ORDER BY valid_from, time_start`,
		workshopID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener schedules"})
		return
	}
	defer rows.Close()

	schedules := []Schedule{}
	for rows.Next() {
		var s Schedule
		var validUntil *string
		if err := rows.Scan(
			&s.ID, &s.WorkshopID, &s.DaysOfWeek, &s.TimeStart, &s.DurationMin,
			&s.ValidFrom, &validUntil, &s.CreatedAt,
		); err != nil {
			continue
		}
		s.ValidUntil = validUntil
		schedules = append(schedules, s)
	}

	c.JSON(http.StatusOK, gin.H{"data": schedules})
}

// DeleteSchedule handles DELETE /api/v1/schedules/:id.
// Soft-deletes by setting valid_until = today. Only the workshop owner can do this.
func DeleteSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")

	// Verify ownership via JOIN
	var ownerID string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT w.instructor_id
		 FROM schedules s
		 JOIN workshops w ON w.id = s.workshop_id
		 WHERE s.id = $1`, scheduleID,
	).Scan(&ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar este schedule"})
		return
	}

	// Soft delete: set valid_until = today
	result, err := db.Pool.Exec(context.Background(),
		`UPDATE schedules SET valid_until = CURRENT_DATE WHERE id = $1 AND valid_until IS NULL`,
		scheduleID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al eliminar schedule: " + err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		// Already closed or not found — still OK from caller's perspective
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": scheduleID, "already_closed": true}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": scheduleID}})
}
