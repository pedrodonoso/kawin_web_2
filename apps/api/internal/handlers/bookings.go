package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

// createBookingInput is the request body for POST /api/v1/bookings.
// For type=class: provide schedule_id + date.
// For other types: only workshop_id is required.
type createBookingInput struct {
	WorkshopID string `json:"workshop_id" binding:"required"`
	ScheduleID string `json:"schedule_id"` // required only for class workshops
	Date       string `json:"date"`        // "YYYY-MM-DD", required for class workshops
}

type bookingResponse struct {
	ID            string  `json:"id"`
	WorkshopID    string  `json:"workshop_id"`
	SessionID     *string `json:"session_id,omitempty"`
	Status        string  `json:"status"`
	PaymentStatus string  `json:"payment_status"`
	Amount        float64 `json:"amount"`
	Commission    float64 `json:"commission"`
}

// CreateBooking handles POST /api/v1/bookings.
// For class workshops: materializes the session if needed, checks capacity, then books.
// For other types: books directly against the workshop.
func CreateBooking(c *gin.Context) {
	studentID, _ := c.Get("userID")

	var input createBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	ctx := context.Background()

	// Load workshop (price, capacity, type)
	var workshopType string
	var price float64
	var capacity *int
	err := db.Pool.QueryRow(ctx,
		`SELECT type, price, capacity FROM workshops WHERE id = $1 AND status = 'published'`,
		input.WorkshopID,
	).Scan(&workshopType, &price, &capacity)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	commission := price * 0.15
	var sessionID *string

	if workshopType == "class" {
		if input.ScheduleID == "" || input.Date == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "schedule_id y date son requeridos para talleres tipo class"})
			return
		}

		// Validate that the schedule generates a session on the given date
		targetDate, err := time.Parse("2006-01-02", input.Date)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "date inválido, usa YYYY-MM-DD"})
			return
		}

		var daysOfWeek []int
		var validFrom time.Time
		var validUntilStr *string
		var timeStart string
		var durationMin int
		var schedWorkshopID string

		err = db.Pool.QueryRow(ctx,
			`SELECT workshop_id, days_of_week, time_start::text, duration_min, valid_from, valid_until::text
			 FROM schedules WHERE id = $1`,
			input.ScheduleID,
		).Scan(&schedWorkshopID, &daysOfWeek, &timeStart, &durationMin, &validFrom, &validUntilStr)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Schedule no encontrado"})
			return
		}

		if schedWorkshopID != input.WorkshopID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule no pertenece a este taller"})
			return
		}

		// Validate schedule generates session on targetDate
		daySet := make(map[int]bool)
		for _, d := range daysOfWeek {
			daySet[d] = true
		}
		if !daySet[int(targetDate.Weekday())] {
			c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule no tiene clases en el día indicado"})
			return
		}
		if targetDate.Before(validFrom.Truncate(24 * time.Hour)) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es anterior al inicio del schedule"})
			return
		}
		if validUntilStr != nil {
			validUntil, _ := time.Parse("2006-01-02", (*validUntilStr)[:10])
			if targetDate.After(validUntil) {
				c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es posterior al fin del schedule"})
				return
			}
		}

		// Run atomic transaction: materialize session + create booking
		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
			return
		}
		defer tx.Rollback(ctx) //nolint:errcheck

		// Upsert session (materialize if not exists)
		startsAt := input.Date + "T" + timeStart + ":00Z"
		// Compute ends_at from duration
		startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
		endsAt := startTime.Add(time.Duration(durationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

		var sid string
		err = tx.QueryRow(ctx,
			`INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (workshop_id, schedule_id, starts_at) DO UPDATE SET workshop_id = EXCLUDED.workshop_id
			 RETURNING id`,
			input.WorkshopID, input.ScheduleID, startsAt, endsAt,
		).Scan(&sid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión: " + err.Error()})
			return
		}
		sessionID = &sid

		// Check session is not cancelled
		var cancelled bool
		tx.QueryRow(ctx, `SELECT cancelled FROM sessions WHERE id = $1`, sid).Scan(&cancelled) //nolint:errcheck
		if cancelled {
			c.JSON(http.StatusConflict, gin.H{"message": "Esta clase fue cancelada"})
			return
		}

		// Check capacity
		if capacity != nil {
			var count int
			tx.QueryRow(ctx,
				`SELECT COUNT(*) FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
				sid,
			).Scan(&count) //nolint:errcheck
			if count >= *capacity {
				c.JSON(http.StatusConflict, gin.H{"message": "No hay cupos disponibles para esta clase"})
				return
			}
		}

		// Insert booking
		var bookingID string
		err = tx.QueryRow(ctx,
			`INSERT INTO bookings (student_id, workshop_id, session_id, status, payment_status, amount, commission)
			 VALUES ($1, $2, $3, 'confirmed', 'pending', $4, $5)
			 RETURNING id`,
			studentID.(string), input.WorkshopID, sid, price, commission,
		).Scan(&bookingID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear reserva: " + err.Error()})
			return
		}

		if err := tx.Commit(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar reserva"})
			return
		}

		c.JSON(http.StatusCreated, gin.H{"data": bookingResponse{
			ID:            bookingID,
			WorkshopID:    input.WorkshopID,
			SessionID:     sessionID,
			Status:        "confirmed",
			PaymentStatus: "pending",
			Amount:        price,
			Commission:    commission,
		}})
		return
	}

	// Non-class booking (workshop, course, event): book without session
	var bookingID string
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO bookings (student_id, workshop_id, status, payment_status, amount, commission)
		 VALUES ($1, $2, 'confirmed', 'pending', $3, $4)
		 RETURNING id`,
		studentID.(string), input.WorkshopID, price, commission,
	).Scan(&bookingID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": bookingResponse{
		ID:            bookingID,
		WorkshopID:    input.WorkshopID,
		Status:        "confirmed",
		PaymentStatus: "pending",
		Amount:        price,
		Commission:    commission,
	}})
}

