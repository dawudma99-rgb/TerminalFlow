'use server'

import type { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'
import { revalidatePath } from 'next/cache'
import { getServerAuthContext, type ServerAuthContext } from '@/lib/auth/serverAuthContext'
import { getTodayUtcRange } from '@/lib/utils/date-range'

export type AlertRow = Database['public']['Tables']['alerts']['Row'] & {
  container_no?: string | null
  list_name?: string | null
  // Cleared flag (may not exist in DB yet, handled gracefully)
  cleared_at?: string | null
}

// --- Read ---
/**
 * Fetch alerts for the current authenticated user / organization.
 * Returns alerts with joined container_no and list_name.
 * Ordered by created_at DESC (newest first).
 */
export async function fetchAlerts(params?: {
  limit?: number
  onlyUnread?: boolean
}): Promise<AlertRow[]> {
  let context: ServerAuthContext
  
  try {
    context = await getServerAuthContext()
  } catch {
    // If not authenticated, return empty array (graceful failure)
    return []
  }
  
  const { supabase, organizationId } = context
  const limit = params?.limit ?? 50
  const onlyUnread = params?.onlyUnread ?? false

  // Build query with joins to get container_no and list_name
  // Using Supabase's foreign key relationship syntax
  // Note: Supabase returns relationships as objects (not arrays) for many-to-one relationships
  let query = supabase
    .from('alerts')
    .select(`
      *,
      containers!alerts_container_id_fkey(container_no),
      container_lists!alerts_list_id_fkey(name)
    `)
    .eq('organization_id', organizationId)

  // Filter by seen_at if onlyUnread is true
  // Note: seen_at may exist in DB even if not in types yet
  if (onlyUnread) {
    query = query.is('seen_at', null)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Supabase fetchAlerts error', { error: error.message })
    throw new Error(`Supabase fetchAlerts error: ${error.message}`)
  }

  if (!data) return []

  // Map the results to AlertRow format
  // Supabase returns nested objects for relationships
  // Handle both array and object cases for safety
  return data.map((alert: any) => {
    // Extract container_no - Supabase may return as object or array
    const container = alert.containers
    const container_no = Array.isArray(container)
      ? (container[0]?.container_no ?? null)
      : (container?.container_no ?? null)

    // Extract list_name - Supabase may return as object or array
    const list = alert.container_lists
    const list_name = Array.isArray(list)
      ? (list[0]?.name ?? null)
      : (list?.name ?? null)

      return {
        id: alert.id,
        organization_id: alert.organization_id,
        container_id: alert.container_id,
        list_id: alert.list_id,
        event_type: alert.event_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
        created_by_user_id: alert.created_by_user_id,
        created_at: alert.created_at,
        seen_at: alert.seen_at ?? null,
        // Include joined fields
        container_no,
        list_name,
      } as AlertRow
  })
}

// --- Paginated Read ---
/**
 * Fetch alerts with pagination support.
 * Returns alerts plus a hasMore boolean indicating if there are more pages.
 */
export async function fetchAlertsPage(params: {
  page: number
  pageSize: number
}): Promise<{ alerts: AlertRow[]; hasMore: boolean }> {
  let context: ServerAuthContext
  
  try {
    context = await getServerAuthContext()
  } catch {
    // If not authenticated, return empty result (graceful failure)
    return { alerts: [], hasMore: false }
  }
  
  const { supabase, organizationId } = context

  const { page, pageSize } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Build query with joins to get container_no and list_name
  // Filter out cleared alerts (show only active alerts)
  let query = supabase
    .from('alerts')
    .select(
      `
      *,
      containers!alerts_container_id_fkey(container_no),
      container_lists!alerts_list_id_fkey(name)
    `,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .is('cleared_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    logger.error('Supabase fetchAlertsPage error', { error: error.message })
    throw new Error(`Supabase fetchAlertsPage error: ${error.message}`)
  }

  if (!data) return { alerts: [], hasMore: false }

  // Map the results to AlertRow format
  const alerts: AlertRow[] = data.map((alert: any) => {
    const container = alert.containers
    const container_no = Array.isArray(container)
      ? (container[0]?.container_no ?? null)
      : (container?.container_no ?? null)

    const list = alert.container_lists
    const list_name = Array.isArray(list)
      ? (list[0]?.name ?? null)
      : (list?.name ?? null)

    return {
      id: alert.id,
      organization_id: alert.organization_id,
      container_id: alert.container_id,
      list_id: alert.list_id,
      event_type: alert.event_type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      created_by_user_id: alert.created_by_user_id,
      created_at: alert.created_at,
      seen_at: alert.seen_at ?? null,
      container_no,
      list_name,
      // Cleared flag (gracefully handle missing column)
      cleared_at: (alert as any).cleared_at ?? null,
    } as AlertRow
  })

  // Determine if there are more pages
  const hasMore = count !== null ? from + alerts.length < count : false

  return { alerts, hasMore }
}

// --- Recent Alerts for Dashboard ---
/**
 * Fetch alerts created in the last 24 hours for the dashboard "Changes Since Yesterday" section.
 * Returns alerts with joined container_no and list_name, grouped by event_type.
 */
export async function fetchRecentAlertsForDashboard(): Promise<AlertRow[]> {
  let context: ServerAuthContext
  
  try {
    context = await getServerAuthContext()
  } catch {
    return []
  }
  
  const { supabase, organizationId } = context

  // Calculate 24 hours ago (UTC)
  const now = new Date()
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Build query with joins to get container_no and list_name
  // Filter out cleared alerts (only show active alerts)
  let query = supabase
    .from('alerts')
    .select(
      `
      *,
      containers!alerts_container_id_fkey(container_no),
      container_lists!alerts_list_id_fkey(name)
    `
    )
    .eq('organization_id', organizationId)
    .is('cleared_at', null)
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  const { data, error } = await query

  if (error) {
    logger.error('Supabase fetchRecentAlertsForDashboard error', { error: error.message })
    return []
  }

  if (!data) return []

  // Map the results to AlertRow format
  return data.map((alert: any) => {
    const container = alert.containers
    const container_no = Array.isArray(container)
      ? (container[0]?.container_no ?? null)
      : (container?.container_no ?? null)

    const list = alert.container_lists
    const list_name = Array.isArray(list)
      ? (list[0]?.name ?? null)
      : (list?.name ?? null)

    return {
      id: alert.id,
      organization_id: alert.organization_id,
      container_id: alert.container_id,
      list_id: alert.list_id,
      event_type: alert.event_type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      created_by_user_id: alert.created_by_user_id,
      created_at: alert.created_at,
      seen_at: alert.seen_at ?? null,
      container_no,
      list_name,
      cleared_at: (alert as any).cleared_at ?? null,
    } as AlertRow
  })
}

// --- Today's Alerts for List ---
/**
 * Fetch alerts created today (UTC) for a specific list.
 * Returns raw alerts for the given list within the current UTC day.
 * 
 * @param listId - The container list ID to filter alerts by
 * @returns Array of alert rows created today for the specified list
 */
export async function fetchAlertsForListToday(
  listId: string
): Promise<Database['public']['Tables']['alerts']['Row'][]> {
  let context: ServerAuthContext

  try {
    context = await getServerAuthContext()
  } catch {
    // If not authenticated, return empty array (graceful failure)
    return []
  }

  const { supabase, organizationId } = context
  const { start, end } = getTodayUtcRange()

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('list_id', listId)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('fetchAlertsForListToday error', { listId, error: error.message })
    throw new Error(`Supabase fetchAlertsForListToday error: ${error.message}`)
  }

  return data ?? []
}

// --- Update ---
/**
 * Mark alerts as seen by setting seen_at to the current timestamp.
 * Only updates alerts belonging to the current organization.
 * Does not throw on partial failure - logs errors instead.
 */
export async function markAlertsSeen(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) {
    return
  }

  let context: ServerAuthContext
  
  try {
    context = await getServerAuthContext()
  } catch {
    // No user/profile/org - do nothing (graceful failure)
    return
  }
  
  const { supabase, organizationId } = context

  try {
    // Update seen_at to current timestamp for alerts matching the IDs and organization
    // Filtering by organization_id ensures users can only mark their own org's alerts as seen
    const { error } = await supabase
      .from('alerts')
      .update({ seen_at: new Date().toISOString() })
      .in('id', ids)
      .eq('organization_id', organizationId)

    if (error) {
      // Log but don't throw - graceful failure
      logger.error('Supabase markAlertsSeen error', {
        error: error.message,
        alertIds: ids,
        orgId: organizationId,
      })
    } else {
      // Revalidate paths that display alerts
      revalidatePath('/dashboard')
      revalidatePath('/dashboard/alerts')
    }
  } catch (err) {
    // Catch any unexpected errors and log them
    logger.error('markAlertsSeen unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      alertIds: ids,
    })
  }
}

