'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

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
        event.preventDefault()
        return
      }

      // Log in dev mode
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Global Error Boundary] Unhandled promise rejection:', event.reason)
      }

      // Optional: show toast (non-blocking)
      toast.error('A background operation failed — check console for details.')

      // Prevent default browser logging spam
      event.preventDefault()
    }

    const handleWindowError = (event: ErrorEvent) => {
      const message = event.message || ''
      const source = event.filename || ''

      // Filter out common noise errors
      const isNoiseError =
        message.includes('Fast Refresh') ||
        message.includes('ChunkLoadError') ||
        message.includes('ResizeObserver loop') ||
        message.includes('Non-Error promise rejection captured') ||
        source.includes('fonts.googleapis.com')

      if (isNoiseError) {
        // Silently suppress known noise errors
        event.preventDefault()
        return
      }

      if (process.env.NODE_ENV === 'development') {
        console.warn('[Global Error Boundary] Uncaught error:', event.message)
      }

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

