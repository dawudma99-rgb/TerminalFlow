import { fetchClearedAlertsPage } from '@/lib/data/alerts-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History, ArrowLeft } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 50

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function formatEstimatedCharges(metadata: any): string {
  const dem = metadata?.estimated_demurrage_fees
  const det = metadata?.estimated_detention_fees
  if (dem && det) {
    return `Dem: $${dem.toFixed(2)} / Det: $${det.toFixed(2)}`
  }
  if (dem) return `Dem: $${dem.toFixed(2)}`
  if (det) return `Det: $${det.toFixed(2)}`
  return '—'
}

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

export default async function AlertsHistoryPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const page = parseInt(searchParams.page || '1', 10)
  const { alerts, hasMore } = await fetchClearedAlertsPage({
    page: Math.max(1, page),
    pageSize: PAGE_SIZE,
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Cleared Alerts
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/alerts">
                <ArrowLeft className="h-4 w-4 mr-2" />
                ← Back to active alerts
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <EmptyState
              title="No cleared alerts"
              description="Cleared alerts will appear here."
              icon={<History className="h-12 w-12 text-muted-foreground" />}
            />
          ) : (
            <div className="space-y-4">
              {/* Alerts Table */}
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
                      <TableHead>Est. Charges</TableHead>
                      <TableHead>Cleared</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow
                        key={alert.id}
                        className="hover:bg-muted/50 opacity-60"
                      >
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(alert.created_at)}
                        </TableCell>
                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                        <TableCell className="max-w-md text-muted-foreground">
                          <div className="font-medium">{alert.title}</div>
                          {alert.message && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {alert.message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {alert.container_no || '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{alert.list_name || '—'}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {alert.event_type.replace(/_/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatEstimatedCharges(alert.metadata)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {alert.cleared_at ? formatDate(alert.cleared_at) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {alerts.length > 0 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {page} • Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/alerts/history?page=${page - 1}`}>
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
                        <Link href={`/dashboard/alerts/history?page=${page + 1}`}>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

