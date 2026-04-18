package handlers

import (
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
	OnlineURL  string `json:"online_url"`
}

type sessionResponse struct {
	ID         string `json:"id"`
	WorkshopID string `json:"workshop_id"`
	ScheduleID string `json:"schedule_id"`
	StartsAt   string `json:"starts_at"`
	EndsAt     string `json:"ends_at"`
	Cancelled  bool   `json:"cancelled"`
	OnlineURL  string `json:"online_url,omitempty"`
	Created    bool   `json:"created"` // true = recién creada, false = ya existía
}

// MaterializeSession maneja POST /api/v1/sessions/materialize.
func MaterializeSession(c *gin.Context) {
	userID, _ := c.Get("userID")

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

	// Verificar propiedad y obtener time_start y duration_min
	var schedInfo struct {
		OwnerID     string `gorm:"column:owner_id"`
		WorkshopID  string `gorm:"column:workshop_id"`
		TimeStart   string `gorm:"column:time_start"`
		DurationMin int    `gorm:"column:duration_min"`
	}
	res := db.DB.Raw(`
		SELECT w.instructor_id::text as owner_id, s.workshop_id::text as workshop_id,
		       s.time_start::text as time_start, s.duration_min
		FROM schedules s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ? AND s.workshop_id = ?`,
		input.ScheduleID, input.WorkshopID,
	).Scan(&schedInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado o no pertenece al taller"})
		return
	}
	if schedInfo.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para materializar sesiones de este taller"})
		return
	}

	// Verificar que el schedule aplica en el día solicitado
	var schedDetails struct {
		DaysStr    string    `gorm:"column:days_str"`
		ValidFrom  time.Time `gorm:"column:valid_from"`
		ValidUntil *string   `gorm:"column:valid_until"`
	}
	db.DB.Raw(
		`SELECT array_to_string(days_of_week, ',') as days_str, valid_from, valid_until::text as valid_until FROM schedules WHERE id = ?`,
		input.ScheduleID,
	).Scan(&schedDetails) //nolint:errcheck

	daySet := make(map[int]bool)
	for _, d := range parseIntCSV(schedDetails.DaysStr) {
		daySet[d] = true
	}
	if !daySet[int(sessionDate.Weekday())] {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule no aplica en el día indicado"})
		return
	}
	if sessionDate.Before(schedDetails.ValidFrom.Truncate(24 * time.Hour)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es anterior al inicio del schedule"})
		return
	}
	if schedDetails.ValidUntil != nil && len(*schedDetails.ValidUntil) >= 10 {
		validUntil, _ := time.Parse("2006-01-02", (*schedDetails.ValidUntil)[:10])
		if sessionDate.After(validUntil) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es posterior al fin del schedule"})
			return
		}
	}

	// Calcular starts_at y ends_at
	parts := strings.SplitN(schedInfo.TimeStart, ":", 3)
	hour, _ := strconv.Atoi(parts[0])
	minute := 0
	if len(parts) > 1 {
		minute, _ = strconv.Atoi(parts[1])
	}
	startsAt := fmt.Sprintf("%sT%02d:%02d:00Z", input.Date, hour, minute)
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
	endsAt := startTime.Add(time.Duration(schedInfo.DurationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

	// Upsert: crear si no existe, devolver existente si ya existe
	var existing struct {
		ID        string `gorm:"column:id"`
		Cancelled bool   `gorm:"column:cancelled"`
		OnlineURL string `gorm:"column:online_url"`
	}

	created := false

	// Intentar insert; si hay conflicto, hacer select
	insertRes := db.DB.Raw(`
		INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at, online_url)
		VALUES (?, ?, ?, ?, NULLIF(?,''))
		ON CONFLICT (workshop_id, schedule_id, starts_at) DO NOTHING
		RETURNING id, cancelled, COALESCE(online_url,'') as online_url`,
		input.WorkshopID, input.ScheduleID, startsAt, endsAt, input.OnlineURL,
	).Scan(&existing)

	if insertRes.Error != nil || existing.ID == "" {
		// La sesión ya existía — cargarla
		selectRes := db.DB.Raw(`
			SELECT id, cancelled, COALESCE(online_url,'') as online_url FROM sessions
			WHERE workshop_id = ? AND schedule_id = ? AND starts_at = ?`,
			input.WorkshopID, input.ScheduleID, startsAt,
		).Scan(&existing)
		if selectRes.Error != nil || selectRes.RowsAffected == 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión"})
			return
		}
	} else {
		created = true
	}

	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}

	c.JSON(status, gin.H{"data": sessionResponse{
		ID:         existing.ID,
		WorkshopID: input.WorkshopID,
		ScheduleID: input.ScheduleID,
		StartsAt:   startsAt,
		EndsAt:     endsAt,
		Cancelled:  existing.Cancelled,
		OnlineURL:  existing.OnlineURL,
		Created:    created,
	}})
}

