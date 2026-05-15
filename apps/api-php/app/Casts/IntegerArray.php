<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class IntegerArray implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null) {
            return [];
        }
        $value = trim((string) $value, '{}');
        if ($value === '') {
            return [];
        }
        return array_map('intval', explode(',', $value));
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if (is_array($value)) {
            return '{' . implode(',', array_map('intval', $value)) . '}';
        }
        return is_string($value) ? $value : '{}';
    }
}
