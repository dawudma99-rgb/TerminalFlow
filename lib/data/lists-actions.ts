'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/utils/logger'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

export type ListRecord = Database['public']['Tables']['container_lists']['Row']
export type ListInsert = Database['public']['Tables']['container_lists']['Insert']
export type ListUpdate = Database['public']['Tables']['container_lists']['Update']

// --- Read ---
/**
 * Fetch all container lists for the current authenticated user's organization.
 * Returns lists ordered by creation date (oldest first).
 */
export async function fetchLists(): Promise<ListRecord[]> {
  console.time('server fetchLists')
  const { supabase, organizationId } = await getServerAuthContext()
  
  const { data, error } = await supabase
    .from('container_lists')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.timeEnd('server fetchLists')
    throw new Error(`Supabase fetchLists error: ${error.message}`)
  }
  if (!data) {
    console.timeEnd('server fetchLists')
    return []
  }

  console.timeEnd('server fetchLists')
  return data
}

// --- Create ---
/**
 * Create a new container list for the current organization.
 * Auto-sets organization_id from the authenticated user's profile.
 */
export async function createList(name: string): Promise<ListRecord> {
  if (!name || name.trim().length === 0) {
    throw new Error('List name is required')
  }

  const { supabase, organizationId } = await getServerAuthContext()

  const { data, error } = await supabase
    .from('container_lists')
    .insert({
      name: name.trim(),
      organization_id: organizationId,
    })
    .select()
    .single()

  if (error) throw new Error(`Supabase createList error: ${error.message}`)
  if (!data) throw new Error('Failed to create list: no data returned')

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return data
}

// --- Delete ---
/**
 * Delete a container list by ID.
 * Only allows deletion of lists belonging to the current organization.
 */
export async function deleteList(id: string): Promise<void> {
  if (!id) throw new Error('List ID is required')

  const { supabase, organizationId } = await getServerAuthContext()

  // Verify the list belongs to the organization
  const { data: list, error: checkError } = await supabase
    .from('container_lists')
    .select('id, organization_id')
    .eq('id', id)
    .eq('organization_id', organizationId)
    .single()

  if (checkError || !list) {
    throw new Error('List not found or access denied')
  }

  // Delete the list (containers with list_id will be handled by CASCADE if configured)
  const { error } = await supabase
    .from('container_lists')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) throw new Error(`Supabase deleteList error: ${error.message}`)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
}

// --- Ensure Main List Exists ---
/**
 * Ensures the current organization has at least one list (Main List) and that
 * the user's current_list_id points to a valid list.
 * 
 * This is idempotent and safe to call multiple times.
 * 
 * Steps:
 * 1. Get current user and profile
 * 2. Fetch all lists for the org
 * 3. If no lists exist: create "Main List" and set current_list_id
 * 4. If lists exist but current_list_id is null/invalid: set to oldest list or "Main List"
 * 
 * @returns {Promise<{ lists: ListRecord[], activeListId: string | null }>}
 */
export async function ensureMainListForCurrentOrg(): Promise<{
  lists: ListRecord[]
  activeListId: string | null
}> {
  const { supabase, user, profile, organizationId } = await getServerAuthContext()
  
  const userId = user.id
  const orgId = organizationId
  const currentListId = profile.current_list_id

  // Fetch all lists for this org
  const { data: existingLists, error: listsError } = await supabase
    .from('container_lists')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })

  if (listsError) {
    logger.error('[ensureMainListForCurrentOrg] Failed to fetch lists:', listsError)
    throw new Error(`Failed to fetch lists: ${listsError.message}`)
  }

  const lists = existingLists || []

  // Case 1: No lists exist - create Main List and set it as active
  if (lists.length === 0) {
    logger.info('[ensureMainListForCurrentOrg] No lists found, creating Main List', {
      orgId,
      userId,
    })

    const { data: newList, error: createError } = await supabase
      .from('container_lists')
      .insert({
        name: 'Main List',
        organization_id: orgId,
      })
      .select()
      .single()

    if (createError || !newList) {
      logger.error('[ensureMainListForCurrentOrg] Failed to create Main List:', createError)
      throw new Error(`Failed to create Main List: ${createError?.message || 'no data returned'}`)
    }

    // Update profile to set current_list_id to the new Main List
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_list_id: newList.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      logger.error('[ensureMainListForCurrentOrg] Failed to set current_list_id:', updateError)
      // Don't throw - list was created, just the profile update failed
      // The list will be set as active on next successful ensureMainListForCurrentOrg call
    } else {
      logger.info('[ensureMainListForCurrentOrg] Created Main List and set as active', {
        listId: newList.id,
        userId,
      })
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/containers')

    return {
      lists: [newList],
      activeListId: newList.id,
    }
  }

  // Case 2: Lists exist but current_list_id is null or invalid
  const isValidListId = currentListId && lists.some((list) => list.id === currentListId)
  
  if (!isValidListId) {
    // Find the best list to use (prefer "Main List", otherwise oldest)
    let targetList = lists.find((list) => list.name === 'Main List')
    if (!targetList) {
      targetList = lists[0] // Oldest list
    }

    logger.info('[ensureMainListForCurrentOrg] Fixing current_list_id', {
      orgId,
      userId,
      previousListId: currentListId,
      newListId: targetList.id,
      listName: targetList.name,
    })

    // Update profile to set current_list_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        current_list_id: targetList.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      logger.error('[ensureMainListForCurrentOrg] Failed to update current_list_id:', updateError)
      // Don't throw - just log the error
    } else {
      logger.info('[ensureMainListForCurrentOrg] Updated current_list_id', {
        listId: targetList.id,
        userId,
      })
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/containers')

    return {
      lists,
      activeListId: targetList.id,
    }
  }

  // Case 3: Everything is already valid - no-op
  logger.debug('[ensureMainListForCurrentOrg] No-op: lists and current_list_id are valid', {
    orgId,
    userId,
    listCount: lists.length,
    currentListId,
  })

  return {
    lists,
    activeListId: currentListId,
  }
}

