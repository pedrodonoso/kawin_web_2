<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $table = 'categories';
    public $incrementing = false;
    protected $keyType = 'string';
    const UPDATED_AT = null;

    protected $fillable = ['name', 'slug', 'icon', 'description'];

    public function workshops(): HasMany
    {
        return $this->hasMany(Workshop::class);
    }
}
