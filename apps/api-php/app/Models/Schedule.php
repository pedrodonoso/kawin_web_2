<?php

namespace App\Models;

use App\Casts\IntegerArray;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Schedule extends Model
{
    protected $table = 'schedules';
    public $incrementing = false;
    protected $keyType = 'string';
    const UPDATED_AT = null;

    protected $fillable = [
        'workshop_id', 'days_of_week', 'time_start',
        'duration_min', 'valid_from', 'valid_until',
    ];

    protected $casts = [
        'days_of_week' => IntegerArray::class,
        'duration_min' => 'integer',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(Session::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where(
            fn($q) => $q->whereNull('valid_until')->orWhere('valid_until', '>=', now()->format('Y-m-d'))
        );
    }
}
