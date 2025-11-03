'use server'

import { createClient } from '@/lib/supabase/server'

export interface Settings {
  demurrageDailyRate: number
  detentionDailyRate: number
  demFreeDays: number
  detFreeDays: number
  weekendChargeable: boolean
}

/**
 * Load user settings from the profiles table.
 * This is a client-callable function that takes userId.
 * Returns defaults if settings don't exist.
 */
export async function loadSettings(): Promise<Settings> {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      // keep production-safe; do not expose internals
    }

    const defaults: Settings = {
      demurrageDailyRate: 80,
      detentionDailyRate: 50,
      demFreeDays: 7,
      detFreeDays: 7,
      weekendChargeable: true,
    }

    const settings = (data?.settings as Partial<Settings>) || {}
    const merged = {
      ...defaults,
      ...settings,
    }

    return merged
  } catch (_err) {
    return {
      demurrageDailyRate: 80,
      detentionDailyRate: 50,
      demFreeDays: 7,
      detFreeDays: 7,
      weekendChargeable: true,
    }
  }
}

/**
 * Save user settings to the profiles table for the authenticated user.
 * Updates the settings JSONB column.
 */
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const supabase = await createClient()
  
  // Get the current authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  
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