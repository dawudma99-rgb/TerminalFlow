/**
 * Container utilities
 * Pure computation logic migrated from legacy container-manager.ts
 * No Supabase, no UI, no side effects — fully type-safe and reusable.
 */

const DEBUG = false

import { calculateTieredFees, type Tier } from '@/lib/tierUtils'
import { logger } from '@/lib/utils/logger'
import type { Database } from '@/types/database'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export type ContainerStatus = 'Safe' | 'Warning' | 'Overdue' | 'Closed'

/**
 * Container with computed derived fields.
 * Extends the database ContainerRow type with computed fields.
 */
export type DerivedContainer = ContainerRow & {
  days_left: number | null
  status: ContainerStatus
  demurrage_fees: number
  detention_fees: number
  lfd_date: string | null
  detention_chargeable_days: number | null
  detention_status: 'Safe' | 'Warning' | 'Overdue' | null
}

/**
 * @deprecated Use DerivedContainer instead. This type is kept for backward compatibility.
 * Will be removed in a future version.
 */
export type ContainerWithDerivedFields = DerivedContainer

/**
 * @deprecated This custom interface is deprecated. Use ContainerRow from database types instead.
 * Kept for backward compatibility only - compute functions no longer use this type.
 */
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
  weekend_chargeable?: ContainerRow['weekend_chargeable']
  container_no?: ContainerRow['container_no']
  bl_number?: ContainerRow['bl_number'] | null
  carrier?: ContainerRow['carrier']
  milestone?: ContainerRow['milestone'] | null
  created_at?: ContainerRow['created_at'] | null
  updated_at?: ContainerRow['updated_at'] | null
  version?: ContainerRow['version'] | null
  // pol and pod are used in the codebase but may not exist in the database schema yet
  pol?: string | null
  pod?: string | null
  lfd_date?: ContainerRow['lfd_date'] | null
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

function normalizeTierArray(source?: ContainerRow['demurrage_tiers']): Tier[] | undefined {
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

function resolveTierArray(source?: ContainerRow['demurrage_tiers']): Tier[] | undefined {
  return normalizeTierArray(source)
}

function resolveFeeRate(value?: ContainerRow['demurrage_fee_if_late'] | ContainerRow['detention_fee_rate'] | null): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

const DAY_IN_MS = 86400000

function startOfDay(date: Date): Date {
  const next = new Date(date.getTime())
  next.setHours(0, 0, 0, 0)
  return next
}

/**
 * Add chargeable days to a start date, optionally excluding weekends.
 * @param startDate - Starting date
 * @param daysToAdd - Number of days to add
 * @param includeWeekends - If false, skip Saturday (6) and Sunday (0)
 * @returns New date after adding chargeable days
 */
export function addChargeableDays(startDate: Date, daysToAdd: number, includeWeekends: boolean): Date {
  const normalized = startOfDay(startDate)
  let current = new Date(normalized.getTime())
  let daysAdded = 0

  while (daysAdded < daysToAdd) {
    current = new Date(current.getTime() + DAY_IN_MS)
    const dayOfWeek = current.getDay()
    
    if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      daysAdded++
    }
  }

  return startOfDay(current)
}

/**
 * Count chargeable days between two dates, optionally excluding weekends.
 * @param startDate - Starting date (inclusive)
 * @param endDate - Ending date (exclusive - days up to but not including this date)
 * @param includeWeekends - If false, skip Saturday (6) and Sunday (0)
 * @returns Number of chargeable days between the dates
 */
export function countChargeableDaysBetween(startDate: Date, endDate: Date, includeWeekends: boolean): number {
  const normalizedStart = startOfDay(startDate)
  const normalizedEnd = startOfDay(endDate)

  if (normalizedEnd.getTime() <= normalizedStart.getTime()) {
    return 0
  }

  let count = 0
  let current = new Date(normalizedStart.getTime())

  while (current.getTime() < normalizedEnd.getTime()) {
    const dayOfWeek = current.getDay()
    
    if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      count++
    }
    
    current = new Date(current.getTime() + DAY_IN_MS)
  }

  return count
}

