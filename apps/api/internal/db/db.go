package db

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(databaseURL string) {
	var err error
	DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger:      logger.Default.LogMode(logger.Warn),
		PrepareStmt: true,
	})
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	log.Println("Database connected (GORM)")
}

func Close() {
	if DB == nil {
		return
	}
	sqlDB, err := DB.DB()
	if err == nil {
		_ = sqlDB.Close()
	}
}
