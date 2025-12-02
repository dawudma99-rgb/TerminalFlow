'use server'

import { getServerAuthContext } from '@/lib/auth/serverAuthContext'

export interface Settings {
  demurrageDailyRate: number
  detentionDailyRate: number
  demFreeDays: number
  detFreeDays: number
  weekendChargeable: boolean
  daysBeforeFreeTimeWarning?: number // Org-level: days before free time ends to trigger Warning alerts
}

/**
 * Load user settings from the profiles table.
 * This is a client-callable function that takes userId.
 * Returns defaults if settings don't exist.
 */
export async function loadSettings(): Promise<Settings> {
  const defaults: Settings = {
    demurrageDailyRate: 80,
    detentionDailyRate: 50,
    demFreeDays: 7,
    detFreeDays: 7,
    weekendChargeable: true,
    daysBeforeFreeTimeWarning: 2, // Default to current behavior
  }

  try {
    const { profile } = await getServerAuthContext()
    const settings = (profile.settings as Partial<Settings>) || {}
    return {
      ...defaults,
      ...settings,
    }
  } catch {
    return defaults
  }
}

/**
 * Save user settings to the profiles table for the authenticated user.
 * Updates the settings JSONB column.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const { supabase, user } = await getServerAuthContext()
  
  // First, get current settings to merge with new ones
  const currentSettings = await loadSettings().catch(() => null)
  const mergedSettings = currentSettings 
    ? { ...currentSettings, ...settings }
    : settings

  const { error } = await supabase
    .from('profiles')
    .update({ settings: mergedSettings })
    .eq('id', user.id)

  if (error) throw new Error(`Failed to save settings: ${error.message}`)
}