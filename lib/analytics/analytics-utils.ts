/**
 * Analytics Utilities
 * Pure calculation functions for analytics metrics
 */

import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'

export interface CostOfInactionData {
  totalCost: number
  overdueCount: number
  dueSoonCount: number
}

export interface StatusDistributionData {
  overdue: number
  warning: number
  safe: number
  closed: number
}

export interface PortPerformanceData {
  port: string
  count: number
  avgDaysLeft: number
  overduePercent: number
  overdueCount: number
}

export interface AtRiskContainer {
  container_no: string
  port: string
  days_left: number
  demurrage_fee_if_late: number
  status?: string
  list_id?: string | null
  list_name?: string | null
  id?: string
  demurrage_fees?: number
  detention_fees?: number
}

export interface ListAnalyticsData {
  list_id: string
  list_name: string
  activeCount: number
  overdueCount: number
  dueSoonCount: number
  estimatedFees: number
}

export interface DetentionAnalyticsData {
  container_id: string
  container_no: string
  port: string | null
  days_in_detention: number
  detention_fees: number
  list_id?: string | null
  list_name?: string | null
}

export interface DetentionSummary {
  containersInDetention: number
  totalDetentionFees: number
}

/**
 * Get projected demurrage rate for due-soon containers
 * Uses first tier rate if tiers exist, otherwise falls back to flat rate
 */
function getProjectedDemurrageRate(container: ContainerRecordWithComputed): number {
  const tiers = container.demurrage_tiers as
    | { from_day: number; to_day: number | null; rate: number }[]
    | null
    | undefined

  if (tiers && tiers.length > 0) {
    const firstTier = tiers[0]
    return typeof firstTier.rate === 'number' ? firstTier.rate : 0
  }

  return container.demurrage_fee_if_late ?? 0
}

/**
 * Calculate Cost of Inaction (7-day projection)
 * Only includes open containers that are overdue or due within 7 days
 * Uses the same fee engine as the rest of the app (demurrage_fees for overdue, tiered rates for projections)
 */
export function calculateCostOfInaction(
  containers: ContainerRecordWithComputed[]
): CostOfInactionData {
  let totalCost = 0
  let overdueCount = 0
  let dueSoonCount = 0

  containers.forEach((container) => {
    // Skip closed containers
    if (container.is_closed) return

    const daysLeft = container.days_left

    // Skip if days_left is null/undefined or not a number
    if (typeof daysLeft !== 'number') return

    // Overdue containers (days_left < 0)
    if (daysLeft < 0) {
        overdueCount++

      // Use precomputed demurrage_fees (already calculated with tiered logic)
      if (typeof container.demurrage_fees === 'number') {
        totalCost += container.demurrage_fees
      } else {
        // Fallback to flat rate calculation if demurrage_fees is not available
        const rate = container.demurrage_fee_if_late ?? 0
          const daysOverdue = Math.abs(daysLeft)
        totalCost += daysOverdue * rate
      }

      return
    }

    // Due soon (0 < days_left <= 7)
    if (daysLeft > 0 && daysLeft <= 7) {
      dueSoonCount++

      // Add one day of "projected" demurrage based on tiers
      const projectedRate = getProjectedDemurrageRate(container)
      totalCost += projectedRate

      return
    }

    // For days_left > 7: do not count as overdue or due soon, do not add to totalCost
  })

  return {
    totalCost,
    overdueCount,
    dueSoonCount,
  }
}

/**
 * Calculate status distribution
 * Counts containers by their computed status
 */
export function calculateStatusDistribution(
  containers: ContainerRecordWithComputed[]
): StatusDistributionData {
  const status: StatusDistributionData = {
    overdue: 0,
    warning: 0,
    safe: 0,
    closed: 0,
  }

  containers.forEach((container) => {
    if (container.is_closed) {
      status.closed++
    } else {
      const daysLeft = container.days_left
      if (daysLeft !== null && daysLeft !== undefined && typeof daysLeft === 'number') {
        if (daysLeft < 0) {
          status.overdue++
        } else if (daysLeft <= 2) {
          status.warning++
        } else {
          status.safe++
        }
      } else {
        // If days_left is null/undefined, treat as safe
        status.safe++
      }
    }
  })

  return status
}

