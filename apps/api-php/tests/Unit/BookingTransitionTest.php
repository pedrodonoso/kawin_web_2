<?php

namespace Tests\Unit;

use App\Http\Controllers\BookingController;
use PHPUnit\Framework\TestCase;

/**
 * Tests para la máquina de estados de reservas.
 *
 * Estados válidos:  pending → confirmed | cancelled
 *                  confirmed → cancelled
 *                  cancelled → (ninguno)
 */
class BookingTransitionTest extends TestCase
{
    private ConcreteBookingController $ctrl;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ctrl = new ConcreteBookingController();
    }

    // -----------------------------------------------------------------------
    // Transiciones válidas (deben retornar null)
    // -----------------------------------------------------------------------

    /** @test */
    public function pending_to_confirmed_is_valid(): void
    {
        $this->assertNull($this->ctrl->transition('pending', 'confirmed'));
    }

    /** @test */
    public function pending_to_cancelled_is_valid(): void
    {
        $this->assertNull($this->ctrl->transition('pending', 'cancelled'));
    }

    /** @test */
    public function confirmed_to_cancelled_is_valid(): void
    {
        $this->assertNull($this->ctrl->transition('confirmed', 'cancelled'));
    }

    // -----------------------------------------------------------------------
    // Transiciones inválidas (deben retornar mensaje de error)
    // -----------------------------------------------------------------------

    /** @test */
    public function confirmed_to_confirmed_is_invalid(): void
    {
        $result = $this->ctrl->transition('confirmed', 'confirmed');
        $this->assertNotNull($result);
        $this->assertStringContainsString('confirmed', $result);
    }

    /** @test */
    public function cancelled_to_confirmed_is_invalid(): void
    {
        $this->assertNotNull($this->ctrl->transition('cancelled', 'confirmed'));
    }

    /** @test */
    public function cancelled_to_cancelled_is_invalid(): void
    {
        $this->assertNotNull($this->ctrl->transition('cancelled', 'cancelled'));
    }

    /** @test */
    public function cancelled_to_pending_is_invalid(): void
    {
        $this->assertNotNull($this->ctrl->transition('cancelled', 'pending'));
    }

    /** @test */
    public function unknown_state_returns_error(): void
    {
        $result = $this->ctrl->transition('unknown_state', 'confirmed');
        $this->assertNotNull($result);
        $this->assertStringContainsString('desconocido', $result);
    }
}

/**
 * Expone validateBookingTransition (privado) para tests.
 */
class ConcreteBookingController extends BookingController
{
    public function transition(string $from, string $to): ?string
    {
        return $this->validateBookingTransition($from, $to);
    }
}
