import { fetchAlerts } from '@/lib/data/alerts-actions'
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

export default async function AlertsPage() {
  const alerts = await fetchAlerts({ limit: 200 })

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
        </CardContent>
      </Card>
    </div>
  )
}

