import { NextResponse } from 'next/server'
import { fetchAlerts } from '@/lib/data/alerts-actions'

/**
 * GET /api/alerts
 * Returns alerts for the current authenticated user's organization.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 20
    const onlyUnread = searchParams.get('onlyUnread') === 'true'

    const alerts = await fetchAlerts({
      limit,
      onlyUnread,
    })

    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

