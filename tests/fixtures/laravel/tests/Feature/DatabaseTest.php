<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseTest extends TestCase
{
    use RefreshDatabase;

    /**
     * The DB_CONNECTION set by the workflow reaches Laravel and its database works.
     */
    public function test_users_are_stored_in_the_configured_database(): void
    {
        User::factory()->create(['email' => 'ada@example.com']);

        $this->assertSame(config('database.default'), DB::connection()->getDriverName());
        $this->assertDatabaseHas('users', ['email' => 'ada@example.com']);
    }
}
