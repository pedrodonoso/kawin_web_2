<?php

namespace Tests;

use Firebase\JWT\JWT;
use Laravel\Lumen\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function createApplication()
    {
        return require __DIR__ . '/../bootstrap/app.php';
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /**
     * Generate a signed JWT identical to what AuthController produces.
     */
    protected function makeToken(
        string $userId  = 'aaaaaaaa-0000-0000-0000-000000000001',
        string $email   = 'test@kawin.app',
        string $role    = 'instructor'
    ): string {
        $payload = [
            'sub'   => $userId,
            'email' => $email,
            'role'  => $role,
            'exp'   => time() + 3600,
        ];
        return JWT::encode($payload, env('API_SECRET', 'test-secret-key'), 'HS256');
    }

    /**
     * Return headers array with a valid Bearer token.
     */
    protected function authHeaders(
        string $userId = 'aaaaaaaa-0000-0000-0000-000000000001',
        string $role   = 'instructor'
    ): array {
        return ['Authorization' => 'Bearer ' . $this->makeToken($userId, 'test@kawin.app', $role)];
    }
}
