package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type Category struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Icon        string `json:"icon,omitempty"`
	Description string `json:"description,omitempty"`
}

func GetCategories(c *gin.Context) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, name, slug, COALESCE(icon,''), COALESCE(description,'') FROM categories ORDER BY name`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener categorías"})
		return
	}
	defer rows.Close()

	categories := []Category{}
	for rows.Next() {
		var cat Category
		if err := rows.Scan(&cat.ID, &cat.Name, &cat.Slug, &cat.Icon, &cat.Description); err != nil {
			continue
		}
		categories = append(categories, cat)
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}
