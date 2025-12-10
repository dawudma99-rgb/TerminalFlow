'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeDerivedFields } from '@/lib/utils/containers'
import type { ContainerRecord } from '@/lib/data/containers-actions'
import { logger } from '@/lib/utils/logger'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

const DEFAULT_WARNING_THRESHOLD_DAYS = 2

/**
 * Type for the overdue candidate result.
 * Contains essential fields for debugging purposes.
 */
export type OverdueCandidate = {
  id: string
  container_no: string | null
  status: 'Overdue'
  days_left: number
  arrival_date: string | null
  free_days: number | null
  is_closed: boolean
  organization_id: string
  list_id: string | null
  created_at: string | null
  updated_at: string | null
  // Additional useful fields for debugging
  demurrage_fees: number
  detention_fees: number
  pod: string | null
  pol: string | null
  milestone: string | null
}

/**
 * Finds all containers in the current organization that are currently overdue.
 * 
 * This is a read-only debug function that:
 * - Queries containers for the current user's organization
 * - Filters to non-closed containers with arrival_date and free_days
 * - Computes derived fields (status, days_left) for each container
 * - Returns only those with status === 'Overdue'
 * 
 * Does NOT create alerts or send emails - this is for diagnostic purposes only.
 * 
 * @returns Array of overdue containers with computed fields
 */
