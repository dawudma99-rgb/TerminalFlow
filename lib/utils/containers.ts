/**
 * Container utilities
 * Pure computation logic migrated from legacy container-manager.ts
 * No Supabase, no UI, no side effects — fully type-safe and reusable.
 */

import { calculateTieredFees, type Tier } from '@/lib/tierUtils'

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
  
  // Calculate demurrage fees if overdue
  let demurrage_fees = 0
  if (days_left !== null && days_left < 0) {
    const daysOverdue = Math.abs(days_left)
    console.log('[computeDerivedFields:demurrage] BEFORE calculateTieredFees', {
      containerId: c.id,
      containerNo: (c as any).container_no,
      carrier: (c as any).carrier,
      days_left,
      daysOverdue,
      demurrage_tiers: (c as any).demurrage_tiers,
      demurrage_fee_if_late: c.demurrage_fee_if_late
    })
    demurrage_fees = calculateTieredFees(
      daysOverdue,
      (c as any).demurrage_tiers as Tier[] | undefined,
      c.demurrage_fee_if_late ?? undefined
    )
    console.log('[computeDerivedFields:demurrage] RESULT', {
      containerId: c.id,
      containerNo: (c as any).container_no,
      demurrage_fees
    })
  }
  
  // --- DETENTION CALCULATION ---
  let detention_fees = 0
  if (c.has_detention) {
    const gateOut = c.gate_out_date ? new Date(c.gate_out_date) : null
    const emptyReturn = c.empty_return_date ? new Date(c.empty_return_date) : null
    const detentionFreeDays = c.detention_free_days ?? 7

    if (gateOut) {
      const endDate = emptyReturn || new Date()
      const totalDays = Math.ceil((endDate.getTime() - gateOut.getTime()) / 86400000)
      const detentionDays = totalDays - detentionFreeDays

      if (detentionDays > 0) {
        detention_fees = calculateTieredFees(
          detentionDays,
          (c as any).detention_tiers as Tier[] | undefined,
          (c as any).detention_fee_rate ?? undefined
        )
      }

      console.log('[computeDerivedFields:detention]', {
        containerId: c.id,
        gateOut,
        emptyReturn,
        detentionFreeDays,
        totalDays,
        detentionDays,
        detention_tiers: (c as any).detention_tiers,
        detention_fees
      })
    }
  }
  
  console.log('[computeDerivedFields]', c.id, { days_left, demurrage_fees, detention_fees })
  
  return {
    ...c,
    days_left,
    status,
    demurrage_fees,
    detention_fees
  }
}

