'use client'

import { useEffect, useState } from 'react'
import { fetchAlerts } from '@/lib/data/alerts-actions'
import type { AlertRow } from '@/lib/data/alerts-actions'
import Link from 'next/link'

/**
 * Formats an alert into human-readable text for forwarders.
 * Uses metadata when available, falls back gracefully.
 * Simplified for non-technical users.
 */
function formatAlertDescription(alert: AlertRow): string {
  const metadata = alert.metadata as any
  const eventType = alert.event_type
  const port = metadata?.port || 'the port'
  const daysOverdue = metadata?.days_overdue
  const newDaysLeft = metadata?.new_days_left

  switch (eventType) {
    case 'became_overdue':
      if (daysOverdue !== undefined && daysOverdue !== null) {
        return `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} at ${port}`
      }
      return `Overdue at ${port}`

    case 'demurrage_started':
      return `Demurrage started at ${port}.`

    case 'detention_started':
      return `Detention started at ${port}.`

    case 'became_warning':
      if (newDaysLeft !== undefined && newDaysLeft !== null && newDaysLeft > 0) {
        return `LFD in ${newDaysLeft} day${newDaysLeft !== 1 ? 's' : ''} at ${port}.`
      }
      return `Approaching deadline at ${port}.`

    default:
      // Fallback for any other event types
      return alert.message || `Alert at ${port}`
  }
}

type AlertCardProps = {
  title: string
  alerts: AlertRow[]
  totalCount: number
  subtitle: string
  footerLink: string
  footerText: string
}

function AlertCard({ title, alerts, totalCount, subtitle, footerLink, footerText }: AlertCardProps) {
  const displayedAlerts = alerts.slice(0, 3)
  const remainingCount = totalCount - displayedAlerts.length

  return (
    <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow">
      <h2 className="text-lg font-semibold text-[#111827] mb-1">{title}</h2>
      <p className="text-sm text-[#6B7280] mb-4">{subtitle}</p>

      {displayedAlerts.length === 0 ? (
        <p className="text-sm text-[#6B7280]">
          {title.includes('Urgent') 
            ? 'No urgent issues in the last 7 days.'
            : 'Nothing coming up soon in the next few days.'}
        </p>
      ) : (
        <div className="space-y-4">
          {displayedAlerts.map((alert) => {
            const containerNo = alert.container_no || 'Unknown Container'
            const listName = alert.list_name
            const description = formatAlertDescription(alert)

            return (
              <div key={alert.id} className="border-b border-[#E5E7EB] last:border-0 pb-3 last:pb-0">
                <div className="font-semibold text-[#111827] mb-1">{containerNo}</div>
                <div className="text-sm text-[#374151] mb-1">{description}</div>
                {listName && (
                  <div className="text-xs text-[#6B7280] mt-1">{listName}</div>
                )}
              </div>
            )
          })}
          {remainingCount > 0 && (
            <div className="text-xs text-[#6B7280] pt-2">
              + {remainingCount} more in the last 7 days.
            </div>
          )}
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-[#E5E7EB]">
        <Link 
          href={footerLink} 
          className="text-sm text-[#007EA7] hover:underline font-medium"
        >
          {footerText} →
        </Link>
      </div>
    </div>
  )
}

/**
 * Client component that fetches and displays alert summaries for the dashboard.
 * Shows urgent (critical) and upcoming (warning) alerts from the last 7 days.
 */
export function DashboardAlertsPanel() {
  const [urgentAlerts, setUrgentAlerts] = useState<AlertRow[]>([])
  const [upcomingAlerts, setUpcomingAlerts] = useState<AlertRow[]>([])
  const [urgentCount, setUrgentCount] = useState(0)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadAlerts() {
      try {
        // Fetch recent alerts (not just unread), limit to 100 to get a good sample
        const allAlerts = await fetchAlerts({ limit: 100, onlyUnread: false })

        // Filter to alerts from the last 7 days
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        const recentAlerts = allAlerts.filter(
          (alert) => new Date(alert.created_at) >= sevenDaysAgo
        )

        // Filter and sort urgent alerts (critical severity, specific event types)
        const urgent = recentAlerts
          .filter(
            (alert) =>
              alert.severity === 'critical' &&
              ['became_overdue', 'demurrage_started', 'detention_started'].includes(alert.event_type)
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        // Filter and sort upcoming alerts (warning severity, became_warning event type)
        const upcoming = recentAlerts
          .filter(
            (alert) =>
              alert.severity === 'warning' && alert.event_type === 'became_warning'
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        setUrgentAlerts(urgent)
        setUpcomingAlerts(upcoming)
        setUrgentCount(urgent.length)
        setUpcomingCount(upcoming.length)
      } catch (error) {
        // Gracefully handle errors - don't break the dashboard
        console.error('Error loading alerts for dashboard:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAlerts()
  }, [])

  if (loading) {
    return (
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow">
          <div className="h-32 animate-pulse bg-gray-100 rounded" />
        </div>
        <div className="bg-white rounded-md border border-[#E5E7EB] p-6 shadow">
          <div className="h-32 animate-pulse bg-gray-100 rounded" />
        </div>
      </section>
    )
  }

  const urgentSubtitle =
    urgentCount > 0
      ? `You have ${urgentCount} urgent issue${urgentCount !== 1 ? 's' : ''} in the last 7 days.`
      : 'No urgent issues in the last 7 days.'

  const upcomingSubtitle =
    upcomingCount > 0
      ? `You have ${upcomingCount} upcoming issue${upcomingCount !== 1 ? 's' : ''} to keep an eye on.`
      : 'Nothing coming up soon in the next few days.'

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AlertCard
        title="🚨 Urgent Issues"
        alerts={urgentAlerts}
        totalCount={urgentCount}
        subtitle={urgentSubtitle}
        footerLink="/dashboard/alerts"
        footerText="View all urgent alerts"
      />
      <AlertCard
        title="⏳ Coming Up Soon"
        alerts={upcomingAlerts}
        totalCount={upcomingCount}
        subtitle={upcomingSubtitle}
        footerLink="/dashboard/alerts"
        footerText="Review upcoming alerts"
      />
    </section>
  )
}

