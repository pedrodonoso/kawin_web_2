package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
	"github.com/pedrodonoso/kawin/api/internal/models"
)

// errNoCapacity is a sentinel used inside the CreateBooking transaction.
var errNoCapacity = errors.New("no_capacity")

// validBookingTransitions define la máquina de estados de booking_status.
var validBookingTransitions = map[string][]string{
	"pending":   {"confirmed", "cancelled"},
	"confirmed": {"cancelled"},
	"cancelled": {},
}

func validateBookingTransition(from, to string) error {
	allowed, ok := validBookingTransitions[from]
	if !ok {
		return fmt.Errorf("estado de reserva desconocido: %s", from)
	}
	for _, s := range allowed {
		if s == to {
			return nil
		}
	}
	return fmt.Errorf("transición de estado inválida: %s → %s", from, to)
}

type createBookingInput struct {
	WorkshopID string `json:"workshop_id" binding:"required"`
	SessionID  string `json:"session_id"`
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
func CreateBooking(c *gin.Context) {
	studentID, _ := c.Get("userID")

	var input createBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var workshopInfo struct {
		Type     string  `gorm:"column:type"`
		Price    float64 `gorm:"column:price"`
		Capacity *int    `gorm:"column:capacity"`
	}
	res := db.DB.Raw(
		`SELECT type, price, capacity FROM workshops WHERE id = ? AND status = 'published'`, input.WorkshopID,
	).Scan(&workshopInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	price := workshopInfo.Price
	commission := price * 0.15
	var sessionID *string

	if workshopInfo.Type == "class" {
		if input.SessionID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "session_id es requerido para talleres tipo class"})
			return
		}

		var sessionInfo struct {
			WorkshopID string `gorm:"column:workshop_id"`
			Cancelled  bool   `gorm:"column:cancelled"`
		}
		res2 := db.DB.Raw(
			`SELECT workshop_id::text as workshop_id, cancelled FROM sessions WHERE id = ?`, input.SessionID,
		).Scan(&sessionInfo)
		if res2.Error != nil || res2.RowsAffected == 0 {
			c.JSON(http.StatusNotFound, gin.H{"message": "Sesión no encontrada"})
			return
		}
		if sessionInfo.WorkshopID != input.WorkshopID {
			c.JSON(http.StatusBadRequest, gin.H{"message": "La sesión no pertenece a este taller"})
			return
		}
		if sessionInfo.Cancelled {
			c.JSON(http.StatusConflict, gin.H{"message": "Esta clase fue cancelada"})
			return
		}

		sid := input.SessionID
		sessionID = &sid

		var bookingID string
		capacity := workshopInfo.Capacity

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

		if capacity != nil {
			var count int64
			tx.Raw(
				`SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status != 'cancelled'`, sid,
			).Scan(&count) //nolint:errcheck
			if int(count) >= *capacity {
				tx.Rollback()
				c.JSON(http.StatusConflict, gin.H{"message": "No hay cupos disponibles para esta clase"})
				return
			}
		}

		booking := models.Booking{
			StudentID:     studentID.(string),
			WorkshopID:    input.WorkshopID,
			SessionID:     &sid,
			Status:        "confirmed",
			PaymentStatus: "pending",
			Amount:        price,
			Commission:    commission,
		}
		if err := tx.Create(&booking).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear reserva: " + err.Error()})
			return
		}
		bookingID = booking.ID

		if err := tx.Commit().Error; err != nil {
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

	// Non-class booking (workshop, course, event)
	booking := models.Booking{
		StudentID:     studentID.(string),
		WorkshopID:    input.WorkshopID,
		Status:        "confirmed",
		PaymentStatus: "pending",
		Amount:        price,
		Commission:    commission,
	}
	if err := db.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": bookingResponse{
		ID:            booking.ID,
		WorkshopID:    input.WorkshopID,
		Status:        "confirmed",
		PaymentStatus: "pending",
		Amount:        price,
		Commission:    commission,
	}})
}

