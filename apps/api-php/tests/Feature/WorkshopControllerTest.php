<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class WorkshopControllerTest extends TestCase
{
    protected function tearDown(): void
    {
        \Mockery::close();
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/workshops
    // -----------------------------------------------------------------------

    /** @test */
    public function index_returns_published_workshops(): void
    {
        DB::shouldReceive('select')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "status = 'published'"))
            ->andReturn([
                (object)[
                    'id' => 'ws-1', 'title' => 'Yoga Matutino', 'slug' => 'yoga-matutino-12345',
                    'type' => 'class', 'modality' => 'presencial', 'price' => 5000.0,
                    'currency' => 'CLP', 'status' => 'published',
                ],
            ]);

        $this->json('GET', '/api/v1/workshops');

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertCount(1, $data['data']);
        $this->assertSame(1, $data['total']);
    }

    /** @test */
    public function index_passes_filters_to_query(): void
    {
        DB::shouldReceive('select')
            ->once()
            ->withArgs(function ($sql, $bindings) {
                return str_contains($sql, 'ILIKE')
                    && in_array('%yoga%', $bindings);
            })
            ->andReturn([]);

        $this->json('GET', '/api/v1/workshops?q=yoga');

        $this->assertResponseStatus(200);
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/workshops/:id
    // -----------------------------------------------------------------------

    /** @test */
    public function show_returns_workshop_by_slug(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'w.slug = ?'))
            ->andReturn((object)[
                'id' => 'ws-1', 'title' => 'Yoga Matutino', 'slug' => 'yoga-matutino-12345',
                'type' => 'workshop', 'modality' => 'presencial', 'price' => 5000.0,
                'currency' => 'CLP', 'status' => 'published', 'capacity' => 10,
                'description' => '', 'location' => '', 'online_url' => '',
                'cover_image_url' => '', 'created_at' => '2026-01-01',
                'category_id' => '', 'category_name' => '', 'category_slug' => '',
                'instructor_id' => 'user-1', 'instructor_name' => 'María',
                'instructor_bio' => '', 'instructor_instagram' => '',
                'instructor_facebook' => '', 'instructor_whatsapp' => '',
                'instructor_phone' => '',
            ]);

        // bookings_count query
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "status = 'confirmed'"))
            ->andReturn((object)['cnt' => 3]);

        // sessions query (type = workshop, not class)
        DB::shouldReceive('select')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'schedule_id IS NULL'))
            ->andReturn([]);

        $this->json('GET', '/api/v1/workshops/yoga-matutino-12345');

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame('Yoga Matutino', $data['data']['title']);
        $this->assertSame(3, $data['data']['bookings_count']);
    }

    /** @test */
    public function show_returns_404_for_unknown_slug(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'w.slug = ?'))
            ->andReturn(null);

        $this->json('GET', '/api/v1/workshops/no-existe');

        $this->assertResponseStatus(404);
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/workshops (requiere auth)
    // -----------------------------------------------------------------------

    /** @test */
    public function store_creates_workshop_and_returns_201(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'INSERT INTO workshops'))
            ->andReturn((object)['id' => 'new-ws-id']);

        $this->json('POST', '/api/v1/workshops', [
            'title'    => 'Nuevo Taller',
            'type'     => 'workshop',
            'modality' => 'presencial',
            'price'    => 8000,
        ], $this->authHeaders());

        $this->assertResponseStatus(201);
        $data = json_decode($this->response->getContent(), true);
        $this->assertArrayHasKey('id', $data['data']);
        $this->assertArrayHasKey('slug', $data['data']);
    }

    /** @test */
    public function store_returns_401_without_token(): void
    {
        $this->json('POST', '/api/v1/workshops', [
            'title'    => 'Taller Sin Auth',
            'type'     => 'workshop',
            'modality' => 'presencial',
        ]);

        $this->assertResponseStatus(401);
    }

    /** @test */
    public function store_returns_422_when_title_missing(): void
    {
        $this->json('POST', '/api/v1/workshops', [
            'type'     => 'workshop',
            'modality' => 'presencial',
        ], $this->authHeaders());

        $this->assertResponseStatus(422);
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/workshops/:id
    // -----------------------------------------------------------------------

    /** @test */
    public function destroy_archives_workshop_with_no_active_bookings(): void
    {
        // workshop exists
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "status != 'archived'"))
            ->andReturn((object)['ok' => true]);

        // active session bookings = 0
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'JOIN sessions'))
            ->andReturn((object)['cnt' => 0]);

        // direct bookings = 0
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'session_id IS NULL'))
            ->andReturn((object)['cnt' => 0]);

        DB::shouldReceive('update')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "'archived'"))
            ->andReturn(1);

        $this->json(
            'DELETE',
            '/api/v1/workshops/ws-uuid',
            [],
            $this->authHeaders()
        );

        $this->assertResponseStatus(200);
        $data = json_decode($this->response->getContent(), true);
        $this->assertSame('archived', $data['data']['status']);
    }

    /** @test */
    public function destroy_returns_409_when_active_bookings_exist(): void
    {
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, "status != 'archived'"))
            ->andReturn((object)['ok' => true]);

        // 2 active session bookings
        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'JOIN sessions'))
            ->andReturn((object)['cnt' => 2]);

        DB::shouldReceive('selectOne')
            ->once()
            ->withArgs(fn($sql) => str_contains($sql, 'session_id IS NULL'))
            ->andReturn((object)['cnt' => 0]);

        $this->json(
            'DELETE',
            '/api/v1/workshops/ws-uuid',
            [],
            $this->authHeaders()
        );

        $this->assertResponseStatus(409);
        $data = json_decode($this->response->getContent(), true);
        $this->assertArrayHasKey('active_bookings', $data);
    }
}
