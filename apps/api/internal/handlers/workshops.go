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

type Session struct {
	ID        string `json:"id"`
	StartsAt  string `json:"starts_at"`
	EndsAt    string `json:"ends_at"`
	Cancelled bool   `json:"cancelled,omitempty"`
	Notes     string `json:"notes,omitempty"`
}

// UpcomingSession represents a computed (virtual or materialized) class instance.
// Returned only for workshops of type "class".
type UpcomingSession struct {
	Date           string  `json:"date"`            // "YYYY-MM-DD"
	Time           string  `json:"time"`            // "HH:MM"
	DurationMin    int     `json:"duration_min"`
	ScheduleID     string  `json:"schedule_id"`
	SessionID      *string `json:"session_id"`      // nil = not yet materialized
	SpotsRemaining *int    `json:"spots_remaining"` // nil = no capacity limit
	Status         string  `json:"status"`          // "available" | "cancelled" | "full"
}

type Workshop struct {
	ID               string            `json:"id"`
	Title            string            `json:"title"`
	Slug             string            `json:"slug"`
	Description      string            `json:"description"`
	Type             string            `json:"type"`
	Modality         string            `json:"modality"`
	Price            float64           `json:"price"`
	Currency         string            `json:"currency"`
	Capacity         *int              `json:"capacity,omitempty"`
	Location         string            `json:"location,omitempty"`
	CoverImageURL    string            `json:"cover_image_url,omitempty"`
	Status           string            `json:"status"`
	CategoryID       string            `json:"category_id,omitempty"`
	CategoryName     string            `json:"category_name,omitempty"`
	CategorySlug     string            `json:"category_slug,omitempty"`
	InstructorID     string            `json:"instructor_id,omitempty"`
	InstructorName   string            `json:"instructor_name,omitempty"`
	InstructorBio    string            `json:"instructor_bio,omitempty"`
	Sessions         []Session         `json:"sessions,omitempty"`
	Schedules        []Schedule        `json:"schedules,omitempty"`
	UpcomingSessions []UpcomingSession `json:"upcoming_sessions,omitempty"`
	CreatedAt        string            `json:"created_at"`
}

// =============================================================================
// Virtual session engine
// =============================================================================

type materializedSession struct {
	ID        string
	Cancelled bool
}

// computeUpcomingSessions calculates the upcoming class instances for a given set
// of schedules within [from, to], merging any already-materialized sessions.
// Pure function: no DB calls.
func computeUpcomingSessions(
	schedules []Schedule,
	from, to time.Time,
	materialized map[string]materializedSession, // key: "scheduleID:YYYY-MM-DD"
	bookingCounts map[string]int,                // key: session_id → confirmed bookings
	capacity *int,
) []UpcomingSession {
	var result []UpcomingSession

	for _, sched := range schedules {
		// Parse valid_from (stored as "YYYY-MM-DD" or "YYYY-MM-DDT...")
		validFrom, err := time.Parse("2006-01-02", sched.ValidFrom[:10])
		if err != nil {
			continue
		}

		// Parse valid_until (nil = active indefinitely)
		var validUntil *time.Time
		if sched.ValidUntil != nil && len(*sched.ValidUntil) >= 10 {
			t, err := time.Parse("2006-01-02", (*sched.ValidUntil)[:10])
			if err == nil {
				validUntil = &t
			}
		}

		// Build a set of active weekdays
		daySet := make(map[time.Weekday]bool)
		for _, d := range sched.DaysOfWeek {
			daySet[time.Weekday(d)] = true
		}

		// Parse time_start — PostgreSQL returns TIME as "HH:MM:SS" or "HH:MM"
		parts := strings.SplitN(sched.TimeStart, ":", 3)
		if len(parts) < 2 {
			continue
		}
		hour, _ := strconv.Atoi(parts[0])
		minute, _ := strconv.Atoi(parts[1])
		timeStr := fmt.Sprintf("%02d:%02d", hour, minute)

		// Walk every day in the query range
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

			status := "available"
			var sessionID *string
			var spotsRemaining *int

			if mat, ok := materialized[key]; ok {
				id := mat.ID
				sessionID = &id
				if mat.Cancelled {
					status = "cancelled"
				} else if capacity != nil {
					count := bookingCounts[mat.ID]
					remaining := *capacity - count
					if remaining <= 0 {
						status = "full"
						remaining = 0
					}
					spotsRemaining = &remaining
				}
			} else if capacity != nil {
				// Not materialized → no bookings yet → full capacity available
				remaining := *capacity
				spotsRemaining = &remaining
			}

			result = append(result, UpcomingSession{
				Date:           dateStr,
				Time:           timeStr,
				DurationMin:    sched.DurationMin,
				ScheduleID:     sched.ID,
				SessionID:      sessionID,
				SpotsRemaining: spotsRemaining,
				Status:         status,
			})
		}
	}

	// Sort chronologically, then by time within the same day
	sort.Slice(result, func(i, j int) bool {
		if result[i].Date == result[j].Date {
			return result[i].Time < result[j].Time
		}
		return result[i].Date < result[j].Date
	})

	return result
}

// loadActiveSchedules returns schedules whose validity window overlaps [from, to].
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

// loadMaterializedSessions returns already-materialized sessions (those with a schedule_id)
// in the upcoming window, keyed by "scheduleID:YYYY-MM-DD".
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

// loadBookingCounts returns confirmed booking counts per session_id for a workshop.
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

func GetWorkshop(c *gin.Context) {
	idOrSlug := c.Param("id")

	var w Workshop
	// Accept both UUID and slug — try UUID first (36-char with dashes), fall back to slug
	err := db.Pool.QueryRow(context.Background(), `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		       w.status, COALESCE(w.created_at::text,''),
		       COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		       w.instructor_id::text, COALESCE(p.name,''), COALESCE(p.bio,'')
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
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	if w.Type == "class" {
		// Virtual session engine: compute upcoming sessions from schedule rules
		from := time.Now().UTC().Truncate(24 * time.Hour)
		to := from.AddDate(0, 0, 56) // 8 weeks ahead

		schedules, _ := loadActiveSchedules(w.ID, from, to)
		materialized, _ := loadMaterializedSessions(w.ID, from, to)
		bookingCounts, _ := loadBookingCounts(w.ID)

		w.UpcomingSessions = computeUpcomingSessions(schedules, from, to, materialized, bookingCounts, w.Capacity)
	} else {
		// Manual sessions for workshop / course / event types
		srows, err := db.Pool.Query(context.Background(),
			`SELECT id, starts_at::text, ends_at::text, cancelled, COALESCE(notes,'')
			 FROM sessions WHERE workshop_id = $1 ORDER BY starts_at`, w.ID)
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

func itoa(i int) string {
	return strconv.Itoa(i)
}
