package handlers

import (
	"context"
	"net/http"
	"time"

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

// updateScheduleInput is the request body for PUT /api/v1/schedules/:id.
type updateScheduleInput struct {
	DaysOfWeek  []int  `json:"days_of_week"  binding:"required"`
	TimeStart   string `json:"time_start"    binding:"required"`
	DurationMin int    `json:"duration_min"`
	ChangeDate  string `json:"change_date"   binding:"required"`
}

// UpdateSchedule handles PUT /api/v1/schedules/:id.
// Closes the old schedule the day before change_date and creates a new one from change_date.
func UpdateSchedule(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")
	ctx := context.Background()

	// Verify ownership
	var ownerID string
	var workshopID string
	err := db.Pool.QueryRow(ctx,
		`SELECT w.instructor_id, s.workshop_id
		 FROM schedules s
		 JOIN workshops w ON w.id = s.workshop_id
		 WHERE s.id = $1`, scheduleID,
	).Scan(&ownerID, &workshopID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
		return
	}
	if ownerID != userID.(string) {
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

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Close old schedule
	_, err = tx.Exec(ctx,
		`UPDATE schedules SET valid_until = $1 WHERE id = $2`,
		validUntilOld, scheduleID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cerrar schedule antiguo: " + err.Error()})
		return
	}

	// Insert new schedule
	var newScheduleID string
	err = tx.QueryRow(ctx,
		`INSERT INTO schedules (workshop_id, days_of_week, time_start, duration_min, valid_from)
		 VALUES ($1, $2, $3, $4, $5::date)
		 RETURNING id`,
		workshopID, input.DaysOfWeek, input.TimeStart, input.DurationMin, input.ChangeDate,
	).Scan(&newScheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear schedule nuevo: " + err.Error()})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar cambio"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"old_schedule_id": scheduleID,
		"new_schedule_id": newScheduleID,
	}})
}

// affectedBookingRow is returned by GetAffectedBookings and used internally.
type affectedBookingRow struct {
	BookingID      string  `json:"booking_id"`
	StudentName    string  `json:"student_name"`
	SessionDate    string  `json:"session_date"`
	SessionTime    string  `json:"session_time"`
	Amount         float64 `json:"amount"`
	CommissionZone string  `json:"commission_zone"`
}

// commissionZone returns "instructor" if now is past the Sunday before sessionDate,
// or "platform" if the change is still in advance.
func commissionZone(sessionDate time.Time) string {
	weekday := int(sessionDate.Weekday()) // 0=Sun
	cutoffSunday := sessionDate.AddDate(0, 0, -weekday)
	if time.Now().UTC().Before(cutoffSunday) {
		return "platform"
	}
	return "instructor"
}

