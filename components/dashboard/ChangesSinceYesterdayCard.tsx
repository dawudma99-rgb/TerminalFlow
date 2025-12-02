import clsx from 'clsx'
import Link from 'next/link'
import type { AlertRow } from '@/lib/data/alerts-actions'
import { History, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'

type ChangesSinceYesterdayCardProps = {
  alerts: AlertRow[]
  className?: string
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'became_overdue':
      return 'Became overdue'
    case 'became_warning':
      return 'Became warning'
    case 'detention_started':
      return 'Detention started'
    case 'container_closed':
      return 'Container closed'
    default:
      return eventType.replace(/_/g, ' ')
  }
}

function getEventTypeIcon(eventType: string) {
  switch (eventType) {
    case 'became_overdue':
    case 'detention_started':
      return <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
    case 'became_warning':
      return <Clock className="h-4 w-4 text-[#D97706]" />
    case 'container_closed':
      return <CheckCircle2 className="h-4 w-4 text-[#059669]" />
    default:
      return <History className="h-4 w-4 text-gray-400" />
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  if (diffMins > 0) {
    return `${diffMins}m ago`
  }
  return 'Just now'
}

export function ChangesSinceYesterdayCard({ alerts, className }: ChangesSinceYesterdayCardProps) {
  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] p-6 shadow', className)}>
      <div className="flex items-center gap-2 mb-1">
        <History className="h-5 w-5 text-[#2563EB]" />
        <h2 className="text-lg font-semibold text-[#111827]">Changes in last 24 hours</h2>
      </div>
      <p className="text-sm text-[#6B7280] mb-4">Recent events that need your attention.</p>

      {alerts.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No changes in the last 24 hours.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center gap-3 py-2 border-b border-[#E5E7EB] last:border-0"
            >
              <div className="flex-shrink-0">{getEventTypeIcon(alert.event_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#374151]">
                  <span className="font-medium">{getEventTypeLabel(alert.event_type)}</span>
                  {' • '}
                  <span className="font-medium">{alert.container_no || 'Unknown'}</span>
                  {alert.list_name && <span className="text-[#6B7280]"> • {alert.list_name}</span>}
                </div>
                <div className="text-xs text-[#6B7280] mt-0.5">
                  {formatTimeAgo(alert.created_at)}
                </div>
              </div>
              <Link
                href="/dashboard/containers"
                className="text-xs text-[#007EA7] hover:underline font-medium flex-shrink-0"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="pt-4 mt-4 border-t border-[#E5E7EB]">
          <Link
            href="/dashboard/alerts"
            className="text-sm text-[#007EA7] hover:underline font-medium"
          >
            View all alerts →
          </Link>
        </div>
      )}
    </div>
  )
}

