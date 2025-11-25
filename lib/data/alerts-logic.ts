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
import { sendAlertEmail } from '@/lib/email/sendAlertEmail'
import { createEmailDraftForContainerEvent } from '@/lib/data/email-drafts-actions'

type ContainerRow = Database['public']['Tables']['containers']['Row']

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

  // Compute derived fields for both old and new containers
  const oldDerived: ContainerWithDerivedFields | null = previousContainer
    ? computeDerivedFields(previousContainer)
    : null
  const newDerived = computeDerivedFields(newContainer)

  const alertsToCreate: Database['public']['Tables']['alerts']['Insert'][] = []

  // 1) Became WARNING (risk approaching)
  // Condition: previous status = 'Safe' (or null) AND new status = 'Warning'
  const oldStatus = oldDerived?.status ?? null
  const newStatus = newDerived.status
  if ((oldStatus === 'Safe' || oldStatus === null) && newStatus === 'Warning') {
    alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'became_warning',
      severity: 'warning',
      title: `Free time running out`,
      message: newDerived.days_left !== null && newContainer.port
        ? `Container ${newContainer.container_no} at ${newContainer.port} has ${newDerived.days_left} free day${newDerived.days_left === 1 ? '' : 's'} left.`
        : `This container is running low on free days.`,
      metadata: {
        previous_status: oldStatus,
        new_status: newStatus,
        previous_days_left: oldDerived?.days_left ?? null,
        new_days_left: newDerived.days_left,
        container_no: newContainer.container_no,
        port: newContainer.port,
        milestone: newContainer.milestone,
      },
      created_by_user_id: currentUserId ?? null,
    })

    // Prepare client-facing draft (fire-and-forget but catch errors)
    // Pass the supabase client and organization_id we already have
    createEmailDraftForContainerEvent({
      containerId: newContainer.id,
      eventType: 'lfd_warning',
      generatedByUserId: currentUserId,
      organizationId: newContainer.organization_id,
      supabase,
    }).catch((err) => {
      logger.error('[createAlertsForContainerChange] Failed to create email draft for lfd_warning', {
        container_id: newContainer.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  // 2) Became OVERDUE (cost started - demurrage begins when overdue)
  // Condition: previous status != 'Overdue' AND new status = 'Overdue'
  if (oldStatus !== 'Overdue' && newStatus === 'Overdue') {
    const daysOverdue = newDerived.days_left !== null ? Math.abs(newDerived.days_left) : 0
    alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'became_overdue',
      severity: 'critical',
      title: 'Container is overdue – demurrage started',
      message: daysOverdue > 0 && newContainer.port
        ? `Container ${newContainer.container_no} at ${newContainer.port} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past free time. Demurrage charges are now accruing.`
        : `Free time has ended — demurrage charges may now apply.`,
      metadata: {
        previous_status: oldStatus,
        new_status: newStatus,
        previous_days_left: oldDerived?.days_left ?? null,
        new_days_left: newDerived.days_left,
        days_overdue: daysOverdue,
        container_no: newContainer.container_no,
        port: newContainer.port,
        milestone: newContainer.milestone,
      },
      created_by_user_id: currentUserId ?? null,
    })

    // Prepare client-facing draft (fire-and-forget but catch errors)
    // Pass the supabase client and organization_id we already have
    createEmailDraftForContainerEvent({
      containerId: newContainer.id,
      eventType: 'became_overdue',
      generatedByUserId: currentUserId,
      organizationId: newContainer.organization_id,
      supabase,
    }).catch((err) => {
      logger.error('[createAlertsForContainerChange] Failed to create email draft for became_overdue', {
        container_id: newContainer.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  // 3) Detention started
  // Condition: previous detention_chargeable_days <= 0 AND new detention_chargeable_days > 0
  const oldDetentionDays = oldDerived?.detention_chargeable_days ?? null
  const newDetentionDays = newDerived.detention_chargeable_days
  if (
    (oldDetentionDays === null || oldDetentionDays <= 0) &&
    newDetentionDays !== null && newDetentionDays > 0
  ) {
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
        port: newContainer.port,
        milestone: newContainer.milestone,
        gate_out_date: newContainer.gate_out_date,
        empty_return_date: newContainer.empty_return_date,
        lfd_date: newDerived.lfd_date,
      },
      created_by_user_id: currentUserId ?? null,
    })

    // Prepare client-facing draft (fire-and-forget but catch errors)
    // Pass the supabase client and organization_id we already have
    createEmailDraftForContainerEvent({
      containerId: newContainer.id,
      eventType: 'detention_started',
      generatedByUserId: currentUserId,
      organizationId: newContainer.organization_id,
      supabase,
    }).catch((err) => {
      logger.error('[createAlertsForContainerChange] Failed to create email draft for detention_started', {
        container_id: newContainer.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  // 5) Container closed
  // Condition: previous is_closed = false AND new is_closed = true
  const oldIsClosed = previousContainer?.is_closed ?? false
  const newIsClosed = newContainer.is_closed
  if (!oldIsClosed && newIsClosed) {
    alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'container_closed',
      severity: 'info',
      title: `Container completed`,
      message: newContainer.port
        ? `Container ${newContainer.container_no} at ${newContainer.port} is closed — no further action needed.`
        : `This container is closed — no further action needed.`,
      metadata: {
        container_no: newContainer.container_no,
        port: newContainer.port,
        milestone: newContainer.milestone,
        final_status: newStatus,
        final_days_left: newDerived.days_left,
      },
      created_by_user_id: currentUserId ?? null,
    })
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

