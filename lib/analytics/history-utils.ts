/**
 * History Utilities
 * Client-side utilities for history/activity log operations
 */

import type { HistoryEvent } from '@/lib/data/history-actions'

export type FieldChange = {
  field: string
  label: string
  oldValue: string
  newValue: string
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'

  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  // Dates stored as ISO strings inside payload
  if (typeof value === 'object') {
    // Don't explode huge JSON – keep it short
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

const NOISY_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'version',
  'organization_id',
  'user_id',
  'deleted_at',
])

const ARRAY_FIELDS_TO_SUMMARIZE = new Set(['demurrage_tiers', 'detention_tiers'])

function prettyLabel(field: string): string {
  const map: Record<string, string> = {
    milestone: 'Milestone',
    status: 'Status',
    assigned_to: 'Assigned to',
    list_id: 'List',
    arrival_date: 'Arrival date',
    gate_out_date: 'Gate out date',
    empty_return_date: 'Empty return date',
    has_detention: 'Has detention',
    container_size: 'Container size',
    carrier: 'Carrier',
  }
  return map[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getAllFieldChanges(event: HistoryEvent): FieldChange[] {
  const payload: any = event.details || event.payload
  if (!payload || typeof payload !== 'object' || !payload.old || !payload.new) return []

  const oldRow = payload.old as Record<string, unknown>
  const newRow = payload.new as Record<string, unknown>

  const fields = new Set([...Object.keys(oldRow), ...Object.keys(newRow)])

  const changes: FieldChange[] = []

  for (const field of fields) {
    if (NOISY_FIELDS.has(field)) continue

    const oldVal = oldRow[field]
    const newVal = newRow[field]

    // Treat tier arrays as one "changed" flag
    if (ARRAY_FIELDS_TO_SUMMARIZE.has(field)) {
      // Only add if actually different
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({
          field,
          label: prettyLabel(field),
          oldValue: '[changed]',
          newValue: '[changed]',
        })
      }
      continue
    }

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue

    changes.push({
      field,
      label: prettyLabel(field),
      oldValue: formatValue(oldVal),
      newValue: formatValue(newVal),
    })
  }

  return changes
}

const KEY_FIELDS = [
  'milestone',
  'status',
  'assigned_to',
  'arrival_date',
  'gate_out_date',
  'empty_return_date',
  'has_detention',
]

export function summarizeKeyChanges(changes: FieldChange[]): string | null {
  if (!changes.length) return null

  const important = changes.filter((c) => KEY_FIELDS.includes(c.field))

  const picked = important.length ? important : changes.slice(0, 2)

  const parts = picked.map((c) => `${c.label}: ${c.oldValue} → ${c.newValue}`)

  return parts.join(' • ')
}

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

