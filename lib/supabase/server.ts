import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { env } from '@/lib/config/env'
import { logger } from '@/lib/utils/logger'

/**
 * Creates a Supabase server client that reads cookies and attaches JWTs to requests.
 * 
 * This server client assumes middleware has already refreshed the session.
 * It reads cookies and automatically attaches the JWT from cookies to all requests.
 * 
 * Session refresh is handled exclusively by middleware.ts via getSession(),
 * which ensures all server actions automatically receive a valid JWT.
 * 
 * NOTE: This client is NOT read-only - it can perform writes. The "read-only mode"
 * comment refers to session management (only reading cookies, not refreshing sessions).
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name: string) {
          const value = cookieStore.get(name)?.value
          // Log access token cookie presence for debugging
          if (name.includes('access-token')) {
            logger.debug('[Supabase Server] Access token cookie found:', { hasValue: !!value, preview: value ? `${value.substring(0, 20)}...` : 'null' })
          }
          return value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )

  logger.debug('[Supabase] Server client initialized (write-enabled, reads cookies for JWT)')
  logger.info('[Supabase] Server client created (reads cookies, attaches JWT)')

  return supabase
}

