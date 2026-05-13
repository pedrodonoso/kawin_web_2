<?php

/** @var \Laravel\Lumen\Routing\Router $router */

// Health check
$router->get('/health', function () {
    return response()->json(['status' => 'ok', 'service' => 'kawin-api-php']);
});

$router->group(['prefix' => 'api/v1'], function () use ($router) {

    // -------------------------------------------------------------------------
    // Public routes
    // -------------------------------------------------------------------------

    $router->get('/categories',      'CategoryController@index');
    $router->get('/workshops',        'WorkshopController@index');
    $router->get('/workshops/{id}',   'WorkshopController@show');

    $router->post('/auth/register',   'AuthController@register');
    $router->post('/auth/login',      'AuthController@login');

    // Public instructor profile
    $router->get('/instructors/{id}/profile', 'ProfileController@publicShow');

    // Active discounts for a workshop (public — no auth needed)
    $router->get('/workshops/{id}/active-discounts', 'DiscountController@publicDiscounts');

    // -------------------------------------------------------------------------
    // Protected routes (require JWT)
    // -------------------------------------------------------------------------

    $router->group(['middleware' => 'auth'], function () use ($router) {

        // Profile
        $router->get('/my-profile',  'ProfileController@show');
        $router->put('/my-profile',  'ProfileController@update');

        // My workshops (instructor)
        $router->get('/my-workshops',          'WorkshopWriteController@index');
        $router->get('/my-workshops/{id}',     'WorkshopWriteController@show');
        $router->post('/workshops',            'WorkshopWriteController@store');
        $router->put('/workshops/{id}',        'WorkshopWriteController@update');
        $router->delete('/workshops/{id}',     'WorkshopWriteController@destroy');
        $router->post('/my-workshops/{id}/submit-review', 'WorkshopWriteController@submitForReview');

        // Schedules
        $router->post('/workshops/{id}/schedules',         'ScheduleController@store');
        $router->get('/workshops/{id}/schedules',          'ScheduleController@index');
        $router->put('/schedules/{id}',                    'ScheduleController@update');
        $router->delete('/schedules/{id}',                 'ScheduleController@destroy');
        // community: affected-bookings and bulk-action disabled (no bookings in this version)
        // $router->get('/schedules/{id}/affected-bookings',  'ScheduleController@affectedBookings');
        // $router->post('/schedules/{id}/bulk-action',       'ScheduleController@bulkAction');

        // Sessions
        $router->get('/workshops/{id}/available-slots', 'WorkshopController@availableSlots');
        $router->post('/sessions/materialize',          'SessionController@materialize');
        $router->post('/sessions/cancel',               'SessionController@cancel');
        $router->post('/sessions/{id}/reactivate',      'SessionController@reactivate');
        $router->patch('/sessions/{id}/url',            'SessionController@updateUrl');

        // Bookings — disabled in community version
        // $router->post('/bookings',                  'BookingController@store');
        // $router->get('/my-bookings',                'BookingController@myBookings');
        // $router->post('/bookings/{id}/cancel',      'BookingController@cancel');
        // $router->post('/bookings/{id}/migrate',     'BookingController@migrate');
        // $router->post('/bookings/{id}/refund',      'BookingController@refund');
        $router->get('/instructor-bookings',        'BookingController@instructorBookings');

        // Discounts
        $router->get('/workshops/{id}/discounts',  'DiscountController@index');
        $router->post('/workshops/{id}/discounts', 'DiscountController@store');
        $router->put('/discounts/{id}',            'DiscountController@update');
        $router->delete('/discounts/{id}',         'DiscountController@destroy');

        // Instructor stats
        $router->get('/instructor/stats', 'InstructorStatsController@stats');

        // In-app notifications
        $router->get('/my-notifications',               'NotificationController@index');
        $router->post('/notifications/{id}/read',       'NotificationController@markAsRead');
        $router->post('/notifications/read-all',        'NotificationController@markAllAsRead');

        // Web Push subscriptions
        $router->post('/push/subscribe',                'PushSubscriptionController@subscribe');
        $router->delete('/push/subscribe',              'PushSubscriptionController@unsubscribe');

        // WebSocket channel auth (Soketi/Pusher private channels)
        $router->post('/broadcasting/auth',             'BroadcastingController@auth');

        // -----------------------------------------------------------------------
        // Admin-only routes
        // -----------------------------------------------------------------------

        $router->group(['prefix' => 'admin', 'middleware' => 'admin'], function () use ($router) {
            $router->get('/stats',                  'AdminController@stats');
            $router->get('/workshops',                          'AdminController@workshops');
            $router->get('/workshops/{id}',                     'AdminController@getWorkshop');
            $router->put('/workshops/{id}',                     'AdminController@updateWorkshop');
            $router->post('/workshops/{id}/review',             'AdminController@review');
            $router->patch('/workshops/{id}/guest-contact',     'AdminController@setWorkshopGuestContact');

            $router->get('/guest-contacts',             'GuestContactController@index');
            $router->get('/guest-contacts/{id}',        'GuestContactController@show');
            $router->post('/guest-contacts',            'GuestContactController@store');
            $router->put('/guest-contacts/{id}',        'GuestContactController@update');
            $router->delete('/guest-contacts/{id}',     'GuestContactController@destroy');
        });
    });
});
