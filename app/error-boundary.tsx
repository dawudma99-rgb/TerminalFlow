'use client'

import { useEffect } from 'react'
import * as Sentry from "@sentry/nextjs"
import { toast } from 'sonner'
import { logger } from '@/lib/utils/logger'

/**
 * GlobalErrorBoundary
 * Catches any unhandled promise rejections or runtime errors
 * and prevents them from cluttering the console or crashing the app.
 */
export default function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const reasonString = String(reason || '')

      // Filter out common noise errors
      const isNoiseError =
        reasonString.includes('Fast Refresh') ||
        reasonString.includes('ChunkLoadError') ||
        reasonString.includes('Loading chunk') ||
        reasonString.includes('Failed to fetch dynamically imported module') ||
        (reasonString.includes('fonts.googleapis.com') && reasonString.includes('Failed to fetch'))

      if (isNoiseError) {
        // Silently suppress known noise errors
        logger.warn('Filtered noisy unhandled rejection', { reason })
        event.preventDefault()
        return
      }

      logger.error('Unhandled rejection', { reason })

      const errToCapture =
        reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'Unhandled rejection')

      Sentry.captureException(errToCapture, {
        tags: { source: 'unhandled-rejection' },
      })

      // Optional: show toast (non-blocking)
      toast.error('A background operation failed — check console for details.')

      // Prevent default browser logging spam
      event.preventDefault()
    }

    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || ''
      const source = event.filename || ''
      const rawError = event.error

      // Filter out common noise errors
      const isNoiseError =
        message.includes('Fast Refresh') ||
        message.includes('ChunkLoadError') ||
        message.includes('ResizeObserver loop') ||
        message.includes('Non-Error promise rejection captured') ||
        source.includes('fonts.googleapis.com')

      if (isNoiseError) {
        // Silently suppress known noise errors
        logger.warn('Filtered noisy window error', { error: rawError })
        event.preventDefault()
        return
      }

      logger.error('Window error', { error: rawError, messageText: event.message })

      const errToCapture =
        rawError instanceof Error
          ? rawError
          : new Error(event.message || 'Window error')

      Sentry.captureException(errToCapture, {
        tags: { source: 'window-error' },
      })

      toast.error('An unexpected client error occurred.')

      event.preventDefault()
    }

    window.addEventListener('unhandledrejection', handlePromiseRejection)
    window.addEventListener('error', handleWindowError)

    return () => {
      window.removeEventListener('unhandledrejection', handlePromiseRejection)
      window.removeEventListener('error', handleWindowError)
    }
  }, [])

  return <>{children}</>
}

