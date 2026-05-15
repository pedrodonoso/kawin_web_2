<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Discount extends Model
{
    protected $table = 'discounts';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'workshop_id', 'session_id', 'type', 'value', 'label',
        'max_uses', 'uses_count', 'active', 'valid_from', 'valid_until',
    ];

    protected $casts = [
        'value'      => 'float',
        'max_uses'   => 'integer',
        'uses_count' => 'integer',
        'active'     => 'boolean',
    ];

    public function workshop(): BelongsTo
    {
        return $this->belongsTo(Workshop::class);
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(Session::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query
            ->where('active', true)
            ->where(fn($q) => $q->whereNull('max_uses')->orWhereColumn('uses_count', '<', 'max_uses'))
            ->where(fn($q) => $q->whereNull('valid_from')->orWhere('valid_from', '<=', now()))
            ->where(fn($q) => $q->whereNull('valid_until')->orWhere('valid_until', '>=', now()));
    }
}
