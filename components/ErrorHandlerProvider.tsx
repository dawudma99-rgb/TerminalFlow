'use client'

import { useEffect } from 'react'
import { registerGlobalErrorHandler } from '@/lib/utils/error-handler'

/**
 * Client component that registers global error handlers
 * Must be used in a client component context (not in server components)
 */
export function ErrorHandlerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerGlobalErrorHandler()
  }, [])

  return <>{children}</>
}


