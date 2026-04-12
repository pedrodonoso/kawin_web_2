package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

// Session representa una sesión materializada en la base de datos.
type Session struct {
	ID             string `json:"id"`
	StartsAt       string `json:"starts_at"`
	EndsAt         string `json:"ends_at"`
	Cancelled      bool   `json:"cancelled,omitempty"`
	Notes          string `json:"notes,omitempty"`
	SpotsRemaining *int   `json:"spots_remaining,omitempty"` // nil = sin límite de cupos
	BookingCount   int    `json:"booking_count,omitempty"`
}

// AvailableSlot representa un slot calculado desde schedules para el calendario del tallerista.
// Retornado por GET /workshops/:id/available-slots (solo para instructores).
type AvailableSlot struct {
	Date           string  `json:"date"`         // "YYYY-MM-DD"
	Time           string  `json:"time"`         // "HH:MM"
	DurationMin    int     `json:"duration_min"`
	ScheduleID     string  `json:"schedule_id"`
	SessionID      *string `json:"session_id"`      // nil = no materializado aún
	SpotsRemaining *int    `json:"spots_remaining"` // nil = sin límite
	BookingCount   int     `json:"booking_count"`   // reservas activas de esta sesión
	Status         string  `json:"status"`          // "not_materialized" | "available" | "full" | "cancelled"
}

type Workshop struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Slug           string     `json:"slug"`
	Description    string     `json:"description"`
	Type           string     `json:"type"`
	Modality       string     `json:"modality"`
	Price          float64    `json:"price"`
	Currency       string     `json:"currency"`
	Capacity       *int       `json:"capacity,omitempty"`
	Location       string     `json:"location,omitempty"`
	CoverImageURL  string     `json:"cover_image_url,omitempty"`
	Status         string     `json:"status"`
	CategoryID     string     `json:"category_id,omitempty"`
	CategoryName   string     `json:"category_name,omitempty"`
	CategorySlug   string     `json:"category_slug,omitempty"`
	InstructorID       string     `json:"instructor_id,omitempty"`
	InstructorName     string     `json:"instructor_name,omitempty"`
	InstructorBio      string     `json:"instructor_bio,omitempty"`
	InstructorInstagram string    `json:"instructor_instagram,omitempty"`
	InstructorFacebook  string    `json:"instructor_facebook,omitempty"`
	InstructorWhatsapp  string    `json:"instructor_whatsapp,omitempty"`
	InstructorPhone     string    `json:"instructor_phone,omitempty"`
	Sessions       []Session  `json:"sessions,omitempty"`
	Schedules      []Schedule `json:"schedules,omitempty"`
	BookingsCount  int        `json:"bookings_count"`
	CreatedAt      string     `json:"created_at"`
}

// =============================================================================
// Slot engine (solo para GetAvailableSlots — uso exclusivo del tallerista)
// =============================================================================

type materializedSession struct {
	ID        string
	Cancelled bool
}

