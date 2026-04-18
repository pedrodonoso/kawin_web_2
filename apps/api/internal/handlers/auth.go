package handlers

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pedrodonoso/kawin/api/internal/db"
	"github.com/pedrodonoso/kawin/api/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type registerInput struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role"`
}

type loginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func jwtSecret() []byte {
	s := os.Getenv("API_SECRET")
	if s == "" {
		s = "dev-secret"
	}
	return []byte(s)
}

func makeToken(userID, email, role string) (string, error) {
	claims := jwt.MapClaims{
		"sub":   userID,
		"email": email,
		"role":  role,
		"exp":   time.Now().Add(30 * 24 * time.Hour).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}

func Register(c *gin.Context) {
	var input registerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	role := input.Role
	if role == "" {
		role = "student"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al procesar contraseña"})
		return
	}

	user := models.User{Email: input.Email, PasswordHash: string(hash), Role: role}
	if err := db.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "El email ya está registrado"})
		return
	}

	db.DB.Create(&models.Profile{UserID: user.ID, Name: input.Name})

	token, err := makeToken(user.ID, input.Email, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al generar token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "email": input.Email, "role": role},
	})
}

func Login(c *gin.Context) {
	var input loginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var user models.User
	result := db.DB.Select("id, password_hash, role").Where("email = ?", input.Email).First(&user)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Credenciales incorrectas"})
		return
	}
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error de servidor"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Credenciales incorrectas"})
		return
	}

	token, err := makeToken(user.ID, input.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al generar token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": user.ID, "email": input.Email, "role": user.Role},
	})
}