/**
 * Derive Last Free Day (LFD) from arrival date and free days.
 * Uses weekend-aware logic based on includeWeekends flag.
 * @param arrivalDate - Arrival date string (ISO or DD/MM/YYYY)
 * @param freeDays - Number of free days
 * @param includeWeekends - Whether to include weekends in calculation
 * @returns LFD Date object, or null if arrival date is invalid
 */
export function deriveLfdFromFreeDays(
  arrivalDate: string | null | undefined,
  freeDays: number,
  includeWeekends: boolean
): Date | null {
  if (!arrivalDate) return null
  
  const arrival = parseDateFlexible(arrivalDate)
  if (!arrival) return null
  
  const normalizedArrival = startOfDay(arrival)
  return addChargeableDays(normalizedArrival, freeDays, includeWeekends)
}

/**
 * Derive free days from arrival date and Last Free Day (LFD).
 * Counts chargeable days from arrival to LFD (inclusive of LFD day).
 * Uses weekend-aware logic based on includeWeekends flag.
 * @param arrivalDate - Arrival date string (ISO or DD/MM/YYYY)
 * @param lfdDate - Last Free Day date string (ISO or DD/MM/YYYY)
 * @param includeWeekends - Whether to include weekends in calculation
 * @returns Number of free days, or null if dates are invalid
 */
export function deriveFreeDaysFromLfd(
  arrivalDate: string | null | undefined,
  lfdDate: string | null | undefined,
  includeWeekends: boolean
): number | null {
  if (!arrivalDate || !lfdDate) return null
  
  const arrival = parseDateFlexible(arrivalDate)
  const lfd = parseDateFlexible(lfdDate)
  
  if (!arrival || !lfd) return null
  
  const normalizedArrival = startOfDay(arrival)
  const normalizedLfd = startOfDay(lfd)
  
  // LFD must be after or equal to arrival
  if (normalizedLfd.getTime() < normalizedArrival.getTime()) {
    return null
  }
  
  // Count chargeable days from arrival to LFD (inclusive)
  // Since LFD is the last free day, we count up to and including LFD
  const lfdPlusOne = new Date(normalizedLfd.getTime() + DAY_IN_MS)
  return countChargeableDaysBetween(normalizedArrival, lfdPlusOne, includeWeekends)
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
 * @param arrival - Arrival date string
 * @param freeDays - Number of free days
 * @param includeWeekends - Whether to include weekends in calculation (default: true for backward compatibility)
 */
export function computeDaysLeft(arrival?: string | null, freeDays = 7, includeWeekends = true): number | null {
  const arrivalDate = parseDateFlexible(arrival)
  if (!arrivalDate) return null

  const now = new Date()
  const nowNormalized = startOfDay(now)
  const normalizedArrival = startOfDay(arrivalDate)

  if (includeWeekends) {
    // Original behavior: simple calendar day calculation
    const expiryDate = new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
    const diff = expiryDate.getTime() - nowNormalized.getTime()
    return Math.ceil(diff / DAY_IN_MS)
  } else {
    // Weekend-aware: calculate expiry using business days, then count business days until expiry
    const expiryDate = addChargeableDays(normalizedArrival, freeDays, false)
    const daysLeft = countChargeableDaysBetween(nowNormalized, expiryDate, false)
    
    // If expiry has passed, return negative days
    if (expiryDate.getTime() < nowNormalized.getTime()) {
      const daysOverdue = countChargeableDaysBetween(expiryDate, nowNormalized, false)
      return -daysOverdue
    }
    
    return daysLeft
  }
}

/**
 * Compute the container status.
 * @param c - Container record from database
 * @param warningThresholdDays - Days before free time ends to trigger Warning (default: 2)
 */
export function computeContainerStatus(
  c: ContainerRow,
  warningThresholdDays: number = 2
): ContainerStatus {
  if (c.is_closed) return 'Closed'
  const includeWeekends = c.weekend_chargeable
  const daysLeft = computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)
  if (daysLeft === null) return 'Safe'
  if (daysLeft > warningThresholdDays) return 'Safe'
  if (daysLeft > 0) return 'Warning'
  return 'Overdue'
}