// computeAvailableSlots calcula los slots para el calendario del tallerista en [from, to],
// fusionando los ya materializados con los que aún no existen en la DB.
// Pure function: no hace llamadas a DB.
func computeAvailableSlots(
	schedules []Schedule,
	from, to time.Time,
	materialized map[string]materializedSession, // key: "scheduleID:YYYY-MM-DD"
	bookingCounts map[string]int,                // key: session_id → reservas confirmadas
	capacity *int,
) []AvailableSlot {
	var result []AvailableSlot

	for _, sched := range schedules {
		validFrom, err := time.Parse("2006-01-02", sched.ValidFrom[:10])
		if err != nil {
			continue
		}

		var validUntil *time.Time
		if sched.ValidUntil != nil && len(*sched.ValidUntil) >= 10 {
			t, err := time.Parse("2006-01-02", (*sched.ValidUntil)[:10])
			if err == nil {
				validUntil = &t
			}
		}

		daySet := make(map[time.Weekday]bool)
		for _, d := range sched.DaysOfWeek {
			daySet[time.Weekday(d)] = true
		}

		// time_start llega como "HH:MM:SS" o "HH:MM" desde Postgres
		parts := strings.SplitN(sched.TimeStart, ":", 3)
		if len(parts) < 2 {
			continue
		}
		hour, _ := strconv.Atoi(parts[0])
		minute, _ := strconv.Atoi(parts[1])
		timeStr := fmt.Sprintf("%02d:%02d", hour, minute)

		for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
			if !daySet[d.Weekday()] {
				continue
			}
			dayOnly := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, time.UTC)
			if dayOnly.Before(validFrom) {
				continue
			}
			if validUntil != nil && dayOnly.After(*validUntil) {
				continue
			}

			dateStr := d.Format("2006-01-02")
			key := sched.ID + ":" + dateStr

			status := "not_materialized"
			var sessionID *string
			var spotsRemaining *int

			if mat, ok := materialized[key]; ok {
				id := mat.ID
				sessionID = &id
				if mat.Cancelled {
					status = "cancelled"
				} else {
					if capacity != nil {
						count := bookingCounts[mat.ID]
						remaining := *capacity - count
						if remaining <= 0 {
							status = "full"
							remaining = 0
						} else {
							status = "available"
						}
						spotsRemaining = &remaining
					} else {
						status = "available"
					}
				}
			} else if capacity != nil {
				remaining := *capacity
				spotsRemaining = &remaining
			}

			bookingCount := 0
			if sessionID != nil {
				bookingCount = bookingCounts[*sessionID]
			}

			result = append(result, AvailableSlot{
				Date:           dateStr,
				Time:           timeStr,
				DurationMin:    sched.DurationMin,
				ScheduleID:     sched.ID,
				SessionID:      sessionID,
				SpotsRemaining: spotsRemaining,
				BookingCount:   bookingCount,
				Status:         status,
			})
		}
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].Date == result[j].Date {
			return result[i].Time < result[j].Time
		}
		return result[i].Date < result[j].Date
	})

	return result
}

// loadActiveSchedules devuelve los schedules cuyo rango de validez se superpone con [from, to].
func loadActiveSchedules(workshopID string, from, to time.Time) ([]Schedule, error) {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, workshop_id, days_of_week, time_start::text, duration_min,
		       valid_from::text, valid_until::text, created_at::text
		FROM schedules
		WHERE workshop_id = $1
		  AND valid_from <= $2
		  AND (valid_until IS NULL OR valid_until >= $3)
		ORDER BY valid_from, time_start`,
		workshopID, to.Format("2006-01-02"), from.Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []Schedule
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
	return schedules, nil
}

// loadMaterializedSessions devuelve las sesiones ya materializadas en [from, to],
// indexadas por "scheduleID:YYYY-MM-DD".
func loadMaterializedSessions(workshopID string, from, to time.Time) (map[string]materializedSession, error) {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, schedule_id::text, (starts_at AT TIME ZONE 'UTC')::date::text, cancelled
		FROM sessions
		WHERE workshop_id = $1
		  AND schedule_id IS NOT NULL
		  AND starts_at >= $2
		  AND starts_at <= $3`,
		workshopID,
		from.Format("2006-01-02"),
		to.Add(24*time.Hour).Format("2006-01-02"),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]materializedSession)
	for rows.Next() {
		var id, scheduleID, dateStr string
		var cancelled bool
		if rows.Scan(&id, &scheduleID, &dateStr, &cancelled) == nil {
			m[scheduleID+":"+dateStr] = materializedSession{ID: id, Cancelled: cancelled}
		}
	}
	return m, nil
}

