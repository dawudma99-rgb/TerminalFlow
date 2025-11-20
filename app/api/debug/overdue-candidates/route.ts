import { NextResponse } from 'next/server'
import { getOverdueCandidatesForCurrentOrg } from '@/lib/data/overdue-sweep'

/**
 * GET /api/debug/overdue-candidates
 * 
 * Debug endpoint that returns all containers in the current organization
 * that are currently overdue (based on computed derived fields).
 * 
 * This is a read-only diagnostic tool - it does NOT create alerts or send emails.
 * 
 * Usage:
 * - Visit /api/debug/overdue-candidates in your browser while logged in
 * - Or use curl/fetch: GET /api/debug/overdue-candidates
 * 
 * Returns:
 * - 200: JSON with { count: number, containers: OverdueCandidate[] }
 * - 401: If user is not authenticated
 * - 500: If there's an error fetching data
 * 
 * Example response:
 * {
 *   "count": 2,
 *   "containers": [
 *     {
 *       "id": "...",
 *       "container_no": "MSCU1234567",
 *       "status": "Overdue",
 *       "days_left": -3,
 *       "arrival_date": "2024-01-15",
 *       "free_days": 7,
 *       ...
 *     }
 *   ]
 * }
 */
export async function GET() {
  try {
    // Call the helper function to get overdue candidates
    const overdueCandidates = await getOverdueCandidatesForCurrentOrg()

    return NextResponse.json({
      count: overdueCandidates.length,
      containers: overdueCandidates,
    })
  } catch (error) {
    // Check if it's an authentication error
    if (error instanceof Error && error.message.includes('not authenticated')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to access this endpoint.' },
        { status: 401 }
      )
    }

    // Check if it's a profile not found error (also auth-related)
    if (error instanceof Error && error.message.includes('profile not found')) {
      return NextResponse.json(
        { error: 'Unauthorized. User profile not found.' },
        { status: 401 }
      )
    }

    // Log other errors and return 500
    console.error('Error in /api/debug/overdue-candidates:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch overdue candidates',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

