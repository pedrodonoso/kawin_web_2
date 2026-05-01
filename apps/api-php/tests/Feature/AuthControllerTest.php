<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AuthControllerTest extends TestCase
{
    protected function tearDown(): void
    {
        \Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // Register
    // -----------------------------------------------------------------------

    /** @test */
    public function register_returns_201_with_token_and_user(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO users'))
            ->andReturn((object)['id' => 'uuid-new-user']);

        DB::shouldReceive('insert')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO profiles'));

        $this->json('POST', '/api/v1/auth/register', [
            'name'     => 'Ana García',
            'email'    => 'ana@kawin.app',
            'password' => 'password123',
            'role'     => 'instructor',
        ]);

        $this->assertResponseStatus(201);
        $data = json_decode($this->response->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertSame('instructor', $data['user']['role']);
    }

    /** @test */
    public function register_returns_409_on_duplicate_email(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO users'))
            ->andThrow(new \Exception('duplicate key'));

        $this->json('POST', '/api/v1/auth/register', [
            'name'     => 'Ana García',
            'email'    => 'ana@kawin.app',
            'password' => 'password123',
        ]);

        $this->assertResponseStatus(409);
        $this->assertStringContainsString('registrado', $this->response->getContent());
    }

    /** @test */
    public function register_returns_422_when_required_fields_missing(): void
    {
        $this->json('POST', '/api/v1/auth/register', [
            'email' => 'ana@kawin.app',
        ]);

        $this->assertResponseStatus(422);
    }

    // -----------------------------------------------------------------------
    // Login
    // -----------------------------------------------------------------------

    /** @test */
    public function login_returns_200_with_token_on_valid_credentials(): void
    {
        $hash = password_hash('secret123', PASSWORD_BCRYPT);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'SELECT id, password_hash'))
            ->andReturn((object)[
                'id'            => 'uuid-user-1',
                'password_hash' => $hash,
                'role'          => 'student',
            ]);

        $this->json('POST', '/api/v1/auth/login', [
            'email'    => 'carlos@kawin.app',
            'password' => 'secret123',
        ]);

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertArrayHasKey('token', $data);
        $this->assertSame('student', $data['user']['role']);
    }

    /** @test */
    public function login_returns_401_on_wrong_password(): void
    {
        $hash = password_hash('correct-password', PASSWORD_BCRYPT);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'SELECT id, password_hash'))
            ->andReturn((object)[
                'id'            => 'uuid-user-1',
                'password_hash' => $hash,
                'role'          => 'student',
            ]);

        $this->json('POST', '/api/v1/auth/login', [
            'email'    => 'carlos@kawin.app',
            'password' => 'wrong-password',
        ]);

        $this->assertResponseStatus(401);
    }

    /** @test */
    public function login_returns_401_when_user_not_found(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'SELECT id, password_hash'))
            ->andReturn(null);

        $this->json('POST', '/api/v1/auth/login', [
            'email'    => 'noexiste@kawin.app',
            'password' => 'password123',
        ]);

        $this->assertResponseStatus(401);
    }
}
