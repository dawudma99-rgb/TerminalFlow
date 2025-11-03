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

// --- Read ---
/**
 * Fetch all containers for the current authenticated user / organization.
 * Returns containers with computed derived fields (days_left, status).
 * Cached to prevent duplicate queries during render.
 */
export const fetchContainers = cache(async function fetchContainers(): Promise<ContainerRecordWithComputed[]> {
  const supabase = await createClient()
  const orgId = await getOrgId(supabase)
  const { data, error } = await supabase
    .from('containers')
    .select('*')
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Supabase fetchContainers error: ${error.message}`)
  if (!data) return []

  // Apply computeDerivedFields to each item to get status and days_left
  const withDerived = data.map((c: ContainerRecord) => computeDerivedFields(c as ContainerRecord))

  return withDerived as ContainerRecordWithComputed[]
})

// --- Create ---
/**
 * Insert a new container record.
 */
export async function insertContainer(container: Omit<ContainerInsert, 'organization_id'>) {
  const supabase = await createClient()
  
  // Get the current user's organization_id
  const orgId = await getOrgId(supabase)
  
  const containerWithOrg = {
    ...container,
    organization_id: orgId
  }
  
  const { data, error } = await supabase
    .from('containers')
    .insert(containerWithOrg)
    .select()
    .single()

  if (error) throw new Error(`Supabase insertContainer error: ${error.message}`)
  revalidatePath('/dashboard')
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
  return { success: true, id }
}