// GetMyBookings handles GET /api/v1/my-bookings.
// Returns bookings for the authenticated user (as student).
func GetMyBookings(c *gin.Context) {
	studentID, _ := c.Get("userID")

	rows, err := db.Pool.Query(context.Background(),
		`SELECT b.id, b.workshop_id, w.title, w.slug,
		        b.session_id::text, b.status, b.payment_status, b.amount,
		        COALESCE(s.starts_at::text, ''), b.created_at::text
		 FROM bookings b
		 JOIN workshops w ON w.id = b.workshop_id
		 LEFT JOIN sessions s ON s.id = b.session_id
		 WHERE b.student_id = $1
		 ORDER BY b.created_at DESC
		 LIMIT 50`,
		studentID.(string),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas"})
		return
	}
	defer rows.Close()

	type myBooking struct {
		ID            string  `json:"id"`
		WorkshopID    string  `json:"workshop_id"`
		WorkshopTitle string  `json:"workshop_title"`
		WorkshopSlug  string  `json:"workshop_slug"`
		SessionID     *string `json:"session_id,omitempty"`
		Status        string  `json:"status"`
		PaymentStatus string  `json:"payment_status"`
		Amount        float64 `json:"amount"`
		SessionDate   string  `json:"session_date,omitempty"`
		CreatedAt     string  `json:"created_at"`
	}

	bookings := []myBooking{}
	for rows.Next() {
		var b myBooking
		var sessionIDStr *string
		if err := rows.Scan(
			&b.ID, &b.WorkshopID, &b.WorkshopTitle, &b.WorkshopSlug,
			&sessionIDStr, &b.Status, &b.PaymentStatus, &b.Amount,
			&b.SessionDate, &b.CreatedAt,
		); err != nil {
			continue
		}
		if sessionIDStr != nil && *sessionIDStr != "" {
			b.SessionID = sessionIDStr
		}
		bookings = append(bookings, b)
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// GetInstructorBookings handles GET /api/v1/instructor-bookings.
// Returns all bookings for workshops owned by the authenticated instructor.
// Optional query params: ?workshop_id=, ?status=, ?from= (date), ?to= (date)
func GetInstructorBookings(c *gin.Context) {
	instructorID, _ := c.Get("userID")
	ctx := context.Background()

	workshopIDFilter := c.Query("workshop_id")
	statusFilter := c.Query("status")
	fromFilter := c.Query("from")
	toFilter := c.Query("to")

	query := `SELECT b.id, b.workshop_id, w.title, p.name,
	                 COALESCE(s.starts_at::text, ''), b.status, b.payment_status, b.amount, b.created_at::text
	          FROM bookings b
	          JOIN workshops w ON w.id = b.workshop_id
	          JOIN profiles p ON p.user_id = b.student_id
	          LEFT JOIN sessions s ON s.id = b.session_id
	          WHERE w.instructor_id = $1`

	args := []interface{}{instructorID.(string)}
	argIdx := 2

	if workshopIDFilter != "" {
		query += " AND b.workshop_id = $" + itoa(argIdx)
		args = append(args, workshopIDFilter)
		argIdx++
	}
	if statusFilter != "" {
		query += " AND b.status = $" + itoa(argIdx)
		args = append(args, statusFilter)
		argIdx++
	}
	if fromFilter != "" {
		query += " AND b.created_at >= $" + itoa(argIdx) + "::date"
		args = append(args, fromFilter)
		argIdx++
	}
	if toFilter != "" {
		query += " AND b.created_at < ($" + itoa(argIdx) + "::date + interval '1 day')"
		args = append(args, toFilter)
		argIdx++
	}
	_ = argIdx

	query += " ORDER BY b.created_at DESC LIMIT 100"

	rows, err := db.Pool.Query(ctx, query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas: " + err.Error()})
		return
	}
	defer rows.Close()

	type instructorBooking struct {
		ID            string  `json:"booking_id"`
		WorkshopID    string  `json:"workshop_id"`
		WorkshopTitle string  `json:"workshop_title"`
		StudentName   string  `json:"student_name"`
		SessionDate   string  `json:"session_date,omitempty"`
		Status        string  `json:"status"`
		PaymentStatus string  `json:"payment_status"`
		Amount        float64 `json:"amount"`
		CreatedAt     string  `json:"created_at"`
	}

	bookings := []instructorBooking{}
	for rows.Next() {
		var b instructorBooking
		if err := rows.Scan(
			&b.ID, &b.WorkshopID, &b.WorkshopTitle, &b.StudentName,
			&b.SessionDate, &b.Status, &b.PaymentStatus, &b.Amount, &b.CreatedAt,
		); err != nil {
			continue
		}
		bookings = append(bookings, b)
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// itoa converts an int to its decimal string representation.
func itoa(n int) string {
	return strconv.Itoa(n)
}

// migrateBookingInput is the request body for POST /api/v1/bookings/:id/migrate.
type migrateBookingInput struct {
	TargetScheduleID string `json:"target_schedule_id" binding:"required"`
	TargetDate       string `json:"target_date"        binding:"required"`
}

// MigrateBooking handles POST /api/v1/bookings/:id/migrate.
// Moves a booking to a different session (new schedule + date). Only the workshop owner can do this.
func MigrateBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")
	ctx := context.Background()

	var input migrateBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	targetDate, err := time.Parse("2006-01-02", input.TargetDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "target_date inválido, usa YYYY-MM-DD"})
		return
	}

	// Load booking + verify workshop ownership
	var workshopID, oldSessionID, bookingStatus string
	var ownerID string
	err = db.Pool.QueryRow(ctx,
		`SELECT b.workshop_id, b.session_id::text, b.status, w.instructor_id
		 FROM bookings b
		 JOIN workshops w ON w.id = b.workshop_id
		 WHERE b.id = $1`, bookingID,
	).Scan(&workshopID, &oldSessionID, &bookingStatus, &ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar esta reserva"})
		return
	}
	if bookingStatus == "cancelled" {
		c.JSON(http.StatusConflict, gin.H{"message": "No se puede migrar una reserva cancelada"})
		return
	}

	// Validate target schedule generates a session on target_date
	var daysOfWeek []int
	var validFrom time.Time
	var validUntilStr *string
	var timeStart string
	var durationMin int
	var schedWorkshopID string

	err = db.Pool.QueryRow(ctx,
		`SELECT workshop_id, days_of_week, time_start::text, duration_min, valid_from, valid_until::text
		 FROM schedules WHERE id = $1`,
		input.TargetScheduleID,
	).Scan(&schedWorkshopID, &daysOfWeek, &timeStart, &durationMin, &validFrom, &validUntilStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Schedule destino no encontrado"})
		return
	}
	if schedWorkshopID != workshopID {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule destino no pertenece al mismo taller"})
		return
	}

	daySet := make(map[int]bool)
	for _, d := range daysOfWeek {
		daySet[d] = true
	}
	if !daySet[int(targetDate.Weekday())] {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El schedule destino no tiene clases en el día indicado"})
		return
	}
	if targetDate.Before(validFrom.Truncate(24 * time.Hour)) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es anterior al inicio del schedule destino"})
		return
	}
	if validUntilStr != nil {
		validUntil, _ := time.Parse("2006-01-02", (*validUntilStr)[:10])
		if targetDate.After(validUntil) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La fecha es posterior al fin del schedule destino"})
			return
		}
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
		return
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Upsert target session
	startsAt := input.TargetDate + "T" + timeStart + ":00Z"
	startTime, _ := time.Parse("2006-01-02T15:04:05Z", startsAt)
	endsAt := startTime.Add(time.Duration(durationMin) * time.Minute).Format("2006-01-02T15:04:05Z")

	var targetSessionID string
	err = tx.QueryRow(ctx,
		`INSERT INTO sessions (workshop_id, schedule_id, starts_at, ends_at)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (workshop_id, schedule_id, starts_at) DO UPDATE SET workshop_id = EXCLUDED.workshop_id
		 RETURNING id`,
		workshopID, input.TargetScheduleID, startsAt, endsAt,
	).Scan(&targetSessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al materializar sesión destino: " + err.Error()})
		return
	}

	// Check target session not cancelled
	var cancelled bool
	tx.QueryRow(ctx, `SELECT cancelled FROM sessions WHERE id = $1`, targetSessionID).Scan(&cancelled) //nolint:errcheck
	if cancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "La sesión destino está cancelada"})
		return
	}

	// Check capacity
	var capacity *int
	db.Pool.QueryRow(ctx, `SELECT capacity FROM workshops WHERE id = $1`, workshopID).Scan(&capacity) //nolint:errcheck
	if capacity != nil {
		var count int
		tx.QueryRow(ctx,
			`SELECT COUNT(*) FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
			targetSessionID,
		).Scan(&count) //nolint:errcheck
		if count >= *capacity {
			c.JSON(http.StatusConflict, gin.H{"message": "No hay cupos disponibles en la sesión destino"})
			return
		}
	}

	// Update booking
	_, err = tx.Exec(ctx,
		`UPDATE bookings
		 SET session_id = $1, migrated_from_session_id = $2, status = 'confirmed'
		 WHERE id = $3`,
		targetSessionID, oldSessionID, bookingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al migrar reserva: " + err.Error()})
		return
	}

	if err := tx.Commit(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al confirmar migración"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                        bookingID,
		"session_id":                targetSessionID,
		"migrated_from_session_id":  oldSessionID,
		"status":                    "confirmed",
	}})
}

// RefundBooking handles POST /api/v1/bookings/:id/refund.
// Cancels and refunds a booking due to schedule change. Only the workshop owner can do this.
func RefundBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")
	ctx := context.Background()

	// Load booking + session starts_at + verify ownership
	var workshopID, bookingStatus, paymentStatus string
	var ownerID string
	var startsAtStr string
	err := db.Pool.QueryRow(ctx,
		`SELECT b.workshop_id, b.status, b.payment_status, w.instructor_id, s.starts_at::date::text
		 FROM bookings b
		 JOIN workshops w ON w.id = b.workshop_id
		 JOIN sessions s ON s.id = b.session_id
		 WHERE b.id = $1`, bookingID,
	).Scan(&workshopID, &bookingStatus, &paymentStatus, &ownerID, &startsAtStr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar esta reserva"})
		return
	}
	if bookingStatus == "cancelled" {
		c.JSON(http.StatusConflict, gin.H{"message": "La reserva ya está cancelada"})
		return
	}

	sessionDate, err := time.Parse("2006-01-02", startsAtStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al parsear fecha de sesión"})
		return
	}

	zone := commissionZone(sessionDate)

	_, err = db.Pool.Exec(ctx,
		`UPDATE bookings
		 SET status = 'cancelled', payment_status = 'refunded',
		     cancelled_reason = 'schedule_change', commission_absorbed_by = $1
		 WHERE id = $2`,
		zone, bookingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al reembolsar reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                   bookingID,
		"workshop_id":          workshopID,
		"status":               "cancelled",
		"payment_status":       "refunded",
		"cancelled_reason":     "schedule_change",
		"commission_absorbed_by": zone,
	}})
}
