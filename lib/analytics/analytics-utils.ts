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
}

export interface AtRiskContainer {
  container_no: string
  port: string
  days_left: number
  demurrage_fee_if_late: number
  status?: string
}

/**
 * Calculate Cost of Inaction (7-day projection)
 * Only includes open containers that are overdue or due within 7 days
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

    // Count for badges
    if (daysLeft !== null && daysLeft !== undefined && typeof daysLeft === 'number') {
      if (daysLeft <= 0) {
        overdueCount++
      } else if (daysLeft > 0 && daysLeft <= 7) {
        dueSoonCount++
      }

      // Calculate fees for containers at risk (overdue or due within 7 days)
      if (daysLeft <= 7) {
        const demurrageFeeRate = container.demurrage_fee_if_late || 0

        if (daysLeft < 0) {
          // Overdue containers - multiply fee rate by days overdue
          const daysOverdue = Math.abs(daysLeft)
          totalCost += daysOverdue * demurrageFeeRate
        } else {
          // Containers due soon - use fee rate as potential exposure
          totalCost += demurrageFeeRate
        }
      }
    }
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
 * Groups containers by port and calculates averages
 */
export function calculatePortPerformance(
  containers: ContainerRecordWithComputed[]
): PortPerformanceData[] {
  const portMap = new Map<string, { count: number; totalDaysLeft: number; activeCount: number }>()

  containers.forEach((container) => {
    // Use pod for backward compatibility (port was POD)
    const port = container.pod || 'Unknown'
    
    if (!portMap.has(port)) {
      portMap.set(port, {
        count: 0,
        totalDaysLeft: 0,
        activeCount: 0,
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
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .slice(0, 10) // Top 10 ports

  return portArray
}

/**
 * Get top containers at risk
 * Returns the 5 most urgent containers
 */
export function getTopAtRiskContainers(
  containers: ContainerRecordWithComputed[]
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
      const aDays = a.days_left || 0
      const bDays = b.days_left || 0
      return aDays - bDays // Sort ascending (most urgent first)
    })
    .slice(0, 5) // Top 5
    .map((container) => ({
      container_no: container.container_no || '',
      port: container.pod || 'Unknown',
      days_left: container.days_left || 0,
      demurrage_fee_if_late: container.demurrage_fee_if_late || 0,
      status: container.status,
    }))

  return activeContainers
}

