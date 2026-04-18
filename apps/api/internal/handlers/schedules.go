package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
	"github.com/pedrodonoso/kawin/api/internal/models"
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

// schedRowRaw is an intermediate struct used when scanning schedule rows from DB.
// GORM v1 cannot scan named-slice types (models.IntArray) via Raw().Scan(), so we
// fetch days_of_week as a comma-separated string and convert in Go.
type schedRowRaw struct {
	ID          string  `gorm:"column:id"`
	WorkshopID  string  `gorm:"column:workshop_id"`
	DaysStr     string  `gorm:"column:days_str"`
	TimeStart   string  `gorm:"column:time_start"`
	DurationMin int     `gorm:"column:duration_min"`
	ValidFrom   string  `gorm:"column:valid_from"`
	ValidUntil  *string `gorm:"column:valid_until"`
	CreatedAt   string  `gorm:"column:created_at"`
}

// parseIntCSV parses a comma-separated string of integers (e.g. "1,3,5") into []int.
func parseIntCSV(s string) []int {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	result := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			result = append(result, n)
		}
	}
	return result
}

// rowsToSchedules converts raw DB scan results into handler Schedule structs.
func rowsToSchedules(rows []schedRowRaw) []Schedule {
	out := make([]Schedule, len(rows))
	for i, r := range rows {
		out[i] = Schedule{
			ID:          r.ID,
			WorkshopID:  r.WorkshopID,
			DaysOfWeek:  parseIntCSV(r.DaysStr),
			TimeStart:   r.TimeStart,
			DurationMin: r.DurationMin,
			ValidFrom:   r.ValidFrom,
			ValidUntil:  r.ValidUntil,
			CreatedAt:   r.CreatedAt,
		}
	}
	return out
}

// createScheduleInput is the request body for POST /workshops/:id/schedules.
type createScheduleInput struct {
	DaysOfWeek  []int  `json:"days_of_week"  binding:"required"`
	TimeStart   string `json:"time_start"    binding:"required"`
	DurationMin int    `json:"duration_min"`
	ValidFrom   string `json:"valid_from"`
}

// CreateSchedule handles POST /api/v1/workshops/:id/schedules.
func CreateSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	workshopID := c.Param("id")

	// Verify ownership
	var ownerID string
	result := db.DB.Raw(`SELECT instructor_id::text as instructor_id FROM workshops WHERE id = ?`, workshopID).
		Scan(&ownerID)
	if result.Error != nil || result.RowsAffected == 0 {
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
	if len(input.TimeStart) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "time_start inválido, usa formato HH:MM"})
		return
	}
	if input.DurationMin <= 0 {
		input.DurationMin = 60
	}

	validFrom := input.ValidFrom
	if validFrom == "" {
		validFrom = time.Now().Format("2006-01-02")
	}

	parsedValidFrom, err := time.Parse("2006-01-02", validFrom)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "valid_from inválido, usa YYYY-MM-DD"})
		return
	}

	sched := models.Schedule{
		WorkshopID:  workshopID,
		DaysOfWeek:  models.IntArray(input.DaysOfWeek),
		TimeStart:   input.TimeStart,
		DurationMin: input.DurationMin,
		ValidFrom:   parsedValidFrom,
	}
	if err := db.DB.Create(&sched).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear schedule: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": sched.ID}})
}

// GetSchedules handles GET /api/v1/workshops/:id/schedules.
func GetSchedules(c *gin.Context) {
	workshopID := c.Param("id")

	var rows []schedRowRaw
	if err := db.DB.Raw(`
		SELECT id, workshop_id,
		       array_to_string(days_of_week, ',') as days_str,
		       time_start::text as time_start, duration_min,
		       valid_from::text as valid_from, valid_until::text as valid_until,
		       created_at::text as created_at
		FROM schedules
		WHERE workshop_id = ?
		  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
		ORDER BY valid_from, time_start`, workshopID,
	).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener schedules"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rowsToSchedules(rows)})
}

