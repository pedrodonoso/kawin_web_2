<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Session extends Model
{
    protected $table = 'sessions';
    public $incrementing = false;
    protected $keyType = 'string';
    const UPDATED_AT = null;

    protected $fillable = [
        'workshop_id', 'schedule_id', 'starts_at', 'ends_at',
        'cancelled', 'notes', 'online_url',
    ];

    protected $casts = [
        'cancelled' => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(Schedule::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function scopeNotCancelled(Builder $query): Builder
    {
        return $query->where('cancelled', false);
    }

    public function scopeVirtual(Builder $query): Builder
    {
        return $query->whereNotNull('schedule_id');
    }

    public function scopeManual(Builder $query): Builder
    {
        return $query->whereNull('schedule_id');
    }

    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('ends_at', '>=', now('America/Santiago'));
    }
}
