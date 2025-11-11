'use client'

import { useMemo } from 'react'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'

interface ContainerStats {
  total: number
  open: number
  closed: number
  overdue: number
  safe: number
}

/**
 * Custom hook for computing container statistics
 * 
 * Calculates aggregate stats from filtered containers in a single pass
 * for optimal performance.
 * 
 * @param filteredContainers - Array of filtered containers to analyze
 * @returns Statistics object with total, open, closed, overdue, and safe counts
 */
export function useContainerStats(
  filteredContainers: ContainerRecordWithComputed[]
): ContainerStats {
  const stats = useMemo(() => {
    let open = 0
    let closed = 0
    let overdue = 0
    let safe = 0

    for (const c of filteredContainers) {
      if (c.is_closed) closed++
      else open++

      if (c.status === 'Overdue') overdue++
      else if (c.status === 'Safe') safe++
    }

    return {
      total: filteredContainers.length,
      open,
      closed,
      overdue,
      safe,
    }
  }, [filteredContainers])

  return stats
}



