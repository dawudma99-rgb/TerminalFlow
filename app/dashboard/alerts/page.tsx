import { fetchAlertsPage } from '@/lib/data/alerts-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell, History } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { AlertsPageContent } from './AlertsPageContent'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 50

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1', 10)
  const { alerts, hasMore } = await fetchAlertsPage({
    page: Math.max(1, page),
    pageSize: PAGE_SIZE,
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Alerts
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/alerts/history">
                <History className="h-4 w-4 mr-2" />
                View cleared alerts →
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState
              title="No active alerts"
              description="Alerts will appear here when container state changes occur."
              icon={<Bell className="h-12 w-12 text-muted-foreground" />}
            />
          ) : (
            <AlertsPageContent alerts={alerts} hasMore={hasMore} currentPage={page} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

