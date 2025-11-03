'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']
type Organization = Database['public']['Tables']['organizations']['Row']

/**
 * Get the current authenticated user's profile with selected fields.
 */
export async function getCurrentProfile(): Promise<Pick<Profile, 'id' | 'email' | 'organization_id' | 'role' | 'settings'>> {
  const supabase = await createClient()
  
  // Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, organization_id, role, settings')
    .eq('id', user.id)
    .single()
  
  if (error) throw new Error(`Failed to load profile: ${error.message}`)
  if (!data) throw new Error('Profile not found')
  
  return data
}

/**
 * Update the current authenticated user's profile.
 * Only updates specified fields.
 */
export async function updateProfile(
  updates: Partial<Pick<Profile, 'email' | 'role' | 'settings' | 'current_list_id'>>
): Promise<Profile> {
  const supabase = await createClient()
  
  // Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  
  // Add updated_at timestamp
  const updatesWithTimestamp = {
    ...updates,
    updated_at: new Date().toISOString(),
  }
  
  const { data, error } = await supabase
    .from('profiles')
    .update(updatesWithTimestamp)
    .eq('id', user.id)
    .select()
    .single()
  
  if (error) throw new Error(`Failed to update profile: ${error.message}`)
  if (!data) throw new Error('Profile not found after update')
  
  return data
}

/**
 * Get organization details by ID.
 */
export async function getOrganization(orgId: string): Promise<Pick<Organization, 'id' | 'name' | 'created_at'>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, created_at')
    .eq('id', orgId)
    .single()
  
  if (error) throw new Error(`Failed to load organization: ${error.message}`)
  if (!data) throw new Error('Organization not found')
  
  return data
}

