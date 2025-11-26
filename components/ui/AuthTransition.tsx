'use client'

import { createContext, useContext, useState, ReactNode, useRef } from 'react'

interface AuthTransitionContextType {
  isTransitioning: boolean
  startTransition: () => void
  endTransition: () => void
}

const AuthTransitionContext = createContext<AuthTransitionContextType | undefined>(undefined)

export function AuthTransitionProvider({ children }: { children: ReactNode }) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const startTransition = () => {
    setIsTransitioning(true)
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      setIsTransitioning(false)
      timeoutRef.current = null
    }, 1000)
  }

  const endTransition = () => {
    clearTimer()
    setIsTransitioning(false)
  }

  return (
    <AuthTransitionContext.Provider value={{ isTransitioning, startTransition, endTransition }}>
      {children}
    </AuthTransitionContext.Provider>
  )
}

export function useAuthTransition() {
  const context = useContext(AuthTransitionContext)
  if (!context) {
    throw new Error('useAuthTransition must be used within AuthTransitionProvider')
  }
  return context
}

