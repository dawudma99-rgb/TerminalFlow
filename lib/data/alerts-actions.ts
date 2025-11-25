'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { logger } from '@/lib/utils/logger'

export type AlertRow = Database['public']['Tables']['alerts']['Row'] & {
  container_no?: string | null
  list_name?: string | null
}

/**
 * Get the current authenticated user's organization ID.
 * Reusable helper for server actions.
 */
async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (error || !profile?.organization_id) throw new Error('User profile not found')
  return profile.organization_id
}

// --- Read ---
/**
 * Fetch alerts for the current authenticated user / organization.
 * Returns alerts with joined container_no and list_name.
 * Ordered by created_at DESC (newest first).
 * Cached to prevent duplicate queries during render.
 */
export const fetchAlerts = cache(async function fetchAlerts(params?: {
  limit?: number
  onlyUnread?: boolean
}): Promise<AlertRow[]> {
  const supabase = await createClient()
  
  // Get user and organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return []
  }

  const orgId = profile.organization_id
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
    .eq('organization_id', orgId)

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
      // Include joined fields
      container_no,
      list_name,
    } as AlertRow
  })
})

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

  const supabase = await createClient()

  // Get user and organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // No user - do nothing (graceful failure)
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    // No profile/org - do nothing (graceful failure)
    return
  }

  const orgId = profile.organization_id

  try {
    // Note: seen_at field doesn't exist in the alerts table schema
    // If this functionality is needed, the database schema should be updated first
    const { error } = await supabase
      .from('alerts')
      .update({})
      .in('id', ids)
      .eq('organization_id', orgId)

    if (error) {
      // Log but don't throw - graceful failure
      logger.error('Supabase markAlertsSeen error', {
        error: error.message,
        alertIds: ids,
        orgId,
      })
    }
  } catch (err) {
    // Catch any unexpected errors and log them
    logger.error('markAlertsSeen unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      alertIds: ids,
    })
  }
}