// GetAffectedBookings handles GET /api/v1/schedules/:id/affected-bookings?change_date=YYYY-MM-DD.
func GetAffectedBookings(c *gin.Context) {
	userID, _ := c.Get("userID")
	scheduleID := c.Param("id")
	changeDateStr := c.Query("change_date")
	ctx := context.Background()

	if changeDateStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date requerido"})
		return
	}
	if _, err := time.Parse("2006-01-02", changeDateStr); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "change_date inválido, usa YYYY-MM-DD"})
		return
	}

	// Verify ownership
	var ownerID string
	err := db.Pool.QueryRow(ctx,
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
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso"})
		return
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT b.id, COALESCE(p.name, u.email), s.starts_at::date::text, s.starts_at::time::text, b.amount
		 FROM bookings b
		 JOIN sessions s ON s.id = b.session_id
		 JOIN users u ON u.id = b.student_id
		 LEFT JOIN profiles p ON p.user_id = b.student_id
		 WHERE s.schedule_id = $1
		   AND s.starts_at >= $2::date
		   AND b.status != 'cancelled'
		 ORDER BY s.starts_at`,
		scheduleID, changeDateStr,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas afectadas: " + err.Error()})
		return
	}
	defer rows.Close()

	result := []affectedBookingRow{}
	for rows.Next() {
		var r affectedBookingRow
		var sessionDateStr string
		if err := rows.Scan(&r.BookingID, &r.StudentName, &sessionDateStr, &r.SessionTime, &r.Amount); err != nil {
			continue
		}
		r.SessionDate = sessionDateStr
		if sd, err := time.Parse("2006-01-02", sessionDateStr); err == nil {
			r.CommissionZone = commissionZone(sd)
		} else {
			r.CommissionZone = "instructor"
		}
		result = append(result, r)
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
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
	ctx := context.Background()

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

	// Verify ownership
	var ownerID string
	err := db.Pool.QueryRow(ctx,
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
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso"})
		return
	}

	// Fetch new schedule details for migrate_all
	newSchedTimeStart := ""
	newSchedDurationMin := 0
	if input.Action == "migrate_all" {
		var newSchedDaysOfWeek []int
		err = db.Pool.QueryRow(ctx,
			`SELECT days_of_week, time_start::text, duration_min FROM schedules WHERE id = $1`,
			input.NewScheduleID,
		).Scan(&newSchedDaysOfWeek, &newSchedTimeStart, &newSchedDurationMin)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "new_schedule_id no encontrado"})
			return
		}
	}

	// Get affected bookings with session info
	type affectedRow struct {
		bookingID      string
		sessionID      string
		sessionDate    time.Time
		workshopID     string
		oldSessionID   string
	}

	rows, err := db.Pool.Query(ctx,
		`SELECT b.id, b.session_id, s.starts_at::date, b.workshop_id
		 FROM bookings b
		 JOIN sessions s ON s.id = b.session_id
		 WHERE s.schedule_id = $1
		   AND s.starts_at >= $2::date
		   AND b.status != 'cancelled'`,
		scheduleID, input.ChangeDate,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas afectadas: " + err.Error()})
		return
	}

	var affected []affectedRow
	for rows.Next() {
		var r affectedRow
		if err := rows.Scan(&r.bookingID, &r.sessionID, &r.sessionDate, &r.workshopID); err != nil {
			continue
		}
		r.oldSessionID = r.sessionID
		affected = append(affected, r)
	}
	rows.Close()

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	migrated := 0
	refunded := 0

	for _, r := range affected {
		if input.Action == "refund_all" {
			zone := commissionZone(r.sessionDate)
			_, err := tx.Exec(ctx,
				`UPDATE bookings
				 SET status = 'cancelled', payment_status = 'refunded',
				     cancelled_reason = 'schedule_change', commission_absorbed_by = $1
				 WHERE id = $2`,
				zone, r.bookingID,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al reembolsar reserva " + r.bookingID + ": " + err.Error()})
				return
			}
			refunded++
		} else {
			// migrate_all: keep same session date, move to new schedule
			targetDateStr := r.sessionDate.Format("2006-01-02")
			startsAt := targetDateStr + "T" + newSchedTimeStart + ":00Z"
			startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
			endsAt := startTime.Add(time.Duration(newSchedDurationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

			var targetSessionID string
			err = tx.QueryRow(ctx,
				`INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (workshop_id, schedule_id, starts_at) DO UPDATE SET workshop_id = EXCLUDED.workshop_id
				 RETURNING id`,
				r.workshopID, input.NewScheduleID, startsAt, endsAt,
			).Scan(&targetSessionID)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión destino: " + err.Error()})
				return
			}

			// Check target session not cancelled
			var cancelled bool
			tx.QueryRow(ctx, `SELECT cancelled FROM sessions WHERE id = $1`, targetSessionID).Scan(&cancelled) //nolint:errcheck
			if cancelled {
				c.JSON(http.StatusConflict, gin.H{"message": "La sesión destino está cancelada para la fecha " + targetDateStr})
				return
			}

			_, err = tx.Exec(ctx,
				`UPDATE bookings
				 SET session_id = $1, migrated_from_session_id = $2, status = 'confirmed'
				 WHERE id = $3`,
				targetSessionID, r.oldSessionID, r.bookingID,
			)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al migrar reserva " + r.bookingID + ": " + err.Error()})
				return
			}
			migrated++
		}
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar operación bulk"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"migrated": migrated,
		"refunded": refunded,
	}})
}
