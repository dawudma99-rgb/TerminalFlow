'use client'

import { useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { HistoryEvent } from '@/lib/data/history-actions'
import { EmptyState } from '@/components/ui/EmptyState'
import { Activity } from 'lucide-react'
import { getAllFieldChanges, summarizeKeyChanges, type FieldChange } from '@/lib/analytics/history-utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type HistoryEventDetailsDialogProps = {
  changes: FieldChange[]
}

function HistoryEventDetailsDialog({ changes }: HistoryEventDetailsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="link"
          size="sm"
          className="px-0 text-xs font-normal h-auto"
        >
          View details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change details</DialogTitle>
          <DialogDescription>
            All fields that changed in this update.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 max-h-80 overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Field</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">From</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">To</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.field} className="border-t">
                  <td className="px-3 py-2 align-top font-medium">{c.label}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground whitespace-pre-wrap">
                    {c.oldValue}
                  </td>
                  <td className="px-3 py-2 align-top whitespace-pre-wrap">
                    {c.newValue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ActivityTableProps {
  events: HistoryEvent[]
}

export function ActivityTable({ events }: ActivityTableProps) {
  const formatEventType = (type: string | null) => {
    if (!type) return 'Unknown'
    return type
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  const getEventTypeBadge = (type: string | null) => {
    const eventType = type?.toLowerCase() || ''
    
    if (eventType.includes('created')) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Created</Badge>
    }
    if (eventType.includes('edited')) {
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Edited</Badge>
    }
    if (eventType.includes('closed')) {
      return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Closed</Badge>
    }
    if (eventType.includes('deleted')) {
      return <Badge variant="destructive">Deleted</Badge>
    }
    if (eventType.includes('reopened')) {
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Reopened</Badge>
    }
    if (eventType.includes('imported')) {
      return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Imported</Badge>
    }
    
    return <Badge variant="outline">{formatEventType(type)}</Badge>
  }

  // Memoize formatted events to avoid re-computation on every render
  const formattedEvents = useMemo(() => {
    return events.map((event) => ({
      ...event,
      formattedDate: new Date(event.created_at).toLocaleString('en-GB', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
      formattedContainerId: event.container_no || event.container_id.substring(0, 8) + '...',
    }))
  }, [events])

  if (events.length === 0) {
    return (
      <EmptyState
        title="No events found"
        description="No activity events match your current filters."
        icon={<Activity className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead aria-label="Event date and time">Date</TableHead>
            <TableHead aria-label="Type of event">Event Type</TableHead>
            <TableHead aria-label="Event summary">Summary</TableHead>
            <TableHead aria-label="User who performed the action">User</TableHead>
            <TableHead aria-label="Container identifier">Container</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {formattedEvents.map((event) => {
            const changes = getAllFieldChanges(event)
            const keySummary = summarizeKeyChanges(changes)
            return (
              <TableRow key={event.id} className="hover:bg-muted/50">
                <TableCell className="whitespace-nowrap">{event.formattedDate}</TableCell>
                <TableCell>{getEventTypeBadge(event.type || event.event_type)}</TableCell>
                <TableCell className="max-w-md align-top">
                  <div className="flex flex-col gap-1">
                    <div className="truncate">{event.summary || 'Container updated'}</div>
                    {keySummary && (
                      <div className="text-xs text-muted-foreground">
                        {keySummary}
                      </div>
                    )}
                    {changes.length > 0 && (
                      <div>
                        <HistoryEventDetailsDialog changes={changes} />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{event.user || 'System'}</TableCell>
                <TableCell className="font-mono text-xs">
                  {event.container_no
                    ? event.container_no
                    : event.container_id
                    ? `${event.container_id.slice(0, 8)}...`
                    : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

