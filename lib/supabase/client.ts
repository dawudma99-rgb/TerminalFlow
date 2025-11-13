'use client'

import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/config/env'
import { logger } from '@/lib/utils/logger'

export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

logger.debug('[Supabase] Client (browser) initialized')