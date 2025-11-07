'use client'
import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

export function useClientSearchParams() {
  const params = useSearchParams()
  const serializedParams = useMemo(() => params.toString(), [params])
  return useMemo(() => {
    const searchParams = new URLSearchParams(serializedParams)
    const entries = Array.from(searchParams.entries())
    return Object.fromEntries(entries)
  }, [serializedParams])
}

