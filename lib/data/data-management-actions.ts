'use server'

import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

type ContainerInsert = Database['public']['Tables']['containers']['Insert']

/**
 * Export all organization data (containers, history, profiles) as JSON.
 */
export async function exportOrgData() {
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  // Fetch all organization-scoped data
  const [containersResult, historyResult, profilesResult] = await Promise.all([
    supabase
      .from('containers')
      .select('*')
      .eq('organization_id', orgId),
    supabase
      .from('container_history')
      .select('*')
      .eq('organization_id', orgId),
    supabase
      .from('profiles')
      .select('settings, email, role, organization_id')
      .eq('organization_id', orgId),
  ])

  if (containersResult.error) throw new Error(`Failed to export containers: ${containersResult.error.message}`)
  if (historyResult.error) throw new Error(`Failed to export history: ${historyResult.error.message}`)
  if (profilesResult.error) throw new Error(`Failed to export profiles: ${profilesResult.error.message}`)

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    organizationId: orgId,
    containers: containersResult.data || [],
    history: historyResult.data || [],
    profiles: profilesResult.data || [],
  }

  return JSON.stringify(exportData, null, 2)
}

/**
 * Import organization data from JSON file.
 * Only imports containers (history/profiles require manual handling).
 */
export async function importOrgData(fileContent: string) {
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  let parsed: {
    containers?: Array<Record<string, unknown>>
    history?: Array<Record<string, unknown>>
    profiles?: Array<Record<string, unknown>>
  }
  try {
    parsed = JSON.parse(fileContent) as {
      containers?: Array<Record<string, unknown>>
      history?: Array<Record<string, unknown>>
      profiles?: Array<Record<string, unknown>>
    }
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (!parsed?.containers || !Array.isArray(parsed.containers)) {
    throw new Error('Invalid file format: missing containers array')
  }

  // Map containers to include organization_id and remove any id conflicts
  const containersToInsert: ContainerInsert[] = parsed.containers.map((raw) => {
    const container = { ...(raw as ContainerInsert) }
    delete container.id
    container.organization_id = orgId
    return container
  })

  const { error } = await supabase
    .from('containers')
    .insert(containersToInsert)

  if (error) throw new Error(`Failed to import containers: ${error.message}`)
  
  revalidatePath('/dashboard')
  return true
}

/**
 * Clear all organization data (containers and history).
 * Requires explicit confirmation in the UI.
 */
export async function clearOrgData() {
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  // Delete in sequence to avoid constraint issues
  const [containersError, historyError] = await Promise.all([
    supabase.from('containers').delete().eq('organization_id', orgId),
    supabase.from('container_history').delete().eq('organization_id', orgId),
  ])

  if (containersError.error) throw new Error(`Failed to clear containers: ${containersError.error.message}`)
  if (historyError.error) throw new Error(`Failed to clear history: ${historyError.error.message}`)
  
  revalidatePath('/dashboard')
  return true
}

/**
 * Seed demo data for testing.
 * Inserts 3 sample containers with realistic data.
 */
export async function seedDemoData() {
  const { supabase, organizationId } = await getServerAuthContext()
  const orgId = organizationId

  const now = new Date()
  const demo = [
    {
      container_no: `DEMO${Date.now()}-1`,
      pod: 'Felixstowe',
      pol: 'Shanghai',
      arrival_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      free_days: 7,
      demurrage_fee_if_late: 80,
      detention_fee_rate: 50,
      has_detention: false,
      is_closed: false,
      organization_id: orgId,
      notes: 'Demo container - MSC shipping line',
    },
    {
      container_no: `DEMO${Date.now()}-2`,
      pod: 'Southampton',
      pol: 'Rotterdam',
      arrival_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      free_days: 5,
      demurrage_fee_if_late: 100,
      detention_fee_rate: 60,
      has_detention: false,
      is_closed: false,
      organization_id: orgId,
      notes: 'Demo container - Hapag Lloyd shipping line',
    },
    {
      container_no: `DEMO${Date.now()}-3`,
      pod: 'Liverpool',
      pol: 'Hamburg',
      arrival_date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      free_days: 10,
      demurrage_fee_if_late: 120,
      detention_fee_rate: 70,
      has_detention: false,
      is_closed: false,
      organization_id: orgId,
      notes: 'Demo container - CMA CGM shipping line',
    },
  ]

  const { error } = await supabase.from('containers').insert(demo)

  if (error) throw new Error(`Failed to seed demo data: ${error.message}`)
  
  revalidatePath('/dashboard')
  return true
}