// GetMyBookings handles GET /api/v1/my-bookings.
func GetMyBookings(c *gin.Context) {
	studentID, _ := c.Get("userID")

	workshopFilter := c.Query("workshop_id")
	workshopSlugFilter := c.Query("workshop_slug")

	query := `SELECT b.id, b.workshop_id, w.title as workshop_title, w.slug as workshop_slug,
		        b.session_id::text as session_id, b.status, b.payment_status, b.amount,
		        COALESCE(s.starts_at::text, '') as session_date,
		        COALESCE(s.schedule_id::text, '') as schedule_id,
		        COALESCE((s.starts_at AT TIME ZONE 'UTC')::date::text, '') as session_day,
		        b.created_at::text as created_at,
		        COALESCE(s.online_url, w.online_url, '') as online_url
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

	type myBooking struct {
		ID            string  `json:"id"                        gorm:"column:id"`
		WorkshopID    string  `json:"workshop_id"               gorm:"column:workshop_id"`
		WorkshopTitle string  `json:"workshop_title"            gorm:"column:workshop_title"`
		WorkshopSlug  string  `json:"workshop_slug"             gorm:"column:workshop_slug"`
		SessionID     *string `json:"session_id,omitempty"      gorm:"column:session_id"`
		Status        string  `json:"status"                    gorm:"column:status"`
		PaymentStatus string  `json:"payment_status"            gorm:"column:payment_status"`
		Amount        float64 `json:"amount"                    gorm:"column:amount"`
		SessionDate   string  `json:"session_date,omitempty"    gorm:"column:session_date"`
		ScheduleID    string  `json:"schedule_id,omitempty"     gorm:"column:schedule_id"`
		SessionDay    string  `json:"session_day,omitempty"     gorm:"column:session_day"`
		CreatedAt     string  `json:"created_at"                gorm:"column:created_at"`
		OnlineURL     string  `json:"online_url,omitempty"      gorm:"column:online_url"`
	}

	var bookings []myBooking
	if err := db.DB.Raw(query, args...).Scan(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

// GetInstructorBookings handles GET /api/v1/instructor-bookings.
func GetInstructorBookings(c *gin.Context) {
	instructorID, _ := c.Get("userID")

	workshopIDFilter := c.Query("workshop_id")
	statusFilter := c.Query("status")
	fromFilter := c.Query("from")
	toFilter := c.Query("to")

	query := `SELECT b.id as booking_id, b.workshop_id, w.title as workshop_title,
	                 COALESCE(p.name, u.email) as student_name,
	                 COALESCE(
	                   s.starts_at::text,
	                   (SELECT ns.starts_at::text FROM sessions ns
	                    WHERE ns.workshop_id = b.workshop_id
	                      AND ns.schedule_id IS NULL
	                    ORDER BY ns.starts_at ASC LIMIT 1),
	                   ''
	                 ) as session_date,
	                 b.status, b.payment_status, b.amount, b.created_at::text as created_at
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

	type instructorBooking struct {
		ID            string  `json:"booking_id"     gorm:"column:booking_id"`
		WorkshopID    string  `json:"workshop_id"    gorm:"column:workshop_id"`
		WorkshopTitle string  `json:"workshop_title" gorm:"column:workshop_title"`
		StudentName   string  `json:"student_name"   gorm:"column:student_name"`
		SessionDate   string  `json:"session_date,omitempty" gorm:"column:session_date"`
		Status        string  `json:"status"         gorm:"column:status"`
		PaymentStatus string  `json:"payment_status" gorm:"column:payment_status"`
		Amount        float64 `json:"amount"         gorm:"column:amount"`
		CreatedAt     string  `json:"created_at"     gorm:"column:created_at"`
	}

	var bookings []instructorBooking
	if err := db.DB.Raw(query, args...).Scan(&bookings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener reservas: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": bookings})
}

type migrateBookingInput struct {
	TargetSessionID string `json:"target_session_id" binding:"required"`
}

// MigrateBooking handles POST /api/v1/bookings/:id/migrate.
func MigrateBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")

	var input migrateBookingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var bookingInfo struct {
		WorkshopID   string  `gorm:"column:workshop_id"`
		OldSessionID *string `gorm:"column:old_session_id"`
		Status       string  `gorm:"column:status"`
		OwnerID      string  `gorm:"column:owner_id"`
	}
	res := db.DB.Raw(`
		SELECT b.workshop_id::text as workshop_id, b.session_id::text as old_session_id,
		       b.status, w.instructor_id::text as owner_id
		FROM bookings b
		JOIN workshops w ON w.id = b.workshop_id
		WHERE b.id = ?`, bookingID,
	).Scan(&bookingInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}
	if bookingInfo.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar esta reserva"})
		return
	}
	if err := validateBookingTransition(bookingInfo.Status, "confirmed"); err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "No se puede migrar esta reserva: " + err.Error()})
		return
	}

	var targetInfo struct {
		WorkshopID string `gorm:"column:workshop_id"`
		Cancelled  bool   `gorm:"column:cancelled"`
	}
	res2 := db.DB.Raw(
		`SELECT workshop_id::text as workshop_id, cancelled FROM sessions WHERE id = ?`, input.TargetSessionID,
	).Scan(&targetInfo)
	if res2.Error != nil || res2.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Sesión destino no encontrada"})
		return
	}
	if targetInfo.WorkshopID != bookingInfo.WorkshopID {
		c.JSON(http.StatusBadRequest, gin.H{"message": "La sesión destino no pertenece al mismo taller"})
		return
	}
	if targetInfo.Cancelled {
		c.JSON(http.StatusConflict, gin.H{"message": "La sesión destino está cancelada"})
		return
	}

	var capacity *int
	db.DB.Raw(`SELECT capacity FROM workshops WHERE id = ?`, bookingInfo.WorkshopID).Scan(&capacity) //nolint:errcheck
	if capacity != nil {
		var count int64
		db.DB.Raw(
			`SELECT COUNT(*) FROM bookings WHERE session_id = ? AND status != 'cancelled'`, input.TargetSessionID,
		).Scan(&count) //nolint:errcheck
		if int(count) >= *capacity {
			c.JSON(http.StatusConflict, gin.H{"message": "No hay cupos disponibles en la sesión destino"})
			return
		}
	}

	if err := db.DB.Exec(`
		UPDATE bookings
		SET session_id = ?, migrated_from_session_id = ?, status = 'confirmed'
		WHERE id = ?`,
		input.TargetSessionID, bookingInfo.OldSessionID, bookingID,
	).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al migrar reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                       bookingID,
		"session_id":               input.TargetSessionID,
		"migrated_from_session_id": bookingInfo.OldSessionID,
		"status":                   "confirmed",
	}})
}

