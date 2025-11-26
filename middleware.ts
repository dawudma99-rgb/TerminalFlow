// Middleware restricted to dashboard routes only for performance
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'
import { logger } from '@/lib/utils/logger'

export async function middleware(request: NextRequest) {
  logger.debug('[Middleware] Running with path:', { path: request.nextUrl.pathname })
  
  const { supabase, response } = createClient(request)
  
  // Get user authentication - getUser() will refresh the session if needed
  // This is more efficient than calling both getSession() and getUser()
  console.time('middleware getUser')
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.timeEnd('middleware getUser')
  
  if (userError) {
    logger.error('[Middleware] getUser error:', userError.message)
  } else if (user) {
    logger.debug('[Middleware] User authenticated', { userId: user.id, email: user.email })
  }

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
  matcher: ['/dashboard/:path*']
}

