'use server'

import type { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'
import { revalidatePath } from 'next/cache'
import { getServerAuthContext, type ServerAuthContext } from '@/lib/auth/serverAuthContext'

export type AlertRow = Database['public']['Tables']['alerts']['Row'] & {
  container_no?: string | null
  list_name?: string | null
  seen_at?: string | null
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
    } as AlertRow
  })

  // Determine if there are more pages
  const hasMore = count !== null ? from + alerts.length < count : false

  return { alerts, hasMore }
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

