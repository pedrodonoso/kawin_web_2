package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type profileResponse struct {
	Name         string `json:"name"`
	Bio          string `json:"bio"`
	Phone        string `json:"phone"`
	Whatsapp     string `json:"whatsapp"`
	InstagramURL string `json:"instagram_url"`
	FacebookURL  string `json:"facebook_url"`
}

type updateProfileInput struct {
	Name         string `json:"name" binding:"required"`
	Bio          string `json:"bio"`
	Phone        string `json:"phone"`
	Whatsapp     string `json:"whatsapp"`
	InstagramURL string `json:"instagram_url"`
	FacebookURL  string `json:"facebook_url"`
}

// GetMyProfile handles GET /api/v1/my-profile.
func GetMyProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	ctx := context.Background()

	var p profileResponse
	err := db.Pool.QueryRow(ctx,
		`SELECT COALESCE(name,''), COALESCE(bio,''), COALESCE(phone,''), COALESCE(whatsapp,''),
		        COALESCE(instagram_url,''), COALESCE(facebook_url,'')
		 FROM profiles WHERE user_id = $1`, userID,
	).Scan(&p.Name, &p.Bio, &p.Phone, &p.Whatsapp, &p.InstagramURL, &p.FacebookURL)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "Perfil no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": p})
}

// UpdateMyProfile handles PUT /api/v1/my-profile.
func UpdateMyProfile(c *gin.Context) {
	userID, _ := c.Get("userID")

	var input updateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	_, err := db.Pool.Exec(context.Background(),
		`UPDATE profiles
		 SET name=$1, bio=$2, phone=$3, whatsapp=$4,
		     instagram_url=$5, facebook_url=$6, updated_at=NOW()
		 WHERE user_id=$7`,
		input.Name, input.Bio, input.Phone, input.Whatsapp,
		input.InstagramURL, input.FacebookURL, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar perfil: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Perfil actualizado"}})
}
