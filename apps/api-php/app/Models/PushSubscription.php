<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushSubscription extends Model
{
    protected $table = 'push_subscriptions';
    public $incrementing = false;
    protected $keyType = 'string';
    const UPDATED_AT = null;

    protected $fillable = ['user_id', 'endpoint', 'p256dh', 'auth'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
