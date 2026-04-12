package handlers

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type createWorkshopInput struct {
	Title       string          `json:"title" binding:"required"`
	Description string          `json:"description"`
	Type        string          `json:"type" binding:"required"`
	Modality    string          `json:"modality" binding:"required"`
	Price       float64         `json:"price"`
	Currency    string          `json:"currency"`
	Capacity    *int            `json:"capacity"`
	Location    string          `json:"location"`
	CategoryID  string         `json:"category_id"`
	Status      string         `json:"status"`
	Sessions    []sessionInput `json:"sessions"`
}

type sessionInput struct {
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at"`
	Notes    string `json:"notes"`
}

func CreateWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input createWorkshopInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if input.Currency == "" {
		input.Currency = "CLP"
	}
	if input.Status == "" {
		input.Status = "draft"
	}

	slug := slugify(input.Title)

	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}

	var workshopID string
	err := db.Pool.QueryRow(context.Background(),
		`INSERT INTO workshops
		 (instructor_id, category_id, title, slug, description, type, modality,
		  price, currency, capacity, location, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		 RETURNING id`,
		userID, catID, input.Title, slug, input.Description,
		input.Type, input.Modality, input.Price, input.Currency,
		input.Capacity, input.Location, input.Status,
	).Scan(&workshopID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear taller: " + err.Error()})
		return
	}

	for _, s := range input.Sessions {
		if s.StartsAt == "" || s.EndsAt == "" {
			continue
		}
		db.Pool.Exec(context.Background(),
			`INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES ($1,$2,$3,$4)`,
			workshopID, s.StartsAt, s.EndsAt, s.Notes,
		)
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": workshopID, "slug": slug}})
}

func GetMyWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")
	id := c.Param("id")

	var w Workshop
	err := db.Pool.QueryRow(context.Background(), `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		       w.status, COALESCE(w.created_at::text,''),
		       COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		       COALESCE(p.name,''), COALESCE(p.bio,'')
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE w.id = $1 AND w.instructor_id = $2`, id, userID,
	).Scan(
		&w.ID, &w.Title, &w.Slug, &w.Description,
		&w.Type, &w.Modality, &w.Price, &w.Currency,
		&w.Capacity, &w.Location, &w.CoverImageURL,
		&w.Status, &w.CreatedAt,
		&w.CategoryID, &w.CategoryName, &w.CategorySlug,
		&w.InstructorName, &w.InstructorBio,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	if w.Type == "class" {
		// Return schedules for class-type workshops
		schedRows, err := db.Pool.Query(context.Background(), `
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
	} else {
		srows, err := db.Pool.Query(context.Background(),
			`SELECT id, starts_at::text, ends_at::text, COALESCE(notes,'')
			 FROM sessions WHERE workshop_id = $1 AND schedule_id IS NULL ORDER BY starts_at`, w.ID)
		if err == nil {
			defer srows.Close()
			for srows.Next() {
				var s Session
				if srows.Scan(&s.ID, &s.StartsAt, &s.EndsAt, &s.Notes) == nil {
					w.Sessions = append(w.Sessions, s)
				}
			}
		}
	}

	// Agregar conteo de reservas confirmadas para que el frontend sepa qué campos deshabilitar.
	db.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = $1 AND status = 'confirmed'`, w.ID,
	).Scan(&w.BookingsCount) //nolint:errcheck

	c.JSON(http.StatusOK, gin.H{"data": w})
}

type updateWorkshopInput struct {
	Title       string         `json:"title" binding:"required"`
	Description string         `json:"description"`
	Type        string         `json:"type" binding:"required"`
	Modality    string         `json:"modality" binding:"required"`
	Price       float64        `json:"price"`
	Currency    string         `json:"currency"`
	Capacity    *int           `json:"capacity"`
	Location    string         `json:"location"`
	CategoryID  string         `json:"category_id"`
	Status      string         `json:"status"`
	Sessions    []sessionInput `json:"sessions"`
}

func UpdateWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")
	id := c.Param("id")

	var input updateWorkshopInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if input.Currency == "" {
		input.Currency = "CLP"
	}
	if input.Status == "" {
		input.Status = "draft"
	}

	// Cargar estado actual del taller para validaciones.
	var currentType, currentStatus string
	var currentPrice float64
	var currentCapacity *int
	err := db.Pool.QueryRow(context.Background(),
		`SELECT type, status, price, capacity FROM workshops WHERE id = $1 AND instructor_id = $2`, id, userID,
	).Scan(&currentType, &currentStatus, &currentPrice, &currentCapacity)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o sin permisos"})
		return
	}

	// Contar reservas confirmadas del taller.
	var confirmedBookings int
	db.Pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = $1 AND status = 'confirmed'`, id,
	).Scan(&confirmedBookings) //nolint:errcheck

	// Si hay reservas confirmadas, los campos precio y cupos se mantienen sin cambio.
	// Solo se permiten modificar: título, descripción, modalidad, ubicación y categoría.
	if confirmedBookings > 0 {
		input.Price = currentPrice
		input.Capacity = currentCapacity
	}

	// Si se intenta pasar a borrador desde publicado, validar reservas activas.
	if input.Status == "draft" && currentStatus == "published" {
		if count := activeBookingsCount(id); count > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"message":         fmt.Sprintf("El taller tiene %d reserva(s) activa(s). No se puede cambiar a borrador hasta que pasen todas las sesiones reservadas.", count),
				"active_bookings": count,
			})
			return
		}
	}

	if input.Type != "" && input.Type != currentType {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El tipo de taller no puede modificarse después de creado"})
		return
	}

	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}

	result, err := db.Pool.Exec(context.Background(),
		`UPDATE workshops
		 SET title=$1, description=$2, type=$3, modality=$4,
		     price=$5, currency=$6, capacity=$7, location=$8,
		     category_id=$9, status=$10, updated_at=NOW()
		 WHERE id=$11 AND instructor_id=$12`,
		input.Title, input.Description, currentType, input.Modality,
		input.Price, input.Currency, input.Capacity, input.Location,
		catID, input.Status, id, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar taller: " + err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o sin permisos"})
		return
	}

	// Reemplazar sesiones solo si no hay reservas confirmadas.
	if confirmedBookings == 0 {
		db.Pool.Exec(context.Background(), `DELETE FROM sessions WHERE workshop_id = $1 AND schedule_id IS NULL`, id)
		for _, s := range input.Sessions {
			if s.StartsAt == "" || s.EndsAt == "" {
				continue
			}
			db.Pool.Exec(context.Background(),
				`INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES ($1,$2,$3,$4)`,
				id, s.StartsAt, s.EndsAt, s.Notes,
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id}})
}

// activeBookingsCount devuelve la cantidad de reservas confirmadas con sesiones futuras
// o reservas directas (sin sesión) para el workshop dado.
func activeBookingsCount(workshopID string) int {
	ctx := context.Background()
	var sessionBookings, directBookings int
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM bookings b
		 JOIN sessions s ON s.id = b.session_id
		 WHERE b.workshop_id = $1
		   AND b.status = 'confirmed'
		   AND s.starts_at > NOW()`, workshopID,
	).Scan(&sessionBookings) //nolint:errcheck
	db.Pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM bookings
		 WHERE workshop_id = $1 AND status = 'confirmed' AND session_id IS NULL`, workshopID,
	).Scan(&directBookings) //nolint:errcheck
	return sessionBookings + directBookings
}

// DeleteWorkshop handles DELETE /api/v1/workshops/:id.
// Soft-archives the workshop (status = 'archived'). Only the owner can do this.
func DeleteWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")
	id := c.Param("id")

	// Verify ownership before checking bookings
	var exists bool
	db.Pool.QueryRow(context.Background(),
		`SELECT true FROM workshops WHERE id = $1 AND instructor_id = $2 AND status != 'archived'`, id, userID,
	).Scan(&exists) //nolint:errcheck
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o ya archivado"})
		return
	}

	if count := activeBookingsCount(id); count > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"message":         fmt.Sprintf("El taller tiene %d reserva(s) activa(s). No se puede archivar hasta que pasen todas las sesiones reservadas.", count),
			"active_bookings": count,
		})
		return
	}

	result, err := db.Pool.Exec(context.Background(),
		`UPDATE workshops SET status = 'archived', updated_at = NOW()
		 WHERE id = $1 AND instructor_id = $2 AND status != 'archived'`,
		id, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al archivar taller: " + err.Error()})
		return
	}
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o ya archivado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id, "status": "archived"}})
}

func GetMyWorkshops(c *gin.Context) {
	userID, _ := c.Get("userID")

	rows, err := db.Pool.Query(context.Background(),
		`SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		        w.type, w.modality, w.price, w.currency,
		        w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		        w.status, COALESCE(w.created_at::text,''),
		        COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		        COALESCE(p.name,'')
		 FROM workshops w
		 LEFT JOIN categories c ON c.id = w.category_id
		 LEFT JOIN profiles p ON p.user_id = w.instructor_id
		 WHERE w.instructor_id = $1
		 ORDER BY w.created_at DESC`,
		userID,
	)
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

	c.JSON(http.StatusOK, gin.H{"data": workshops})
}

var nonAlpha = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	replacer := strings.NewReplacer(
		"á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u",
		"ñ", "n", "ü", "u", "Á", "a", "É", "e", "Í", "i", "Ó", "o", "Ú", "u",
	)
	s = replacer.Replace(strings.ToLower(s))
	s = nonAlpha.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return fmt.Sprintf("%s-%d", s, time.Now().UnixMilli()%100000)
}