// DeleteSchedule handles DELETE /api/v1/schedules/:id.
// Soft-deletes by setting valid_until = today.
func DeleteSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")

	var ownerID string
	result := db.DB.Raw(`
		SELECT w.instructor_id::text as instructor_id
		FROM schedules s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, scheduleID,
	).Scan(&ownerID)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar este schedule"})
		return
	}

	res := db.DB.Exec(`UPDATE schedules SET valid_until = CURRENT_DATE WHERE id = ? AND valid_until IS NULL`, scheduleID)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al eliminar schedule: " + res.Error.Error()})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": scheduleID, "already_closed": true}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": scheduleID}})
}

// updateScheduleInput is the request body for PUT /api/v1/schedules/:id.
type updateScheduleInput struct {
	DaysOfWeek  []int  `json:"days_of_week"  binding:"required"`
	TimeStart   string `json:"time_start"    binding:"required"`
	DurationMin int    `json:"duration_min"`
	ChangeDate  string `json:"change_date"   binding:"required"`
}

// UpdateSchedule handles PUT /api/v1/schedules/:id.
func UpdateSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")

	var ownership struct {
		OwnerID    string `gorm:"column:owner_id"`
		WorkshopID string `gorm:"column:workshop_id"`
	}
	result := db.DB.Raw(`
		SELECT w.instructor_id::text as owner_id, s.workshop_id::text as workshop_id
		FROM schedules s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, scheduleID,
	).Scan(&ownership)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownership.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar este schedule"})
		return
	}

	var input updateScheduleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	changeDate, err := time.Parse("2006-01-02", input.ChangeDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date inválido, usa YYYY-MM-DD"})
		return
	}
	validUntilOld := changeDate.AddDate(0, 0, -1).Format("2006-01-02")

	if input.DurationMin <= 0 {
		input.DurationMin = 60
	}

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

	if err := tx.Exec(`UPDATE schedules SET valid_until = ? WHERE id = ?`, validUntilOld, scheduleID).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cerrar schedule antiguo: " + err.Error()})
		return
	}

	newSched := models.Schedule{
		WorkshopID:  ownership.WorkshopID,
		DaysOfWeek:  models.IntArray(input.DaysOfWeek),
		TimeStart:   input.TimeStart,
		DurationMin: input.DurationMin,
		ValidFrom:   changeDate,
	}
	if err := tx.Create(&newSched).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear schedule nuevo: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar cambio"})
		return
	}

	var newScheduleID = newSched.ID

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"old_schedule_id": scheduleID,
		"new_schedule_id": newScheduleID,
	}})
}

// affectedBookingRow is returned by GetAffectedBookings and used internally.
type affectedBookingRow struct {
	BookingID      string  `json:"booking_id"     gorm:"column:booking_id"`
	StudentName    string  `json:"student_name"   gorm:"column:student_name"`
	SessionDate    string  `json:"session_date"   gorm:"column:session_date"`
	SessionTime    string  `json:"session_time"   gorm:"column:session_time"`
	Amount         float64 `json:"amount"         gorm:"column:amount"`
	CommissionZone string  `json:"commission_zone"`
}

// commissionZone returns "instructor" if now is on or past the Monday of sessionDate's ISO week.
func commissionZone(sessionDate time.Time) string {
	weekday := int(sessionDate.Weekday()) // 0=Sun,1=Mon,...,6=Sat
	daysFromMonday := (weekday + 6) % 7   // Mon→0, Tue→1, ..., Sun→6
	cutoffMonday := sessionDate.AddDate(0, 0, -daysFromMonday)
	cutoffMonday = time.Date(cutoffMonday.Year(), cutoffMonday.Month(), cutoffMonday.Day(), 0, 0, 0, 0, time.UTC)
	if time.Now().UTC().Before(cutoffMonday) {
		return "platform"
	}
	return "instructor"
}

