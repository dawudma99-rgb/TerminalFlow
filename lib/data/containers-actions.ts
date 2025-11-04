'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { computeDerivedFields } from '@/lib/utils/containers'

export type ContainerRecord = Database['public']['Tables']['containers']['Row']
export type ContainerInsert = Database['public']['Tables']['containers']['Insert']
export type ContainerUpdate = Database['public']['Tables']['containers']['Update']

// Extended type with computed fields
export type ContainerRecordWithComputed = ContainerRecord & {
  days_left?: number | null
  status?: string
}

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

async function getUserId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  return user.id
}

// --- Read ---
/**
 * Fetch containers for the current authenticated user / organization.
 * If listId is provided, filters by list_id. Otherwise returns all containers for the org.
 * Returns containers with computed derived fields (days_left, status).
 * Cached to prevent duplicate queries during render.
 */
export const fetchContainers = cache(async function fetchContainers(listId?: string | null): Promise<ContainerRecordWithComputed[]> {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  
  let query = supabase
    .from('containers')
    .select('*')
    .eq('organization_id', orgId)
  
  // Filter by list_id if provided
  if (listId) {
    query = query.eq('list_id', listId)
  }
  
  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) throw new Error(`Supabase fetchContainers error: ${error.message}`)
  if (!data) return []

  // Apply computeDerivedFields to each item to get status and days_left
  const withDerived = data.map((c: ContainerRecord) => computeDerivedFields(c as ContainerRecord))

  return withDerived as ContainerRecordWithComputed[]
})

// --- Create ---
/**
 * Insert a new container record.
 * If listId is provided, assigns container to that list.
 * If no listId provided, fetches current_list_id from user's profile.
 * Always sets list_id (never null).
 */
export async function insertContainer(
  container: Omit<ContainerInsert, 'organization_id' | 'list_id'>,
  listId?: string | null
) {
  const supabase = await createClient()
  
  // Get the current user's organization_id
  const orgId = await getOrgId(supabase)
  
  // If no listId provided, fetch from profile
  let finalListId = listId
  if (!finalListId) {
    const userId = await getUserId(supabase)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('current_list_id')
      .eq('id', userId)
      .single()
    
    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`)
    }
    
    finalListId = profile?.current_list_id ?? null
  }
  
  const containerWithOrg = {
    ...container,
    organization_id: orgId,
    list_id: finalListId, // Always set list_id (can be null if no active list)
  }
  
  const { data, error } = await supabase
    .from('containers')
    .insert(containerWithOrg)
    .select()
    .single()

  if (error) throw new Error(`Supabase insertContainer error: ${error.message}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return data
}

// --- Update ---
/**
 * Update an existing container record by ID.
 */
export async function updateContainer(id: string, fields: ContainerUpdate) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  const { data, error } = await supabase
    .from('containers')
    .update(fields)
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) throw new Error(`Supabase updateContainer error: ${error.message}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return data
}

// --- Delete ---
/**
 * Delete a container record.
 */
export async function deleteContainer(id: string) {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  const { error } = await supabase
    .from('containers')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw new Error(`Supabase deleteContainer error: ${error.message}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return { success: true, id }
}

