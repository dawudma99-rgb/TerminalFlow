'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hitRateLimit } from '@/lib/rate-limit/simpleLimiter'
import { cookies } from 'next/headers'

export type SignInResult = {
  success: boolean
  error?: string
}

export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  // Basic, best-effort rate limiting to protect against brute-force login attempts.
  // NOTE: This is in-memory and per-process only. For a real distributed setup,
  // we can later swap in a Redis/Upstash implementation with the same interface.
  const emailKey =
    typeof email === 'string' && email.trim().length > 0
      ? email.trim().toLowerCase()
      : 'unknown-email'

  const rateResult = hitRateLimit(`login:email:${emailKey}`, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // max 5 attempts per 15 minutes per email
  })

  if (!rateResult.ok) {
    return {
      success: false,
      error: 'Too many login attempts for this email. Please wait a few minutes and try again.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return {
      success: false,
      error: 'Invalid email or password.',
    }
  }

  revalidatePath('/')
  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Explicitly clear Supabase auth cookies (access + refresh)
  const cookieStore = await cookies()
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name)
    }
  }

  revalidatePath('/')
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, organization_id, current_list_id')
    .eq('id', user.id)
    .single()
  if (error) throw new Error(error.message)
  return data
}

