package models

import (
	"database/sql/driver"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// IntArray maps to PostgreSQL integer[] via lib/pq.
type IntArray []int

func (a IntArray) Value() (driver.Value, error) {
	return pq.Array([]int(a)).Value()
}

func (a *IntArray) Scan(src any) error {
	var tmp []int64
	if err := pq.Array(&tmp).Scan(src); err != nil {
		return fmt.Errorf("IntArray.Scan: %w", err)
	}
	*a = make(IntArray, len(tmp))
	for i, v := range tmp {
		(*a)[i] = int(v)
	}
	return nil
}

// User maps to the users table.
// No gorm.Model — the table uses UUID PKs and no DeletedAt.
type User struct {
	ID           string    `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email        string    `gorm:"uniqueIndex;not null"`
	PasswordHash string    `gorm:"column:password_hash;not null"`
	Role         string    `gorm:"not null;default:'student'"`
	CreatedAt    time.Time `gorm:"autoCreateTime"`
}

// Profile maps to the profiles table.
type Profile struct {
	ID           string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	UserID       string     `gorm:"type:uuid;not null;uniqueIndex;column:user_id"`
	Name         string
	Bio          string
	Phone        string
	Whatsapp     string
	InstagramURL string     `gorm:"column:instagram_url"`
	FacebookURL  string     `gorm:"column:facebook_url"`
	UpdatedAt    *time.Time `gorm:"autoUpdateTime"`
}

// Category maps to the categories table.
type Category struct {
	ID          string `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Name        string `gorm:"not null"`
	Slug        string `gorm:"uniqueIndex;not null"`
	Icon        string
	Description string
}

// Workshop maps to the workshops table.
type Workshop struct {
	ID                 string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	InstructorID       string     `gorm:"type:uuid;not null;column:instructor_id"`
	CategoryID         *string    `gorm:"type:uuid;column:category_id"`
	Title              string     `gorm:"not null"`
	Slug               string     `gorm:"uniqueIndex;not null"`
	Description        string
	Type               string     `gorm:"not null"`
	Modality           string     `gorm:"not null"`
	Price              float64    `gorm:"not null;default:0"`
	Currency           string     `gorm:"not null;default:'CLP'"`
	Capacity           *int
	Location           string
	OnlineURL          string     `gorm:"column:online_url"`
	CoverImageURL      string     `gorm:"column:cover_image_url"`
	Status             string     `gorm:"not null;default:'draft'"`
	ApprovalStatus     string     `gorm:"column:approval_status;not null;default:'not_submitted'"`
	AdminObservations  *string    `gorm:"column:admin_observations"`
	ReviewedBy         *string    `gorm:"type:uuid;column:reviewed_by"`
	ReviewedAt         *time.Time `gorm:"column:reviewed_at"`
	CreatedAt          time.Time  `gorm:"autoCreateTime"`
	UpdatedAt          *time.Time `gorm:"autoUpdateTime"`
}

// Schedule maps to the schedules table.
type Schedule struct {
	ID          string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	WorkshopID  string     `gorm:"type:uuid;not null;column:workshop_id"`
	DaysOfWeek  IntArray   `gorm:"type:integer[];column:days_of_week;not null"`
	TimeStart   string     `gorm:"type:time;column:time_start;not null"`
	DurationMin int        `gorm:"column:duration_min;not null;default:60"`
	ValidFrom   time.Time  `gorm:"type:date;column:valid_from;not null"`
	ValidUntil  *time.Time `gorm:"type:date;column:valid_until"`
	CreatedAt   time.Time  `gorm:"autoCreateTime"`
}

// Session maps to the sessions table.
type Session struct {
	ID         string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	WorkshopID string     `gorm:"type:uuid;not null;column:workshop_id"`
	ScheduleID *string    `gorm:"type:uuid;column:schedule_id"`
	StartsAt   time.Time  `gorm:"column:starts_at;not null"`
	EndsAt     *time.Time `gorm:"column:ends_at"`
	Cancelled  bool       `gorm:"not null;default:false"`
	Notes      string
}

// Discount maps to the discounts table.
type Discount struct {
	ID         string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	WorkshopID string     `gorm:"type:uuid;not null;column:workshop_id"`
	SessionID  *string    `gorm:"type:uuid;column:session_id"`
	Type       string     `gorm:"not null"`        // "percent" | "flat"
	Value      float64    `gorm:"not null"`
	Label      string     `gorm:"not null;default:''"`
	MaxUses    *int       `gorm:"column:max_uses"`
	UsesCount  int        `gorm:"column:uses_count;not null;default:0"`
	Active     bool       `gorm:"not null;default:true"`
	ValidFrom  *time.Time `gorm:"column:valid_from"`
	ValidUntil *time.Time `gorm:"column:valid_until"`
	CreatedAt  time.Time  `gorm:"autoCreateTime"`
}

// Booking maps to the bookings table.
type Booking struct {
	ID                    string     `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	StudentID             string     `gorm:"type:uuid;not null;column:student_id"`
	WorkshopID            string     `gorm:"type:uuid;not null;column:workshop_id"`
	SessionID             *string    `gorm:"type:uuid;column:session_id"`
	Status                string     `gorm:"not null;default:'pending'"`
	PaymentStatus         string     `gorm:"column:payment_status;not null;default:'pending'"`
	Amount                float64    `gorm:"not null;default:0"`
	Commission            float64    `gorm:"not null;default:0"`
	CommissionAbsorbedBy  *string    `gorm:"column:commission_absorbed_by"`
	CancelledReason       *string    `gorm:"column:cancelled_reason"`
	MigratedFromSessionID *string    `gorm:"type:uuid;column:migrated_from_session_id"`
	CreatedAt             time.Time  `gorm:"autoCreateTime"`
}
