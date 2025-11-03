/**
 * History Utilities
 * Client-side utilities for history/activity log operations
 */

import type { HistoryEvent } from '@/lib/data/history-actions'

/**
 * Export history events to CSV format.
 * Returns a CSV string ready for download.
 * This is a pure client-side function (not a server action).
 */
export function exportHistoryCSV(history: HistoryEvent[]): string {
  // CSV Headers
  const headers = ['Date', 'Event Type', 'Summary', 'User', 'Container ID', 'Details']
  const rows = [headers.map(h => `"${h}"`).join(',')]

  // Add data rows
  history.forEach((event) => {
    const date = new Date(event.created_at).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    
    const eventType = (event.event_type || event.type || 'unknown')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
    
    const summary = (event.summary || '').replace(/"/g, '""') // Escape quotes
    const user = (event.user || 'System').replace(/"/g, '""')
    const containerId = event.container_id.replace(/"/g, '""')
    const details = JSON.stringify(event.details || {}).replace(/"/g, '""')

    rows.push(
      [
        `"${date}"`,
        `"${eventType}"`,
        `"${summary}"`,
        `"${user}"`,
        `"${containerId}"`,
        `"${details}"`,
      ].join(',')
    )
  })

  return rows.join('\n')
}

