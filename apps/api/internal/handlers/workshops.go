package handlers

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type Workshop struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Slug           string   `json:"slug"`
	Description    string   `json:"description"`
	Type           string   `json:"type"`
	Modality       string   `json:"modality"`
	Price          float64  `json:"price"`
	Currency       string   `json:"currency"`
	Capacity       *int     `json:"capacity,omitempty"`
	Location       string   `json:"location,omitempty"`
	CoverImageURL  string   `json:"cover_image_url,omitempty"`
	Status         string   `json:"status"`
	CategoryID     string   `json:"category_id,omitempty"`
	CategoryName   string   `json:"category_name,omitempty"`
	CategorySlug   string   `json:"category_slug,omitempty"`
	InstructorName string   `json:"instructor_name,omitempty"`
	CreatedAt      string   `json:"created_at"`
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
	slug := c.Param("slug")

	var w Workshop
	err := db.Pool.QueryRow(context.Background(), `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,''),
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,''), COALESCE(w.cover_image_url,''),
		       w.status, COALESCE(w.created_at::text,''),
		       COALESCE(c.id::text,''), COALESCE(c.name,''), COALESCE(c.slug,''),
		       COALESCE(p.name,'')
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		WHERE w.slug = $1`, slug,
	).Scan(
		&w.ID, &w.Title, &w.Slug, &w.Description,
		&w.Type, &w.Modality, &w.Price, &w.Currency,
		&w.Capacity, &w.Location, &w.CoverImageURL,
		&w.Status, &w.CreatedAt,
		&w.CategoryID, &w.CategoryName, &w.CategorySlug,
		&w.InstructorName,
	)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": w})
}

func itoa(i int) string {
	return strconv.Itoa(i)
}