// =============================================================================
// UpdateSessionURL — PATCH /api/v1/sessions/:id/url
// =============================================================================

type updateSessionURLInput struct {
	OnlineURL string `json:"online_url"`
}

// UpdateSessionURL maneja PATCH /api/v1/sessions/:id/url.
func UpdateSessionURL(c *gin.Context) {
	userID, _ := c.Get("userID")
	sessionID := c.Param("id")

	var input updateSessionURLInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var ownerID string
	res := db.DB.Raw(`
		SELECT w.instructor_id::text as instructor_id FROM sessions s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, sessionID,
	).Scan(&ownerID)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sesión no encontrada"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para editar esta sesión"})
		return
	}

	if err := db.DB.Exec(
		`UPDATE sessions SET online_url = NULLIF(?,'') WHERE id = ?`, input.OnlineURL, sessionID,
	).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar la sesión: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"online_url": input.OnlineURL})
}

// =============================================================================
// CancelSession — POST /api/v1/sessions/cancel
// =============================================================================

type cancelSessionInput struct {
	SessionID string `json:"session_id" binding:"required"`
}

// CancelSession maneja POST /api/v1/sessions/cancel.
func CancelSession(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input cancelSessionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var sessionInfo struct {
		WorkshopID       string `gorm:"column:workshop_id"`
		OwnerID          string `gorm:"column:owner_id"`
		StartsAtStr      string `gorm:"column:starts_at_str"`
		AlreadyCancelled bool   `gorm:"column:already_cancelled"`
	}
	res := db.DB.Raw(`
		SELECT s.workshop_id::text as workshop_id, w.instructor_id::text as owner_id,
		       s.starts_at::date::text as starts_at_str, s.cancelled as already_cancelled
		FROM sessions s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, input.SessionID,
	).Scan(&sessionInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sesión no encontrada"})
		return
	}
	if sessionInfo.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para cancelar sesiones de este taller"})
		return
	}
	if sessionInfo.AlreadyCancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "Esta sesión ya fue cancelada"})
		return
	}

	var activeBookings int64
	db.DB.Raw(
		`SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status != 'cancelled'`, input.SessionID,
	).Scan(&activeBookings) //nolint:errcheck
	if activeBookings > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"message":         fmt.Sprintf("Esta sesión tiene %d reserva(s) activa(s) y no puede cancelarse.", activeBookings),
			"active_bookings": activeBookings,
		})
		return
	}

	sessionDate, _ := time.Parse("2006-01-02", sessionInfo.StartsAtStr)

	tx := db.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if err := tx.Exec(`UPDATE sessions SET cancelled = true WHERE id = ?`, input.SessionID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar sesión: " + err.Error()})
		return
	}

	var bookingIDs []string
	tx.Raw(`SELECT id FROM bookings WHERE session_id = ? AND status != 'cancelled'`, input.SessionID).
		Scan(&bookingIDs) //nolint:errcheck

	zone := commissionZone(sessionDate)
	byInstructor := 0
	byPlatform := 0

	for _, bid := range bookingIDs {
		if err := tx.Exec(`
			UPDATE bookings
			SET status = 'cancelled', payment_status = 'refunded',
			    cancelled_reason = 'instructor_cancel', commission_absorbed_by = ?
			WHERE id = ?`, zone, bid,
		).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar reserva " + bid + ": " + err.Error()})
			return
		}
		if zone == "instructor" {
			byInstructor++
		} else {
			byPlatform++
		}
	}

	if err := tx.Commit().Error; err != nil {
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
