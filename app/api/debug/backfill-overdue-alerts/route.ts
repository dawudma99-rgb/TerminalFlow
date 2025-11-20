import { NextResponse } from 'next/server'
import { backfillOverdueAlertsForCurrentOrg } from '@/lib/data/overdue-sweep'

/**
 * POST /api/debug/backfill-overdue-alerts
 * 
 * Manual debug endpoint that creates `became_overdue` alerts for all overdue containers
 * in the current organization that don't already have such an alert.
 * 
 * This is a manual backfill tool - it does NOT send emails.
 * 
 * Usage:
 * - With curl:
 *   ```bash
 *   curl -X POST http://localhost:3000/api/debug/backfill-overdue-alerts
 *   ```
 * - Or use a REST client like Postman/Insomnia
 * - Must be authenticated (logged in) to use this endpoint
 * 
 * Returns:
 * - 200: JSON with summary:
 *   ```json
 *   {
 *     "ok": true,
 *     "totalOverdue": 3,
 *     "createdAlerts": 2,
 *     "skippedExisting": 1
 *   }
 *   ```
 *   Where:
 *   - `totalOverdue`: Total number of overdue containers found
 *   - `createdAlerts`: Number of new alerts created
 *   - `skippedExisting`: Number of containers that already had a `became_overdue` alert
 * 
 * - 401: If user is not authenticated
 * - 500: If there's an error processing the backfill
 * 
 * Example workflow:
 * 1. First, check what's overdue: GET /api/debug/overdue-candidates
 * 2. Then backfill alerts: POST /api/debug/backfill-overdue-alerts
 * 3. Check the results in the dashboard alerts page
 */
export async function POST() {
  try {
    // Call the backfill function
    const summary = await backfillOverdueAlertsForCurrentOrg()

    return NextResponse.json({
      ok: true,
      ...summary,
    })
  } catch (error) {
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Please log in to access this endpoint.' },
        { status: 401 }
      )
    }

    // Check if it's a profile not found error (also auth-related)
    if (error instanceof Error && error.message.includes('profile not found')) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. User profile not found.' },
        { status: 401 }
      )
    }

    // Log other errors and return 500
    console.error('Error in /api/debug/backfill-overdue-alerts:', error)
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to backfill overdue alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

