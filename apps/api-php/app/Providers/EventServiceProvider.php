<?php

namespace App\Providers;

use App\Models\Booking;
use App\Models\Workshop;
use App\Observers\BookingObserver;
use App\Observers\WorkshopObserver;
use Illuminate\Support\ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Workshop::observe(WorkshopObserver::class);
        Booking::observe(BookingObserver::class);
    }
}
