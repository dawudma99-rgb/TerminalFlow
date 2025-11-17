'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { computeDerivedFields } from '@/lib/utils/containers'
import {
  resolveMilestone,
  type ContainerMilestone,
} from '@/lib/utils/milestones'
import { logger } from '@/lib/utils/logger'
import { createAlertsForContainerChange } from '@/lib/data/alerts-logic'

export type ContainerRecord = Database['public']['Tables']['containers']['Row']
export type ContainerInsert = Database['public']['Tables']['containers']['Insert']
export type ContainerUpdate = Database['public']['Tables']['containers']['Update']

// Extended type with computed fields
export type ContainerRecordWithComputed = ContainerRecord & {
  days_left?: number | null
  status?: string
  demurrage_fees?: number
  detention_fees?: number
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

  // Normalize empty strings to null for pol and pod
  const normalizeOptionalString = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  const containerWithMilestone = {
    ...container,
    pol: normalizeOptionalString(container.pol),
    pod: normalizeOptionalString(container.pod),
  }

  containerWithMilestone.milestone = resolveMilestone(
    containerWithMilestone.milestone,
    {
      gate_out_date: containerWithMilestone.gate_out_date,
      empty_return_date: containerWithMilestone.empty_return_date,
    }
  )

  const containerWithOrg = {
    ...containerWithMilestone,
    organization_id: orgId,
    list_id: finalListId, // Always set list_id (can be null if no active list)
  }

  logger.debug('[insertContainer] payload', {
    container_no: containerWithOrg.container_no,
    organization_id: orgId,
    list_id: finalListId,
  })

  const { data, error } = await supabase
    .from('containers')
    .insert(containerWithOrg)
    .select()
    .single()

  if (error) {
    const details = error.details ? ` Details: ${error.details}` : ''
    const hint = error.hint ? ` Hint: ${error.hint}` : ''
    throw new Error(`Supabase insertContainer error: ${error.message}.${details}${hint}`)
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return data
}

// --- Update ---
/**
 * Update an existing container record by ID.
 */
type ContainerUpdateInput = Partial<ContainerUpdate> & {
  milestone?: ContainerMilestone | null
}

export async function updateContainer(id: string, fields: ContainerUpdateInput) {
  const supabase = await createClient()

  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    logger.error('updateContainer invalid id format', { id })
    throw new Error('Invalid container ID format. Expected UUID.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    logger.error('updateContainer unauthorized user', { id, userError })
    throw new Error('Unauthorized user')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    logger.error('updateContainer missing organization_id', {
      id,
      profileError,
      userId: user.id,
    })
    throw new Error('Organization ID not found for user')
  }

  // Normalize empty strings to null for pol and pod
  const normalizeOptionalString = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  const normalizedFields: ContainerUpdateInput = {
    ...fields,
  }

  // Normalize pol and pod if present
  if (Object.prototype.hasOwnProperty.call(normalizedFields, 'pol')) {
    normalizedFields.pol = normalizeOptionalString(normalizedFields.pol as string | null | undefined)
  }
  if (Object.prototype.hasOwnProperty.call(normalizedFields, 'pod')) {
    normalizedFields.pod = normalizeOptionalString(normalizedFields.pod as string | null | undefined)
  }

  // All milestone validation, legacy mapping, and fallbacks live in
  // `lib/utils/milestones.ts` so server actions stay thin and consistent.
  if (Object.prototype.hasOwnProperty.call(normalizedFields, 'milestone')) {
    normalizedFields.milestone = resolveMilestone(normalizedFields.milestone, {
      gate_out_date: (normalizedFields as ContainerUpdate).gate_out_date,
      empty_return_date: (normalizedFields as ContainerUpdate).empty_return_date,
    })
  }

  const safeFields = Object.fromEntries(
    Object.entries({
      ...normalizedFields,
      organization_id: profile.organization_id,
    }).filter(([, value]) => value !== undefined)
  ) as Partial<ContainerUpdate> & { organization_id: string }

  logger.debug('[updateContainer] payload', {
    id,
    fields: Object.keys(safeFields),
  })

  // Fetch the previous container state before updating (for alert detection)
  const { data: previousContainer, error: fetchError } = await supabase
    .from('containers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (fetchError) {
    logger.error('updateContainer failed to fetch previous container', { id, fetchError })
    // Continue with update even if we can't fetch previous state (alerts will be skipped)
  }

  const { data, error } = await supabase
    .from('containers')
    .update(safeFields)
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select()
    .single()

  if (error) {
    logger.error('Supabase updateContainer error', { id, error })
    const details = error.details ? ` Details: ${error.details}` : ''
    const hint = error.hint ? ` Hint: ${error.hint}` : ''
    throw new Error(`Supabase updateContainer error: ${error.message}.${details}${hint}`)
  }

  // Create alerts for state changes (after successful update)
  if (data) {
    try {
      await createAlertsForContainerChange({
        supabase,
        previousContainer: previousContainer ?? null,
        newContainer: data,
        currentUserId: user.id,
      })
    } catch (alertError) {
      // Log but don't throw - we don't want to break the main update if alerts fail
      logger.error('updateContainer failed to create alerts', {
        id,
        alertError: alertError instanceof Error ? alertError.message : String(alertError),
      })
    }
  }

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

