<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Workshop extends Model
{
    protected $table      = 'workshops';
    protected $keyType    = 'string';
    public    $incrementing = false;

    protected $fillable = [
        'instructor_id', 'category_id', 'title', 'slug', 'description',
        'type', 'modality', 'price', 'currency', 'capacity',
        'location', 'address', 'lat', 'lng', 'online_url', 'notes', 'cover_image_url',
        'status', 'approval_status', 'admin_observations',
        'pending_changes', 'reviewed_by', 'reviewed_at',
    ];

    protected $casts = [
        'pending_changes' => 'array',
        'price'           => 'integer',
        'lat'             => 'float',
        'lng'             => 'float',
    ];

    /** Transient context passed to observers — never persisted. */
    public ?array $notifyContext = null;

    protected static function boot(): void
    {
        parent::boot();
        static::creating(function (self $model) {
            if (empty($model->id)) {
                $model->id = (string) Str::uuid();
            }
        });
    }
}
