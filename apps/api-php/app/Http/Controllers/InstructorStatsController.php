<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InstructorStatsController extends Controller
{
    // GET /api/v1/instructor/stats
    public function stats(Request $request): JsonResponse
    {
        $instructorId = $this->userId($request);

        // Global totals
        $totals = DB::selectOne(
            "SELECT
                COUNT(*)                                                                as total_bookings,
                COUNT(*) FILTER (WHERE b.status = 'confirmed')                         as confirmed_bookings,
                COUNT(*) FILTER (WHERE b.status = 'cancelled')                         as cancelled_bookings,
                COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'confirmed'), 0)       as total_revenue,
                COUNT(*) FILTER (
                    WHERE b.status = 'confirmed'
                      AND date_trunc('month', b.created_at) = date_trunc('month', NOW())
                )                                                                       as this_month_bookings,
                COALESCE(SUM(b.amount) FILTER (
                    WHERE b.status = 'confirmed'
                      AND date_trunc('month', b.created_at) = date_trunc('month', NOW())
                ), 0)                                                                   as this_month_revenue
             FROM bookings b
             JOIN workshops w ON w.id = b.workshop_id
             WHERE w.instructor_id = ?",
            [$instructorId]
        );

        // Per-workshop breakdown
        $byWorkshop = DB::select(
            "SELECT w.id as workshop_id, w.title as workshop_title,
                    COUNT(*) FILTER (WHERE b.status = 'confirmed')  as confirmed,
                    COUNT(*) FILTER (WHERE b.status = 'cancelled')  as cancelled,
                    COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'confirmed'), 0) as revenue
             FROM workshops w
             LEFT JOIN bookings b ON b.workshop_id = w.id
             WHERE w.instructor_id = ?
             GROUP BY w.id, w.title
             ORDER BY confirmed DESC",
            [$instructorId]
        );

        // Bookings over time — last 6 months (monthly)
        $overTime = DB::select(
            "SELECT to_char(date_trunc('month', b.created_at), 'YYYY-MM') as month,
                    COUNT(*) FILTER (WHERE b.status = 'confirmed')                    as bookings,
                    COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'confirmed'), 0)  as revenue
             FROM bookings b
             JOIN workshops w ON w.id = b.workshop_id
             WHERE w.instructor_id = ?
               AND b.created_at >= NOW() - interval '6 months'
             GROUP BY date_trunc('month', b.created_at)
             ORDER BY date_trunc('month', b.created_at) ASC",
            [$instructorId]
        );

        // Top students (by confirmed bookings count)
        $topStudents = DB::select(
            "SELECT COALESCE(p.name, u.email)  as student_name,
                    u.email                     as student_email,
                    COUNT(*)                    as booking_count,
                    COALESCE(SUM(b.amount), 0)  as total_spent,
                    (
                        SELECT w2.title
                        FROM bookings b2
                        JOIN workshops w2 ON w2.id = b2.workshop_id
                        WHERE b2.student_id = b.student_id
                          AND w2.instructor_id = ?
                        ORDER BY b2.created_at DESC
                        LIMIT 1
                    ) as last_workshop
             FROM bookings b
             JOIN workshops w ON w.id = b.workshop_id
             JOIN users u     ON u.id = b.student_id
             LEFT JOIN profiles p ON p.user_id = b.student_id
             WHERE w.instructor_id = ? AND b.status = 'confirmed'
             GROUP BY b.student_id, p.name, u.email
             ORDER BY booking_count DESC
             LIMIT 20",
            [$instructorId, $instructorId]
        );

        return response()->json(['data' => [
            'total_bookings'      => (int)($totals->total_bookings ?? 0),
            'confirmed_bookings'  => (int)($totals->confirmed_bookings ?? 0),
            'cancelled_bookings'  => (int)($totals->cancelled_bookings ?? 0),
            'total_revenue'       => (float)($totals->total_revenue ?? 0),
            'this_month_bookings' => (int)($totals->this_month_bookings ?? 0),
            'this_month_revenue'  => (float)($totals->this_month_revenue ?? 0),
            'by_workshop'         => $byWorkshop,
            'over_time'           => $overTime,
            'top_students'        => $topStudents,
        ]]);
    }
}
