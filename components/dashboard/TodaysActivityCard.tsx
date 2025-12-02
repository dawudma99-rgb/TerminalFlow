import clsx from 'clsx'
import Link from 'next/link'
import type { AlertRow } from '@/lib/data/alerts-actions'
import { History, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

type TodaysActivityCardProps = {
  alerts: AlertRow[]
  className?: string
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'became_overdue':
      return 'Overdue'
    case 'became_warning':
      return 'Warning'
    case 'detention_started':
      return 'Detention'
    case 'container_closed':
      return 'Closed'
    default:
      return eventType.replace(/_/g, ' ')
  }
}

function getEventTypeIcon(eventType: string) {
  switch (eventType) {
    case 'became_overdue':
    case 'detention_started':
      return <AlertTriangle className="h-3 w-3 text-[#DC2626]" />
    case 'became_warning':
      return <Clock className="h-3 w-3 text-[#D97706]" />
    case 'container_closed':
      return <CheckCircle2 className="h-3 w-3 text-[#059669]" />
    default:
      return <History className="h-3 w-3 text-gray-400" />
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours > 0) {
    return `${diffHours}h`
  }
  if (diffMins > 0) {
    return `${diffMins}m`
  }
  return 'now'
}

export function TodaysActivityCard({ alerts, className }: TodaysActivityCardProps) {
  const displayAlerts = alerts.slice(0, 10)
  const remainingCount = alerts.length > 10 ? alerts.length - 10 : 0

  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] shadow h-full flex flex-col', className)}>
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-base font-semibold text-[#111827]">Today's Activity</h2>
        </div>
      </div>
      <div className="p-4 flex-1 overflow-hidden">
        {displayAlerts.length === 0 ? (
          <p className="text-xs text-[#6B7280]">No activity in the last 24 hours.</p>
        ) : (
          <div className="space-y-2">
            {displayAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 py-1.5 border-b border-[#F3F4F6] last:border-0"
              >
                <div className="flex-shrink-0 mt-0.5">{getEventTypeIcon(alert.event_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#374151] leading-tight">
                    <span className="font-medium">{alert.container_no || '—'}</span>
                    <span className="text-[#6B7280]"> • {getEventTypeLabel(alert.event_type)}</span>
                    {alert.list_name && (
                      <span className="text-[#6B7280]"> • {alert.list_name}</span>
                    )}
                  </div>
                  <div className="text-xs text-[#6B7280] mt-0.5">{formatTimeAgo(alert.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {remainingCount > 0 && (
        <div className="p-4 border-t border-[#E5E7EB]">
          <Link
            href="/dashboard/alerts"
            className="text-xs text-[#007EA7] hover:underline font-medium"
          >
            +{remainingCount} more →
          </Link>
        </div>
      )}
    </div>
  )
}

