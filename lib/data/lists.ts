'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ListRecord = {
  id: string
  name: string
  organization_id: string
  created_at: string
}

/**
 * ✅ Get all lists for the user's organization
 * - Server-only (safe with Next 15 Webpack)
 * - Throws readable errors
 */
export async function getLists(organizationId: string): Promise<ListRecord[]> {
  if (!organizationId) throw new Error('Missing organizationId')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('container_lists')
    .select('id, name, organization_id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error('Supabase getLists error: ' + error.message)
  return data ?? []
}

/**
 * ✅ Create a new list
 * - Requires name + organizationId
 * - Returns the inserted row
 */
export async function createList(
  name: string,
  organizationId: string
): Promise<ListRecord> {
  if (!name.trim()) throw new Error('List name is required')
  if (!organizationId) throw new Error('Missing organizationId')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('container_lists')
    .insert([{ name: name.trim(), organization_id: organizationId }])
    .select('id, name, organization_id, created_at')
    .single()

  if (error) throw new Error('Supabase createList error: ' + error.message)

  // Refresh containers view after mutation
  revalidatePath('/dashboard/containers')
  return data
}

/**
 * ✅ Delete a list by ID
 * - Safe for Next 15 (server-only)
 */
export async function deleteList(listId: string): Promise<void> {
  if (!listId) throw new Error('Missing listId')

  const supabase = await createClient()
  const { error } = await supabase
    .from('container_lists')
    .delete()
    .eq('id', listId)

  if (error) throw new Error('Supabase deleteList error: ' + error.message)

  revalidatePath('/dashboard/containers')
}
