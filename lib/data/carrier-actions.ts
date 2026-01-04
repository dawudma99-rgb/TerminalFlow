'use server'

import { revalidatePath } from 'next/cache'
import type { Tier } from '@/lib/tierUtils'
import { validateTierConfiguration } from '@/lib/tierUtils'
import type { Database } from '@/types/database'
import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

export type CarrierDefaultsRecord = Database['public']['Tables']['carrier_defaults']['Row']
export type CarrierDefaultsInsert = Database['public']['Tables']['carrier_defaults']['Insert']
export type CarrierDefaultsUpdate = Database['public']['Tables']['carrier_defaults']['Update']

export interface CarrierDefaults {
  id: string
  organization_id: string
  carrier_name: string
  demurrage_tiers: Tier[]
  detention_tiers: Tier[]
  // Free days
  demurrage_free_days?: number
  detention_free_days?: number
  // Flat rates (used when tiers are empty)
  demurrage_flat_rate?: number
  detention_flat_rate?: number
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
  demurrage_free_days?: number
  detention_free_days?: number
  demurrage_flat_rate?: number
  detention_flat_rate?: number
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
 * Validate carrier name (trim, length, non-empty)
 */
function validateCarrierName(carrier: string): string {
  if (typeof carrier !== 'string') {
    throw new Error('Carrier name must be a string')
  }
  
  const trimmed = carrier.trim()
  
  if (trimmed.length === 0) {
    throw new Error('Carrier name cannot be empty or whitespace only')
  }
  
  if (trimmed.length > 100) {
    throw new Error('Carrier name must be 100 characters or less')
  }
  
  return trimmed
}

/**
 * Check case-insensitive uniqueness of carrier name within organization
 */
async function checkCarrierNameUniqueness(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  organizationId: string,
  carrierName: string,
  excludeId?: string
): Promise<void> {
  // Get all carriers for this organization
  const { data, error } = await supabase
    .from('carrier_defaults')
    .select('id, carrier_name')
    .eq('organization_id', organizationId)
  
  if (error) {
    throw new Error(`Failed to check carrier name uniqueness: ${error.message}`)
  }
  
  const normalizedInput = carrierName.toLowerCase()
  
  for (const row of data || []) {
    // Skip the row being updated
    if (excludeId && row.id === excludeId) {
      continue
    }
    
    if (row.carrier_name.toLowerCase() === normalizedInput) {
      throw new Error(`Carrier "${carrierName}" already exists`)
    }
  }
}

/**
 * Validate free days (integer, 0-365)
 */
function validateFreeDays(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number`)
  }
  
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`)
  }
  
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer`)
  }
  
  if (value < 0 || value > 365) {
    throw new Error(`${fieldName} must be between 0 and 365`)
  }
  
  return value
}

/**
 * Validate flat rate (>= 0, <= 100000)
 */
function validateFlatRate(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  
  if (typeof value !== 'number') {
    throw new Error(`${fieldName} must be a number`)
  }
  
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number`)
  }
  
  if (value < 0) {
    throw new Error(`${fieldName} must be greater than or equal to 0`)
  }
  
  if (value > 100000) {
    throw new Error(`${fieldName} must be 100,000 or less`)
  }
  
  return value
}

/**
 * Validate tier arrays (structure, max length, use validateTierConfiguration)
 */
function validateTierArray(tiers: Tier[], fieldName: string, maxTiers: number = 50): void {
  if (!Array.isArray(tiers)) {
    throw new Error(`${fieldName} must be an array`)
  }
  
  if (tiers.length > maxTiers) {
    throw new Error(`${fieldName} cannot have more than ${maxTiers} tiers`)
  }
  
  // Empty array is allowed
  if (tiers.length === 0) {
    return
  }
  
  // Use existing tier validation
  const validation = validateTierConfiguration(tiers, fieldName)
  if (!validation.valid) {
    throw new Error(`Invalid ${fieldName}: ${validation.errors.join(', ')}`)
  }
}

/**
 * Get carrier defaults for a specific carrier for the authenticated user's organization
 */
export async function getCarrierDefaults(carrier: string): Promise<CarrierDefaults | null> {
  if (!carrier) {
    return null
  }

  const { supabase, organizationId } = await getServerAuthContext()
  
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
  const defaults = (data.defaults as CarrierDefaultsData | null) || {}
  return {
    id: data.id,
    organization_id: data.organization_id || '',
    carrier_name: data.carrier_name,
    demurrage_tiers: convertPersistedTiers(defaults.demurrage_tiers),
    detention_tiers: convertPersistedTiers(defaults.detention_tiers),
    demurrage_free_days: defaults.demurrage_free_days,
    detention_free_days: defaults.detention_free_days,
    demurrage_flat_rate: defaults.demurrage_flat_rate,
    detention_flat_rate: defaults.detention_flat_rate,
    updated_at: data.updated_at
  }
}

