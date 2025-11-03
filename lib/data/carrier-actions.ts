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

export interface CarrierDefaultsData {
  demurrage_tiers: Tier[]
  detention_tiers: Tier[]
}

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

  // Parse the defaults JSON
  const defaults = data.defaults as unknown as CarrierDefaultsData
  
  return {
    id: data.id,
    organization_id: data.organization_id || '',
    carrier_name: data.carrier_name,
    demurrage_tiers: defaults.demurrage_tiers || [],
    detention_tiers: defaults.detention_tiers || [],
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
  const normalizeTiers = (tiers: any[]): any[] =>
    tiers.map((t) => ({
      from: t.from ?? t.from_day ?? 1,
      to: t.to ?? t.to_day ?? null,
      rate: t.rate ?? 0,
    }))
  
  const defaultsData: CarrierDefaultsData = {
    demurrage_tiers: normalizeTiers(demurrageTiers),
    detention_tiers: normalizeTiers(detentionTiers),
  }
  
  if (existing) {
    // Update existing defaults
    const { data, error } = await supabase
      .from('carrier_defaults')
      .update({
        defaults: defaultsData as unknown as Database['public']['Tables']['carrier_defaults']['Update']['defaults'],
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
        defaults: defaultsData as unknown as Database['public']['Tables']['carrier_defaults']['Insert']['defaults']
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
    const defaults = item.defaults as unknown as CarrierDefaultsData
    return {
      id: item.id,
      organization_id: item.organization_id || '',
      carrier_name: item.carrier_name,
      demurrage_tiers: defaults.demurrage_tiers || [],
      detention_tiers: defaults.detention_tiers || [],
      updated_at: item.updated_at
    }
  })
}
