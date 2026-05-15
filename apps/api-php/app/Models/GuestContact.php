<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GuestContact extends Model
{
    protected $table = 'guest_contacts';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'created_by', 'name', 'email', 'phone', 'whatsapp',
        'bio', 'instagram', 'website',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function workshops(): HasMany
    {
        return $this->hasMany(Workshop::class);
    }
}
