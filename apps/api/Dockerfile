# Development stage
FROM golang:1.23-alpine AS development
WORKDIR /app
RUN go install github.com/air-verse/air@latest
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
CMD ["air", "-c", ".air.toml"]

# Build stage
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api ./cmd/main.go

# Production stage
FROM alpine:3.20 AS production
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/api .
EXPOSE 8080
CMD ["./api"]
