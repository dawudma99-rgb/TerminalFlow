'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'

export type ListRecord = Database['public']['Tables']['container_lists']['Row']

/**
 * Get organization ID from current authenticated user
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

/**
 * Get all lists for the current organization.
 * Ordered by created_at ascending (oldest first).
 */
export async function getAllLists(organizationId: string): Promise<ListRecord[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('container_lists')
    .select('id, name, created_at, organization_id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Supabase getAllLists error: ${error.message}`)
  return data || []
}

/**
 * Create a new list.
 * If this is the first list, names it "Main List" automatically.
 */
export async function createList(name: string, organizationId: string): Promise<ListRecord> {
  const supabase = await createClient()
  
  // Check if any lists exist
  const existingLists = await getAllLists(organizationId)
  
  // Auto-name as "Main List" if this is the first list
  const listName = existingLists.length === 0 ? 'Main List' : name.trim()
  
  if (!listName) {
    throw new Error('List name cannot be empty')
  }

  const { data, error } = await supabase
    .from('container_lists')
    .insert({
      organization_id: organizationId,
      name: listName,
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase createList error: ${error.message}`)
  
  revalidatePath('/dashboard/containers')
  return data
}

/**
 * Delete a list.
 * Prevents deleting the first (oldest) list.
 * Containers in the list will be deleted via CASCADE.
 */
export async function deleteList(listId: string, organizationId: string): Promise<void> {
  const supabase = await createClient()
  
  // Get all lists to check if this is the first list
  const allLists = await getAllLists(organizationId)
  
  if (allLists.length === 0) {
    throw new Error('No lists found')
  }
  
  // Prevent deleting the first list
  if (allLists[0].id === listId) {
    throw new Error('Cannot delete the main list. This list must always remain available.')
  }
  
  const { error } = await supabase
    .from('container_lists')
    .delete()
    .eq('id', listId)
    .eq('organization_id', organizationId)

  if (error) throw new Error(`Supabase deleteList error: ${error.message}`)
  
  revalidatePath('/dashboard/containers')
}

/**
 * Set the active list for the current user.
 * Updates profiles.current_list_id.
 */
export async function setActiveList(userId: string, listId: string): Promise<void> {
  const supabase = await createClient()
  
  // Verify the list exists and belongs to the user's organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  
  if (!profile?.organization_id) throw new Error('User profile not found')
  
  const orgId = profile.organization_id
  
  // Use local variable for listId (may be reassigned during self-healing)
  let activeListId = listId
  
  // Verify list belongs to user's organization
  const { data: list, error: listError } = await supabase
    .from('container_lists')
    .select('id')
    .eq('id', activeListId)
    .eq('organization_id', orgId)
    .single()
  
  // Self-healing fallback: if list is missing or invalid, recover gracefully
  if (listError || !list) {
    console.warn('[Lists] Active list missing or invalid, attempting self-healing fallback.')
    
    // Try to find an existing list for this organization
    const { data: fallback } = await supabase
      .from('container_lists')
      .select('id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (!fallback) {
      console.log('[Lists] No existing lists found, creating Main List.')
      const { data: newList, error: createError } = await supabase
        .from('container_lists')
        .insert([{ organization_id: orgId, name: 'Main List' }])
        .select('id')
        .single()
      
      if (createError || !newList) {
        throw new Error('Failed to recover or create a new Main List')
      }
      
      activeListId = newList.id
    } else {
      activeListId = fallback.id
    }
    
    // Continue with profile update using the recovered listId
    console.log(`[Lists] Successfully recovered list: ${activeListId}`)
  }
  
  // Prevent unnecessary updates or render loops
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('current_list_id')
    .eq('id', userId)
    .maybeSingle()
  
  if (currentProfile?.current_list_id === activeListId) {
    console.log('[Lists] Active list already up to date — skipping update.')
    return
  }
  
  // Update profile
  const { error } = await supabase
    .from('profiles')
    .update({ current_list_id: activeListId })
    .eq('id', userId)

  if (error) throw new Error(`Supabase setActiveList error: ${error.message}`)
  
  revalidatePath('/dashboard/containers')
}

/**
 * Move a container to a different list.
 * Updates containers.list_id.
 */
export async function moveContainerToList(
  containerId: string,
  listId: string,
  organizationId: string
): Promise<void> {
  const supabase = await createClient()
  
  // Verify list belongs to organization
  const { data: list, error: listError } = await supabase
    .from('container_lists')
    .select('id')
    .eq('id', listId)
    .eq('organization_id', organizationId)
    .single()
  
  if (listError || !list) {
    throw new Error('List not found or does not belong to your organization')
  }
  
  // Update container
  const { error } = await supabase
    .from('containers')
    .update({ list_id: listId })
    .eq('id', containerId)
    .eq('organization_id', organizationId)

  if (error) throw new Error(`Supabase moveContainerToList error: ${error.message}`)
  
  revalidatePath('/dashboard/containers')
}