export async function getOverdueCandidatesForCurrentOrg(): Promise<OverdueCandidate[]> {
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  // Query containers for this organization
  // Filter to non-closed containers that have arrival_date and free_days
  // (required to compute status)
  const { data: containers, error } = await supabase
    .from('containers')
    .select('*')
    .eq('organization_id', orgId)
    .eq('is_closed', false)
    .not('arrival_date', 'is', null)
    .not('free_days', 'is', null)
    .order('arrival_date', { ascending: true })

  if (error) {
    logger.error('[getOverdueCandidatesForCurrentOrg] Failed to fetch containers', {
      organization_id: orgId,
      error: error.message,
    })
    throw new Error(`Failed to fetch containers: ${error.message}`)
  }

  if (!containers || containers.length === 0) {
    return []
  }

  // Compute derived fields for each container and filter to overdue ones
  const overdueCandidates: OverdueCandidate[] = []

  for (const container of containers) {
    // Compute derived fields (status, days_left, etc.)
    const derived = computeDerivedFields(container as ContainerRecord)

    // Only include containers that are currently overdue
    if (derived.status === 'Overdue') {
      overdueCandidates.push({
        id: container.id,
        container_no: container.container_no ?? null,
        status: 'Overdue',
        days_left: derived.days_left ?? 0, // days_left should be negative for overdue
        arrival_date: container.arrival_date ?? null,
        free_days: container.free_days ?? null,
        is_closed: container.is_closed ?? false,
        organization_id: container.organization_id,
        list_id: container.list_id ?? null,
        created_at: container.created_at ?? null,
        updated_at: container.updated_at ?? null,
        demurrage_fees: derived.demurrage_fees,
        detention_fees: derived.detention_fees,
        pod: container.pod ?? null,
        pol: container.pol ?? null,
        milestone: container.milestone ?? null,
      })
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('[getOverdueCandidatesForCurrentOrg] Found overdue candidates', {
      organization_id: orgId,
      total_containers: containers.length,
      overdue_count: overdueCandidates.length,
    })
  }

  return overdueCandidates
}

/**
 * Summary type for backfill operations.
 */
export type BackfillSummary = {
  totalWarnings: number
  createdAlerts: number
  skippedExisting: number
}

/**
 * Backfills `became_overdue` alerts for all overdue containers in the current organization.
 * 
 * This function:
 * - Gets all overdue containers for the current user's organization
 * - For each overdue container, checks if a `became_overdue` alert already exists
 * - If no such alert exists, creates a new one
 * - Returns a summary of the operation
 * 
 * Does NOT send emails - this is for manual backfilling/debugging only.
 * 
 * @returns Summary object with counts of total overdue containers, created alerts, and skipped (existing) alerts
 */
export async function backfillOverdueAlertsForCurrentOrg(): Promise<BackfillSummary> {
  const emptySummary: BackfillSummary = {
    totalWarnings: 0,
    createdAlerts: 0,
    skippedExisting: 0,
  }

  let supabase: SupabaseClient<Database>
  let organizationId: string

  try {
    const ctx = await getServerAuthContext()
    supabase = ctx.supabase
    organizationId = ctx.organizationId

    if (!organizationId) {
      logger.warn('[backfillOverdueAlertsForCurrentOrg] No organizationId in auth context')
      return emptySummary
    }
  } catch (error) {
    logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to get auth context', {
      error: error instanceof Error ? error.message : String(error),
    })
    return emptySummary
  }

  let containers: ContainerRecord[] = []

  try {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_closed', false)
      .not('arrival_date', 'is', null)
      .not('free_days', 'is', null)

    if (error) {
      logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to fetch containers', {
        organizationId,
        error: error.message,
      })
      return emptySummary
    }

    containers = data ?? []
    if (containers.length === 0) return emptySummary
  } catch (error) {
    logger.error('[backfillOverdueAlertsForCurrentOrg] Unexpected error fetching containers', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return emptySummary
  }

  const warningThresholdDays = DEFAULT_WARNING_THRESHOLD_DAYS ?? 2
  const overdueContainers: ContainerRecord[] = []

  for (const c of containers) {
    try {
      const derived = computeDerivedFields(c, warningThresholdDays)
      if (derived.status === 'Overdue') overdueContainers.push(c)
    } catch (error) {
      logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to compute derived fields', {
        container_id: c.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  let createdAlerts = 0
  let skippedExisting = 0

  for (const container of overdueContainers) {
    try {
      const { data: existingAlerts, error: existingError } = await supabase
        .from('alerts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('container_id', container.id)
        .eq('event_type', 'became_overdue')
        .is('cleared_at', null)
        .limit(1)

      if (existingError) {
        logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to check existing overdue alerts', {
          container_id: container.id,
          error: existingError.message,
        })
        continue
      }

      if (existingAlerts?.length) {
        skippedExisting++
        continue
      }

      const derived = computeDerivedFields(container, warningThresholdDays)

      const { error: insertError } = await supabase.from('alerts').insert({
        organization_id: organizationId,
        container_id: container.id,
        list_id: container.list_id,
        event_type: 'became_overdue',
        severity: 'critical',
        title: 'Container is overdue – demurrage started',
        message: `Container ${container.container_no} is overdue. Demurrage has likely started.`,
        metadata: {
          previous_status: derived.status,
          new_status: 'Overdue',
          days_left: derived.days_left,
          days_overdue: derived.days_left != null ? -Math.min(derived.days_left, 0) : null,
          container_no: container.container_no,
          pol: (container as any).pol ?? null,
          pod: (container as any).pod ?? null,
        },
      })

      if (insertError) {
        logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to insert overdue alert', {
          container_id: container.id,
          error: insertError.message,
        })
        continue
      }

      createdAlerts++
    } catch (error) {
      logger.error('[backfillOverdueAlertsForCurrentOrg] Unexpected error while processing container', {
        container_id: container.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    totalWarnings: overdueContainers.length,
    createdAlerts,
    skippedExisting,
  }
}

/**
 * Backfills `became_warning` alerts for all warning containers in the current organization.
 * 
 * This function:
 * - Gets all warning containers for the current user's organization
 * - For each warning container, checks if a `became_warning` alert already exists
 * - If no such alert exists, creates a new one
 * - Returns a summary of the operation
 * 
 * Does NOT send emails - this is for automatic backfilling on dashboard load.
 * 
 * @returns Summary object with counts of total warning containers, created alerts, and skipped (existing) alerts
 */
export async function backfillWarningAlertsForCurrentOrg(): Promise<BackfillSummary> {
  const emptySummary: BackfillSummary = {
    totalWarnings: 0,
    createdAlerts: 0,
    skippedExisting: 0,
  }

  let supabase: SupabaseClient<Database>
  let organizationId: string

  try {
    const ctx = await getServerAuthContext()
    supabase = ctx.supabase
    organizationId = ctx.organizationId

    if (!organizationId) {
      logger.warn('[backfillWarningAlertsForCurrentOrg] No organizationId in auth context')
      return emptySummary
    }
  } catch (error) {
    logger.error('[backfillWarningAlertsForCurrentOrg] Failed to get auth context', {
      error: error instanceof Error ? error.message : String(error),
    })
    return emptySummary
  }

  let containers: ContainerRecord[] = []

  try {
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_closed', false)
      .not('arrival_date', 'is', null)
      .not('free_days', 'is', null)

    if (error) {
      logger.error('[backfillWarningAlertsForCurrentOrg] Failed to fetch containers', {
        organizationId,
        error: error.message,
      })
      return emptySummary
    }

    containers = data ?? []
    if (containers.length === 0) return emptySummary
  } catch (error) {
    logger.error('[backfillWarningAlertsForCurrentOrg] Unexpected error fetching containers', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
    return emptySummary
  }

  const warningThresholdDays = DEFAULT_WARNING_THRESHOLD_DAYS ?? 2
  const warningContainers: ContainerRecord[] = []

  for (const c of containers) {
    try {
      const derived = computeDerivedFields(c, warningThresholdDays)
      if (derived.status === 'Warning') warningContainers.push(c)
    } catch (error) {
      logger.error('[backfillWarningAlertsForCurrentOrg] Failed to compute derived fields', {
        container_id: c.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  let createdAlerts = 0
  let skippedExisting = 0

  for (const container of warningContainers) {
    try {
      const { data: existingAlerts, error: existingError } = await supabase
        .from('alerts')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('container_id', container.id)
        .eq('event_type', 'became_warning')
        .is('cleared_at', null)
        .limit(1)

      if (existingError) {
        logger.error('[backfillWarningAlertsForCurrentOrg] Failed to check existing warning alerts', {
          container_id: container.id,
          error: existingError.message,
        })
        continue
      }

      if (existingAlerts?.length) {
        skippedExisting++
        continue
      }

      const derived = computeDerivedFields(container, warningThresholdDays)

      const { error: insertError } = await supabase.from('alerts').insert({
        organization_id: organizationId,
        container_id: container.id,
        list_id: container.list_id,
        event_type: 'became_warning',
        severity: 'warning',
        title: 'Free time running out',
        message: `Container ${container.container_no} is approaching the end of free time.`,
        metadata: {
          previous_status: derived.status,
          new_status: 'Warning',
          days_left: derived.days_left,
          container_no: container.container_no,
          pol: (container as any).pol ?? null,
          pod: (container as any).pod ?? null,
        },
      })

      if (insertError) {
        logger.error('[backfillWarningAlertsForCurrentOrg] Failed to insert warning alert', {
          container_id: container.id,
          error: insertError.message,
        })
        continue
      }

      createdAlerts++
    } catch (error) {
      logger.error('[backfillWarningAlertsForCurrentOrg] Unexpected error while processing container', {
        container_id: container.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    totalWarnings: warningContainers.length,
    createdAlerts,
    skippedExisting,
  }
}

