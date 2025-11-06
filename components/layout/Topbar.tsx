'use client'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { signOut } from '@/lib/auth/actions'
import { useAuth } from '@/lib/auth/useAuth'
import { useEffect, useState, memo } from 'react'
import { getOrganization } from '@/lib/data/user-actions'
import { useTheme } from 'next-themes'
import { LogOut, Moon, Sun } from 'lucide-react'

// Memoized to prevent unnecessary re-renders that trigger useAuth calls
export const Topbar = memo(function Topbar() {
  const { user, profile, loading } = useAuth()
  const [orgName, setOrgName] = useState('')
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    let cancelled = false
    
    if (profile?.organization_id) {
      getOrganization(profile.organization_id)
        .then((org) => {
          if (!cancelled) {
            setOrgName(org?.name || '')
          }
        })
        .catch((err) => console.error('Failed to load organization:', err))
    } else {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        if (!cancelled) {
          setOrgName('')
        }
      }, 0)
    }
    
    return () => {
      cancelled = true
    }
  }, [profile?.organization_id])

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="bg-card border-b flex items-center justify-between px-6 py-3">
      <div className="flex items-center space-x-3">
        <div className="text-lg font-semibold">📦 D&D Copilot</div>
        {orgName && (
          <span className="text-sm text-muted-foreground">({orgName})</span>
        )}
      </div>
      <div className="flex items-center space-x-3">
        {!loading && (
          <>
            <span className="text-sm text-muted-foreground">
              {profile?.email || user?.email}
            </span>
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1" /> Sign Out
            </Button>
          </>
        )}
      </div>
    </header>
  )
})
