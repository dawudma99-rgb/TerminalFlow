'use client'

import { useAuth } from '@/lib/auth/useAuth'
import { useEffect, useState } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { getOrganization, updateProfile } from '@/lib/data/user-actions'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
  const [organization, setOrganization] = useState<{ id: string; name: string; created_at: string } | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!user || !profile) {
      console.warn('[profile-page] No user or profile found after auth load')
      setOrgLoading(false)
      return
    }

    async function loadOrg() {
      if (!profile) return
      console.log('[profile-page] Fetching organization for', profile.organization_id)
      try {
        if (profile.organization_id) {
          const orgData = await getOrganization(profile.organization_id)
          setOrganization(orgData)
        }
      } catch (err) {
        console.error('[profile-page] Error loading organization:', err)
      } finally {
        setOrgLoading(false)
      }
    }

    loadOrg()
  }, [user, profile, loading])

  async function handleSave() {
    if (!user || !profile) return
    setUpdating(true)
    try {
      await updateProfile({
        email: profile.email,
        settings: profile.settings,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      console.error('[profile-page] updateProfile failed:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setUpdating(false)
    }
  }

  if (loading || orgLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <LoadingState message="Loading profile..." />
        </div>
      </AppLayout>
    )
  }

  if (!user || !profile) {
    return (
      <AppLayout>
        <div className="p-4">
          <h1 className="text-lg font-semibold mb-2">Profile</h1>
          <p className="text-gray-600">Please sign in to view your profile.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold mb-4">Profile</h1>

        <div className="rounded-lg border p-4 bg-white shadow-sm">
          <p><strong>User ID:</strong> {user.id}</p>
          <p><strong>Email:</strong> {profile.email || user.email}</p>
          <p><strong>Organization:</strong> {organization?.name || 'N/A'}</p>
          <p><strong>Role:</strong> {profile.role || 'N/A'}</p>
        </div>

        <button
          onClick={handleSave}
          disabled={updating}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {updating ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </AppLayout>
  )
}