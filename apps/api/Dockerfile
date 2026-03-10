# Development stage
FROM golang:1.24-alpine AS development
WORKDIR /app
RUN go install github.com/air-verse/air@v1.61.7
COPY go.mod ./
RUN go mod tidy || true
COPY . .
RUN go mod tidy
CMD ["air", "-c", ".air.toml"]

# Build stage
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod ./
COPY . .
RUN go mod tidy
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o api ./cmd/main.go

# Production stage
FROM alpine:3.20 AS production
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/api .
EXPOSE 8080
CMD ["./api"]
