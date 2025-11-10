// Middleware restricted to dashboard routes only for performance
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { logger } from '@/lib/utils/logger'

const isDev = process.env.NODE_ENV === 'development'

export async function middleware(request: NextRequest) {
  if (isDev) {
    console.log('[Middleware] Running with path:', request.nextUrl.pathname)
  }
  
  const { supabase, response } = createClient(request)
  
  // Refresh the session to ensure cookies are up-to-date and tokens are valid
  // This ensures server actions have access to fresh authentication tokens
  // The getSession() call will refresh the token if needed and update cookies via setAll()
  if (isDev) {
    console.log('[Middleware] Session refresh start')
  }
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (isDev) {
    console.log('[Middleware] Session refresh done')
  }
  
  if (sessionError) {
    logger.error('[Middleware] Session refresh error:', sessionError.message)
  } else {
    logger.info('[Middleware] Session refreshed successfully', { hasSession: !!session, expiresAt: session?.expires_at })
  }
  
  // Check user authentication for route protection
  const { data: { user } } = await supabase.auth.getUser()

  // Protect any path starting with /dashboard
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Return the response with updated cookies from createServerClient
  // This ensures any refreshed session tokens are written to the response
  // The setAll() handler in createClient() writes cookies to both request and response
  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/dashboard/containers/:path*']
}

