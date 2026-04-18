package handlers

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
	"github.com/pedrodonoso/kawin/api/internal/models"
)

type createWorkshopInput struct {
	Title       string         `json:"title" binding:"required"`
	Description string         `json:"description"`
	Type        string         `json:"type" binding:"required"`
	Modality    string         `json:"modality" binding:"required"`
	Price       float64        `json:"price"`
	Currency    string         `json:"currency"`
	Capacity    *int           `json:"capacity"`
	Location    string         `json:"location"`
	OnlineURL   string         `json:"online_url"`
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

	w := models.Workshop{
		InstructorID:  userID.(string),
		CategoryID:    catID,
		Title:         input.Title,
		Slug:          slug,
		Description:   input.Description,
		Type:          input.Type,
		Modality:      input.Modality,
		Price:         input.Price,
		Currency:      input.Currency,
		Capacity:      input.Capacity,
		Location:      input.Location,
		OnlineURL:     input.OnlineURL,
		Status:        input.Status,
	}
	if err := db.DB.Create(&w).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al crear taller: " + err.Error()})
		return
	}

	for _, s := range input.Sessions {
		if s.StartsAt == "" || s.EndsAt == "" {
			continue
		}
		db.DB.Exec(
			`INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?,?,?,?)`,
			w.ID, s.StartsAt, s.EndsAt, s.Notes,
		)
	}

	c.JSON(http.StatusCreated, gin.H{"data": gin.H{"id": w.ID, "slug": slug}})
}

func GetMyWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")
	id := c.Param("id")

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
		       COALESCE(p.name,'') as instructor_name,
		       COALESCE(p.bio,'') as instructor_bio
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE w.id = ? AND w.instructor_id = ?`, id, userID,
	).Scan(&w)
	if result.Error != nil || result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

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
	} else {
		var sessions []Session
		db.DB.Raw(`
			SELECT id, starts_at::text as starts_at, ends_at::text as ends_at,
			       COALESCE(notes,'') as notes
			FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL ORDER BY starts_at`, w.ID,
		).Scan(&sessions)
		w.Sessions = sessions
	}

	db.DB.Raw(
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = ? AND status = 'confirmed'`, w.ID,
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
	OnlineURL   string         `json:"online_url"`
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

	var current struct {
		Type     string  `gorm:"column:type"`
		Status   string  `gorm:"column:status"`
		Price    float64 `gorm:"column:price"`
		Capacity *int    `gorm:"column:capacity"`
	}
	res := db.DB.Raw(
		`SELECT type, status, price, capacity FROM workshops WHERE id = ? AND instructor_id = ?`, id, userID,
	).Scan(&current)
	if res.Error != nil || res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o sin permisos"})
		return
	}

	var confirmedBookings int64
	db.DB.Raw(
		`SELECT COUNT(*) FROM bookings WHERE workshop_id = ? AND status = 'confirmed'`, id,
	).Scan(&confirmedBookings) //nolint:errcheck

	if confirmedBookings > 0 {
		input.Price = current.Price
		input.Capacity = current.Capacity
	}

	if input.Status == "draft" && current.Status == "published" {
		if count := activeBookingsCount(id); count > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"message":         fmt.Sprintf("El taller tiene %d reserva(s) activa(s). No se puede cambiar a borrador hasta que pasen todas las sesiones reservadas.", count),
				"active_bookings": count,
			})
			return
		}
	}

	if input.Type != "" && input.Type != current.Type {
		c.JSON(http.StatusBadRequest, gin.H{"message": "El tipo de taller no puede modificarse después de creado"})
		return
	}

	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}

	result := db.DB.Exec(`
		UPDATE workshops
		SET title=?, description=?, type=?, modality=?,
		    price=?, currency=?, capacity=?, location=?,
		    online_url=?, category_id=?, status=?, updated_at=NOW()
		WHERE id=? AND instructor_id=?`,
		input.Title, input.Description, current.Type, input.Modality,
		input.Price, input.Currency, input.Capacity, input.Location,
		input.OnlineURL, catID, input.Status, id, userID,
	)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar taller: " + result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o sin permisos"})
		return
	}

	if confirmedBookings == 0 {
		db.DB.Exec(`DELETE FROM sessions WHERE workshop_id = ? AND schedule_id IS NULL`, id)
		for _, s := range input.Sessions {
			if s.StartsAt == "" || s.EndsAt == "" {
				continue
			}
			db.DB.Exec(
				`INSERT INTO sessions (workshop_id, starts_at, ends_at, notes) VALUES (?,?,?,?)`,
				id, s.StartsAt, s.EndsAt, s.Notes,
			)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id}})
}

// activeBookingsCount devuelve la cantidad de reservas confirmadas con sesiones futuras
// o reservas directas (sin sesión) para el workshop dado.
func activeBookingsCount(workshopID string) int {
	var sessionBookings, directBookings int64
	db.DB.Raw(`
		SELECT COUNT(*) FROM bookings b
		JOIN sessions s ON s.id = b.session_id
		WHERE b.workshop_id = ?
		  AND b.status = 'confirmed'
		  AND s.starts_at > NOW()`, workshopID,
	).Scan(&sessionBookings) //nolint:errcheck
	db.DB.Raw(`
		SELECT COUNT(*) FROM bookings
		WHERE workshop_id = ? AND status = 'confirmed' AND session_id IS NULL`, workshopID,
	).Scan(&directBookings) //nolint:errcheck
	return int(sessionBookings + directBookings)
}

// DeleteWorkshop handles DELETE /api/v1/workshops/:id.
func DeleteWorkshop(c *gin.Context) {
	userID, _ := c.Get("userID")
	id := c.Param("id")

	var exists bool
	db.DB.Raw(
		`SELECT true FROM workshops WHERE id = ? AND instructor_id = ? AND status != 'archived'`, id, userID,
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

	result := db.DB.Exec(`
		UPDATE workshops SET status = 'archived', updated_at = NOW()
		WHERE id = ? AND instructor_id = ? AND status != 'archived'`,
		id, userID,
	)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al archivar taller: " + result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado o ya archivado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": id, "status": "archived"}})
}

func GetMyWorkshops(c *gin.Context) {
	userID, _ := c.Get("userID")

	var workshops []Workshop
	if err := db.DB.Raw(`
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
		WHERE w.instructor_id = ?
		ORDER BY w.created_at DESC`, userID,
	).Scan(&workshops).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener talleres"})
		return
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

