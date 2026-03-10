package handlers

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/pedrodonoso/kawin/api/internal/db"
	"golang.org/x/crypto/bcrypt"
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

	var userID string
	err = db.Pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
		input.Email, string(hash), role,
	).Scan(&userID)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"message": "El email ya está registrado"})
		return
	}

	// Create profile
	db.Pool.Exec(context.Background(),
		`INSERT INTO profiles (user_id, name) VALUES ($1, $2)`,
		userID, input.Name,
	)

	token, err := makeToken(userID, input.Email, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al generar token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"token": token,
		"user":  gin.H{"id": userID, "email": input.Email, "role": role},
	})
}

func Login(c *gin.Context) {
	var input loginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var userID, passwordHash, role string
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, password_hash, role FROM users WHERE email = $1`,
		input.Email,
	).Scan(&userID, &passwordHash, &role)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Credenciales incorrectas"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error de servidor"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Credenciales incorrectas"})
		return
	}

	token, err := makeToken(userID, input.Email, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al generar token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user":  gin.H{"id": userID, "email": input.Email, "role": role},
	})
}
