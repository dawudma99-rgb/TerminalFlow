/**
 * Global error handler utilities
 * Registers handlers for unhandled promise rejections and global JS errors
 */

import { logger } from './logger'

/**
 * Register global error handlers for unhandled promise rejections and JS errors
 * Should be called once during app initialization
 */
export function registerGlobalErrorHandler() {
  if (typeof window === 'undefined') return

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('⚠️ Unhandled promise rejection:', event.reason)
    
    // Optionally prevent default browser console error
    // event.preventDefault()
  })

  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    logger.error('💥 Global JS error:', event.error || event.message)
  })
}

/**
 * Handle async operation errors gracefully
 * @param fn Async function to execute
 * @param errorMessage Custom error message
 * @returns Result or null if error occurred
 */
export async function handleAsyncError<T>(
  fn: () => Promise<T>,
  errorMessage = 'Operation failed'
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    logger.error(errorMessage, error)
    return null
  }
}






