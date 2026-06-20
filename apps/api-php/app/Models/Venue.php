<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Venue extends Model
{
    protected $table      = 'venues';
    protected $keyType    = 'string';
    public    $incrementing = false;

    protected $fillable = [
        'created_by', 'name', 'slug', 'description', 'address',
        'city', 'country', 'lat', 'lng', 'cover_image_url',
        'phone', 'whatsapp', 'instagram_url', 'facebook_url', 'website',
        'status',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
    ];

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
