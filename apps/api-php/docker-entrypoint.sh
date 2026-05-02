#!/bin/sh
set -e

# Generate APP_KEY if not provided (Railway env var takes precedence)
if [ -z "$APP_KEY" ]; then
  echo "[entrypoint] WARNING: APP_KEY not set — generating ephemeral key"
  APP_KEY=$(php artisan key:generate --show)
  export APP_KEY
fi

# Write minimal .env so Artisan commands work (Railway injects real vars via environment)
cat > /app/.env <<EOF
APP_NAME=${APP_NAME:-KawinAPI}
APP_ENV=${APP_ENV:-production}
APP_KEY=${APP_KEY}
APP_DEBUG=${APP_DEBUG:-false}
APP_URL=${APP_URL:-http://localhost}

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE}
DB_USERNAME=${DB_USERNAME}
DB_PASSWORD=${DB_PASSWORD}

CACHE_DRIVER=${CACHE_DRIVER:-file}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-sync}

REDIS_HOST=${REDIS_HOST:-127.0.0.1}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-null}

MAIL_MAILER=${MAIL_MAILER:-log}
MAIL_HOST=${MAIL_HOST:-localhost}
MAIL_PORT=${MAIL_PORT:-25}
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-noreply@kawin.app}
MAIL_FROM_NAME="${MAIL_FROM_NAME:-Kawin}"

API_SECRET=${API_SECRET}

PUSHER_APP_ID=${PUSHER_APP_ID:-}
PUSHER_APP_KEY=${PUSHER_APP_KEY:-}
PUSHER_APP_SECRET=${PUSHER_APP_SECRET:-}
PUSHER_HOST=${PUSHER_HOST:-}
PUSHER_PORT=${PUSHER_PORT:-443}

VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-}
VAPID_SUBJECT=${VAPID_SUBJECT:-mailto:noreply@kawin.app}
EOF

php artisan config:cache
php artisan route:cache

echo "[entrypoint] Running migrations..."
php artisan migrate --force

echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -c /app/supervisord.conf
