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

type ContainerRow = Database['public']['Tables']['containers']['Row']

/**
 * Creates alert records for container state changes.
 * 
 * Detects V1 events:
 * - became_warning: Safe/null → Warning
 * - became_overdue: !Overdue → Overdue
 * - demurrage_started: days_left >= 0 → days_left < 0
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
      title: `Container ${newContainer.container_no} is now WARNING`,
      message: `Container ${newContainer.container_no} at ${newContainer.port} has ${newDerived.days_left ?? 'unknown'} days left until demurrage charges begin.`,
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
  }

  // 2) Became OVERDUE (cost started)
  // Condition: previous status != 'Overdue' AND new status = 'Overdue'
  if (oldStatus !== 'Overdue' && newStatus === 'Overdue') {
    const daysOverdue = newDerived.days_left !== null ? Math.abs(newDerived.days_left) : 0
    alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'became_overdue',
      severity: 'critical',
      title: `Container ${newContainer.container_no} is now OVERDUE`,
      message: `Container ${newContainer.container_no} at ${newContainer.port} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Demurrage charges have started.`,
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
  }

  // 3) Demurrage started
  // Condition: previous days_left >= 0 AND new days_left < 0
  const oldDaysLeft = oldDerived?.days_left ?? null
  const newDaysLeft = newDerived.days_left
  if (
    oldDaysLeft !== null && oldDaysLeft >= 0 &&
    newDaysLeft !== null && newDaysLeft < 0
  ) {
    const daysOverdue = Math.abs(newDaysLeft)
    alertsToCreate.push({
      organization_id: newContainer.organization_id,
      container_id: newContainer.id,
      list_id: newContainer.list_id,
      event_type: 'demurrage_started',
      severity: 'critical',
      title: `Demurrage charges started for ${newContainer.container_no}`,
      message: `Container ${newContainer.container_no} at ${newContainer.port} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue. Demurrage fees are now being charged.`,
      metadata: {
        previous_days_left: oldDaysLeft,
        new_days_left: newDaysLeft,
        days_overdue: daysOverdue,
        container_no: newContainer.container_no,
        port: newContainer.port,
        milestone: newContainer.milestone,
        lfd_date: newDerived.lfd_date,
      },
      created_by_user_id: currentUserId ?? null,
    })
  }

  // 4) Detention started
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
      title: `Detention charges started for ${newContainer.container_no}`,
      message: `Container ${newContainer.container_no} at ${newContainer.port} has ${newDetentionDays} chargeable detention day${newDetentionDays !== 1 ? 's' : ''}. Detention fees are now being charged.`,
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
      title: `Container ${newContainer.container_no} has been closed`,
      message: `Container ${newContainer.container_no} at ${newContainer.port} has been marked as closed.`,
      metadata: {
        container_no: newContainer.container_no,
        port: newContainer.port,
        milestone: newContainer.milestone,
        final_status: newStatus,
        final_days_left: newDaysLeft,
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

