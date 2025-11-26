'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

type ProfileRow = Database['public']['Tables']['profiles']['Row']
type OrganizationRow = Database['public']['Tables']['organizations']['Row']

export type ServerAuthContext = {
  supabase: SupabaseClient<Database>
  user: User
  profile: ProfileRow
  organizationId: string
}

export type ServerOrgContext = ServerAuthContext & {
  organization: OrganizationRow
}

/**
 * Central helper to resolve the current user, profile, and organizationId
 * for server actions and server components.
 *
 * Throws a clear error if:
 * - no authenticated user
 * - no profile found
 * - no organization_id on profile
 */
export async function getServerAuthContext(): Promise<ServerAuthContext> {
  // 1. Create Supabase client via existing createClient() from lib/supabase/server.ts
  const supabase = await createClient()

  // 2. Call supabase.auth.getUser()
  const { data: { user }, error: getUserError } = await supabase.auth.getUser()

  if (getUserError || !user) {
    throw new Error('Not authenticated')
  }

  // 3. Query profiles table by user.id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // 4. If no profile or no organization_id -> throw a descriptive Error
  if (profileError || !profile) {
    throw new Error('User profile not found')
  }

  if (!profile.organization_id) {
    throw new Error('User profile missing organization_id')
  }

  // 5. Return { supabase, user, profile, organizationId: profile.organization_id }
  return {
    supabase,
    user,
    profile,
    organizationId: profile.organization_id,
  }
}

/**
 * Helper to load the organization row for the current user.
 * Builds on top of getServerAuthContext().
 */
export async function getServerOrgContext(): Promise<ServerOrgContext> {
  const base = await getServerAuthContext()
  const { supabase, organizationId } = base

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()

  if (error || !organization) {
    throw new Error('Organization not found for current user')
  }

  return {
    ...base,
    organization,
  }
}