/**
 * Save carrier defaults for a specific carrier for the authenticated user's organization
 */
export async function saveCarrierDefaults(
  carrier: string, 
  demurrageTiers: Tier[], 
  detentionTiers: Tier[],
  options?: {
    demurrage_free_days?: number
    detention_free_days?: number
    demurrage_flat_rate?: number
    detention_flat_rate?: number
  }
): Promise<CarrierDefaults> {
  // Validate carrier name
  const carrierName = validateCarrierName(carrier)
  
  // Validate tier arrays
  validateTierArray(demurrageTiers, 'Demurrage tiers')
  validateTierArray(detentionTiers, 'Detention tiers')
  
  // Validate numeric fields
  const demurrageFreeDays = validateFreeDays(options?.demurrage_free_days, 'Demurrage free days')
  const detentionFreeDays = validateFreeDays(options?.detention_free_days, 'Detention free days')
  const demurrageFlatRate = validateFlatRate(options?.demurrage_flat_rate, 'Demurrage flat rate')
  const detentionFlatRate = validateFlatRate(options?.detention_flat_rate, 'Detention flat rate')

  const { supabase, organizationId } = await getServerAuthContext()
  
  // Check if defaults already exist (for update vs insert)
  const existing = await getCarrierDefaults(carrierName)
  
  // Check case-insensitive uniqueness (excluding current record if updating)
  await checkCarrierNameUniqueness(supabase, organizationId, carrierName, existing?.id)
  
  // Normalize tier keys before saving to Supabase (from_day/to_day → from/to)
  const defaultsData: CarrierDefaultsData = {
    demurrage_tiers: normalizeTiers(demurrageTiers),
    detention_tiers: normalizeTiers(detentionTiers),
    demurrage_free_days: demurrageFreeDays,
    detention_free_days: detentionFreeDays,
    demurrage_flat_rate: demurrageFlatRate,
    detention_flat_rate: detentionFlatRate,
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
      demurrage_free_days: demurrageFreeDays,
      detention_free_days: detentionFreeDays,
      demurrage_flat_rate: demurrageFlatRate,
      detention_flat_rate: detentionFlatRate,
      updated_at: data.updated_at
    }
  } else {
    // Create new defaults
    const { data, error } = await supabase
      .from('carrier_defaults')
      .insert({
        organization_id: organizationId,
        carrier_name: carrierName,
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
      demurrage_free_days: demurrageFreeDays,
      detention_free_days: detentionFreeDays,
      demurrage_flat_rate: demurrageFlatRate,
      detention_flat_rate: detentionFlatRate,
      updated_at: data.updated_at
    }
  }
}

/**
 * Update carrier name (rename) for the authenticated user's organization
 */
export async function updateCarrierName(
  oldCarrierName: string,
  newCarrierName: string
): Promise<void> {
  // Validate old carrier name
  const oldName = validateCarrierName(oldCarrierName)
  
  // Validate new carrier name
  const newName = validateCarrierName(newCarrierName)

  if (oldName === newName) {
    return // No change needed
  }

  const { supabase, organizationId } = await getServerAuthContext()
  
  // Get the existing carrier to get its ID for uniqueness check
  const existing = await getCarrierDefaults(oldName)
  if (!existing) {
    throw new Error(`Carrier "${oldName}" not found`)
  }
  
  // Check case-insensitive uniqueness (excluding current record)
  await checkCarrierNameUniqueness(supabase, organizationId, newName, existing.id)

  // Update carrier name
  const { error } = await supabase
    .from('carrier_defaults')
    .update({ carrier_name: newName })
    .eq('carrier_name', oldName)
    .eq('organization_id', organizationId)

  if (error) {
    throw new Error(`Failed to rename carrier: ${error.message}`)
  }

  revalidatePath('/dashboard')
}

/**
 * Delete carrier defaults for a specific carrier for the authenticated user's organization
 */
export async function deleteCarrierDefaults(carrier: string): Promise<void> {
  if (!carrier) {
    throw new Error('Carrier name is required')
  }

  const { supabase, organizationId } = await getServerAuthContext()
  
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
 * Get all carrier defaults for the authenticated user's organization
 */
export async function getAllCarrierDefaults(): Promise<CarrierDefaults[]> {
  const { supabase, organizationId } = await getServerAuthContext()
  
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
      demurrage_free_days: defaults?.demurrage_free_days,
      detention_free_days: defaults?.detention_free_days,
      demurrage_flat_rate: defaults?.demurrage_flat_rate,
      detention_flat_rate: defaults?.detention_flat_rate,
      updated_at: item.updated_at
    }
  })
}