/**
 * Calculate port performance metrics
 * Groups containers by port and calculates averages and overdue percentage
 */
export function calculatePortPerformance(
  containers: ContainerRecordWithComputed[]
): PortPerformanceData[] {
  const portMap = new Map<string, { 
    count: number
    totalDaysLeft: number
    activeCount: number
    overdueCount: number
  }>()

  containers.forEach((container) => {
    // Use pod for backward compatibility (port was POD)
    // Fallback to port field if pod is not available
    const port = (container.pod || (container as { port?: string | null }).port) || 'Unknown'
    
    if (!portMap.has(port)) {
      portMap.set(port, {
        count: 0,
        totalDaysLeft: 0,
        activeCount: 0,
        overdueCount: 0,
      })
    }

    const portData = portMap.get(port)!
    portData.count++

    // Only count days_left for open containers
    if (!container.is_closed) {
      const daysLeft = container.days_left
      if (daysLeft !== null && daysLeft !== undefined && typeof daysLeft === 'number') {
        portData.totalDaysLeft += daysLeft
        portData.activeCount++
        
        // Count overdue containers
        if (daysLeft < 0) {
          portData.overdueCount++
        }
      }
    }
  })

  // Convert to array and calculate averages
  const portArray: PortPerformanceData[] = Array.from(portMap.entries())
    .map(([port, data]) => ({
      port,
      count: data.count,
      avgDaysLeft: data.activeCount > 0 
        ? Math.round(data.totalDaysLeft / data.activeCount) 
        : 0,
      overdueCount: data.overdueCount,
      overduePercent: data.activeCount > 0 
        ? Math.round((data.overdueCount / data.activeCount) * 100)
        : 0,
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 10) // Top 10 ports

  return portArray
}

/**
 * Get top containers at risk
 * Returns the most urgent containers, sorted by urgency
 */
export function getTopAtRiskContainers(
  containers: ContainerRecordWithComputed[],
  limit: number = 20
): AtRiskContainer[] {
  // Filter to open containers with valid days_left
  const activeContainers = containers
    .filter((c) => {
      const daysLeft = c.days_left
      return (
        !c.is_closed &&
        daysLeft !== null &&
        daysLeft !== undefined &&
        typeof daysLeft === 'number'
      )
    })
    .sort((a, b) => {
      // Sort by urgency: Overdue first, then by days_left ascending
      const aIsOverdue = a.status === 'Overdue' || (a.days_left !== null && a.days_left < 0)
      const bIsOverdue = b.status === 'Overdue' || (b.days_left !== null && b.days_left < 0)
      
      if (aIsOverdue && !bIsOverdue) return -1
      if (!aIsOverdue && bIsOverdue) return 1
      
      const aDays = a.days_left || 0
      const bDays = b.days_left || 0
      return aDays - bDays // Sort ascending (most urgent first)
    })
    .slice(0, limit)
    .map((container) => ({
      container_no: container.container_no || '',
      port: container.pod || (container as { port?: string | null }).port || 'Unknown',
      days_left: container.days_left || 0,
      demurrage_fee_if_late: container.demurrage_fee_if_late || 0,
      status: container.status,
      list_id: container.list_id || null,
      id: container.id,
      demurrage_fees: container.demurrage_fees || 0,
      detention_fees: container.detention_fees || 0,
    }))

  return activeContainers
}

/**
 * Calculate list-level analytics
 * Aggregates containers by list_id
 */
export function calculateListAnalytics(
  containers: ContainerRecordWithComputed[],
  listNameMap: Map<string, string>
): ListAnalyticsData[] {
  const listMap = new Map<string, {
    activeCount: number
    overdueCount: number
    dueSoonCount: number
    estimatedFees: number
  }>()

  containers.forEach((container) => {
    // Only count active containers
    if (container.is_closed) return

    const listId = container.list_id || 'unassigned'
    const listName = listId !== 'unassigned' 
      ? (listNameMap.get(listId) || 'Unknown List')
      : 'Unassigned'

    if (!listMap.has(listId)) {
      listMap.set(listId, {
        activeCount: 0,
        overdueCount: 0,
        dueSoonCount: 0,
        estimatedFees: 0,
      })
    }

    const listData = listMap.get(listId)!
    listData.activeCount++

    const daysLeft = container.days_left
    if (typeof daysLeft === 'number') {
      if (daysLeft < 0) {
        listData.overdueCount++
      } else if (daysLeft > 0 && daysLeft <= 7) {
        listData.dueSoonCount++
      }
    }

    // Sum fees for this list
    const demurrageFees = typeof container.demurrage_fees === 'number' ? container.demurrage_fees : 0
    const detentionFees = typeof container.detention_fees === 'number' ? container.detention_fees : 0
    listData.estimatedFees += demurrageFees + detentionFees
  })

  // Convert to array, filter lists with active containers, and sort
  const listArray: ListAnalyticsData[] = Array.from(listMap.entries())
    .filter(([listId, data]) => data.activeCount > 0)
    .map(([listId, data]) => ({
      list_id: listId,
      list_name: listId !== 'unassigned' 
        ? (listNameMap.get(listId) || 'Unknown List')
        : 'Unassigned',
      activeCount: data.activeCount,
      overdueCount: data.overdueCount,
      dueSoonCount: data.dueSoonCount,
      estimatedFees: data.estimatedFees,
    }))
    .sort((a, b) => {
      // Sort by estimated fees descending, then by overdue count
      if (b.estimatedFees !== a.estimatedFees) {
        return b.estimatedFees - a.estimatedFees
      }
      return b.overdueCount - a.overdueCount
    })

  return listArray
}

/**
 * Calculate detention analytics
 * Returns containers currently incurring detention charges
 */
export function calculateDetentionAnalytics(
  containers: ContainerRecordWithComputed[],
  listNameMap: Map<string, string>
): {
  summary: DetentionSummary
  containers: DetentionAnalyticsData[]
} {
  const detentionContainers = containers.filter((container) => {
    return (
      container.has_detention &&
      container.detention_chargeable_days !== null &&
      container.detention_chargeable_days !== undefined &&
      container.detention_chargeable_days > 0
    )
  })

  const totalDetentionFees = detentionContainers.reduce((sum, container) => {
    return sum + (typeof container.detention_fees === 'number' ? container.detention_fees : 0)
  }, 0)

  const detentionData: DetentionAnalyticsData[] = detentionContainers.map((container) => ({
    container_id: container.id,
    container_no: container.container_no || '',
    port: container.pod || (container as { port?: string | null }).port || null,
    days_in_detention: container.detention_chargeable_days || 0,
    detention_fees: typeof container.detention_fees === 'number' ? container.detention_fees : 0,
    list_id: container.list_id || null,
    list_name: container.list_id ? (listNameMap.get(container.list_id) || null) : null,
  }))

  return {
    summary: {
      containersInDetention: detentionContainers.length,
      totalDetentionFees,
    },
    containers: detentionData.sort((a, b) => b.days_in_detention - a.days_in_detention),
  }
}

/**
 * Calculate trend data for charts
 * Approximates overdue trend based on current container data
 */
export function calculateOverdueTrend(
  containers: ContainerRecordWithComputed[]
): Array<{ date: string; overdue: number; notOverdue: number }> {
  // Since we don't have historical snapshots, approximate trend from current data
  // by grouping containers by creation/arrival date buckets
  const trendMap = new Map<string, { overdue: number; notOverdue: number }>()

  containers.forEach((container) => {
    // Use arrival_date or created_at for grouping
    const dateStr = container.arrival_date || container.created_at || new Date().toISOString()
    const date = new Date(dateStr)
    
    // Group by month for trend visualization
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    if (!trendMap.has(monthKey)) {
      trendMap.set(monthKey, { overdue: 0, notOverdue: 0 })
    }

    const trendData = trendMap.get(monthKey)!
    const isOverdue = !container.is_closed && 
      container.days_left !== null && 
      typeof container.days_left === 'number' &&
      container.days_left < 0

    if (isOverdue) {
      trendData.overdue++
    } else {
      trendData.notOverdue++
    }
  })

  // Convert to array and sort by date
  return Array.from(trendMap.entries())
    .map(([date, data]) => ({
      date,
      overdue: data.overdue,
      notOverdue: data.notOverdue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-6) // Last 6 months
}

