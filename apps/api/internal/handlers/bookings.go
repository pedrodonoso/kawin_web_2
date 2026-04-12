package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

// createBookingInput is the request body for POST /api/v1/bookings.
// Para type=class: se requiere session_id (sesión ya materializada por el tallerista).
// Para otros tipos: solo workshop_id es requerido.
type createBookingInput struct {
	WorkshopID string `json:"workshop_id" binding:"required"`
	SessionID  string `json:"session_id"` // requerido para talleres tipo class
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
		if input.SessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session_id es requerido para talleres tipo class"})
			return
		}

		// Cargar la sesión materializada y verificar que pertenece al taller
		var sessionWorkshopID string
		var cancelled bool
		err = db.Pool.QueryRow(ctx,
			`SELECT workshop_id, cancelled FROM sessions WHERE id = $1`,
			input.SessionID,
		).Scan(&sessionWorkshopID, &cancelled)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Sesión no encontrada"})
			return
		}
		if sessionWorkshopID != input.WorkshopID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La sesión no pertenece a este taller"})
			return
		}
		if cancelled {
			c.JSON(http.StatusConflict, gin.H{"message": "Esta clase fue cancelada"})
			return
		}

		sid := input.SessionID
		sessionID = &sid

		tx, err := db.Pool.Begin(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al iniciar transacción"})
			return
		}
		defer tx.Rollback(ctx) //nolint:errcheck

		// Verificar cupos
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

	workshopFilter := c.Query("workshop_id")
	workshopSlugFilter := c.Query("workshop_slug")

	query := `SELECT b.id, b.workshop_id, w.title, w.slug,
		        b.session_id::text, b.status, b.payment_status, b.amount,
		        COALESCE(s.starts_at::text, ''),
		        COALESCE(s.schedule_id::text, ''),
		        COALESCE((s.starts_at AT TIME ZONE 'UTC')::date::text, ''),
		        b.created_at::text
		 FROM bookings b
		 JOIN workshops w ON w.id = b.workshop_id
		 LEFT JOIN sessions s ON s.id = b.session_id
		 WHERE b.student_id = $1`

	args := []any{studentID.(string)}
	if workshopFilter != "" {
		args = append(args, workshopFilter)
		query += ` AND b.workshop_id = $` + itoa(len(args))
	} else if workshopSlugFilter != "" {
		args = append(args, workshopSlugFilter)
		query += ` AND w.slug = $` + itoa(len(args))
	}
	query += ` ORDER BY b.created_at DESC LIMIT 50`

	rows, err := db.Pool.Query(context.Background(), query, args...)
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
		ScheduleID    string  `json:"schedule_id,omitempty"`
		SessionDay    string  `json:"session_day,omitempty"` // "YYYY-MM-DD"
		CreatedAt     string  `json:"created_at"`
	}

	bookings := []myBooking{}
	for rows.Next() {
		var b myBooking
		var sessionIDStr *string
		if err := rows.Scan(
			&b.ID, &b.WorkshopID, &b.WorkshopTitle, &b.WorkshopSlug,
			&sessionIDStr, &b.Status, &b.PaymentStatus, &b.Amount,
			&b.SessionDate, &b.ScheduleID, &b.SessionDay, &b.CreatedAt,
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

	query := `SELECT b.id, b.workshop_id, w.title, COALESCE(p.name, u.email),
	                 COALESCE(
	                   s.starts_at::text,
	                   (SELECT ns.starts_at::text FROM sessions ns
	                    WHERE ns.workshop_id = b.workshop_id
	                      AND ns.schedule_id IS NULL
	                    ORDER BY ns.starts_at ASC LIMIT 1),
	                   ''
	                 ),
	                 b.status, b.payment_status, b.amount, b.created_at::text
	          FROM bookings b
	          JOIN workshops w ON w.id = b.workshop_id
	          JOIN users u ON u.id = b.student_id
	          LEFT JOIN profiles p ON p.user_id = b.student_id
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

// migrateBookingInput is the request body for POST /api/v1/bookings/:id/migrate.
// target_session_id debe ser una sesión ya materializada del mismo taller.
type migrateBookingInput struct {
	TargetSessionID string `json:"target_session_id" binding:"required"`
}

// MigrateBooking handles POST /api/v1/bookings/:id/migrate.
// Mueve una reserva a una sesión distinta ya materializada. Solo el dueño del taller puede hacerlo.
func MigrateBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")
	ctx := context.Background()

	var input migrateBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// Cargar reserva y verificar propiedad del taller
	var workshopID, bookingStatus, ownerID string
	var oldSessionID *string
	err := db.Pool.QueryRow(ctx,
		`SELECT b.workshop_id, b.session_id::text, b.status, w.instructor_id::text
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

	// Cargar sesión destino y verificar que pertenece al mismo taller
	var targetWorkshopID string
	var targetCancelled bool
	err = db.Pool.QueryRow(ctx,
		`SELECT workshop_id, cancelled FROM sessions WHERE id = $1`,
		input.TargetSessionID,
	).Scan(&targetWorkshopID, &targetCancelled)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sesión destino no encontrada"})
		return
	}
	if targetWorkshopID != workshopID {
		c.JSON(http.StatusBadRequest, gin.H{"message": "La sesión destino no pertenece al mismo taller"})
		return
	}
	if targetCancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "La sesión destino está cancelada"})
		return
	}

	// Verificar cupos en la sesión destino
	var capacity *int
	db.Pool.QueryRow(ctx, `SELECT capacity FROM workshops WHERE id = $1`, workshopID).Scan(&capacity) //nolint:errcheck
	if capacity != nil {
		var count int
		db.Pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM bookings WHERE session_id = $1 AND status != 'cancelled'`,
			input.TargetSessionID,
		).Scan(&count) //nolint:errcheck
		if count >= *capacity {
			c.JSON(http.StatusConflict, gin.H{"message": "No hay cupos disponibles en la sesión destino"})
			return
		}
	}

	// Actualizar reserva
	_, err = db.Pool.Exec(ctx,
		`UPDATE bookings
		 SET session_id = $1, migrated_from_session_id = $2, status = 'confirmed'
		 WHERE id = $3`,
		input.TargetSessionID, oldSessionID, bookingID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al migrar reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                       bookingID,
		"session_id":               input.TargetSessionID,
		"migrated_from_session_id": oldSessionID,
		"status":                   "confirmed",
	}})
}

// RefundBooking handles POST /api/v1/bookings/:id/refund.
// Cancels and refunds a booking due to schedule change. Only the workshop owner can do this.
func RefundBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")
	ctx := context.Background()

	// Load booking + session starts_at + verify ownership
	var workshopID, bookingStatus, paymentStatus, ownerID string
	var startsAtStrPtr *string
	err := db.Pool.QueryRow(ctx,
		`SELECT b.workshop_id, b.status, b.payment_status, w.instructor_id::text,
		        COALESCE(s.starts_at::date::text, '')
		 FROM bookings b
		 JOIN workshops w ON w.id = b.workshop_id
		 LEFT JOIN sessions s ON s.id = b.session_id
		 WHERE b.id = $1`, bookingID,
	).Scan(&workshopID, &bookingStatus, &paymentStatus, &ownerID, &startsAtStrPtr)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}
	startsAtStr := ""
	if startsAtStrPtr != nil {
		startsAtStr = *startsAtStrPtr
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar esta reserva"})
		return
	}
	if bookingStatus == "cancelled" {
		c.JSON(http.StatusConflict, gin.H{"message": "La reserva ya está cancelada"})
		return
	}

	// Default to today when no session date (non-class booking)
	sessionDate := time.Now().UTC()
	if startsAtStr != "" {
		if t, err2 := time.Parse("2006-01-02", startsAtStr); err2 == nil {
			sessionDate = t
		}
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
