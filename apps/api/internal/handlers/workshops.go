package handlers

import (
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
	OnlineURL      string `json:"online_url,omitempty"`
	SpotsRemaining *int   `json:"spots_remaining,omitempty" gorm:"-"` // calculado en Go
	BookingCount   int    `json:"booking_count,omitempty"`
}

// AvailableSlot representa un slot calculado desde schedules para el calendario del tallerista.
// Retornado por GET /workshops/:id/available-slots (solo para instructores).
type AvailableSlot struct {
	Date           string  `json:"date"`             // "YYYY-MM-DD"
	Time           string  `json:"time"`             // "HH:MM"
	DurationMin    int     `json:"duration_min"`
	ScheduleID     string  `json:"schedule_id"`
	SessionID      *string `json:"session_id"`       // nil = no materializado aún
	OnlineURL      string  `json:"online_url,omitempty"`
	SpotsRemaining *int    `json:"spots_remaining"` // nil = sin límite
	BookingCount   int     `json:"booking_count"`   // reservas activas de esta sesión
	Status         string  `json:"status"`          // "not_materialized" | "available" | "full" | "cancelled"
}

type Workshop struct {
	ID                  string     `json:"id"`
	Title               string     `json:"title"`
	Slug                string     `json:"slug"`
	Description         string     `json:"description"`
	Type                string     `json:"type"`
	Modality            string     `json:"modality"`
	Price               float64    `json:"price"`
	Currency            string     `json:"currency"`
	Capacity            *int       `json:"capacity,omitempty"`
	Location            string     `json:"location,omitempty"`
	OnlineURL           string     `json:"online_url,omitempty"`
	CoverImageURL       string     `json:"cover_image_url,omitempty"`
	Status              string     `json:"status"`
	ApprovalStatus      string     `json:"approval_status,omitempty"`
	AdminObservations   string     `json:"admin_observations,omitempty"`
	CategoryID          string     `json:"category_id,omitempty"`
	CategoryName        string     `json:"category_name,omitempty"`
	CategorySlug        string     `json:"category_slug,omitempty"`
	InstructorID        string     `json:"instructor_id,omitempty"`
	InstructorName      string     `json:"instructor_name,omitempty"`
	InstructorBio       string     `json:"instructor_bio,omitempty"`
	InstructorInstagram string     `json:"instructor_instagram,omitempty"`
	InstructorFacebook  string     `json:"instructor_facebook,omitempty"`
	InstructorWhatsapp  string     `json:"instructor_whatsapp,omitempty"`
	InstructorPhone     string     `json:"instructor_phone,omitempty"`
	Sessions            []Session  `json:"sessions,omitempty"  gorm:"-"`
	Schedules           []Schedule `json:"schedules,omitempty" gorm:"-"`
	BookingsCount       int        `json:"bookings_count"      gorm:"-"`
	CreatedAt           string     `json:"created_at"`
}

// =============================================================================
// Slot engine (solo para GetAvailableSlots — uso exclusivo del tallerista)
// =============================================================================

type materializedSession struct {
	ID        string
	Cancelled bool
	OnlineURL string
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

			var slotOnlineURL string
			if mat, ok := materialized[key]; ok {
				id := mat.ID
				sessionID = &id
				slotOnlineURL = mat.OnlineURL
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
				OnlineURL:      slotOnlineURL,
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
	var rows []schedRowRaw
	err := db.DB.Raw(`
		SELECT id, workshop_id,
		       array_to_string(days_of_week, ',') as days_str,
		       time_start::text as time_start, duration_min,
		       valid_from::text as valid_from, valid_until::text as valid_until,
		       created_at::text as created_at
		FROM schedules
		WHERE workshop_id = ?
		  AND valid_from <= ?
		  AND (valid_until IS NULL OR valid_until >= ?)
		ORDER BY valid_from, time_start`,
		workshopID, to.Format("2006-01-02"), from.Format("2006-01-02"),
	).Scan(&rows).Error
	return rowsToSchedules(rows), err
}

// loadMaterializedSessions devuelve las sesiones ya materializadas en [from, to],
// indexadas por "scheduleID:YYYY-MM-DD".
func loadMaterializedSessions(workshopID string, from, to time.Time) (map[string]materializedSession, error) {
	type sessionRow struct {
		ID         string `gorm:"column:id"`
		ScheduleID string `gorm:"column:schedule_id"`
		DateStr    string `gorm:"column:date_str"`
		Cancelled  bool   `gorm:"column:cancelled"`
		OnlineURL  string `gorm:"column:online_url"`
	}

	var rows []sessionRow
	err := db.DB.Raw(`
		SELECT id, schedule_id::text as schedule_id,
		       (starts_at AT TIME ZONE 'UTC')::date::text as date_str,
		       cancelled, COALESCE(online_url,'') as online_url
		FROM sessions
		WHERE workshop_id = ?
		  AND schedule_id IS NOT NULL
		  AND starts_at >= ?
		  AND starts_at <= ?`,
		workshopID,
		from.Format("2006-01-02"),
		to.Add(24*time.Hour).Format("2006-01-02"),
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	m := make(map[string]materializedSession)
	for _, r := range rows {
		m[r.ScheduleID+":"+r.DateStr] = materializedSession{
			ID:        r.ID,
			Cancelled: r.Cancelled,
			OnlineURL: r.OnlineURL,
		}
	}
	return m, nil
}

// loadBookingCounts devuelve el conteo de reservas confirmadas por session_id.
func loadBookingCounts(workshopID string) (map[string]int, error) {
	type countRow struct {
		SessionID string `gorm:"column:session_id"`
		Count     int    `gorm:"column:count"`
	}

	var rows []countRow
	err := db.DB.Raw(`
		SELECT session_id::text as session_id, COUNT(*) as count
		FROM bookings
		WHERE workshop_id = ?
		  AND session_id IS NOT NULL
		  AND status != 'cancelled'
		GROUP BY session_id`,
		workshopID,
	).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int)
	for _, r := range rows {
		counts[r.SessionID] = r.Count
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
		SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,'') as location,
		       COALESCE(w.online_url,'') as online_url,
		       COALESCE(w.cover_image_url,'') as cover_image_url,
		       w.status, COALESCE(w.created_at::text,'') as created_at,
		       COALESCE(c.id::text,'') as category_id,
		       COALESCE(c.name,'') as category_name,
		       COALESCE(c.slug,'') as category_slug,
		       COALESCE(p.name,'') as instructor_name
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
	_ = i

	query += ` ORDER BY w.created_at DESC LIMIT 50`

	var workshops []Workshop
	if err := db.DB.Raw(query, args...).Scan(&workshops).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener talleres"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": workshops, "total": len(workshops)})
}

