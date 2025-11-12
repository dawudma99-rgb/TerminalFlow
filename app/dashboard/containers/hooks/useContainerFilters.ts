'use client'

import { useState, useMemo, useCallback } from 'react'
import { useDebounce } from 'use-debounce'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'

/**
 * Custom hook for managing container filtering logic
 * 
 * Handles search, status, owner, and view mode filters with debounced search.
 * Computes filtered containers and unique owners list.
 * 
 * @param containers - Array of all containers to filter
 * @returns Filter state, setters, filtered results, and utility functions
 */
export function useContainerFilters(containers: ContainerRecordWithComputed[]) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'demurrage' | 'detention' | 'both'>('both')

  // Get unique owners from containers
  const uniqueOwners = useMemo(() => {
    const owners = containers
      .map(c => c.assigned_to)
      .filter((owner): owner is string => Boolean(owner))
    return Array.from(new Set(owners)).sort()
  }, [containers])

  // Apply filters
  const filteredContainers = useMemo(() => {
    const filtered = containers.filter((container) => {
      // View mode filter
      if (viewMode === 'demurrage') {
        // Demurrage: only containers with arrival_date and free_days defined
        if (!container.arrival_date || container.free_days == null) {
          return false
        }
      } else if (viewMode === 'detention') {
        // Detention: only containers where has_detention is true
        if (!container.has_detention) {
          return false
        }
      }
      // 'both' shows all containers, no filtering needed

      // Search filter (case-insensitive)
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase()
        const matchesSearch =
          container.container_no?.toLowerCase().includes(query) ||
          container.pol?.toLowerCase().includes(query) ||
          container.pod?.toLowerCase().includes(query) ||
          container.assigned_to?.toLowerCase().includes(query) ||
          container.carrier?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'open') {
          // Open means not closed
          if (container.is_closed) return false
        } else {
          // Match exact status
          if (container.status !== statusFilter) return false
        }
      }

      // Owner filter
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'unassigned') {
          if (container.assigned_to) return false
        } else {
          if (container.assigned_to !== ownerFilter) return false
        }
      }

      return true
    })
    return filtered
  }, [containers, viewMode, debouncedSearchQuery, statusFilter, ownerFilter])

  // Clear all filters - memoized for stable reference
  const handleClearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setOwnerFilter('all')
  }, [])

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || ownerFilter !== 'all'

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    ownerFilter,
    setOwnerFilter,
    viewMode,
    setViewMode,
    filteredContainers,
    uniqueOwners,
    handleClearFilters,
    hasActiveFilters,
  }
}

