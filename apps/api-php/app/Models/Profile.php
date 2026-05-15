<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Profile extends Model
{
    protected $table = 'profiles';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'user_id', 'name', 'bio', 'avatar_url', 'phone', 'whatsapp',
        'telegram', 'city', 'country', 'instagram_url', 'facebook_url',
        'show_phone', 'show_whatsapp', 'show_instagram', 'show_facebook',
    ];

    protected $casts = [
        'show_phone'     => 'boolean',
        'show_whatsapp'  => 'boolean',
        'show_instagram' => 'boolean',
        'show_facebook'  => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
