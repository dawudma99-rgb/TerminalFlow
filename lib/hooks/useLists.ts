'use client'

/**
 * useLists — React hook for managing list data
 * Uses SWR for caching and background revalidation.
 */

import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import { getAllLists } from '@/lib/data/lists-actions'
import type { ListRecord } from '@/lib/data/lists-actions'

const fetcher = async (organizationId: string) => {
  console.log('🟢 [useLists] Loading lists for org:', organizationId)
  const data = await getAllLists(organizationId)
  console.log('✅ [useLists] Lists loaded:', data)
  return data
}

export function useLists(organizationId: string | null | undefined, profileCurrentListId?: string | null) {
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const swrKey = organizationId ? `lists-${organizationId}` : null
  const { data, error, isLoading } = useSWR<ListRecord[]>(
    swrKey,
    swrKey ? (() => fetcher(organizationId!)) : null,
    {
      revalidateOnFocus: false,
      refreshInterval: 60000, // refresh every minute
    }
  )

  // Set initial active list after lists are fetched successfully
  useEffect(() => {
    if (!data || isLoading || ready) return
    
    const defaultId = profileCurrentListId || data[0]?.id || null
    setActiveListId(defaultId)
    setReady(true)
    console.log('🧩 [useLists] Ready. Active list:', defaultId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading, ready]) // Removed profileCurrentListId to prevent re-runs

  const switchListLocally = useCallback((listId: string) => {
    if (!listId || listId === activeListId) return
    setActiveListId(listId)
    console.log("🔄 [useLists] Active list changed (local):", listId)
  }, [activeListId])

  return {
    lists: data ?? [],
    loading: isLoading,
    error: error as Error | null,
    activeListId,
    ready,
    switchListLocally,
  }
}

