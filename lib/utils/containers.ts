/**
 * Container utilities
 * Pure computation logic migrated from legacy container-manager.ts
 * No Supabase, no UI, no side effects — fully type-safe and reusable.
 */

const DEBUG = false

import { calculateTieredFees, type Tier } from '@/lib/tierUtils'
import type { Database } from '@/types/database'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export type ContainerStatus = 'Safe' | 'Warning' | 'Overdue' | 'Closed'

export interface ContainerRecord {
  id: string
  arrival_date?: ContainerRow['arrival_date'] | null
  free_days?: ContainerRow['free_days'] | null
  is_closed?: ContainerRow['is_closed']
  gate_out_date?: ContainerRow['gate_out_date'] | null
  empty_return_date?: ContainerRow['empty_return_date'] | null
  last_free_day?: ContainerRow['last_free_day'] | null
  demurrage_fee_if_late?: ContainerRow['demurrage_fee_if_late'] | null
  demurrage_tiers?: Tier[] | ContainerRow['demurrage_tiers']
  detention_free_days?: ContainerRow['detention_free_days'] | null
  detention_tiers?: Tier[] | ContainerRow['detention_tiers']
  detention_fee_rate?: ContainerRow['detention_fee_rate'] | null
  has_detention?: ContainerRow['has_detention'] | null
  container_no?: ContainerRow['container_no']
  carrier?: ContainerRow['carrier']
  created_at?: ContainerRow['created_at'] | null
  updated_at?: ContainerRow['updated_at'] | null
  version?: ContainerRow['version'] | null
}

export interface ContainerWithDerivedFields extends ContainerRecord {
  days_left: number | null
  status: ContainerStatus
  demurrage_fees: number
  detention_fees: number
}

type TierLike = {
  from_day?: unknown
  from?: unknown
  to_day?: unknown
  to?: unknown
  rate?: unknown
}

function isTierLike(value: unknown): value is TierLike {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeTierArray(source?: ContainerRecord['demurrage_tiers']): Tier[] | undefined {
  if (!source || !Array.isArray(source)) return undefined

  const tiers: Tier[] = []

  for (const item of source) {
    if (!isTierLike(item)) continue
    const tierLike = item as TierLike

    const fromCandidate = typeof tierLike.from_day === 'number'
      ? tierLike.from_day
      : typeof tierLike.from === 'number'
        ? tierLike.from
        : undefined

    const toCandidateRaw = tierLike.to_day !== undefined
      ? tierLike.to_day
      : tierLike.to !== undefined
        ? tierLike.to
        : undefined

    const toCandidate = toCandidateRaw === null || typeof toCandidateRaw === 'number'
      ? toCandidateRaw
      : undefined

    const rateCandidate = typeof tierLike.rate === 'number' ? tierLike.rate : undefined

    const fromDay = toNumber(fromCandidate, 1)
    const toDayNormalized = toCandidate === null ? null : toCandidate === undefined ? null : toNumber(toCandidate, 0)
    const rate = toNumber(rateCandidate, 0)

    tiers.push({
      from_day: fromDay,
      to_day: toDayNormalized,
      rate,
    })
  }

  return tiers.length > 0 ? tiers : undefined
}

function resolveTierArray(source?: ContainerRecord['demurrage_tiers']): Tier[] | undefined {
  return normalizeTierArray(source)
}

function resolveFeeRate(value?: ContainerRecord['demurrage_fee_if_late'] | ContainerRecord['detention_fee_rate'] | null): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
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
export function computeDerivedFields(c: ContainerRecord): ContainerWithDerivedFields {
  const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7)
  const status = computeContainerStatus(c)
  const demurrageTiers = resolveTierArray(c.demurrage_tiers)
  const detentionTiers = resolveTierArray(c.detention_tiers)
  const demurrageRate = resolveFeeRate(c.demurrage_fee_if_late)
  const detentionRate = resolveFeeRate(c.detention_fee_rate)
  
  // Calculate demurrage fees if overdue
  let demurrage_fees = 0
  if (days_left !== null && days_left < 0) {
    const daysOverdue = Math.abs(days_left)
    if (DEBUG && process.env.NODE_ENV === 'development') {
      console.log('[computeDerivedFields:demurrage] BEFORE calculateTieredFees', {
        containerId: c.id,
        containerNo: c.container_no,
        carrier: c.carrier,
        days_left,
        daysOverdue,
        demurrage_tiers: demurrageTiers,
        demurrage_fee_if_late: c.demurrage_fee_if_late
      })
    }
    demurrage_fees = calculateTieredFees(
      daysOverdue,
      demurrageTiers,
      demurrageRate
    )
    if (DEBUG && process.env.NODE_ENV === 'development') {
      console.log('[computeDerivedFields:demurrage] RESULT', {
        containerId: c.id,
        containerNo: c.container_no,
        demurrage_fees
      })
    }
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
          detentionTiers,
          detentionRate
        )
      }

      if (DEBUG && process.env.NODE_ENV === 'development') {
        console.log('[computeDerivedFields:detention]', {
          containerId: c.id,
          gateOut,
          emptyReturn,
          detentionFreeDays,
          totalDays,
          detentionDays,
          detention_tiers: detentionTiers,
          detention_fees
        })
      }
    }
  }
  
  // Removed verbose summary log - use DEBUG flag to re-enable if needed
  // if (DEBUG && process.env.NODE_ENV === 'development') {
  //   console.log('[computeDerivedFields]', c.id, { days_left, demurrage_fees, detention_fees })
  // }
  
  return {
    ...c,
    days_left,
    status,
    demurrage_fees,
    detention_fees
  }
}

