<?php

namespace Tests\Unit;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * Tests para la lógica de zona de comisión.
 *
 * Regla (idéntica al Go original):
 *   cutoff = lunes de la semana de la sesión, a las 00:00 UTC
 *   now >= cutoff → "instructor"  (penalización)
 *   now <  cutoff → "platform"    (Kawin absorbe)
 */
class CommissionZoneTest extends TestCase
{
    private ConcreteController $ctrl;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ctrl = new ConcreteController();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow(null);
        parent::tearDown();
    }

    // -----------------------------------------------------------------------
    // "platform" — ahora está antes del lunes de la semana de la sesión
    // -----------------------------------------------------------------------

    /** @test */
    public function platform_when_now_is_before_cutoff_monday(): void
    {
        // Ahora: domingo 26-abril-2026
        // Sesión: viernes 1-mayo-2026 → lunes de esa semana = 27-abril-2026
        // now (Apr 26) < cutoff (Apr 27 00:00) → platform
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 23, 59, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 5, 1, 0, 0, 0, 'UTC'); // viernes
        $this->assertSame('platform', $this->ctrl->zone($sessionDate));
    }

    /** @test */
    public function platform_when_session_is_two_weeks_ahead(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 12, 0, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 5, 11, 0, 0, 0, 'UTC'); // lunes en 2 semanas
        $this->assertSame('platform', $this->ctrl->zone($sessionDate));
    }

    /** @test */
    public function platform_on_sunday_before_next_week_session(): void
    {
        // Ahora: domingo 26-abril-2026 a las 00:00:00
        // Sesión: lunes 27-abril-2026 → cutoff = Apr 27 00:00
        // now (Apr 26 00:00) < cutoff (Apr 27 00:00) → platform
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 0, 0, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 4, 27, 0, 0, 0, 'UTC');
        $this->assertSame('platform', $this->ctrl->zone($sessionDate));
    }

    // -----------------------------------------------------------------------
    // "instructor" — ahora está en la misma semana o más tarde
    // -----------------------------------------------------------------------

    /** @test */
    public function instructor_when_now_equals_cutoff_monday(): void
    {
        // Ahora: lunes 27-abril-2026 00:00:00
        // Sesión: miércoles 29-abril-2026 → cutoff = Apr 27 00:00
        // now == cutoff → instructor
        Carbon::setTestNow(Carbon::create(2026, 4, 27, 0, 0, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 4, 29, 0, 0, 0, 'UTC');
        $this->assertSame('instructor', $this->ctrl->zone($sessionDate));
    }

    /** @test */
    public function instructor_when_session_is_in_past_week(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 26, 12, 0, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 4, 20, 0, 0, 0, 'UTC'); // semana pasada
        $this->assertSame('instructor', $this->ctrl->zone($sessionDate));
    }

    /** @test */
    public function instructor_for_same_week_sunday_session(): void
    {
        // Ahora: miércoles 22-abril-2026
        // Sesión: domingo 26-abril-2026 → cutoff = lunes 20-abril-2026
        // now (Apr 22) >= cutoff (Apr 20) → instructor
        Carbon::setTestNow(Carbon::create(2026, 4, 22, 10, 0, 0, 'UTC'));

        $sessionDate = Carbon::create(2026, 4, 26, 0, 0, 0, 'UTC');
        $this->assertSame('instructor', $this->ctrl->zone($sessionDate));
    }

    /** @test */
    public function instructor_for_session_happening_today(): void
    {
        Carbon::setTestNow(Carbon::create(2026, 4, 25, 8, 0, 0, 'UTC')); // sábado

        $sessionDate = Carbon::create(2026, 4, 25, 18, 0, 0, 'UTC');
        $this->assertSame('instructor', $this->ctrl->zone($sessionDate));
    }
}

/**
 * Subclase concreta que expone commissionZone (método protegido) para tests.
 */
class ConcreteController extends Controller
{
    public function zone(Carbon $date): string
    {
        return $this->commissionZone($date);
    }
}
