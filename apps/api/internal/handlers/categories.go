package handlers

import (
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
	var categories []Category
	if err := db.DB.Raw(
		`SELECT id, name, slug, COALESCE(icon,'') as icon, COALESCE(description,'') as description
		 FROM categories ORDER BY name`,
	).Scan(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener categorías"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": categories})
}
