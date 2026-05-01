package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/pedrodonoso/kawin/api/internal/db"
)

type adminWorkshopRow struct {
	ID                string  `gorm:"column:id"                json:"id"`
	Title             string  `gorm:"column:title"             json:"title"`
	Slug              string  `gorm:"column:slug"              json:"slug"`
	Description       string  `gorm:"column:description"       json:"description"`
	Type              string  `gorm:"column:type"              json:"type"`
	Modality          string  `gorm:"column:modality"          json:"modality"`
	Price             float64 `gorm:"column:price"             json:"price"`
	Currency          string  `gorm:"column:currency"          json:"currency"`
	Capacity          *int    `gorm:"column:capacity"          json:"capacity"`
	Location          string  `gorm:"column:location"          json:"location"`
	OnlineURL         string  `gorm:"column:online_url"        json:"online_url"`
	CoverImageURL     string  `gorm:"column:cover_image_url"   json:"cover_image_url"`
	Status            string  `gorm:"column:status"            json:"status"`
	ApprovalStatus    string  `gorm:"column:approval_status"   json:"approval_status"`
	AdminObservations string  `gorm:"column:admin_observations" json:"admin_observations"`
	ReviewedAt        string  `gorm:"column:reviewed_at"       json:"reviewed_at"`
	CreatedAt         string  `gorm:"column:created_at"        json:"created_at"`
	CategoryID        string  `gorm:"column:category_id"       json:"category_id"`
	CategoryName      string  `gorm:"column:category_name"     json:"category_name"`
	InstructorID      string  `gorm:"column:instructor_id"     json:"instructor_id"`
	InstructorName    string  `gorm:"column:instructor_name"   json:"instructor_name"`
	InstructorEmail   string  `gorm:"column:instructor_email"  json:"instructor_email"`
}

// GetAdminWorkshops returns all workshops, optionally filtered by approval_status.
// GET /api/v1/admin/workshops?status=pending_review
func GetAdminWorkshops(c *gin.Context) {
	filter := c.Query("status") // pending_review | approved | changes_requested | not_submitted | "" (all)

	query := `
		SELECT w.id, w.title, w.slug, COALESCE(w.description,'') as description,
		       w.type, w.modality, w.price, w.currency,
		       w.capacity, COALESCE(w.location,'') as location,
		       COALESCE(w.online_url,'') as online_url,
		       COALESCE(w.cover_image_url,'') as cover_image_url,
		       w.status, w.approval_status,
		       COALESCE(w.admin_observations,'') as admin_observations,
		       COALESCE(w.reviewed_at::text,'') as reviewed_at,
		       COALESCE(w.created_at::text,'') as created_at,
		       COALESCE(c.id::text,'') as category_id,
		       COALESCE(c.name,'') as category_name,
		       w.instructor_id::text as instructor_id,
		       COALESCE(p.name,'') as instructor_name,
		       COALESCE(u.email,'') as instructor_email
		FROM workshops w
		LEFT JOIN categories c ON c.id = w.category_id
		LEFT JOIN profiles p ON p.user_id = w.instructor_id
		LEFT JOIN users u ON u.id = w.instructor_id
		WHERE w.status != 'archived'`

	args := []any{}
	if filter != "" {
		query += " AND w.approval_status = ?"
		args = append(args, filter)
	}
	query += " ORDER BY w.created_at DESC"

	var rows []adminWorkshopRow
	if err := db.DB.Raw(query, args...).Scan(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al obtener talleres"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": rows})
}

type reviewInput struct {
	Action       string `json:"action" binding:"required"` // "approve" | "send_observations"
	Observations string `json:"observations"`
}

// ReviewWorkshop handles admin approval or sends observations to instructor.
// POST /api/v1/admin/workshops/:id/review
func ReviewWorkshop(c *gin.Context) {
	adminID, _ := c.Get("userID")
	workshopID := c.Param("id")

	var input reviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	var exists bool
	db.DB.Raw(`SELECT true FROM workshops WHERE id = ? AND status != 'archived'`, workshopID).Scan(&exists)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	now := time.Now()

	switch input.Action {
	case "approve":
		result := db.DB.Exec(`
			UPDATE workshops
			SET approval_status    = 'approved',
			    status             = 'published',
			    admin_observations = NULL,
			    reviewed_by        = ?,
			    reviewed_at        = ?,
			    updated_at         = NOW()
			WHERE id = ?`,
			adminID, now, workshopID,
		)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al aprobar: " + result.Error.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": workshopID, "approval_status": "approved", "status": "published"}})

	case "send_observations":
		if input.Observations == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Las observaciones no pueden estar vacías"})
			return
		}
		result := db.DB.Exec(`
			UPDATE workshops
			SET approval_status    = 'changes_requested',
			    admin_observations = ?,
			    reviewed_by        = ?,
			    reviewed_at        = ?,
			    updated_at         = NOW()
			WHERE id = ?`,
			input.Observations, adminID, now, workshopID,
		)
		if result.Error != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al enviar observaciones: " + result.Error.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": workshopID, "approval_status": "changes_requested"}})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"message": "Acción inválida. Use 'approve' o 'send_observations'"})
	}
}

