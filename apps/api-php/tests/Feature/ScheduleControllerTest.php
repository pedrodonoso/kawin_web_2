<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ScheduleControllerTest extends TestCase
{
    private string $instructorId = 'aaaaaaaa-0000-0000-0000-000000000001';
    private string $workshopId   = 'cccccccc-0000-0000-0000-000000000003';
    private string $scheduleId   = 'ffffffff-0000-0000-0000-000000000006';

    protected function tearDown(): void
    {
        Carbon::setTestNow(null);
        \Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/workshops/:id/schedules
    // -----------------------------------------------------------------------

    /** @test */
    public function create_schedule_returns_201_for_owner(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)['instructor_id' => $this->instructorId]);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO schedules'))
            ->andReturn((object)['id' => $this->scheduleId]);

        $this->json(
            'POST',
            "/api/v1/workshops/{$this->workshopId}/schedules",
            [
                'days_of_week' => [1, 3],   // lunes y miércoles
                'time_start'   => '18:00',
                'duration_min' => 60,
                'valid_from'   => '2026-05-01',
            ],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(201);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame($this->scheduleId, $data['data']['id']);
    }

    /** @test */
    public function create_schedule_returns_403_for_non_owner(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)['instructor_id' => 'otro-instructor-uuid']);

        $this->json(
            'POST',
            "/api/v1/workshops/{$this->workshopId}/schedules",
            ['days_of_week' => [1], 'time_start' => '18:00'],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(403);
    }

    /** @test */
    public function create_schedule_validates_days_of_week_range(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'FROM workshops WHERE id'))
            ->andReturn((object)['instructor_id' => $this->instructorId]);

        $this->json(
            'POST',
            "/api/v1/workshops/{$this->workshopId}/schedules",
            ['days_of_week' => [0, 7], 'time_start' => '18:00'], // 7 es inválido
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(400);
        $this->assertStringContainsString('days_of_week', $this->response->getContent());
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/schedules/:id  (soft-delete)
    // -----------------------------------------------------------------------

    /** @test */
    public function delete_schedule_soft_deletes_by_setting_valid_until(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'JOIN workshops'))
            ->andReturn((object)['instructor_id' => $this->instructorId]);

        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'valid_until = CURRENT_DATE'))
            ->andReturn(1);

        $this->json(
            'DELETE',
            "/api/v1/schedules/{$this->scheduleId}",
            [],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame($this->scheduleId, $data['data']['id']);
        $this->assertArrayNotHasKey('already_closed', $data['data']);
    }

    /** @test */
    public function delete_schedule_returns_already_closed_flag_when_already_deleted(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'JOIN workshops'))
            ->andReturn((object)['instructor_id' => $this->instructorId]);

        DB::shouldReceive('update')
            ->once()
            ->andReturn(0); // 0 rows affected = ya tenía valid_until

        $this->json(
            'DELETE',
            "/api/v1/schedules/{$this->scheduleId}",
            [],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertTrue($data['data']['already_closed']);
    }

    // -----------------------------------------------------------------------
    // PUT /api/v1/schedules/:id  (immutable update: cierra y crea nuevo)
    // -----------------------------------------------------------------------

    /** @test */
    public function update_schedule_closes_old_and_creates_new(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'owner_id'))
            ->andReturn((object)[
                'owner_id'    => $this->instructorId,
                'workshop_id' => $this->workshopId,
            ]);

        DB::shouldReceive('beginTransaction')->once();
        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'valid_until'))
            ->andReturn(1);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO schedules'))
            ->andReturn((object)['id' => 'new-schedule-id']);

        DB::shouldReceive('commit')->once();

        $this->json(
            'PUT',
            "/api/v1/schedules/{$this->scheduleId}",
            [
                'days_of_week' => [2, 4],
                'time_start'   => '19:00',
                'duration_min' => 90,
                'change_date'  => '2026-06-01',
            ],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame($this->scheduleId, $data['data']['old_schedule_id']);
        $this->assertSame('new-schedule-id', $data['data']['new_schedule_id']);
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/schedules/:id/affected-bookings
    // -----------------------------------------------------------------------

    /** @test */
    public function affected_bookings_returns_list_with_commission_zone(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 12, 0, 0, 'UTC'));

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'instructor_id'))
            ->andReturn((object)['instructor_id' => $this->instructorId]);

        DB::shouldReceive('select')
            ->once()
            ->andReturn([
                (object)[
                    'booking_id'   => 'booking-1',
                    'student_name' => 'Carlos',
                    'session_date' => '2026-05-01',  // próxima semana → platform
                    'session_time' => '18:00:00',
                    'amount'       => 5000.0,
                ],
            ]);

        $this->json(
            'GET',
            "/api/v1/schedules/{$this->scheduleId}/affected-bookings?change_date=2026-05-01",
            [],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertCount(1, $data['data']);
        $this->assertSame('platform', $data['data'][0]['commission_zone']);
    }

    /** @test */
    public function affected_bookings_requires_change_date_param(): void
    {
        $this->json(
            'GET',
            "/api/v1/schedules/{$this->scheduleId}/affected-bookings",
            [],
            $this->authHeaders($this->instructorId)
        );

        $this->assertResponseStatus(400);
    }
}
