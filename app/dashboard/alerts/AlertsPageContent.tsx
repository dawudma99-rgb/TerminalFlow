'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearAlert, type AlertRow } from '@/lib/data/alerts-actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { logger } from '@/lib/utils/logger'

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

interface AlertsPageContentProps {
  alerts: AlertRow[]
  hasMore: boolean
  currentPage: number
}

export function AlertsPageContent({ alerts, hasMore, currentPage }: AlertsPageContentProps) {
  const router = useRouter()
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  const handleClear = async (alertId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(alertId))
    try {
      await clearAlert(alertId)
      toast.success('Alert cleared')
      router.refresh()
    } catch (error) {
      logger.error('Failed to clear alert', { error })
      toast.error('Failed to clear alert')
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.delete(alertId)
        return next
      })
    }
  }

  return (
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => {
              const isUpdating = updatingIds.has(alert.id)

              return (
                <TableRow
                  key={alert.id}
                  className="hover:bg-muted/50"
                >
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
                  <TableCell className="text-xs">
                    {formatEstimatedCharges(alert.metadata)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClear(alert.id)}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Clearing...' : 'Clear'}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {alerts.length > 0 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} • Showing {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-2">
            {currentPage > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/alerts?page=${currentPage - 1}`}>
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
                <Link href={`/dashboard/alerts?page=${currentPage + 1}`}>
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
  )
}
