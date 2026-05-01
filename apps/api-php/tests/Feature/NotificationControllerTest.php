<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class NotificationControllerTest extends TestCase
{
    private string $userId         = 'aaaaaaaa-0000-0000-0000-000000000001';
    private string $notificationId = '11111111-0000-0000-0000-000000000001';

    protected function tearDown(): void
    {
        \Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/my-notifications
    // -----------------------------------------------------------------------

    /** @test */
    public function index_returns_notifications_with_unread_count(): void
    {
        DB::shouldReceive('select')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM notifications'))
            ->andReturn([
                (object)[
                    'id'         => $this->notificationId,
                    'type'       => 'App\\Notifications\\NewBookingNotification',
                    'data'       => json_encode([
                        'type'           => 'new_booking',
                        'booking_id'     => 'booking-uuid',
                        'workshop_title' => 'Yoga',
                        'student_name'   => 'Carlos',
                        'amount'         => 5000,
                        'message'        => 'Carlos reservó "Yoga"',
                    ]),
                    'read_at'    => null,
                    'created_at' => '2026-04-26 10:00:00',
                ],
            ]);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'read_at IS NULL'))
            ->andReturn((object)['cnt' => 1]);

        $this->json(
            'GET',
            '/api/v1/my-notifications',
            [],
            $this->authHeaders($this->userId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertCount(1, $data['data']);
        $this->assertSame(1, $data['unread_count']);
        $this->assertFalse($data['data'][0]['is_read']);
        // data debe estar decodificado como array, no string
        $this->assertIsArray($data['data'][0]['data']);
        $this->assertSame('new_booking', $data['data'][0]['data']['type']);
    }

    /** @test */
    public function index_requires_auth(): void
    {
        $this->json('GET', '/api/v1/my-notifications');
        $this->assertResponseStatus(401);
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/notifications/:id/read
    // -----------------------------------------------------------------------

    /** @test */
    public function mark_as_read_updates_read_at(): void
    {
        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'SET read_at = NOW()'))
            ->andReturn(1);

        $this->json(
            'POST',
            "/api/v1/notifications/{$this->notificationId}/read",
            [],
            $this->authHeaders($this->userId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertTrue($data['data']['read']);
    }

    /** @test */
    public function mark_as_read_returns_200_even_if_already_read(): void
    {
        DB::shouldReceive('update')
            ->once()
            ->andReturn(0); // 0 affected = ya estaba leída

        $this->json(
            'POST',
            "/api/v1/notifications/{$this->notificationId}/read",
            [],
            $this->authHeaders($this->userId)
        );

        // Debe ser idempotente
        $this->assertResponseStatus(200);
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/notifications/read-all
    // -----------------------------------------------------------------------

    /** @test */
    public function mark_all_as_read_returns_count_of_affected(): void
    {
        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'read_at IS NULL'))
            ->andReturn(3);

        $this->json(
            'POST',
            '/api/v1/notifications/read-all',
            [],
            $this->authHeaders($this->userId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame(3, $data['data']['marked_read']);
    }
}
