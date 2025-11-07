'use client'

/**
 * useLists — React hook for managing container lists
 * Uses SWR for caching and background revalidation.
 * Automatically syncs with profile.current_list_id for active list persistence.
 */

import { logger } from '@/lib/utils/logger'
import useSWR from 'swr'
import { fetchLists, createList, deleteList, setActiveList, type ListRecord } from './lists-actions'
import { useAuth } from '@/lib/auth/useAuth'
import { useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

const fetcher = async () => {
  const data = await fetchLists()
  return data
}

export interface UseListsReturn {
  lists: ListRecord[]
  activeListId: string | null
  loading: boolean
  error: Error | null
  setActiveList: (id: string | null) => Promise<void>
  createList: (name: string) => Promise<ListRecord>
  deleteList: (id: string) => Promise<void>
  reload: () => void
}

export function useLists(): UseListsReturn {
  const { profile, loading: authLoading, refreshProfile } = useAuth()
  const orgId = profile?.organization_id

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

  // Get activeListId from profile (synced with Supabase)
  const activeListId = profile?.current_list_id ?? null

  // Graceful loading state - prevent flickering while auth/org loads
  const isReady = !authLoading && !!orgId

  // Auto-create default list if none exist and org is loaded
  useEffect(() => {
    if (authLoading || !orgId) return

    const ensureMainList = async () => {
      try {
        // Check directly in Supabase if a Main List already exists for this org
        const { data: existingLists, error } = await supabase
          .from('container_lists')
          .select('id')
          .eq('organization_id', orgId)
          .eq('name', 'Main List')
          .limit(1)

        if (error) {
          logger.error('[useLists] Error checking for Main List:', error)
          return
        }

        if (existingLists && existingLists.length > 0) {
          logger.info('[useLists] Main List already exists, skipping auto-create')
          return
        }

        logger.info('[useLists] No Main List found, creating one now')
        await createList('Main List')
        mutate()
      } catch (err) {
        logger.error('[useLists] Failed to ensure Main List:', err)
      }
    }

    ensureMainList()
  }, [authLoading, orgId, mutate])

  // Sync activeListId with profile changes (reduced logging)
  useEffect(() => {
    if (profile?.current_list_id !== undefined && profile.current_list_id !== null) {
      // Only log if it's actually set (not just undefined)
    }
  }, [profile?.current_list_id])

  // Set active list (updates profile.current_list_id)
  const handleSetActiveList = useCallback(
    async (id: string | null) => {
      try {
        logger.info('[useLists] Switched active list:', id)
        // Update server first
        await setActiveList(id)
        await refreshProfile()
        // Then refetch lists to ensure consistency
        await mutate()
        logger.info('[useLists] Action completed:', 'switch', id)
      } catch (err) {
        logger.error('[useLists] Failed to set active list:', err)
        toast.error(err instanceof Error ? err.message : 'Unexpected error')
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
        await refreshProfile()
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

  // Combine loading states
  const loading = authLoading || isLoading || !isReady

  // Return safe defaults when not ready, but keep all hooks called
  return {
    lists: isReady ? lists : [],
    activeListId: isReady ? activeListId : null,
    loading,
    error: isReady ? (error as Error | null) : null,
    setActiveList: isReady ? handleSetActiveList : async () => {},
    createList: isReady ? handleCreateList : async () => { throw new Error('Not ready') },
    deleteList: isReady ? handleDeleteList : async () => {},
    reload: isReady ? reload : () => {},
  }
}

