'use server'

import { getServerOrgContext } from '@/lib/auth/serverAuthContext'
import type { Database } from '@/types/database'

type OrganizationRow = Database['public']['Tables']['organizations']['Row']

/**
 * Get the current authenticated user's organization.
 * Uses the centralized getServerOrgContext() helper.
 */
export async function getCurrentOrganization(): Promise<Pick<OrganizationRow, 'id' | 'name' | 'created_at'>> {
  const { organization } = await getServerOrgContext()
  
  return {
    id: organization.id,
    name: organization.name,
    created_at: organization.created_at,
  }
}

