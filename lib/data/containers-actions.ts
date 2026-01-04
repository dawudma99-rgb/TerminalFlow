'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { Json } from '@/types/database'
import { revalidatePath } from 'next/cache'
import { computeDerivedFields } from '@/lib/utils/containers'
import {
  resolveMilestone,
  type ContainerMilestone,
} from '@/lib/utils/milestones'

// Re-export ContainerMilestone for convenience
export type { ContainerMilestone } from '@/lib/utils/milestones'
import { logger } from '@/lib/utils/logger'
import { createAlertsForContainerChange } from '@/lib/data/alerts-logic'
import { ensureMainListForCurrentOrg } from '@/lib/data/lists-actions'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

export type ContainerRecord = Database['public']['Tables']['containers']['Row']
export type ContainerInsert = Database['public']['Tables']['containers']['Insert']
export type ContainerUpdate = Database['public']['Tables']['containers']['Update']

/**
 * Client-side input type for creating new containers.
 * This represents the shape of data sent from the UI form.
 * Server-side fields (organization_id, list_id) are added by insertContainer.
 */
export type ClientContainerInput = {
  container_no: string
  bl_number: string | null
  pol: string | null
  pod: string
  arrival_date: string | null
  free_days: number
  carrier: string | null
  container_size: string | null
  milestone: string | null
  notes: string | null
  assigned_to: string | null
  gate_out_date: string | null
  empty_return_date: string | null
  demurrage_tiers: Json | null
  detention_tiers: Json | null
  has_detention: boolean
  weekend_chargeable?: boolean
}

// Extended types that include pol and pod fields used in the codebase
// These fields may not exist in the database schema yet but are used throughout the app
export type ContainerInsertWithPolPod = ContainerInsert & {
  pol?: string | null
  pod?: string | null
}

export type ContainerUpdateWithPolPod = ContainerUpdate & {
  pol?: string | null
  pod?: string | null
}

// Extended type with computed fields
// This includes all database ContainerRecord fields plus computed fields from ContainerWithDerivedFields
// Note: pol and pod are already in ContainerRecord from the database types, but we explicitly include them
// to ensure TypeScript recognizes them in all contexts
export type ContainerRecordWithComputed = ContainerRecord & {
  days_left: number | null
  status: string
  demurrage_fees: number
  detention_fees: number
  lfd_date: string | null
  detention_chargeable_days: number | null
  detention_status: 'Safe' | 'Warning' | 'Overdue' | null
  // pol and pod are already in ContainerRecord, but explicitly including them ensures type compatibility
  pol: string | null
  pod: string
}

// --- Read ---
/**
 * Fetch containers for the current authenticated user / organization.
 * If listId is provided, filters by list_id. Otherwise returns all containers for the org.
 * Returns containers with computed derived fields (days_left, status).
 */
export async function fetchContainers(listId?: string | null): Promise<ContainerRecordWithComputed[]> {
  console.time('server fetchContainers')
  const { supabase, organizationId } = await getServerAuthContext()
  
  let query = supabase
    .from('containers')
    .select('*')
    .eq('organization_id', organizationId)
  
  // Filter by list_id if provided
  if (listId) {
    query = query.eq('list_id', listId)
  }
  
  const { data, error } = await query.order('updated_at', { ascending: false })

  if (error) {
    console.timeEnd('server fetchContainers')
    throw new Error(`Supabase fetchContainers error: ${error.message}`)
  }
  if (!data) {
    console.timeEnd('server fetchContainers')
    return []
  }

  // TEMP DEBUG: Log fetch parameters and raw container data
  console.log('[TEMP DEBUG fetchContainers]', {
    listId: listId || 'ALL_LISTS',
    orgId: organizationId,
    totalContainers: data.length,
    containers: data.map((c: ContainerRecord) => ({
      id: c.id,
      container_no: c.container_no,
      is_closed: c.is_closed,
      list_id: c.list_id,
      arrival_date: c.arrival_date,
    })),
  })

  // Apply computeDerivedFields to each item to get status and days_left
  // computeDerivedFields accepts ContainerRow (database type) and returns DerivedContainer
  const withDerived: ContainerRecordWithComputed[] = data.map((c: ContainerRecord) => {
    const computed = computeDerivedFields(c)
    // Merge database fields with computed fields
    return { ...c, ...computed } as ContainerRecordWithComputed
  })

  console.timeEnd('server fetchContainers')
  return withDerived
}

// --- Create ---
/**
 * Insert a new container record.
 * If listId is provided, assigns container to that list.
 * If no listId provided, fetches current_list_id from user's profile.
 * Always sets list_id (never null).
 */