// GetWorkshop maneja GET /api/v1/workshops/:id (público).
func GetWorkshop(c *gin.Context) {
	idOrSlug := c.Param("id")

	var w Workshop
	result := db.DB.Raw(`
		SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,'') as location,
		       COALESCE(w.online_url,'') as online_url,
		       COALESCE(w.cover_image_url,'') as cover_image_url,
		       w.status, COALESCE(w.created_at::text,'') as created_at,
		       COALESCE(c.id::text,'') as category_id,
		       COALESCE(c.name,'') as category_name,
		       COALESCE(c.slug,'') as category_slug,
		       w.instructor_id::text as instructor_id,
		       COALESCE(p.name,'') as instructor_name,
		       COALESCE(p.bio,'') as instructor_bio,
		       COALESCE(p.instagram_url,'') as instructor_instagram,
		       COALESCE(p.facebook_url,'') as instructor_facebook,
		       COALESCE(p.whatsapp,'') as instructor_whatsapp,
		       COALESCE(p.phone,'') as instructor_phone
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE (w.id::text = ? OR w.slug = ?)`, idOrSlug, idOrSlug,
	).Scan(&w)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	db.DB.Raw(
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = ? AND status = 'confirmed'`, w.ID,
	).Scan(&w.BookingsCount) //nolint:errcheck

	if w.Type == "class" {
		var schedRows []schedRowRaw
		db.DB.Raw(`
			SELECT id, workshop_id,
			       array_to_string(days_of_week, ',') as days_str,
			       time_start::text as time_start, duration_min,
			       valid_from::text as valid_from, valid_until::text as valid_until,
			       created_at::text as created_at
			FROM schedules
			WHERE workshop_id = ?
			  AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
			ORDER BY valid_from, time_start`, w.ID,
		).Scan(&schedRows)
		w.Schedules = rowsToSchedules(schedRows)

		var sessions []Session
		db.DB.Raw(`
			SELECT s.id, s.starts_at::text as starts_at, s.ends_at::text as ends_at,
			       COALESCE(s.notes,'') as notes, COALESCE(s.online_url,'') as online_url,
			       COALESCE(COUNT(b.id) FILTER (WHERE b.status != 'cancelled'), 0) as booking_count
			FROM sessions s
			LEFT JOIN bookings b ON b.session_id = s.id
			WHERE s.workshop_id = ?
			  AND s.schedule_id IS NOT NULL
			  AND s.cancelled = false
			  AND s.starts_at >= NOW()
			GROUP BY s.id
			ORDER BY s.starts_at`, w.ID,
		).Scan(&sessions)

		for i := range sessions {
			if w.Capacity != nil {
				remaining := *w.Capacity - sessions[i].BookingCount
				if remaining < 0 {
					remaining = 0
				}
				sessions[i].SpotsRemaining = &remaining
			}
		}
		w.Sessions = sessions
	} else {
		var sessions []Session
		db.DB.Raw(`
			SELECT id, starts_at::text as starts_at, ends_at::text as ends_at,
			       cancelled, COALESCE(notes,'') as notes
			FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL ORDER BY starts_at`, w.ID,
		).Scan(&sessions)
		w.Sessions = sessions
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

// GetAvailableSlots maneja GET /api/v1/workshops/:id/available-slots (protegido — solo el tallerista).
func GetAvailableSlots(c *gin.Context) {
	userID, _ := c.Get("userID")
	workshopID := c.Param("id")

	var winfo struct {
		InstructorID string `gorm:"column:instructor_id"`
		Capacity     *int   `gorm:"column:capacity"`
	}
	result := db.DB.Raw(
		`SELECT instructor_id::text as instructor_id, capacity FROM workshops WHERE id = ?`, workshopID,
	).Scan(&winfo)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}
	if winfo.InstructorID != userID.(string) {
		c.JSON(http.StatusForbidden, gin.H{"message": "No tienes permiso para ver este calendario"})
		return
	}

	from := time.Now().UTC().Truncate(24 * time.Hour)
	to := from.AddDate(0, 0, 56)

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

	slots := computeAvailableSlots(schedules, from, to, materialized, bookingCounts, winfo.Capacity)

	c.JSON(http.StatusOK, gin.H{"data": slots})
}

func itoa(i int) string {
	return strconv.Itoa(i)
}

