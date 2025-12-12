/**
 * Alert creation logic for container state changes
 * 
 * This module detects important container state transitions and creates
 * alert records in the alerts table.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { computeDerivedFields, type ContainerWithDerivedFields } from '@/lib/utils/containers'
import { logger } from '@/lib/utils/logger'
import { loadSettings } from '@/lib/data/settings-actions'

type ContainerRow = Database['public']['Tables']['containers']['Row']

/**
 * Check if an alert of the given event type already exists for a container.
 * Only considers uncleared alerts (cleared_at IS NULL).
 */
async function alertAlreadyExists(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  containerId: string,
  eventType: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('container_id', containerId)
    .eq('event_type', eventType)
    .is('cleared_at', null)
    .limit(1)

  if (error) {
    // Log error but don't throw - if check fails, we'll create the alert to be safe
    logger.error('[alertAlreadyExists] Failed to check existing alert', {
      organization_id: organizationId,
      container_id: containerId,
      event_type: eventType,
      error: error.message,
    })
    return false // Return false to allow alert creation if check fails
  }

  return (data?.length ?? 0) > 0
}

/**
 * Creates alert records for container state changes.
 * 
 * Detects V1 events:
 * - became_warning: Safe/null → Warning
 * - became_overdue: !Overdue → Overdue (includes demurrage starting)
 * - detention_started: detention_chargeable_days <= 0 → detention_chargeable_days > 0
 * - container_closed: is_closed false → true
 * 
 * @param params - Parameters for alert creation
 * @param params.supabase - Supabase client (server-side)
 * @param params.previousContainer - Container row before update (null for inserts)
 * @param params.newContainer - Container row after update
 * @param params.currentUserId - Current user's profile ID (optional)
 */
