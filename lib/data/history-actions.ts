'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'

export type HistoryEventRecord = Database['public']['Tables']['container_history']['Row']

export interface HistoryEvent {
  id: string
  created_at: string
  summary: string | null
  user: string | null
  type: string | null
  container_id: string
  details: unknown
  event_type: string | null
}

/**
 * Fetch all history events for the current authenticated user / organization.
 * Ordered by created_at DESC (newest first).
 * Cached to prevent duplicate queries during render.
 */
export const fetchHistory = cache(async function fetchHistory(): Promise<HistoryEvent[]> {
  const supabase = await createClient()
  // Resolve current user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.organization_id) {
    throw new Error('User organization not found')
  }

  const orgId = profile.organization_id

  const { data, error } = await supabase
    .from('container_history')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Supabase fetchHistory error: ${error.message}`)
  }

  if (!data) return []

  // Map to HistoryEvent interface
  return data.map((record) => ({
    id: record.id,
    created_at: record.created_at,
    summary: record.summary || '',
    user: record.user_id || null, // user_id is UUID, we might want to fetch email later
    type: record.event_type || record.action || null,
    container_id: record.container_id,
    details: record.details || record.payload || {},
    event_type: record.event_type,
  }))
})

/**
 * Clear all history events for the current organization.
 * Uses RLS to scope to the authenticated user's organization.
 */
export async function clearHistory(): Promise<void> {
  const supabase = await createClient()

  // Resolve current user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('User not authenticated')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile?.organization_id) {
    throw new Error('User organization not found')
  }

  const orgId = profile.organization_id

  const { error } = await supabase
    .from('container_history')
    .delete()
    .eq('organization_id', orgId)

  if (error) {
    throw new Error(`Supabase clearHistory error: ${error.message}`)
  }

  revalidatePath('/dashboard/analytics')
}