// GetAffectedBookings handles GET /api/v1/schedules/:id/affected-bookings?change_date=YYYY-MM-DD.
func GetAffectedBookings(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")
	changeDateStr := c.Query("change_date")

	if changeDateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date requerido"})
		return
	}
	if _, err := time.Parse("2006-01-02", changeDateStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date inválido, usa YYYY-MM-DD"})
		return
	}

	var ownerID string
	result := db.DB.Raw(`
		SELECT w.instructor_id::text as instructor_id
		FROM schedules s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, scheduleID,
	).Scan(&ownerID)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso"})
		return
	}

	var rows []affectedBookingRow
	if err := db.DB.Raw(`
		SELECT b.id as booking_id, COALESCE(p.name, u.email) as student_name,
		       s.starts_at::date::text as session_date, s.starts_at::time::text as session_time,
		       b.amount
		FROM bookings b
		JOIN sessions s ON s.id = b.session_id
		JOIN users u ON u.id = b.student_id
		LEFT JOIN profiles p ON p.user_id = b.student_id
		WHERE s.schedule_id = ?
		  AND s.starts_at >= ?::date
		  AND b.status != 'cancelled'
		ORDER BY s.starts_at`, scheduleID, changeDateStr,
	).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas afectadas: " + err.Error()})
		return
	}

	for i := range rows {
		if sd, err := time.Parse("2006-01-02", rows[i].SessionDate); err == nil {
			rows[i].CommissionZone = commissionZone(sd)
		} else {
			rows[i].CommissionZone = "instructor"
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": rows})
}

// bulkActionInput is the request body for POST /api/v1/schedules/:id/bulk-action.
type bulkActionInput struct {
	Action        string `json:"action"         binding:"required"` // "migrate_all" | "refund_all"
	NewScheduleID string `json:"new_schedule_id"`
	ChangeDate    string `json:"change_date"    binding:"required"`
}

// BulkAction handles POST /api/v1/schedules/:id/bulk-action.
func BulkAction(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")

	var input bulkActionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if input.Action != "migrate_all" && input.Action != "refund_all" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "action debe ser 'migrate_all' o 'refund_all'"})
		return
	}
	if input.Action == "migrate_all" && input.NewScheduleID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "new_schedule_id requerido para migrate_all"})
		return
	}
	if _, err := time.Parse("2006-01-02", input.ChangeDate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date inválido, usa YYYY-MM-DD"})
		return
	}

	var ownerID string
	result := db.DB.Raw(`
		SELECT w.instructor_id::text as instructor_id
		FROM schedules s
		JOIN workshops w ON w.id = s.workshop_id
		WHERE s.id = ?`, scheduleID,
	).Scan(&ownerID)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso"})
		return
	}

	newSchedTimeStart := ""
	newSchedDurationMin := 0
	if input.Action == "migrate_all" {
		var newSchedInfo struct {
			TimeStart   string `gorm:"column:time_start"`
			DurationMin int    `gorm:"column:duration_min"`
		}
		res := db.DB.Raw(
			`SELECT time_start::text as time_start, duration_min FROM schedules WHERE id = ?`,
			input.NewScheduleID,
		).Scan(&newSchedInfo)
		if res.Error != nil || res.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "new_schedule_id no encontrado"})
			return
		}
		newSchedTimeStart = newSchedInfo.TimeStart
		newSchedDurationMin = newSchedInfo.DurationMin
	}

	type affectedRow struct {
		BookingID   string    `gorm:"column:booking_id"`
		SessionID   string    `gorm:"column:session_id"`
		SessionDate time.Time `gorm:"column:session_date"`
		WorkshopID  string    `gorm:"column:workshop_id"`
	}

	var affected []affectedRow
	if err := db.DB.Raw(`
		SELECT b.id as booking_id, b.session_id::text as session_id,
		       s.starts_at::date as session_date, b.workshop_id::text as workshop_id
		FROM bookings b
		JOIN sessions s ON s.id = b.session_id
		WHERE s.schedule_id = ?
		  AND s.starts_at >= ?::date
		  AND b.status != 'cancelled'`,
		scheduleID, input.ChangeDate,
	).Scan(&affected).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas afectadas: " + err.Error()})
		return
	}

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

	migrated := 0
	refunded := 0

	for _, r := range affected {
		if input.Action == "refund_all" {
			zone := commissionZone(r.SessionDate)
			if err := tx.Exec(`
				UPDATE bookings
				SET status = 'cancelled', payment_status = 'refunded',
				    cancelled_reason = 'schedule_change', commission_absorbed_by = ?
				WHERE id = ?`, zone, r.BookingID,
			).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al reembolsar reserva " + r.BookingID + ": " + err.Error()})
				return
			}
			refunded++
		} else {
			targetDateStr := r.SessionDate.Format("2006-01-02")
			startsAt := targetDateStr + "T" + newSchedTimeStart + "Z"
			startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
			endsAt := startTime.Add(time.Duration(newSchedDurationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

			var targetSessionID string
			if err := tx.Raw(`
				INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
				VALUES (?, ?, ?, ?)
				ON CONFLICT (workshop_id, schedule_id, starts_at) DO UPDATE SET workshop_id = EXCLUDED.workshop_id
				RETURNING id`,
				r.WorkshopID, input.NewScheduleID, startsAt, endsAt,
			).Scan(&targetSessionID).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión destino: " + err.Error()})
				return
			}

			var cancelled bool
			tx.Raw(`SELECT cancelled FROM sessions WHERE id = ?`, targetSessionID).Scan(&cancelled) //nolint:errcheck
			if cancelled {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"message": "La sesión destino está cancelada para la fecha " + targetDateStr})
				return
			}

			if err := tx.Exec(`
				UPDATE bookings
				SET session_id = ?, migrated_from_session_id = ?, status = 'confirmed'
				WHERE id = ?`,
				targetSessionID, r.SessionID, r.BookingID,
			).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al migrar reserva " + r.BookingID + ": " + err.Error()})
				return
			}
			migrated++
		}
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar operación bulk"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"migrated": migrated,
		"refunded": refunded,
	}})
}
