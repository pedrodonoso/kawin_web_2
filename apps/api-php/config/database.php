<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),

    'connections' => [
        'pgsql' => [
            'driver'   => 'pgsql',
            'host'     => env('DB_HOST', 'db'),
            'port'     => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'kawin'),
            'username' => env('DB_USERNAME', 'kawin'),
            'password' => env('DB_PASSWORD', 'kawin'),
            'charset'  => 'utf8',
            'encoding' => 'UTF8',
            'prefix'   => '',
            'schema'   => 'public',
            'sslmode'  => 'prefer',
        ],
    ],

    'migrations' => 'migrations',

    'redis' => [
        'client' => env('REDIS_CLIENT', 'predis'),

        'default' => [
            'host'     => env('REDIS_HOST', 'redis'),
            'password' => env('REDIS_PASSWORD', null),
            'port'     => env('REDIS_PORT', 6379),
            'database' => 0,
        ],

        'cache' => [
            'host'     => env('REDIS_HOST', 'redis'),
            'password' => env('REDIS_PASSWORD', null),
            'port'     => env('REDIS_PORT', 6379),
            'database' => 1,
        ],
    ],
];
