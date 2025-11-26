'use client'

/**
 * useLists — React hook for managing container lists
 * Uses SWR for caching and background revalidation.
 * Automatically syncs with profile.current_list_id for active list persistence.
 */

import { logger } from '@/lib/utils/logger'
import useSWR from 'swr'
import { fetchLists, createList, deleteList, setActiveList, ensureMainListForCurrentOrg, type ListRecord } from './lists-actions'
import { useAuth } from '@/lib/auth/useAuth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const fetcher = async () => {
  const data = await fetchLists()
  return data
}

export interface UseListsReturn {
  lists: ListRecord[]
  activeListId: string | null
  loading: boolean
  isInitialLoading: boolean
  isRefreshing: boolean
  error: Error | null
  setActiveList: (id: string | null) => Promise<void>
  createList: (name: string) => Promise<ListRecord>
  deleteList: (id: string) => Promise<void>
  reload: () => void
}

export function useLists(): UseListsReturn {
  const { profile, loading: authLoading, refreshProfile } = useAuth()
  const orgId = profile?.organization_id
  const hasEnsuredRef = useRef(false)

  // SWR key includes organization_id to ensure proper cache isolation
  const swrKey = orgId ? ['lists', orgId] : null

  const {
    data: lists = [],
    error,
    isLoading,
    mutate,
  } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60000, // refresh every minute
    keepPreviousData: true, // prevent flicker on updates
  })

  // Own activeListId state for immediate UI updates
  // Synchronized with profile.current_list_id but updated optimistically for better UX
  const [activeListId, setActiveListId] = useState<string | null>(profile?.current_list_id ?? null)

  const authReady = !authLoading
  const canFetch = authReady && !!orgId

  // Bootstrap: Auto-create default list and fix current_list_id if needed
  // This runs ONCE per org session when auth/org is ready, then gets out of the way
  // Use ref guard to prevent concurrent execution and ensure single bootstrap pass
  useEffect(() => {
    // Only run when:
    // 1. Auth is ready (not loading)
    // 2. orgId is available
    // 3. We haven't already ensured (bootstrap guard)
    if (authLoading || !orgId || hasEnsuredRef.current) return

    const ensureMainList = async () => {
      // Set guard immediately to prevent concurrent execution
      hasEnsuredRef.current = true
      try {
        logger.debug('[useLists] Bootstrap: Ensuring Main List exists and current_list_id is set')
        const result = await ensureMainListForCurrentOrg()
        
        // Update SWR cache with the resolved lists (initial bootstrap load)
        // This is the only time ensureMainList owns the cache
        await mutate(result.lists, { revalidate: false })
        
        // Refresh profile to sync updated current_list_id from server
        // This won't retrigger ensureMainList since hasEnsuredRef.current is true
        await refreshProfile()
        
        logger.debug('[useLists] Bootstrap complete: Main List ensured', {
          listCount: result.lists.length,
          activeListId: result.activeListId,
        })
      } catch (err) {
        logger.error('[useLists] Bootstrap failed: Failed to ensure Main List:', err)
        // Allow retry on failure by resetting guard
        hasEnsuredRef.current = false
        // Don't throw - let the app continue even if bootstrap fails
        // UI components will show create button as fallback
      }
    }

    ensureMainList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, orgId])
  // Note: Intentionally NOT including mutate or refreshProfile in dependencies.
  // They are stable references and should not retrigger the bootstrap.
  // This effect should run only once per org session when auth/org becomes ready.

  // Sync local activeListId state with profile.current_list_id when profile changes
  // This keeps the local state aligned with the server (authoritative source)
  // but only updates when the profile actually changes, not on every render
  useEffect(() => {
    const profileListId = profile?.current_list_id ?? null
    setActiveListId(prev => {
      // Only update if the profile value is different from current state
      // This prevents unnecessary re-renders and preserves optimistic updates
      if (prev === profileListId) {
        return prev
      }
      logger.debug('[useLists] Syncing activeListId from profile:', {
        previous: prev,
        fromProfile: profileListId,
      })
      return profileListId
    })
  }, [profile?.current_list_id])

  // Set active list (updates profile.current_list_id)
  const handleSetActiveList = useCallback(
    async (id: string | null) => {
      try {
        logger.info('[useLists] Switched active list:', id)
        
        // Optimistically update local activeListId so UI responds immediately
        setActiveListId(id)
        
        // Server: persist active list in profile (authoritative source)
        await setActiveList(id)
        
        // Sync profile from server to ensure consistency
        await refreshProfile()
        
        // Refetch lists to ensure consistency
        await mutate()
        
        logger.info('[useLists] Action completed:', 'switch', id)
      } catch (err) {
        logger.error('[useLists] Failed to set active list:', err)
        toast.error(err instanceof Error ? err.message : 'Unexpected error')
        
        // On error, fall back to profile value by re-syncing
        await refreshProfile()
        
        throw err
      }
    },
    [mutate, refreshProfile]
  )

  // Create new list
  const handleCreateList = useCallback(
    async (name: string): Promise<ListRecord> => {
      try {
        logger.info('[useLists] Creating list:', name)
        const newList = await createList(name)
        
        // Optimistically update SWR cache with new list
        await mutate(
          async (currentLists: ListRecord[] | undefined) => {
            // Add new list to current data immediately
            const updatedLists = currentLists ? [...currentLists, newList] : [newList]
            return updatedLists
          },
          { revalidate: false } // Don't refetch immediately, update manually
        )
        
        // Make the newly created list active immediately in the UI
        setActiveListId(newList.id)
        
        // Persist active list on the server as well
        await setActiveList(newList.id)
        
        // Sync profile and lists from the server
        await refreshProfile()
        await mutate()
        
        logger.info('[useLists] Action completed:', 'create', newList.id)
        return newList
      } catch (err) {
        logger.error('[useLists] Failed to create list:', err)
        toast.error(err instanceof Error ? err.message : 'Unexpected error')
        throw err
      }
    },
    [mutate, refreshProfile]
  )

  // Delete list
  const handleDeleteList = useCallback(
    async (id: string): Promise<void> => {
      if (!id) {
        throw new Error('List ID is required')
      }

      try {
        logger.info('[useLists] Deleting list:', id)
        // Optimistically update SWR cache by removing the list
        await mutate(
          async (currentLists: ListRecord[] | undefined) => {
            // Remove list from current data immediately
            const updatedLists = currentLists ? currentLists.filter(list => list.id !== id) : []
            // Delete on server
            await deleteList(id)
            return updatedLists
          },
          { revalidate: false } // Don't refetch immediately, update manually
        )
        
        // If deleted list was active, clear active list
        if (activeListId === id) {
          await handleSetActiveList(null)
        }
        
        await refreshProfile()
        logger.info('[useLists] Action completed:', 'delete', id)
      } catch (err) {
        logger.error('[useLists] Failed to delete list:', err)
        toast.error(err instanceof Error ? err.message : 'Unexpected error')
        throw err
      }
    },
    [mutate, activeListId, handleSetActiveList, refreshProfile]
  )

  // Manual reload function
  const reload = useCallback(() => {
    mutate()
  }, [mutate])

  // Combine loading states - once auth is done, only reflect SWR loading when org is available
  const loading = authLoading || (canFetch && isLoading)

  // Compute new loading flags
  const hasData = lists && lists.length > 0
  const isInitialLoading = !hasData && (authLoading || (canFetch && isLoading))
  const isRefreshing = hasData && (authLoading || (canFetch && isLoading))

  // Return safe defaults when not ready, but keep all hooks called
  return {
    lists: canFetch ? lists : [],
    activeListId: canFetch ? activeListId : null,
    loading,
    isInitialLoading,
    isRefreshing,
    error: canFetch ? (error as Error | null) : null,
    setActiveList: canFetch ? handleSetActiveList : async () => {},
    createList: canFetch ? handleCreateList : async () => { throw new Error('Not ready') },
    deleteList: canFetch ? handleDeleteList : async () => {},
    reload: canFetch ? reload : () => {},
  }
}

