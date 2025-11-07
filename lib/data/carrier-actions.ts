'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Tier } from '@/lib/tierUtils'
import type { Database } from '@/types/database'

export type CarrierDefaultsRecord = Database['public']['Tables']['carrier_defaults']['Row']
export type CarrierDefaultsInsert = Database['public']['Tables']['carrier_defaults']['Insert']
export type CarrierDefaultsUpdate = Database['public']['Tables']['carrier_defaults']['Update']

export interface CarrierDefaults {
  id: string
  organization_id: string
  carrier_name: string
  demurrage_tiers: Tier[]
  detention_tiers: Tier[]
  created_at?: string
  updated_at: string
}

interface PersistedTier {
  from?: number | null
  to?: number | null
  from_day?: number | null
  to_day?: number | null
  rate?: number | null
}

export interface CarrierDefaultsData {
  demurrage_tiers?: PersistedTier[]
  detention_tiers?: PersistedTier[]
}

type CarrierDefaultsJson = Database['public']['Tables']['carrier_defaults']['Insert']['defaults']

const toTier = (tier: PersistedTier | Tier): Tier => {
  const persisted = tier as PersistedTier
  const fromDay = typeof tier.from_day === 'number' ? tier.from_day : typeof persisted.from === 'number' ? persisted.from : 1
  const toDay = tier.to_day !== undefined ? tier.to_day : persisted.to ?? null
  const rate = typeof tier.rate === 'number' ? tier.rate : typeof persisted.rate === 'number' ? persisted.rate : 0

  return {
    from_day: fromDay,
    to_day: toDay === undefined ? null : toDay,
    rate,
  }
}

const convertPersistedTiers = (tiers?: PersistedTier[] | Tier[]): Tier[] => {
  if (!tiers) return []
  return tiers.map((tier) => toTier(tier))
}

const normalizeTiers = (tiers: Tier[]): PersistedTier[] =>
  tiers.map((tier) => ({
    from: typeof tier.from_day === 'number' ? tier.from_day : 1,
    to: tier.to_day ?? null,
    rate: typeof tier.rate === 'number' ? tier.rate : 0,
  }))

/**
 * Get carrier defaults for a specific carrier and organization
 */
export async function getCarrierDefaults(carrier: string, organizationId: string): Promise<CarrierDefaults | null> {
  if (!carrier || !organizationId) {
    return null
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('carrier_defaults')
    .select('*')
    .eq('carrier_name', carrier)
    .eq('organization_id', organizationId)
    .single()

  if (error) {
    // If no defaults found, that's okay - return null
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Supabase getCarrierDefaults error: ${error.message}`)
  }
  return {
    id: data.id,
    organization_id: data.organization_id || '',
    carrier_name: data.carrier_name,
    demurrage_tiers: convertPersistedTiers((data.defaults as CarrierDefaultsData | null)?.demurrage_tiers),
    detention_tiers: convertPersistedTiers((data.defaults as CarrierDefaultsData | null)?.detention_tiers),
    updated_at: data.updated_at
  }
}

/**
 * Save carrier defaults for a specific carrier and organization
 */
export async function saveCarrierDefaults(
  carrier: string, 
  organizationId: string, 
  demurrageTiers: Tier[], 
  detentionTiers: Tier[]
): Promise<CarrierDefaults> {
  if (!carrier || !organizationId) {
    throw new Error('Carrier and organization ID are required')
  }

  const supabase = await createClient()
  
  // Check if defaults already exist
  const existing = await getCarrierDefaults(carrier, organizationId)
  
  // Normalize tier keys before saving to Supabase (from_day/to_day → from/to)
  const defaultsData: CarrierDefaultsData = {
    demurrage_tiers: normalizeTiers(demurrageTiers),
    detention_tiers: normalizeTiers(detentionTiers),
  }
  const defaultsJson = defaultsData as CarrierDefaultsJson
  
  if (existing) {
    // Update existing defaults
    const { data, error } = await supabase
      .from('carrier_defaults')
      .update({
        defaults: defaultsJson,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) {
      throw new Error(`Supabase updateCarrierDefaults error: ${error.message}`)
    }

    revalidatePath('/dashboard')
    return {
      id: data.id,
      organization_id: data.organization_id || '',
      carrier_name: data.carrier_name,
      demurrage_tiers: demurrageTiers, // Return original format (from_day/to_day)
      detention_tiers: detentionTiers, // Return original format (from_day/to_day)
      updated_at: data.updated_at
    }
  } else {
    // Create new defaults
    const { data, error } = await supabase
      .from('carrier_defaults')
      .insert({
        organization_id: organizationId,
        carrier_name: carrier,
        defaults: defaultsJson
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Supabase insertCarrierDefaults error: ${error.message}`)
    }

    revalidatePath('/dashboard')
    return {
      id: data.id,
      organization_id: data.organization_id || '',
      carrier_name: data.carrier_name,
      demurrage_tiers: demurrageTiers, // Return original format (from_day/to_day)
      detention_tiers: detentionTiers, // Return original format (from_day/to_day)
      updated_at: data.updated_at
    }
  }
}

/**
 * Delete carrier defaults for a specific carrier and organization
 */
export async function deleteCarrierDefaults(carrier: string, organizationId: string): Promise<void> {
  if (!carrier || !organizationId) {
    throw new Error('Carrier and organization ID are required')
  }

  const supabase = await createClient()
  
  const { error } = await supabase
    .from('carrier_defaults')
    .delete()
    .eq('carrier_name', carrier)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(`Supabase deleteCarrierDefaults error: ${error.message}`)
  }

  revalidatePath('/dashboard')
}

/**
 * Get all carrier defaults for an organization
 */
export async function getAllCarrierDefaults(organizationId: string): Promise<CarrierDefaults[]> {
  if (!organizationId) {
    return []
  }

  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('carrier_defaults')
    .select('*')
    .eq('organization_id', organizationId)
    .order('carrier_name', { ascending: true })

  if (error) {
    throw new Error(`Supabase getAllCarrierDefaults error: ${error.message}`)
  }

  return data.map(item => {
    const defaults = item.defaults as CarrierDefaultsData | null
    return {
      id: item.id,
      organization_id: item.organization_id || '',
      carrier_name: item.carrier_name,
      demurrage_tiers: convertPersistedTiers(defaults?.demurrage_tiers),
      detention_tiers: convertPersistedTiers(defaults?.detention_tiers),
      updated_at: item.updated_at
    }
  })
}