type adminUpdateWorkshopInput struct {
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description"`
	Modality    string  `json:"modality" binding:"required"`
	Price       float64 `json:"price"`
	Currency    string  `json:"currency"`
	Capacity    *int    `json:"capacity"`
	Location    string  `json:"location"`
	OnlineURL   string  `json:"online_url"`
	CategoryID  string  `json:"category_id"`
}

// GetAdminStats returns platform-level business metrics.
// GET /api/v1/admin/stats
func GetAdminStats(c *gin.Context) {
	var stats struct {
		TotalWorkshops     int64   `json:"total_workshops"`
		PublishedWorkshops int64   `json:"published_workshops"`
		DraftWorkshops     int64   `json:"draft_workshops"`
		PendingReview      int64   `json:"pending_review"`
		ChangesRequested   int64   `json:"changes_requested"`
		TotalInstructors   int64   `json:"total_instructors"`
		TotalStudents      int64   `json:"total_students"`
		TotalBookings      int64   `json:"total_bookings"`
		ConfirmedBookings  int64   `json:"confirmed_bookings"`
		CancelledBookings  int64   `json:"cancelled_bookings"`
		TotalRevenue       float64 `json:"total_revenue"`
		PlatformCommission float64 `json:"platform_commission"`
	}

	db.DB.Raw(`SELECT COUNT(*) FROM workshops WHERE status != 'archived'`).Scan(&stats.TotalWorkshops)
	db.DB.Raw(`SELECT COUNT(*) FROM workshops WHERE status = 'published'`).Scan(&stats.PublishedWorkshops)
	db.DB.Raw(`SELECT COUNT(*) FROM workshops WHERE status = 'draft'`).Scan(&stats.DraftWorkshops)
	db.DB.Raw(`SELECT COUNT(*) FROM workshops WHERE approval_status = 'pending_review'`).Scan(&stats.PendingReview)
	db.DB.Raw(`SELECT COUNT(*) FROM workshops WHERE approval_status = 'changes_requested'`).Scan(&stats.ChangesRequested)
	db.DB.Raw(`SELECT COUNT(*) FROM users WHERE role IN ('instructor','both')`).Scan(&stats.TotalInstructors)
	db.DB.Raw(`SELECT COUNT(*) FROM users WHERE role IN ('student','both')`).Scan(&stats.TotalStudents)
	db.DB.Raw(`SELECT COUNT(*) FROM bookings`).Scan(&stats.TotalBookings)
	db.DB.Raw(`SELECT COUNT(*) FROM bookings WHERE status = 'confirmed'`).Scan(&stats.ConfirmedBookings)
	db.DB.Raw(`SELECT COUNT(*) FROM bookings WHERE status = 'cancelled'`).Scan(&stats.CancelledBookings)
	db.DB.Raw(`SELECT COALESCE(SUM(amount),0) FROM bookings WHERE status = 'confirmed'`).Scan(&stats.TotalRevenue)
	db.DB.Raw(`SELECT COALESCE(SUM(commission),0) FROM bookings WHERE status = 'confirmed'`).Scan(&stats.PlatformCommission)

	c.JSON(http.StatusOK, gin.H{"data": stats})
}

// UpdateWorkshopAdmin lets an admin edit any workshop's content fields.
// PUT /api/v1/admin/workshops/:id
func UpdateWorkshopAdmin(c *gin.Context) {
	workshopID := c.Param("id")

	var input adminUpdateWorkshopInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	if input.Currency == "" {
		input.Currency = "CLP"
	}

	var catID *string
	if input.CategoryID != "" {
		catID = &input.CategoryID
	}

	result := db.DB.Exec(`
		UPDATE workshops
		SET title=?, description=?, modality=?,
		    price=?, currency=?, capacity=?, location=?,
		    online_url=?, category_id=?, updated_at=NOW()
		WHERE id=? AND status != 'archived'`,
		input.Title, input.Description, input.Modality,
		input.Price, input.Currency, input.Capacity, input.Location,
		input.OnlineURL, catID, workshopID,
	)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Error al actualizar: " + result.Error.Error()})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"message": "Taller no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"id": workshopID}})
}
