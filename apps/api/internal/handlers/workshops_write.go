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
	Schedule    string         `json:"schedule"`
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
		  price, currency, capacity, location, schedule, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id`,
		userID, catID, input.Title, slug, input.Description,
		input.Type, input.Modality, input.Price, input.Currency,
		input.Capacity, input.Location, input.Schedule, input.Status,
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
