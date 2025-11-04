'use client'

/**
 * useContainers — React hook for managing container data
 * Uses SWR for caching and background revalidation.
 * List-aware: fetches containers for a specific list or all containers if listId is null.
 */

import { logger } from '@/lib/utils/logger'
import useSWR from 'swr'
import { fetchContainers } from './containers-actions'
import type { ContainerRecordWithComputed } from './containers-actions'
import { useEffect, useRef } from 'react'

export type ContainerWithComputed = ContainerRecordWithComputed

export function useContainers(listId: string | null) {
  const previousListIdRef = useRef<string | null>(null)

  // Track listId changes (reduced logging)
  useEffect(() => {
    previousListIdRef.current = listId
  }, [listId])

  const fetcher = async () => {
    const data = await fetchContainers(listId ?? undefined)
    return data
  }

  // SWR key includes listId for proper cache isolation
  const swrKey = ['containers', listId]

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // refresh every minute
    keepPreviousData: true, // prevent flicker when switching lists
  })

  return {
    containers: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    reload: async () => {
      await mutate()
    },
  }
}
