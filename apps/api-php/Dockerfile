FROM php:8.3-cli AS development

RUN apt-get update && apt-get install -y \
        libpq-dev zip git unzip supervisor \
    && docker-php-ext-install pdo pdo_pgsql \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock* ./
RUN composer install --no-scripts --no-autoloader 2>/dev/null || composer install --no-scripts

COPY . .
RUN composer dump-autoload --optimize

RUN cp .env.example .env 2>/dev/null || true

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf"]
