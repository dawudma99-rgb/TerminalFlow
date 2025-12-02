'use client'

/**
 * useContainers — React hook for managing container data
 * Uses SWR for caching and background revalidation.
 * List-aware: fetches containers for a specific list or all containers if listId is null.
 */

import useSWR from 'swr'
import { fetchContainers } from './containers-actions'
import type { ContainerRecordWithComputed } from './containers-actions'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth/useAuth'

export type ContainerWithComputed = ContainerRecordWithComputed

export interface UseContainersReturn {
  containers: ContainerWithComputed[]
  loading: boolean
  isInitialLoading: boolean
  isRefreshing: boolean
  isSwitchingList: boolean
  error: Error | null
  reload: () => Promise<void>
}

export function useContainers(listId: string | null): UseContainersReturn {
  const { profile, loading: authLoading } = useAuth()
  const orgId = profile?.organization_id
  const previousListIdRef = useRef<string | null>(null)
  const settledListIdRef = useRef<string | null>(null)
  const [isListIdChanging, setIsListIdChanging] = useState(false)

  const fetcher = async () => {
    const data = await fetchContainers(listId ?? undefined)
    return data
  }

  // SWR key includes organization_id and listId for proper cache isolation
  const swrKey = orgId ? ['containers', orgId, listId] : null

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // refresh every minute
    keepPreviousData: true, // prevent flicker when switching lists
  })

  // Detect listId changes immediately
  useEffect(() => {
    if (previousListIdRef.current !== null && listId !== previousListIdRef.current) {
      // ListId changed - mark as changing
      setIsListIdChanging(true)
    }
    previousListIdRef.current = listId
  }, [listId])

  // Track when we have settled data (not loading and have data)
  // This represents the listId that corresponds to the currently displayed containers
  useEffect(() => {
    const authReady = !authLoading
    const canFetch = authReady && !!orgId
    const hasSettledData = canFetch && !isLoading && data !== undefined
    
    if (hasSettledData) {
      // We have settled data for the current listId
      settledListIdRef.current = listId
      // Clear the changing flag once data has settled
      setIsListIdChanging(false)
    }
  }, [listId, orgId, authLoading, isLoading, data])

  const authReady = !authLoading
  const canFetch = authReady && !!orgId
  const loading = authLoading || (canFetch && isLoading)

  // Compute new loading flags
  const hasData = Array.isArray(data) && data.length > 0
  const isInitialLoading = !hasData && (authLoading || (canFetch && isLoading))
  const isRefreshing = hasData && (authLoading || (canFetch && isLoading))

  // Detect if we're switching lists (not just refreshing the same list)
  // isSwitchingList is true when:
  // - We have orgId (ready to fetch)
  // - We're currently loading OR listId is changing
  // - The listId differs from what we had settled data for OR listId changed
  // This ensures we catch list switches immediately when listId prop changes
  const listIdDiffersFromSettled = settledListIdRef.current !== null && listId !== settledListIdRef.current
  
  const isSwitchingList = Boolean(
    orgId &&
    canFetch &&
    (isLoading || isListIdChanging) &&
    (isListIdChanging || listIdDiffersFromSettled)
  )

  return {
    containers: canFetch ? (data ?? []) : [],
    loading,
    isInitialLoading,
    isRefreshing,
    isSwitchingList,
    error: canFetch ? (error as Error | null) : null,
    reload: async () => {
      if (canFetch) {
        await mutate()
      }
    },
  }
}
