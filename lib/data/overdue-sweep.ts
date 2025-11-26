'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { computeDerivedFields } from '@/lib/utils/containers'
import type { ContainerRecord } from '@/lib/utils/containers'
import { logger } from '@/lib/utils/logger'
import { createEmailDraftForContainerEvent } from '@/lib/data/email-drafts-actions'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

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
  port: string | null
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
        port: container.port ?? null,
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
  totalOverdue: number
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
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  // Get all overdue candidates
  const overdueCandidates = await getOverdueCandidatesForCurrentOrg()

  if (overdueCandidates.length === 0) {
    return {
      totalOverdue: 0,
      createdAlerts: 0,
      skippedExisting: 0,
    }
  }

  let createdAlerts = 0
  let skippedExisting = 0

  // Process each overdue container
  for (const candidate of overdueCandidates) {
    // Check if a `became_overdue` alert already exists for this container
    const { data: existingAlerts, error: checkError } = await supabase
      .from('alerts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('container_id', candidate.id)
      .eq('event_type', 'became_overdue')
      .limit(1)

    if (checkError) {
      logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to check existing alerts', {
        container_id: candidate.id,
        error: checkError.message,
      })
      // Skip this container if we can't check for existing alerts
      skippedExisting++
      continue
    }

    // If an alert already exists, skip this container
    if (existingAlerts && existingAlerts.length > 0) {
      skippedExisting++
      continue
    }

    // Calculate days overdue (days_left is negative for overdue containers)
    const daysOverdue = Math.abs(candidate.days_left)

    // Create the alert row (matching the structure from createAlertsForContainerChange)
    const alertToInsert: Database['public']['Tables']['alerts']['Insert'] = {
      organization_id: orgId,
      container_id: candidate.id,
      list_id: candidate.list_id,
      event_type: 'became_overdue',
      severity: 'critical',
      title: 'Container is overdue – demurrage started',
      message:
        daysOverdue > 0 && candidate.port
          ? `Container ${candidate.container_no} at ${candidate.port} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past free time. Demurrage charges are now accruing.`
          : `Free time has ended — demurrage charges may now apply.`,
      metadata: {
        previous_status: null, // We don't know the previous status in backfill
        new_status: 'Overdue',
        previous_days_left: null,
        new_days_left: candidate.days_left,
        days_overdue: daysOverdue,
        container_no: candidate.container_no,
        port: candidate.port,
        milestone: candidate.milestone,
        arrival_date: candidate.arrival_date,
        free_days: candidate.free_days,
        // Mark as backfilled for debugging
        backfilled: true,
      },
      created_by_user_id: null, // No user action - this is a backfill
    }

    // Insert the alert
    const { error: insertError } = await supabase.from('alerts').insert(alertToInsert)

    if (insertError) {
      logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to create alert', {
        container_id: candidate.id,
        container_no: candidate.container_no,
        error: insertError.message,
      })
      // Continue processing other containers even if one fails
      skippedExisting++
    } else {
      createdAlerts++
      // Create email draft using the same supabase client and orgId we already have
      // Fire-and-forget but catch errors for logging
      createEmailDraftForContainerEvent({
        containerId: candidate.id,
        eventType: 'became_overdue',
        organizationId: orgId,
        supabase,
      }).catch((err) => {
        logger.error('[backfillOverdueAlertsForCurrentOrg] Failed to create email draft', {
          container_id: candidate.id,
          container_no: candidate.container_no,
          error: err instanceof Error ? err.message : String(err),
        })
      })
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[backfillOverdueAlertsForCurrentOrg] Created alert', {
          container_id: candidate.id,
          container_no: candidate.container_no,
        })
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('[backfillOverdueAlertsForCurrentOrg] Backfill complete', {
      organization_id: orgId,
      totalOverdue: overdueCandidates.length,
      createdAlerts,
      skippedExisting,
    })
  }

  return {
    totalOverdue: overdueCandidates.length,
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
    logger.error('[backfillWarningAlertsForCurrentOrg] Failed to fetch containers', {
      organization_id: orgId,
      error: error.message,
    })
    throw new Error(`Failed to fetch containers: ${error.message}`)
  }

  if (!containers || containers.length === 0) {
    return {
      totalOverdue: 0, // Reusing BackfillSummary type - totalOverdue represents total warnings here
      createdAlerts: 0,
      skippedExisting: 0,
    }
  }

  // Compute derived fields for each container and filter to warning ones
  const warningCandidates: Array<{
    id: string
    container_no: string | null
    days_left: number | null
    organization_id: string
    list_id: string | null
    port: string | null
    milestone: string | null
    arrival_date: string | null
    free_days: number | null
  }> = []

  for (const container of containers) {
    // Compute derived fields (status, days_left, etc.)
    const derived = computeDerivedFields(container as ContainerRecord)

    // Only include containers that are currently in Warning status
    if (derived.status === 'Warning') {
      warningCandidates.push({
        id: container.id,
        container_no: container.container_no ?? null,
        days_left: derived.days_left,
        organization_id: container.organization_id,
        list_id: container.list_id ?? null,
        port: container.port ?? null,
        milestone: container.milestone ?? null,
        arrival_date: container.arrival_date ?? null,
        free_days: container.free_days ?? null,
      })
    }
  }

  if (warningCandidates.length === 0) {
    return {
      totalOverdue: 0,
      createdAlerts: 0,
      skippedExisting: 0,
    }
  }

  let createdAlerts = 0
  let skippedExisting = 0

  // Process each warning container
  for (const candidate of warningCandidates) {
    // Check if a `became_warning` alert already exists for this container
    const { data: existingAlerts, error: checkError } = await supabase
      .from('alerts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('container_id', candidate.id)
      .eq('event_type', 'became_warning')
      .limit(1)

    if (checkError) {
      logger.error('[backfillWarningAlertsForCurrentOrg] Failed to check existing alerts', {
        container_id: candidate.id,
        error: checkError.message,
      })
      // Skip this container if we can't check for existing alerts
      skippedExisting++
      continue
    }

    // If an alert already exists, skip this container
    if (existingAlerts && existingAlerts.length > 0) {
      skippedExisting++
      continue
    }

    // Get days_left for message (should be positive for warning status)
    const daysLeft = candidate.days_left ?? 0

    // Create the alert row (matching the structure from createAlertsForContainerChange)
    const alertToInsert: Database['public']['Tables']['alerts']['Insert'] = {
      organization_id: orgId,
      container_id: candidate.id,
      list_id: candidate.list_id,
      event_type: 'became_warning',
      severity: 'warning',
      title: 'Free time running out',
      message:
        daysLeft > 0 && candidate.port
          ? `Container ${candidate.container_no} at ${candidate.port} has ${daysLeft} free day${daysLeft === 1 ? '' : 's'} left.`
          : 'This container is running low on free days.',
      metadata: {
        previous_status: null, // We don't know the previous status in backfill
        new_status: 'Warning',
        previous_days_left: null,
        new_days_left: candidate.days_left,
        days_left: candidate.days_left, // Include for reference
        container_no: candidate.container_no,
        port: candidate.port,
        milestone: candidate.milestone,
        arrival_date: candidate.arrival_date,
        free_days: candidate.free_days,
        // Mark as backfilled for debugging
        backfilled: true,
      },
      created_by_user_id: null, // No user action - this is a backfill
    }

    // Insert the alert
    const { error: insertError } = await supabase.from('alerts').insert(alertToInsert)

    if (insertError) {
      logger.error('[backfillWarningAlertsForCurrentOrg] Failed to create alert', {
        container_id: candidate.id,
        container_no: candidate.container_no,
        error: insertError.message,
      })
      // Continue processing other containers even if one fails
      skippedExisting++
    } else {
      createdAlerts++
      // Create email draft using the same supabase client and orgId we already have
      // Fire-and-forget but catch errors for logging
      createEmailDraftForContainerEvent({
        containerId: candidate.id,
        eventType: 'lfd_warning',
        organizationId: orgId,
        supabase,
      }).catch((err) => {
        logger.error('[backfillWarningAlertsForCurrentOrg] Failed to create email draft', {
          container_id: candidate.id,
          container_no: candidate.container_no,
          error: err instanceof Error ? err.message : String(err),
        })
      })
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[backfillWarningAlertsForCurrentOrg] Created alert', {
          container_id: candidate.id,
          container_no: candidate.container_no,
        })
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    logger.debug('[backfillWarningAlertsForCurrentOrg] Backfill complete', {
      organization_id: orgId,
      totalWarning: warningCandidates.length,
      createdAlerts,
      skippedExisting,
    })
  }

  return {
    totalOverdue: warningCandidates.length, // Reusing BackfillSummary type - totalOverdue represents total warnings here
    createdAlerts,
    skippedExisting,
  }
}

