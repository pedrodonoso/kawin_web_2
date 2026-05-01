package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AdminOnly rejects requests whose JWT role is not "admin".
// Must be used after Auth().
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		if role != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"message": "Acceso restringido a administradores"})
			return
		}
		c.Next()
	}
}
