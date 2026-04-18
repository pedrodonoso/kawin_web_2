package handlers

import (
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

	var p profileResponse
	result := db.DB.Raw(`
		SELECT COALESCE(name,'') as name, COALESCE(bio,'') as bio,
		       COALESCE(phone,'') as phone, COALESCE(whatsapp,'') as whatsapp,
		       COALESCE(instagram_url,'') as instagram_url, COALESCE(facebook_url,'') as facebook_url
		FROM profiles WHERE user_id = ?`, userID).Scan(&p)
	if result.Error != nil || result.RowsAffected == 0 {
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

	err := db.DB.Exec(`
		UPDATE profiles
		SET name=?, bio=?, phone=?, whatsapp=?,
		    instagram_url=?, facebook_url=?, updated_at=NOW()
		WHERE user_id=?`,
		input.Name, input.Bio, input.Phone, input.Whatsapp,
		input.InstagramURL, input.FacebookURL, userID,
	).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar perfil: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"message": "Perfil actualizado"}})
}
