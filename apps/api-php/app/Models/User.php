<?php

namespace App\Models;

use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    use Notifiable;

    protected $table      = 'users';
    public    $timestamps = false;
    protected $primaryKey = 'id';
    public    $incrementing = false;
    protected $keyType    = 'string';

    protected $fillable = ['id', 'email', 'role'];

    /**
     * Route notifications for the mail channel.
     * Used when MAIL channel is activated in the future.
     */
    public function routeNotificationForMail(): string
    {
        return $this->email ?? '';
    }
}
