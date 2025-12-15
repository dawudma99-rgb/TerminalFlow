'use client'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/auth/actions'
import { useAuth } from '@/lib/auth/useAuth'
import { useEffect, useState, memo } from 'react'
import { getCurrentOrganization } from '@/lib/data/organization-actions'
import { LogOut, Loader2 } from 'lucide-react'
import { logger } from '@/lib/utils/logger'
import { AlertsBell } from '@/components/alerts/AlertsBell'
import { PortflowLogo } from '@/components/ui/PortflowLogo'
import { useRouter } from 'next/navigation'

// Memoized to prevent unnecessary re-renders that trigger useAuth calls
export const Topbar = memo(function Topbar() {
  const { user, profile, loading } = useAuth()
  const [orgName, setOrgName] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    
    if (profile?.organization_id) {
      getCurrentOrganization()
        .then((org) => {
          if (!cancelled) {
            setOrgName(org?.name || '')
          }
        })
        .catch((err) => logger.error('Failed to load organization:', err))
    } else {
      // Reset orgName when profile or organization_id is null
      setOrgName('')
    }
    
    return () => {
      cancelled = true
    }
  }, [profile?.organization_id])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    
    try {
      await signOut()
      router.push('/login')
      router.refresh()
    } catch (error) {
      logger.error('Sign out error:', error)
      setIsSigningOut(false)
    }
    // Transition is handled by useAuth on SIGNED_OUT event
  }

  return (
    <header className="bg-card border-b flex items-center justify-between px-6 py-3 h-[60px]">
      <div className="flex items-center space-x-3">
        <PortflowLogo size="md" />
        {loading ? (
          <span className="text-sm text-muted-foreground animate-pulse">...</span>
        ) : orgName ? (
          <span className="text-sm text-muted-foreground">({orgName})</span>
        ) : null}
      </div>
      <div className="flex items-center space-x-3">
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-muted animate-pulse" />
            <span className="text-sm text-muted-foreground animate-pulse">Loading...</span>
          </div>
        ) : (
          <>
            <AlertsBell />
            <span className="text-sm text-muted-foreground">
              {profile?.email || user?.email || '...'}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="min-w-[100px]"
            >
              {isSigningOut ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Signing out…
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-1" /> Sign Out
                </>
              )}
            </Button>
          </>
        )}
      </div>
    </header>
  )
})
