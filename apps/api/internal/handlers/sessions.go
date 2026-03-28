package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type cancelSessionInput struct {
	ScheduleID string `json:"schedule_id" binding:"required"`
	Date       string `json:"date" binding:"required"` // "YYYY-MM-DD"
}

// CancelSession handles POST /api/v1/sessions/cancel.
// Materializes the session if needed, marks it cancelled, and refunds all active bookings.
func CancelSession(c *gin.Context) {
	userID, _ := c.Get("userID")
	ctx := context.Background()

	var input cancelSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	sessionDate, err := time.Parse("2006-01-02", input.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "date inválido, usa YYYY-MM-DD"})
		return
	}

	// Load schedule and verify workshop ownership
	var workshopID, ownerID, timeStart string
	var durationMin int
	err = db.Pool.QueryRow(ctx,
		`SELECT s.workshop_id, w.instructor_id, s.time_start::text, s.duration_min
		 FROM schedules s
		 JOIN workshops w ON w.id = s.workshop_id
		 WHERE s.id = $1`,
		input.ScheduleID,
	).Scan(&workshopID, &ownerID, &timeStart, &durationMin)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para cancelar clases de este taller"})
		return
	}

	// Compute starts_at and ends_at
	startsAt := input.Date + "T" + timeStart + ":00Z"
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
	endsAt := startTime.Add(time.Duration(durationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Upsert session
	var sessionID string
	var alreadyCancelled bool
	err = tx.QueryRow(ctx,
		`INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (workshop_id, schedule_id, starts_at) DO UPDATE SET workshop_id = EXCLUDED.workshop_id
		 RETURNING id, cancelled`,
		workshopID, input.ScheduleID, startsAt, endsAt,
	).Scan(&sessionID, &alreadyCancelled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión: " + err.Error()})
		return
	}

	if alreadyCancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "Esta clase ya fue cancelada"})
		return
	}

	// Mark session as cancelled
	_, err = tx.Exec(ctx,
		`UPDATE sessions SET cancelled = true WHERE id = $1`,
		sessionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar sesión: " + err.Error()})
		return
	}

	// Load active bookings for this session
	rows, err := tx.Query(ctx,
		`SELECT id FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
		sessionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas: " + err.Error()})
		return
	}

	var bookingIDs []string
	for rows.Next() {
		var bid string
		if err := rows.Scan(&bid); err != nil {
			continue
		}
		bookingIDs = append(bookingIDs, bid)
	}
	rows.Close()

	zone := commissionZone(sessionDate)

	byInstructor := 0
	byPlatform := 0

	for _, bid := range bookingIDs {
		_, err = tx.Exec(ctx,
			`UPDATE bookings
			 SET status = 'cancelled', payment_status = 'refunded',
			     cancelled_reason = 'instructor_cancel', commission_absorbed_by = $1
			 WHERE id = $2`,
			zone, bid,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar reserva " + bid + ": " + err.Error()})
			return
		}
		if zone == "instructor" {
			byInstructor++
		} else {
			byPlatform++
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar cancelación"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"session_id":                          sessionID,
		"cancelled_bookings":                  len(bookingIDs),
		"commission_absorbed_by_instructor":   byInstructor,
		"commission_absorbed_by_platform":     byPlatform,
	}})
}
