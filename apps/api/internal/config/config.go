package config

import "os"

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	APISecret   string
	Env         string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://kawin:kawin@localhost:5432/kawin?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		APISecret:   getEnv("API_SECRET", "dev-secret"),
		Env:         getEnv("GO_ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
