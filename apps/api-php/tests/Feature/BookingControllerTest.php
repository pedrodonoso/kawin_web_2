<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BookingControllerTest extends TestCase
{
    private string $instructorId = 'aaaaaaaa-0000-0000-0000-000000000001';
    private string $studentId    = 'bbbbbbbb-0000-0000-0000-000000000002';
    private string $workshopId   = 'cccccccc-0000-0000-0000-000000000003';
    private string $sessionId    = 'dddddddd-0000-0000-0000-000000000004';
    private string $bookingId    = 'eeeeeeee-0000-0000-0000-000000000005';

    protected function setUp(): void
    {
        parent::setUp();
        // Evitar que las notificaciones reales se intenten despachar
        Notification::fake();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow(null);
        \Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/bookings — taller tipo "workshop" (sin sesión)
    // -----------------------------------------------------------------------

    /** @test */
    public function create_booking_for_workshop_type_returns_201(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)[
                'type'          => 'workshop',
                'price'         => 10000.0,
                'capacity'      => null,
                'instructor_id' => $this->instructorId,
            ]);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO bookings'))
            ->andReturn((object)['id' => $this->bookingId]);

        // notifyInstructor internals
        DB::shouldReceive('selectOne')->zeroOrMoreTimes()->andReturn(null);

        $this->json(
            'POST',
            '/api/v1/bookings',
            ['workshop_id' => $this->workshopId],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(201);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame($this->bookingId, $data['data']['id']);
        $this->assertSame('confirmed', $data['data']['status']);
        $this->assertEqualsWithDelta(1500.0, $data['data']['commission'], 0.01);
    }

    /** @test */
    public function create_booking_for_class_type_requires_session_id(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)[
                'type'          => 'class',
                'price'         => 5000.0,
                'capacity'      => 10,
                'instructor_id' => $this->instructorId,
            ]);

        $this->json(
            'POST',
            '/api/v1/bookings',
            ['workshop_id' => $this->workshopId],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(400);
        $this->assertStringContainsString('session_id', $this->response->getContent());
    }

    /** @test */
    public function create_booking_returns_409_when_class_is_full(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)[
                'type'          => 'class',
                'price'         => 5000.0,
                'capacity'      => 2,
                'instructor_id' => $this->instructorId,
            ]);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM sessions WHERE id'))
            ->andReturn((object)[
                'workshop_id' => $this->workshopId,
                'cancelled'   => false,
            ]);

        // Simula transacción + capacity check
        DB::shouldReceive('beginTransaction')->once();
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM bookings WHERE session_id'))
            ->andReturn((object)['cnt' => 2]); // lleno: cnt >= capacity

        DB::shouldReceive('rollBack')->once();

        $this->json(
            'POST',
            '/api/v1/bookings',
            ['workshop_id' => $this->workshopId, 'session_id' => $this->sessionId],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(409);
        $this->assertStringContainsString('cupos', $this->response->getContent());
    }

    /** @test */
    public function create_booking_returns_404_for_unpublished_workshop(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "status = 'published'"))
            ->andReturn(null);

        $this->json(
            'POST',
            '/api/v1/bookings',
            ['workshop_id' => 'nonexistent'],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(404);
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/bookings/:id/cancel
    // -----------------------------------------------------------------------

    /** @test */
    public function cancel_booking_by_student_sets_status_cancelled(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 12, 0, 0, 'UTC'));

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'b.student_id = ?'))
            ->andReturn((object)[
                'workshop_id'    => $this->workshopId,
                'status'         => 'confirmed',
                'payment_status' => 'pending',
                'starts_at_str'  => '2026-05-10', // próxima semana → platform
            ]);

        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "'student_request'"))
            ->andReturn(1);

        $this->json(
            'POST',
            "/api/v1/bookings/{$this->bookingId}/cancel",
            [],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame('cancelled', $data['data']['status']);
        $this->assertSame('student_request', $data['data']['cancelled_reason']);
        $this->assertSame('platform', $data['data']['commission_absorbed_by']);
    }

    /** @test */
    public function cancel_booking_returns_409_for_already_cancelled(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'b.student_id = ?'))
            ->andReturn((object)[
                'workshop_id'    => $this->workshopId,
                'status'         => 'cancelled',
                'payment_status' => 'refunded',
                'starts_at_str'  => '',
            ]);

        $this->json(
            'POST',
            "/api/v1/bookings/{$this->bookingId}/cancel",
            [],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(409);
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/my-bookings
    // -----------------------------------------------------------------------

    /** @test */
    public function my_bookings_returns_student_bookings(): void
    {
        DB::shouldReceive('select')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'b.student_id = ?'))
            ->andReturn([
                (object)[
                    'id'             => $this->bookingId,
                    'workshop_id'    => $this->workshopId,
                    'workshop_title' => 'Yoga',
                    'workshop_slug'  => 'yoga-123',
                    'session_id'     => null,
                    'status'         => 'confirmed',
                    'payment_status' => 'pending',
                    'amount'         => 5000.0,
                    'session_date'   => '',
                    'schedule_id'    => '',
                    'session_day'    => '',
                    'created_at'     => '2026-04-01',
                    'online_url'     => '',
                ],
            ]);

        $this->json(
            'GET',
            '/api/v1/my-bookings',
            [],
            $this->authHeaders($this->studentId, 'student')
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertCount(1, $data['data']);
        $this->assertSame('confirmed', $data['data'][0]['status']);
    }

    /** @test */
    public function my_bookings_requires_auth(): void
    {
        $this->json('GET', '/api/v1/my-bookings');
        $this->assertResponseStatus(401);
    }
}