/**
 * Compute derived fields (status, days_left, etc.)
 * @param c - Container record from database
 * @param warningThresholdDays - Days before free time ends to trigger Warning (optional, uses default if not provided)
 */
export function computeDerivedFields(
  c: ContainerRow,
  warningThresholdDays?: number
): DerivedContainer {
  const includeWeekends = c.weekend_chargeable
  const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)
  const status = computeContainerStatus(c, warningThresholdDays)
  const demurrageTiers = resolveTierArray(c.demurrage_tiers)
  const detentionTiers = resolveTierArray(c.detention_tiers)
  const demurrageRate = resolveFeeRate(c.demurrage_fee_if_late)
  const detentionRate = resolveFeeRate(c.detention_fee_rate)
  
  // Calculate demurrage LFD (Last Free Day)
  let demurrageLfdDate: string | null = null
  if (c.arrival_date) {
    const arrivalDate = parseDateFlexible(c.arrival_date)
    if (arrivalDate) {
      const normalizedArrival = startOfDay(arrivalDate)
      const freeDays = c.free_days ?? 7
      const lfdDateObj = includeWeekends
        ? new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
        : addChargeableDays(normalizedArrival, freeDays, false)
      
      if (!Number.isNaN(lfdDateObj.getTime())) {
        demurrageLfdDate = startOfDay(lfdDateObj).toISOString()
      }
    }
  }
  
  // Calculate demurrage fees if overdue
  let demurrage_fees = 0
  if (days_left !== null && days_left < 0) {
    const daysOverdue = Math.abs(days_left)
    if (DEBUG && process.env.NODE_ENV === 'development') {
      logger.debug('[computeDerivedFields:demurrage] BEFORE calculateTieredFees', {
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
      logger.debug('[computeDerivedFields:demurrage] RESULT', {
        containerId: c.id,
        containerNo: c.container_no,
        demurrage_fees
      })
    }
  }
  
  // --- DETENTION CALCULATION ---
  let detention_fees = 0
  let computedLfdDate: string | null = null
  let detentionChargeableDays: number | null = null
  let detentionStatus: 'Safe' | 'Warning' | 'Overdue' | null = null

  if (c.has_detention) {
    const gateOut = c.gate_out_date ? parseDateFlexible(c.gate_out_date) : null
    const emptyReturn = c.empty_return_date ? parseDateFlexible(c.empty_return_date) : null
    const detentionFreeDays = c.detention_free_days ?? 7

    if (gateOut) {
      const endDate = emptyReturn || new Date()
      const normalizedGateOut = startOfDay(gateOut)
      
      const lfdDateObj = includeWeekends
        ? new Date(normalizedGateOut.getTime() + detentionFreeDays * DAY_IN_MS)
        : addChargeableDays(normalizedGateOut, detentionFreeDays, false)

      if (!Number.isNaN(lfdDateObj.getTime())) {
        const normalizedLfd = startOfDay(lfdDateObj)
        const normalizedEnd = startOfDay(endDate)

        detentionChargeableDays = countChargeableDaysBetween(normalizedLfd, normalizedEnd, includeWeekends)

        computedLfdDate = normalizedLfd.toISOString()
      }

      if (detentionChargeableDays != null) {
        if (detentionChargeableDays === 0) {
          detentionStatus = 'Safe'
        } else if (detentionChargeableDays <= 2) {
          detentionStatus = 'Warning'
        } else {
          detentionStatus = 'Overdue'
        }
      }

      if (detentionChargeableDays && detentionChargeableDays > 0) {
        detention_fees = calculateTieredFees(
          detentionChargeableDays,
          detentionTiers,
          detentionRate
        )
      }

      if (DEBUG && process.env.NODE_ENV === 'development') {
        logger.debug('[computeDerivedFields:detention]', {
          containerId: c.id,
          gateOut,
          emptyReturn,
          detentionFreeDays,
          detentionChargeableDays,
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
    detention_fees,
    lfd_date: computedLfdDate ?? demurrageLfdDate ?? c.lfd_date ?? null,
    detention_chargeable_days: detentionChargeableDays,
    detention_status: detentionStatus
  }
}