// --- Update Active List ---
/**
 * Set the active list for the current user by updating their profile's current_list_id.
 * This persists the user's list selection across sessions.
 */
export async function setActiveList(id: string | null): Promise<void> {
  const { supabase, user, profile: existingProfile, organizationId } = await getServerAuthContext()
  
  const userId = user.id
  const orgId = organizationId
  
  // Force session validation by calling getSession() first
  // This ensures the JWT is loaded and attached to the client for RLS checks
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    logger.error('[setActiveList] Session error:', sessionError.message)
    throw new Error(`Authentication error: ${sessionError.message}`)
  }
  
  if (!session?.access_token) {
    logger.error('[setActiveList] No access token in session')
    throw new Error('User authentication missing in server action — JWT not attached')
  }
  
  logger.info('[setActiveList] Session validated:', {
    hasSession: true,
    hasAccessToken: true,
    userId: session.user?.id,
    expiresAt: session.expires_at,
  })
  
  logger.info('[setActiveList] User validated:', {
    userId: user.id,
    userEmail: user.email,
  })
  
  logger.info('[setActiveList] User validated:', {
    userId: user.id,
    userEmail: user.email,
  })

  logger.info('[setActiveList] Before update:', {
    userId,
    profileId: existingProfile.id,
    orgId,
    targetListId: id,
    clientSource: 'createClient from @/lib/supabase/server',
    authUidMatches: existingProfile.id === userId,
  })

  // If id is provided, verify it belongs to the organization
  if (id) {
    const { data: list, error: checkError } = await supabase
      .from('container_lists')
      .select('id, organization_id')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single()

    if (checkError || !list) {
      logger.error('[setActiveList] List verification failed:', {
        listId: id,
        error: checkError?.message,
      })
      throw new Error('List not found or access denied')
    }
  }

  // Update the user's profile
  // Explicitly set the session on the client to ensure JWT is attached
  if (!session?.access_token) {
    logger.error('[setActiveList] No access token found in session')
    throw new Error('No access token found in session')
  }

  // Explicitly set the session to ensure JWT is attached to subsequent requests
  const { error: setSessionError } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token || '',
  })

  if (setSessionError) {
    logger.error('[setActiveList] Failed to set session:', setSessionError)
    throw new Error(`Failed to set session: ${setSessionError.message}`)
  }
  
  logger.info('[setActiveList] Attempting profile update:', {
    profileId: userId,
    newCurrentListId: id,
    authUidFromSession: userId,
    profileIdFromDB: existingProfile.id,
    jwtExplicitlySet: true,
  })

  const { error, data: updatedProfile } = await supabase
    .from('profiles')
    .update({ 
      current_list_id: id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    logger.error('[setActiveList] Profile update failed:', {
      error: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint,
      userId,
      profileId: existingProfile.id,
      hasSession: !!session,
      hasAccessToken: !!session?.access_token,
      authUidFromGetUser: userId,
      profileIdFromDB: existingProfile.id,
      authUidMatchesProfileId: existingProfile.id === userId,
      jwtExplicitlySet: true,
      rlsHint: 'RLS policy requires: auth.uid() = id. JWT was explicitly set on client.',
    })
    throw new Error(`Supabase setActiveList error: ${error.message}`)
  }

  logger.info('[setActiveList] Profile update successful', {
    updatedProfileId: updatedProfile?.id,
    newCurrentListId: updatedProfile?.current_list_id,
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
}

