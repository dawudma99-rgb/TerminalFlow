/**
 * Container utilities
 * Pure computation logic migrated from legacy container-manager.ts
 * No Supabase, no UI, no side effects — fully type-safe and reusable.
 */

export type ContainerStatus = 'Safe' | 'Warning' | 'Overdue' | 'Closed'

export interface ContainerRecord {
  id: string
  arrival_date?: string | null
  free_days?: number | null
  is_closed?: boolean
  gate_out_date?: string | null
  empty_return_date?: string | null
  last_free_day?: string | null
  demurrage_fee_if_late?: number | null
  detention_free_days?: number | null
  has_detention?: boolean
  created_at?: string | null
  updated_at?: string | null
  version?: number | null
}

/**
 * Parse dates safely with multiple formats.
 */
export function parseDateFlexible(value?: string | null): Date | null {
  if (!value) return null
  const ts = Date.parse(value)
  if (!isNaN(ts)) return new Date(ts)

  // Try DD/MM/YYYY format
  const parts = value.split(/[\/\-\.]/)
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number)
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m - 1, d)
    }
  }

  return null
}

/**
 * Calculate how many days are left until the Last Free Day (LFD).
 */
export function computeDaysLeft(arrival?: string | null, freeDays = 7): number | null {
  const arrivalDate = parseDateFlexible(arrival)
  if (!arrivalDate) return null

  const now = new Date()
  const diff = (arrivalDate.getTime() + freeDays * 86400000) - now.getTime()
  return Math.ceil(diff / 86400000)
}

/**
 * Compute the container status.
 */
export function computeContainerStatus(c: ContainerRecord): ContainerStatus {
  if (c.is_closed) return 'Closed'
  const daysLeft = computeDaysLeft(c.arrival_date, c.free_days ?? 7)
  if (daysLeft === null) return 'Safe'
  if (daysLeft > 2) return 'Safe'
  if (daysLeft > 0) return 'Warning'
  return 'Overdue'
}

/**
 * Compute derived fields (status, days_left, etc.)
 */
export function computeDerivedFields(c: ContainerRecord) {
  const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7)
  const status = computeContainerStatus(c)
  return {
    ...c,
    days_left,
    status
  }
}

