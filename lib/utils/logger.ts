/**
 * Environment-aware logging utility
 * - Logs and warnings only in development
 * - Errors always logged (for debugging production issues)
 */

import { env } from '@/lib/config/env'

export const logger = {
  log: (...args: any[]) => {
    if (env.NODE_ENV === 'development') {
      console.log(...args)
    }
  },

  warn: (...args: any[]) => {
    if (env.NODE_ENV === 'development') {
      console.warn(...args)
    }
  },

  error: (...args: any[]) => {
    // Always log errors, even in production (for debugging)
    if (env.NODE_ENV !== 'production') {
      console.error(...args)
    } else {
      // In production, you might want to send to an error tracking service
      // For now, still log but could integrate with Sentry, etc.
      console.error(...args)
    }
  },

  time: (label?: string) => {
    if (env.NODE_ENV === 'development') {
      console.time(label)
    }
  },

  timeEnd: (label?: string) => {
    if (env.NODE_ENV === 'development') {
      console.timeEnd(label)
    }
  },
}