// --- Clear Alert ---
/**
 * Clear an alert by setting cleared_at to the current timestamp.
 * Only updates alerts belonging to the current organization.
 */
export async function clearAlert(alertId: string): Promise<void> {
  const context = await getServerAuthContext()
  const { supabase, organizationId } = context

  const { error } = await supabase
    .from('alerts')
    .update({ cleared_at: new Date().toISOString() } as any)
    .eq('id', alertId)
    .eq('organization_id', organizationId)

  if (error) {
    logger.error('Supabase clearAlert error', { error: error.message, alertId })
    throw new Error(`Failed to clear alert: ${error.message}`)
  }

  revalidatePath('/dashboard/alerts')
  revalidatePath('/dashboard/alerts/history')
}

// --- Fetch Cleared Alerts Page ---
/**
 * Fetch cleared alerts with pagination support for the history page.
 * Returns alerts where cleared_at IS NOT NULL.
 */
export async function fetchClearedAlertsPage(params: {
  page: number
  pageSize: number
}): Promise<{ alerts: AlertRow[]; hasMore: boolean }> {
  let context: ServerAuthContext
  
  try {
    context = await getServerAuthContext()
  } catch {
    return { alerts: [], hasMore: false }
  }
  
  const { supabase, organizationId } = context

  const { page, pageSize } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Build query for cleared alerts only
  let query = supabase
    .from('alerts')
    .select(
      `
      *,
      containers!alerts_container_id_fkey(container_no),
      container_lists!alerts_list_id_fkey(name)
    `,
      { count: 'exact' }
    )
    .eq('organization_id', organizationId)
    .not('cleared_at', 'is', null)
    .order('cleared_at', { ascending: false })
    .range(from, to)

  const { data, error, count } = await query

  if (error) {
    logger.error('Supabase fetchClearedAlertsPage error', { error: error.message })
    throw new Error(`Supabase fetchClearedAlertsPage error: ${error.message}`)
  }

  if (!data) return { alerts: [], hasMore: false }

  const alerts: AlertRow[] = data.map((alert: any) => {
    const container = alert.containers
    const container_no = Array.isArray(container)
      ? (container[0]?.container_no ?? null)
      : (container?.container_no ?? null)

    const list = alert.container_lists
    const list_name = Array.isArray(list)
      ? (list[0]?.name ?? null)
      : (list?.name ?? null)

    return {
      id: alert.id,
      organization_id: alert.organization_id,
      container_id: alert.container_id,
      list_id: alert.list_id,
      event_type: alert.event_type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      created_by_user_id: alert.created_by_user_id,
      created_at: alert.created_at,
      seen_at: alert.seen_at ?? null,
      container_no,
      list_name,
      cleared_at: (alert as any).cleared_at ?? null,
    } as AlertRow
  })

  const hasMore = count !== null ? from + alerts.length < count : false

  return { alerts, hasMore }
}

