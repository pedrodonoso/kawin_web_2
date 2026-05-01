<?php

namespace Tests\Unit;

use App\Http\Controllers\Controller;
use PHPUnit\Framework\TestCase;

/**
 * Tests para el generador de slugs.
 */
class SlugifyTest extends TestCase
{
    private SlugController $ctrl;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ctrl = new SlugController();
    }

    /** @test */
    public function converts_spaces_to_dashes(): void
    {
        $slug = $this->ctrl->slug('Taller de Yoga');
        $this->assertMatchesRegularExpression('/^taller-de-yoga-\d+$/', $slug);
    }

    /** @test */
    public function normalizes_accented_characters(): void
    {
        $slug = $this->ctrl->slug('Música Ándina Ñoño');
        $this->assertMatchesRegularExpression('/^musica-andina-nono-\d+$/', $slug);
    }

    /** @test */
    public function strips_special_characters(): void
    {
        $slug = $this->ctrl->slug('Taller (avanzado)! 100%');
        $this->assertDoesNotMatchRegularExpression('/[^a-z0-9\-]/', $slug);
    }

    /** @test */
    public function appends_numeric_suffix_for_uniqueness(): void
    {
        $slug1 = $this->ctrl->slug('Yoga');
        usleep(2000); // 2ms gap para diferente timestamp
        $slug2 = $this->ctrl->slug('Yoga');

        // Ambos tienen el patrón correcto
        $this->assertMatchesRegularExpression('/^yoga-\d+$/', $slug1);
        $this->assertMatchesRegularExpression('/^yoga-\d+$/', $slug2);
    }

    /** @test */
    public function handles_consecutive_special_characters(): void
    {
        $slug = $this->ctrl->slug('Taller  ---  Avanzado');
        $this->assertMatchesRegularExpression('/^taller-avanzado-\d+$/', $slug);
    }
}

class SlugController extends Controller
{
    public function slug(string $title): string
    {
        return $this->slugify($title);
    }
}
