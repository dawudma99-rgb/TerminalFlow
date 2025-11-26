'use client'

import { useEffect, useState } from 'react'
import { useAuthTransition } from './AuthTransition'

/**
 * YouTube-style loading bar at the top of the page
 * Shows during auth transitions
 */
export function LoaderBar() {
  const { isTransitioning } = useAuthTransition()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (isTransitioning) {
      // Start animation
      setProgress(0)
      // Simulate progress (not real progress, just visual feedback)
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return 90 // Cap at 90% until transition completes
          return prev + 10
        })
      }, 50)
      return () => clearInterval(interval)
    } else {
      // Complete animation
      setProgress(100)
      const timeout = setTimeout(() => setProgress(0), 200)
      return () => clearTimeout(timeout)
    }
  }, [isTransitioning])

  if (!isTransitioning && progress === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-[#2563EB] transition-all duration-200 ease-out">
      <div
        className="h-full bg-[#2563EB] transition-all duration-75 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