// loadBookingCounts devuelve el conteo de reservas confirmadas por session_id.
func loadBookingCounts(workshopID string) (map[string]int, error) {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT session_id::text, COUNT(*)
		FROM bookings
		WHERE workshop_id = $1
		  AND session_id IS NOT NULL
		  AND status != 'cancelled'
		GROUP BY session_id`,
		workshopID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var sessionID string
		var count int
		if rows.Scan(&sessionID, &count) == nil {
			counts[sessionID] = count
		}
	}
	return counts, nil
}

// =============================================================================
// Handlers
// =============================================================================

func GetWorkshops(c *gin.Context) {
	q := c.Query("q")
	modality := c.Query("modality")
	wType := c.Query("type")
	categorySlug := c.Query("category")

	query := `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		       w.status, COALESCE(w.created_at::text,''),
		       COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		       COALESCE(p.name,'')
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE w.status = 'published'`

	args := []any{}
	i := 1

	if q != "" {
		query += ` AND (w.title ILIKE $` + itoa(i) + ` OR w.description ILIKE $` + itoa(i) + `)`
		args = append(args, "%"+q+"%")
		i++
	}
	if modality != "" {
		query += ` AND w.modality = $` + itoa(i)
		args = append(args, modality)
		i++
	}
	if wType != "" {
		query += ` AND w.type = $` + itoa(i)
		args = append(args, wType)
		i++
	}
	if categorySlug != "" {
		query += ` AND c.slug = $` + itoa(i)
		args = append(args, categorySlug)
		i++
	}

	query += ` ORDER BY w.created_at DESC LIMIT 50`

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener talleres"})
		return
	}
	defer rows.Close()

	workshops := []Workshop{}
	for rows.Next() {
		var w Workshop
		if err := rows.Scan(
			&w.ID, &w.Title, &w.Slug, &w.Description,
			&w.Type, &w.Modality, &w.Price, &w.Currency,
			&w.Capacity, &w.Location, &w.CoverImageURL,
			&w.Status, &w.CreatedAt,
			&w.CategoryID, &w.CategoryName, &w.CategorySlug,
			&w.InstructorName,
		); err != nil {
			continue
		}
		workshops = append(workshops, w)
	}

	c.JSON(http.StatusOK, gin.H{"data": workshops, "total": len(workshops)})
}

// GetWorkshop maneja GET /api/v1/workshops/:id (público).
// Para type="class": retorna schedules como reglas de recurrencia + sesiones materializadas disponibles.
// Para otros tipos: retorna sesiones manuales.
func GetWorkshop(c *gin.Context) {
	idOrSlug := c.Param("id")
	ctx := context.Background()

	var w Workshop
	err := db.Pool.QueryRow(ctx, `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		       w.status, COALESCE(w.created_at::text,''),
		       COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		       w.instructor_id::text, COALESCE(p.name,''), COALESCE(p.bio,''),
		       COALESCE(p.instagram_url,''), COALESCE(p.facebook_url,''),
		       COALESCE(p.whatsapp,''), COALESCE(p.phone,'')
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE (w.id::text = $1 OR w.slug = $1)`, idOrSlug,
	).Scan(
		&w.ID, &w.Title, &w.Slug, &w.Description,
		&w.Type, &w.Modality, &w.Price, &w.Currency,
		&w.Capacity, &w.Location, &w.CoverImageURL,
		&w.Status, &w.CreatedAt,
		&w.CategoryID, &w.CategoryName, &w.CategorySlug,
		&w.InstructorID, &w.InstructorName, &w.InstructorBio,
		&w.InstructorInstagram, &w.InstructorFacebook,
		&w.InstructorWhatsapp, &w.InstructorPhone,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = $1 AND status = 'confirmed'`,
		w.ID,
	).Scan(&w.BookingsCount) //nolint:errcheck

	if w.Type == "class" {
		// Schedules como reglas de recurrencia (para mostrar "clases los lunes a las 19:00")
		schedRows, err := db.Pool.Query(ctx, `
			SELECT id, workshop_id, days_of_week, time_start::text, duration_min,
			       valid_from::text, valid_until::text, created_at::text
			FROM schedules
			WHERE workshop_id = $1
			  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
			ORDER BY valid_from, time_start`, w.ID)
		if err == nil {
			defer schedRows.Close()
			for schedRows.Next() {
				var s Schedule
				var validUntil *string
				if schedRows.Scan(&s.ID, &s.WorkshopID, &s.DaysOfWeek, &s.TimeStart, &s.DurationMin,
					&s.ValidFrom, &validUntil, &s.CreatedAt) == nil {
					s.ValidUntil = validUntil
					w.Schedules = append(w.Schedules, s)
				}
			}
		}

		// Sesiones materializadas disponibles (no canceladas, futuras) con conteo de reservas
		srows, err := db.Pool.Query(ctx, `
			SELECT s.id, s.starts_at::text, s.ends_at::text, COALESCE(s.notes,''),
			       COALESCE(COUNT(b.id) FILTER (WHERE b.status != 'cancelled'), 0)
			FROM sessions s
			LEFT JOIN bookings b ON b.session_id = s.id
			WHERE s.workshop_id = $1
			  AND s.schedule_id IS NOT NULL
			  AND s.cancelled = false
			  AND s.starts_at >= NOW()
			GROUP BY s.id
			ORDER BY s.starts_at`, w.ID)
		if err == nil {
			defer srows.Close()
			for srows.Next() {
				var s Session
				var bookingCount int
				if srows.Scan(&s.ID, &s.StartsAt, &s.EndsAt, &s.Notes, &bookingCount) == nil {
					s.BookingCount = bookingCount
					if w.Capacity != nil {
						remaining := *w.Capacity - bookingCount
						if remaining < 0 {
							remaining = 0
						}
						s.SpotsRemaining = &remaining
					}
					w.Sessions = append(w.Sessions, s)
				}
			}
		}
	} else {
		// Sesiones manuales para workshop / course / event
		srows, err := db.Pool.Query(ctx,
			`SELECT id, starts_at::text, ends_at::text, cancelled, COALESCE(notes,'')
			 FROM sessions WHERE workshop_id = $1 AND schedule_id IS NULL ORDER BY starts_at`, w.ID)
		if err == nil {
			defer srows.Close()
			for srows.Next() {
				var s Session
				if srows.Scan(&s.ID, &s.StartsAt, &s.EndsAt, &s.Cancelled, &s.Notes) == nil {
					w.Sessions = append(w.Sessions, s)
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

// GetAvailableSlots maneja GET /api/v1/workshops/:id/available-slots (protegido — solo el tallerista).
// Devuelve el calendario de slots calculados desde schedules en un rango de fechas,
// fusionando los ya materializados con los que aún no existen en la DB.
// Query params: from=YYYY-MM-DD, to=YYYY-MM-DD (default: hoy + 8 semanas)
func GetAvailableSlots(c *gin.Context) {
	userID, _ := c.Get("userID")
	workshopID := c.Param("id")
	ctx := context.Background()

	// Verificar propiedad del taller
	var ownerID string
	var capacity *int
	err := db.Pool.QueryRow(ctx,
		`SELECT instructor_id, capacity FROM workshops WHERE id = $1`, workshopID,
	).Scan(&ownerID, &capacity)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}
	if ownerID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para ver este calendario"})
		return
	}

	// Parsear rango de fechas
	from := time.Now().UTC().Truncate(24 * time.Hour)
	to := from.AddDate(0, 0, 56) // 8 semanas por defecto

	if fromStr := c.Query("from"); fromStr != "" {
		if t, err := time.Parse("2006-01-02", fromStr); err == nil {
			from = t
		}
	}
	if toStr := c.Query("to"); toStr != "" {
		if t, err := time.Parse("2006-01-02", toStr); err == nil {
			to = t
		}
	}

	schedules, _ := loadActiveSchedules(workshopID, from, to)
	materialized, _ := loadMaterializedSessions(workshopID, from, to)
	bookingCounts, _ := loadBookingCounts(workshopID)

	slots := computeAvailableSlots(schedules, from, to, materialized, bookingCounts, capacity)

	c.JSON(http.StatusOK, gin.H{"data": slots})
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
