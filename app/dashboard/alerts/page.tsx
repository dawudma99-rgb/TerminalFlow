import { fetchAlertsPage } from '@/lib/data/alerts-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function getSeverityBadge(severity: string) {
  switch (severity.toLowerCase()) {
    case 'info':
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Info</Badge>
    case 'warning':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Warning</Badge>
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>
    default:
      return <Badge variant="outline">{severity}</Badge>
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

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
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState
              title="No alerts yet"
              description="Alerts will appear here when container state changes occur."
              icon={<Bell className="h-12 w-12 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Container</TableHead>
                    <TableHead>List</TableHead>
                    <TableHead>Event Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id} className="hover:bg-muted/50">
                      <TableCell className="whitespace-nowrap">
                        {formatDate(alert.created_at)}
                      </TableCell>
                      <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="font-medium">{alert.title}</div>
                        {alert.message && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {alert.message}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {alert.container_no || '—'}
                      </TableCell>
                      <TableCell>{alert.list_name || '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {alert.event_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination controls */}
          {alerts.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {page} • Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
              </div>
              <div className="flex items-center gap-2">
                {page > 1 ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/alerts?page=${page - 1}`}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                )}
                {hasMore ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/alerts?page=${page + 1}`}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

