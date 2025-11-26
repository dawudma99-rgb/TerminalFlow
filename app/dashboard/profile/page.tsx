'use client'

import { useAuth } from '@/lib/auth/useAuth'
import { useEffect, useState } from 'react'
import { LoadingState } from '@/components/ui/LoadingState'
import { getCurrentOrganization } from '@/lib/data/organization-actions'
import { updateProfile } from '@/lib/data/user-actions'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ProfilePage() {
  const { user, profile, loading } = useAuth()
  const [organization, setOrganization] = useState<{ id: string; name: string; created_at: string } | null>(null)
  const [orgLoading, setOrgLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!user || !profile) {
      logger.warn('[profile-page] No user or profile found after auth load')
      setOrganization(null)
      setOrgLoading(false)
      return
    }

    async function loadOrg() {
      if (!profile) return
      logger.debug('[profile-page] Fetching organization for', { organizationId: profile.organization_id })
      try {
        if (profile.organization_id) {
          const orgData = await getCurrentOrganization()
          setOrganization(orgData)
        } else {
          setOrganization(null)
        }
      } catch (err) {
        logger.error('[profile-page] Error loading organization:', err)
        setOrganization(null)
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
      logger.error('[profile-page] updateProfile failed:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setUpdating(false)
    }
  }

  if (loading || orgLoading) {
    return (
      <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="flex h-full items-center justify-center">
          <LoadingState message="Loading profile..." />
        </div>
      </main>
    )
  }

  if (!user || !profile) {
    return (
      <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Please sign in to view your profile.
        </div>
      </main>
    )
  }

  return (
    <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-[#111827]">Profile</h1>
                <p className="text-sm text-[#6B7280]">
                  View your account details and organization assignment.
                </p>
              </div>
              <Button onClick={handleSave} disabled={updating} className="w-full md:w-auto">
                {updating ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="grid gap-4 p-6 text-sm text-[#111827] md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B7280]">User ID</p>
                <p className="mt-1 font-medium">{user.id}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B7280]">Email</p>
                <p className="mt-1 font-medium">{profile.email || user.email}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B7280]">Organization</p>
                <p className="mt-1 font-medium">{organization?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#6B7280]">Role</p>
                <p className="mt-1 font-medium">{profile.role || 'N/A'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
  )
}