export async function insertContainer(
  container: ClientContainerInput,
  listId?: string | null
) {
  const { supabase, organizationId, user } = await getServerAuthContext()

  // If no listId provided, ensure Main List exists and get active list
  let finalListId = listId
  if (!finalListId) {
    // Ensure Main List exists and current_list_id is set
    const { activeListId } = await ensureMainListForCurrentOrg()
    finalListId = activeListId
  }

  // Normalize empty strings to null for pol (optional)
  // pod is required, so ensure it's a non-empty string
  const normalizeOptionalString = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  // Validate pod is provided and non-empty (required field)
  const podValue = container.pod ? String(container.pod).trim() : ''
  if (!podValue) {
    throw new Error('POD (Port of Discharge) is required for all containers')
  }

  // Resolve milestone from input
  const resolvedMilestone = resolveMilestone(
    container.milestone,
    {
      gate_out_date: container.gate_out_date,
      empty_return_date: container.empty_return_date,
    }
  )

  // Build the properly typed ContainerInsert payload
  const containerToInsert: ContainerInsert = {
    // Required fields
    container_no: container.container_no,
    arrival_date: container.arrival_date || new Date().toISOString(),
    organization_id: organizationId,
    pod: podValue,

    // Optional / server-managed
    list_id: finalListId,
    pol: normalizeOptionalString(container.pol),
    free_days: container.free_days,
    bl_number: container.bl_number,
    carrier: container.carrier,
    container_size: container.container_size,
    milestone: resolvedMilestone,
    notes: container.notes,
    assigned_to: container.assigned_to,
    gate_out_date: container.gate_out_date,
    empty_return_date: container.empty_return_date,
    demurrage_tiers: container.demurrage_tiers,
    detention_tiers: container.detention_tiers,
    has_detention: container.has_detention,
    weekend_chargeable: container.weekend_chargeable ?? true,
  }

  logger.debug('[insertContainer] payload', {
    container_no: containerToInsert.container_no,
    organization_id: organizationId,
    list_id: finalListId,
  })

  const { data, error } = await supabase
    .from('containers')
    .insert(containerToInsert)
    .select()
    .single()

  if (error) {
    const details = error.details ? ` Details: ${error.details}` : ''
    const hint = error.hint ? ` Hint: ${error.hint}` : ''
    throw new Error(`Supabase insertContainer error: ${error.message}.${details}${hint}`)
  }

  // Create alerts for state changes (after successful insert)
  if (data) {
    try {
      await createAlertsForContainerChange({
        supabase,
        previousContainer: null,
        newContainer: data,
        currentUserId: user.id,
      })
    } catch (alertError) {
      // Log but don't throw - we don't want to break the main insert if alerts fail
      logger.error('insertContainer failed to create alerts', {
        container_id: data.id,
        alertError: alertError instanceof Error ? alertError.message : String(alertError),
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return data
}

// --- Update ---
/**
 * Update an existing container record by ID.
 */
type ContainerUpdateInput = Partial<ContainerUpdateWithPolPod> & {
  milestone?: ContainerMilestone | null
}

export async function updateContainer(id: string, fields: ContainerUpdateInput) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    logger.error('updateContainer invalid id format', { id })
    throw new Error('Invalid container ID format. Expected UUID.')
  }

  const { supabase, user, profile, organizationId } = await getServerAuthContext()

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
    normalizedFields.pol = normalizeOptionalString(normalizedFields.pol as string | null | undefined) as string | null | undefined
  }
  if (Object.prototype.hasOwnProperty.call(normalizedFields, 'pod')) {
    normalizedFields.pod = normalizeOptionalString(normalizedFields.pod as string | null | undefined) as string | null | undefined
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
      organization_id: organizationId,
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
    .eq('organization_id', organizationId)
    .single()

  if (fetchError) {
    logger.error('updateContainer failed to fetch previous container', { id, fetchError })
    // Continue with update even if we can't fetch previous state (alerts will be skipped)
  }

  const { data, error } = await supabase
    .from('containers')
    .update(safeFields)
    .eq('id', id)
    .eq('organization_id', organizationId)
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
  const { supabase, organizationId } = await getServerAuthContext()
  const { error } = await supabase
    .from('containers')
    .delete()
    .eq('id', id)
    .eq('organization_id', organizationId)

  if (error) throw new Error(`Supabase deleteContainer error: ${error.message}`)
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')
  return { success: true, id }
}

/**
 * Bulk delete multiple container records.
 * Validates that all containers belong to the user's organization via RLS.
 * Returns the number of containers actually deleted.
 */
export async function bulkDeleteContainers(ids: string[]): Promise<{ deleted: number }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('No container IDs provided')
  }

  // Validate all IDs are UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const invalidIds = ids.filter(id => !uuidRegex.test(id))
  if (invalidIds.length > 0) {
    logger.error('bulkDeleteContainers invalid ID format', { invalidIds })
    throw new Error(`Invalid container ID format. Expected UUIDs.`)
  }

  const { supabase, organizationId } = await getServerAuthContext()

  logger.info('[bulkDeleteContainers] Starting bulk delete', {
    count: ids.length,
    organizationId,
  })

  // Delete all containers in a single query
  // RLS ensures only containers belonging to the organization can be deleted
  const { data, error } = await supabase
    .from('containers')
    .delete()
    .in('id', ids)
    .eq('organization_id', organizationId)
    .select('id')

  if (error) {
    logger.error('Supabase bulkDeleteContainers error', { error, idsCount: ids.length })
    throw new Error(`Supabase bulkDeleteContainers error: ${error.message}`)
  }

  const deletedCount = data?.length || 0

  logger.info('[bulkDeleteContainers] Bulk delete completed', {
    requested: ids.length,
    deleted: deletedCount,
    organizationId,
  })

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/containers')

  return { deleted: deletedCount }
}

