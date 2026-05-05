<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Booking extends Model
{
    protected $table      = 'bookings';
    protected $keyType    = 'string';
    public    $incrementing = false;

    protected $fillable = [
        'student_id', 'workshop_id', 'session_id',
        'status', 'payment_status', 'amount', 'commission',
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

    public function workshop()
    {
        return $this->belongsTo(Workshop::class);
    }
}
