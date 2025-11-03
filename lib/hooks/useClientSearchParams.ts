'use client'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

export function useClientSearchParams() {
  const params = useSearchParams()
  return useMemo(() => {
    const entries = Array.from(params.entries())
    return Object.fromEntries(entries)
  }, [params.toString()])
}