// RefundBooking handles POST /api/v1/bookings/:id/refund.
func RefundBooking(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookingID := c.Param("id")

	var bookingInfo struct {
		WorkshopID    string `gorm:"column:workshop_id"`
		Status        string `gorm:"column:status"`
		PaymentStatus string `gorm:"column:payment_status"`
		OwnerID       string `gorm:"column:owner_id"`
		StartsAtStr   string `gorm:"column:starts_at_str"`
	}
	res := db.DB.Raw(`
		SELECT b.workshop_id::text as workshop_id, b.status, b.payment_status,
		       w.instructor_id::text as owner_id,
		       COALESCE(s.starts_at::date::text, '') as starts_at_str
		FROM bookings b
		JOIN workshops w ON w.id = b.workshop_id
		LEFT JOIN sessions s ON s.id = b.session_id
		WHERE b.id = ?`, bookingID,
	).Scan(&bookingInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}
	if bookingInfo.OwnerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para modificar esta reserva"})
		return
	}
	if err := validateBookingTransition(bookingInfo.Status, "cancelled"); err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "No se puede reembolsar esta reserva: " + err.Error()})
		return
	}

	sessionDate := time.Now().UTC()
	if bookingInfo.StartsAtStr != "" {
		if t, err2 := time.Parse("2006-01-02", bookingInfo.StartsAtStr); err2 == nil {
			sessionDate = t
		}
	}
	zone := commissionZone(sessionDate)

	if err := db.DB.Exec(`
		UPDATE bookings
		SET status = 'cancelled', payment_status = 'refunded',
		    cancelled_reason = 'schedule_change', commission_absorbed_by = ?
		WHERE id = ?`, zone, bookingID,
	).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al reembolsar reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                     bookingID,
		"workshop_id":            bookingInfo.WorkshopID,
		"status":                 "cancelled",
		"payment_status":         "refunded",
		"cancelled_reason":       "schedule_change",
		"commission_absorbed_by": zone,
	}})
}

// CancelBooking handles POST /api/v1/bookings/:id/cancel.
func CancelBooking(c *gin.Context) {
	studentID, _ := c.Get("userID")
	bookingID := c.Param("id")

	var bookingInfo struct {
		WorkshopID    string `gorm:"column:workshop_id"`
		Status        string `gorm:"column:status"`
		PaymentStatus string `gorm:"column:payment_status"`
		StartsAtStr   string `gorm:"column:starts_at_str"`
	}
	res := db.DB.Raw(`
		SELECT b.workshop_id::text as workshop_id, b.status, b.payment_status,
		       COALESCE((s.starts_at AT TIME ZONE 'UTC')::date::text, '') as starts_at_str
		FROM bookings b
		LEFT JOIN sessions s ON s.id = b.session_id
		WHERE b.id = ? AND b.student_id = ?`,
		bookingID, studentID.(string),
	).Scan(&bookingInfo)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Reserva no encontrada"})
		return
	}

	if err := validateBookingTransition(bookingInfo.Status, "cancelled"); err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "No se puede cancelar esta reserva: " + err.Error()})
		return
	}

	sessionDate := time.Now().UTC()
	if bookingInfo.StartsAtStr != "" {
		if t, err2 := time.Parse("2006-01-02", bookingInfo.StartsAtStr); err2 == nil {
			sessionDate = t
		}
	}
	zone := commissionZone(sessionDate)

	newPaymentStatus := bookingInfo.PaymentStatus
	if bookingInfo.PaymentStatus == "paid" {
		newPaymentStatus = "refunded"
	}

	if err := db.DB.Exec(`
		UPDATE bookings
		SET status = 'cancelled', payment_status = ?,
		    cancelled_reason = 'student_request', commission_absorbed_by = ?
		WHERE id = ?`, newPaymentStatus, zone, bookingID,
	).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al cancelar reserva: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{
		"id":                     bookingID,
		"workshop_id":            bookingInfo.WorkshopID,
		"status":                 "cancelled",
		"payment_status":         newPaymentStatus,
		"cancelled_reason":       "student_request",
		"commission_absorbed_by": zone,
	}})
}
