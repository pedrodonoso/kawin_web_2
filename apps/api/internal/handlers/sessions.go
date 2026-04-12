package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

// =============================================================================
// MaterializeSession — POST /api/v1/sessions/materialize
// =============================================================================

type materializeSessionInput struct {
	WorkshopID string `json:"workshop_id"  binding:"required"`
	ScheduleID string `json:"schedule_id"  binding:"required"`
	Date       string `json:"date"         binding:"required"` // "YYYY-MM-DD"
}

type sessionResponse struct {
	ID         string `json:"id"`
	WorkshopID string `json:"workshop_id"`
	ScheduleID string `json:"schedule_id"`
	StartsAt   string `json:"starts_at"`
	EndsAt     string `json:"ends_at"`
	Cancelled  bool   `json:"cancelled"`
	Created    bool   `json:"created"` // true = recién creada, false = ya existía
}

// MaterializeSession maneja POST /api/v1/sessions/materialize.
// Convierte un slot calculado desde un schedule en una sesión real en la base de datos.
// Idempotente: si la sesión ya existe la devuelve sin error.
// Solo el dueño del taller puede materializar sesiones.
func MaterializeSession(c *gin.Context) {
	userID, _ := c.Get("userID")
	ctx := context.Background()

	var input materializeSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	sessionDate, err := time.Parse("2006-01-02", input.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "date inválido, usa YYYY-MM-DD"})
		return
	}

	// Verificar propiedad del taller y que el schedule pertenece al taller
	var ownerID, workshopID string
	var timeStart string
	var durationMin int
	err = db.Pool.QueryRow(ctx,
		`SELECT w.instructor_id, s.workshop_id, s.time_start::text, s.duration_min
		 FROM schedules s
		 JOIN workshops w ON w.id = s.workshop_id
		 WHERE s.id = $1 AND s.workshop_id = $2`,
		input.ScheduleID, input.WorkshopID,
	).Scan(&ownerID, &workshopID, &timeStart, &durationMin)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado o no pertenece al taller"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para materializar sesiones de este taller"})
		return
	}

	// Verificar que el schedule aplica en el día solicitado
	var daysOfWeek []int
	var validFrom time.Time
	var validUntilStr *string
	db.Pool.QueryRow(ctx,
		`SELECT days_of_week, valid_from, valid_until::text FROM schedules WHERE id = $1`,
		input.ScheduleID,
	).Scan(&daysOfWeek, &validFrom, &validUntilStr) //nolint:errcheck

	daySet := make(map[int]bool)
	for _, d := range daysOfWeek {
		daySet[d] = true
	}
	if !daySet[int(sessionDate.Weekday())] {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule no aplica en el día indicado"})
		return
	}
	if sessionDate.Before(validFrom.Truncate(24 * time.Hour)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es anterior al inicio del schedule"})
		return
	}
	if validUntilStr != nil && len(*validUntilStr) >= 10 {
		validUntil, _ := time.Parse("2006-01-02", (*validUntilStr)[:10])
		if sessionDate.After(validUntil) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es posterior al fin del schedule"})
			return
		}
	}

	// Calcular starts_at y ends_at
	parts := strings.SplitN(timeStart, ":", 3)
	hour, _ := strconv.Atoi(parts[0])
	minute := 0
	if len(parts) > 1 {
		minute, _ = strconv.Atoi(parts[1])
	}
	startsAt := fmt.Sprintf("%sT%02d:%02d:00Z", input.Date, hour, minute)
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
	endsAt := startTime.Add(time.Duration(durationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

	// Upsert: crear si no existe, devolver existente si ya existe
	var sessionID string
	var cancelled bool
	var created bool

	// Intentar insert; si hay conflicto, hacer select
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (workshop_id, schedule_id, starts_at) DO NOTHING
		 RETURNING id, cancelled`,
		input.WorkshopID, input.ScheduleID, startsAt, endsAt,
	).Scan(&sessionID, &cancelled)

	if err != nil || sessionID == "" {
		// La sesión ya existía — cargar la existente
		err = db.Pool.QueryRow(ctx,
			`SELECT id, cancelled FROM sessions
			 WHERE workshop_id = $1 AND schedule_id = $2 AND starts_at = $3`,
			input.WorkshopID, input.ScheduleID, startsAt,
		).Scan(&sessionID, &cancelled)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión: " + err.Error()})
			return
		}
		created = false
	} else {
		created = true
	}

	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}

	c.JSON(status, gin.H{"data": sessionResponse{
		ID:         sessionID,
		WorkshopID: input.WorkshopID,
		ScheduleID: input.ScheduleID,
		StartsAt:   startsAt,
		EndsAt:     endsAt,
		Cancelled:  cancelled,
		Created:    created,
	}})
}

// =============================================================================
// CancelSession — POST /api/v1/sessions/cancel
// =============================================================================

type cancelSessionInput struct {
	SessionID string `json:"session_id" binding:"required"`
}

// CancelSession maneja POST /api/v1/sessions/cancel.
// Cancela una sesión ya materializada y devuelve todas las reservas activas.
// Solo el dueño del taller puede cancelar sesiones.
func CancelSession(c *gin.Context) {
	userID, _ := c.Get("userID")
	ctx := context.Background()

	var input cancelSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// Cargar sesión y verificar propiedad del taller
	var workshopID, ownerID string
	var startsAtStr string
	var alreadyCancelled bool
	err := db.Pool.QueryRow(ctx,
		`SELECT s.workshop_id, w.instructor_id, s.starts_at::date::text, s.cancelled
		 FROM sessions s
		 JOIN workshops w ON w.id = s.workshop_id
		 WHERE s.id = $1`,
		input.SessionID,
	).Scan(&workshopID, &ownerID, &startsAtStr, &alreadyCancelled)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sesión no encontrada"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para cancelar sesiones de este taller"})
		return
	}
	if alreadyCancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "Esta sesión ya fue cancelada"})
		return
	}

	// Bloquear cancelación si la sesión tiene reservas activas
	var activeBookings int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
		input.SessionID,
	).Scan(&activeBookings) //nolint:errcheck
	if activeBookings > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"message":         fmt.Sprintf("Esta sesión tiene %d reserva(s) activa(s) y no puede cancelarse.", activeBookings),
			"active_bookings": activeBookings,
		})
		return
	}

	sessionDate, _ := time.Parse("2006-01-02", startsAtStr)

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Marcar sesión como cancelada
	_, err = tx.Exec(ctx,
		`UPDATE sessions SET cancelled = true WHERE id = $1`,
		input.SessionID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar sesión: " + err.Error()})
		return
	}

	// Cargar reservas activas de esta sesión
	rows, err := tx.Query(ctx,
		`SELECT id FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
		input.SessionID,
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
		"session_id":                        input.SessionID,
		"cancelled_bookings":                len(bookingIDs),
		"commission_absorbed_by_instructor": byInstructor,
		"commission_absorbed_by_platform":   byPlatform,
	}})
}
