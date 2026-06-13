<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Los precios en Kawin se manejan en pesos chilenos (CLP), que no usan
 * decimales. La columna era NUMERIC(10,2), lo que hacía que PostgreSQL
 * serializara los valores como "65000.00". La convertimos a INTEGER.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            'ALTER TABLE workshops
                ALTER COLUMN price TYPE INTEGER USING round(price)::integer,
                ALTER COLUMN price SET DEFAULT 0'
        );
    }

    public function down(): void
    {
        DB::statement(
            'ALTER TABLE workshops
                ALTER COLUMN price TYPE NUMERIC(10,2) USING price::numeric(10,2),
                ALTER COLUMN price SET DEFAULT 0'
        );
    }
};