export async function createAlertsForContainerChange(params: {
  supabase: SupabaseClient<Database>
  previousContainer: ContainerRow | null
  newContainer: ContainerRow
  currentUserId?: string
}): Promise<void> {
  const { supabase, previousContainer, newContainer, currentUserId } = params

  // Get org-level warning threshold setting (defaults to 2 days for backward compatibility)
  let warningThresholdDays = 2
  try {
    const settings = await loadSettings()
    warningThresholdDays = settings.daysBeforeFreeTimeWarning ?? 2
  } catch (error) {
    // Fall back to default if settings can't be loaded
    logger.debug('[createAlertsForContainerChange] Failed to load settings, using default threshold', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // Compute derived fields for both old and new containers (with org-level threshold)
  const oldDerived: ContainerWithDerivedFields | null = previousContainer
    ? computeDerivedFields(previousContainer, warningThresholdDays)
    : null
  const newDerived = computeDerivedFields(newContainer, warningThresholdDays)

  const alertsToCreate: Database['public']['Tables']['alerts']['Insert'][] = []

  // 1) Became WARNING (risk approaching)
  // Condition: previous status = 'Safe' (or null) AND new status = 'Warning'
  const oldStatus = oldDerived?.status ?? null
  const newStatus = newDerived.status
  if ((oldStatus === 'Safe' || oldStatus === null) && newStatus === 'Warning') {
    // Check if alert already exists before creating
    const exists = await alertAlreadyExists(
      supabase,
      newContainer.organization_id,
      newContainer.id,
      'became_warning'
    )
    if (!exists) {
      alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'became_warning',
      severity: 'warning',
      title: `Free time running out`,
      message: newDerived.days_left !== null && newContainer.pod
        ? `Container ${newContainer.container_no} at ${newContainer.pod} has ${newDerived.days_left} free day${newDerived.days_left === 1 ? '' : 's'} left.`
        : `This container is running low on free days.`,
      metadata: {
        previous_status: oldStatus,
        new_status: newStatus,
        previous_days_left: oldDerived?.days_left ?? null,
        new_days_left: newDerived.days_left,
        container_no: newContainer.container_no,
        pod: newContainer.pod,
        pol: newContainer.pol ?? null,
        milestone: newContainer.milestone,
      },
      created_by_user_id: currentUserId ?? null,
      })
    }

    // Note: Email drafts are no longer auto-created for individual container events.
    // Daily digests are generated separately via createDailyDigestDraftsForToday().
  }

  // 2) Became OVERDUE (cost started - demurrage begins when overdue)
  // Condition: previous status != 'Overdue' AND new status = 'Overdue'
  if (oldStatus !== 'Overdue' && newStatus === 'Overdue') {
    // Check if alert already exists before creating (protects against duplicates and previousContainer fetch failures)
    const exists = await alertAlreadyExists(
      supabase,
      newContainer.organization_id,
      newContainer.id,
      'became_overdue'
    )
    if (!exists) {
      const daysOverdue = newDerived.days_left !== null ? Math.abs(newDerived.days_left) : 0
      alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'became_overdue',
      severity: 'critical',
      title: 'Container is overdue – demurrage started',
      message: daysOverdue > 0 && newContainer.pod
        ? `Container ${newContainer.container_no} at ${newContainer.pod} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past free time. Demurrage charges are now accruing.`
        : `Free time has ended — demurrage charges may now apply.`,
      metadata: {
        previous_status: oldStatus,
        new_status: newStatus,
        previous_days_left: oldDerived?.days_left ?? null,
        new_days_left: newDerived.days_left,
        days_overdue: daysOverdue,
        container_no: newContainer.container_no,
        pod: newContainer.pod,
        pol: newContainer.pol ?? null,
        milestone: newContainer.milestone,
        estimated_demurrage_fees: newDerived.demurrage_fees > 0 ? newDerived.demurrage_fees : undefined,
      },
      created_by_user_id: currentUserId ?? null,
      })
    }

    // Note: Email drafts are no longer auto-created for individual container events.
    // Daily digests are generated separately via createDailyDigestDraftsForToday().
  }

  // 3) Detention started
  // Condition: previous detention_chargeable_days <= 0 AND new detention_chargeable_days > 0
  const oldDetentionDays = oldDerived?.detention_chargeable_days ?? null
  const newDetentionDays = newDerived.detention_chargeable_days
  if (
    (oldDetentionDays === null || oldDetentionDays <= 0) &&
    newDetentionDays !== null && newDetentionDays > 0
  ) {
    // Check if alert already exists before creating
    const exists = await alertAlreadyExists(
      supabase,
      newContainer.organization_id,
      newContainer.id,
      'detention_started'
    )
    if (!exists) {
      alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'detention_started',
      severity: 'critical',
      title: `Detention now being charged`,
      message: newDetentionDays !== null && newDetentionDays > 0
        ? `Container ${newContainer.container_no} has been out ${newDetentionDays} day${newDetentionDays === 1 ? '' : 's'} beyond free time.`
        : `This container may now incur detention charges.`,
      metadata: {
        previous_detention_days: oldDetentionDays,
        new_detention_days: newDetentionDays,
        container_no: newContainer.container_no,
        pod: newContainer.pod,
        pol: newContainer.pol ?? null,
        milestone: newContainer.milestone,
        gate_out_date: newContainer.gate_out_date,
        empty_return_date: newContainer.empty_return_date,
        lfd_date: newDerived.lfd_date,
        estimated_detention_fees: newDerived.detention_fees > 0 ? newDerived.detention_fees : undefined,
      },
      created_by_user_id: currentUserId ?? null,
      })
    }

    // Note: Email drafts are no longer auto-created for individual container events.
    // Daily digests are generated separately via createDailyDigestDraftsForToday().
  }

  // 4) Container closed
  // Condition: previous is_closed = false AND new is_closed = true
  const oldIsClosed = previousContainer?.is_closed ?? false
  const newIsClosed = newContainer.is_closed
  if (!oldIsClosed && newIsClosed) {
    // Check if alert already exists before creating
    const exists = await alertAlreadyExists(
      supabase,
      newContainer.organization_id,
      newContainer.id,
      'container_closed'
    )
    if (!exists) {
      alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'container_closed',
      severity: 'info',
      title: `Container completed`,
      message: newContainer.pod
        ? `Container ${newContainer.container_no} at ${newContainer.pod} is closed — no further action needed.`
        : `This container is closed — no further action needed.`,
      metadata: {
        container_no: newContainer.container_no,
        pod: newContainer.pod,
        pol: newContainer.pol ?? null,
        milestone: newContainer.milestone,
        final_status: newStatus,
        final_days_left: newDerived.days_left,
      },
      created_by_user_id: currentUserId ?? null,
      })
    }
  }

  // Insert all alerts if any were detected
  if (alertsToCreate.length > 0) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[createAlertsForContainerChange] Creating alerts', {
        container_id: newContainer.id,
        container_no: newContainer.container_no,
        alert_count: alertsToCreate.length,
        event_types: alertsToCreate.map(a => a.event_type),
      })
    }

    const { error } = await supabase
      .from('alerts')
      .insert(alertsToCreate)

    if (error) {
      // Log error but don't throw - we don't want to break the main container update
      logger.error('[createAlertsForContainerChange] Failed to create alerts', {
        container_id: newContainer.id,
        error: error.message,
        alert_count: alertsToCreate.length,
      })
    } else if (process.env.NODE_ENV === 'development') {
      logger.debug('[createAlertsForContainerChange] Successfully created alerts', {
        container_id: newContainer.id,
        alert_count: alertsToCreate.length,
      })
    }

  }
}

