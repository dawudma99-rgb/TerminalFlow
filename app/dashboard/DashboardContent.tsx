'use client'

import { useContainers } from '@/lib/data/useContainers'
import { useListsContext } from '@/components/providers/ListsProvider'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useMemo } from 'react'
import { LayoutDashboard, Package, AlertTriangle, Clock, Activity, TrendingUp, DollarSign } from 'lucide-react'
import type { AlertRow } from '@/lib/data/alerts-actions'
import { KpiCard } from '@/components/ui/KpiCard'
import { CriticalIssuesCard } from '@/components/dashboard/CriticalIssuesCard'
import { AtRiskSoonCard } from '@/components/dashboard/AtRiskSoonCard'
import { TodaysActivityCard } from '@/components/dashboard/TodaysActivityCard'
import { ListOverviewCard } from '@/components/dashboard/ListOverviewCard'
import { calculateCostOfInaction } from '@/lib/analytics'

/**
 * Client component that renders the Dashboard UI.
 * 
 * This component handles all the interactive dashboard features:
 * - Critical issues (overdue and detention containers)
 * - At-risk containers (warning status)
 * - Changes since yesterday (recent alerts)
 * - List overview
 * - Quick actions
 * 
 * The parent server component (page.tsx) handles server-side operations
 * like backfilling overdue alerts and fetching recent alerts.
 */
export function DashboardContent({ recentAlerts }: { recentAlerts: AlertRow[] }) {
  const { activeListId, lists } = useListsContext()
  // Fetch all containers (not just active list) for dashboard overview
  const { containers: allContainers, loading, isInitialLoading, isRefreshing, error, reload } = useContainers(null)

  // Create a map of list_id -> list_name for quick lookups
  const listNameMap = useMemo(() => {
    const map = new Map<string, string>()
    lists.forEach((list) => {
      map.set(list.id, list.name)
    })
    return map
  }, [lists])

  // Currency formatter for GBP
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  // Compute projected cost (7 days) using analytics function
  const projectedCost7Days = useMemo(() => {
    if (!allContainers || allContainers.length === 0) return 0
    try {
      const costData = calculateCostOfInaction(allContainers)
      const totalCost = costData.totalCost
      // Safely handle null/NaN
      if (typeof totalCost !== 'number' || isNaN(totalCost)) return 0
      return totalCost
    } catch (error) {
      // Fallback to 0 if calculation fails
      return 0
    }
  }, [allContainers])

  // Compute KPIs
  const kpis = useMemo(() => {
    const total = allContainers.filter((c) => !c.is_closed).length
    const overdue = allContainers.filter((c) => c.status === 'Overdue').length
    const atRisk = allContainers.filter((c) => c.status === 'Warning').length
    const detentionRunning = allContainers.filter(
      (c) => c.detention_chargeable_days !== null && c.detention_chargeable_days > 0
    ).length

    // New in last 24h: containers created or with first arrival in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const newIn24h = allContainers.filter((c) => {
      const createdAt = c.created_at ? new Date(c.created_at) : null
      const arrivalDate = c.arrival_date ? new Date(c.arrival_date) : null
      return (
        (createdAt && createdAt >= twentyFourHoursAgo) ||
        (arrivalDate && arrivalDate >= twentyFourHoursAgo)
      )
    }).length

    return { total, overdue, atRisk, detentionRunning, newIn24h }
  }, [allContainers])

  // Critical Issues: Overdue containers OR containers with detention
  // Compute all matching containers for the "+X more" link
  const criticalIssuesAll = useMemo(() => {
    return allContainers
      .filter((c) => {
        const isOverdue = c.status === 'Overdue'
        const hasDetention = c.detention_chargeable_days !== null && c.detention_chargeable_days > 0
        return isOverdue || hasDetention
      })
      .map((c) => ({
        id: c.id,
        container_no: c.container_no,
        status: c.status,
        days_left: c.days_left,
        detention_chargeable_days: c.detention_chargeable_days,
        demurrage_fees: c.demurrage_fees,
        detention_fees: c.detention_fees,
        port: c.pod || c.pol || null,
        list_id: c.list_id,
        list_name: c.list_id ? listNameMap.get(c.list_id) ?? null : null,
      }))
      .sort((a, b) => {
        // Sort by urgency: overdue first, then by total fees descending
        const aIsOverdue = a.status === 'Overdue'
        const bIsOverdue = b.status === 'Overdue'
        if (aIsOverdue && !bIsOverdue) return -1
        if (!aIsOverdue && bIsOverdue) return 1
        const aFees = (a.demurrage_fees || 0) + (a.detention_fees || 0)
        const bFees = (b.demurrage_fees || 0) + (b.detention_fees || 0)
        return bFees - aFees
      })
  }, [allContainers, listNameMap])

  // Only show top 5 critical issues
  const criticalIssues = useMemo(() => criticalIssuesAll.slice(0, 5), [criticalIssuesAll])
  const criticalIssuesCount = criticalIssuesAll.length

  // At-Risk Soon: Warning status containers
  // Compute all matching containers for the "+X more" link
  const atRiskSoonAll = useMemo(() => {
    return allContainers
      .filter((c) => c.status === 'Warning')
      .map((c) => ({
        id: c.id,
        container_no: c.container_no,
        days_left: c.days_left,
        port: c.pod || c.pol || null,
        list_id: c.list_id,
        list_name: c.list_id ? listNameMap.get(c.list_id) ?? null : null,
      }))
      .sort((a, b) => {
        // Sort by days_left ascending (fewer days = more urgent)
        const aDays = a.days_left ?? Number.POSITIVE_INFINITY
        const bDays = b.days_left ?? Number.POSITIVE_INFINITY
        return aDays - bDays
      })
  }, [allContainers, listNameMap])

  // Only show top 5 at-risk containers
  const atRiskSoon = useMemo(() => atRiskSoonAll.slice(0, 5), [atRiskSoonAll])
  const atRiskSoonCount = atRiskSoonAll.length

  if (isInitialLoading) {
    return (
      <main className="p-4 bg-[#F9FAFB] min-h-screen">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
        </header>
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
          <CardContent className="py-12">
            <LoadingState message="Loading dashboard..." />
          </CardContent>
        </Card>
      </main>
    )
  }

  if (error && allContainers.length === 0) {
    return (
      <main className="p-4 bg-[#F9FAFB] min-h-screen">
        <header className="mb-4">
          <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
        </header>
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
          <CardContent className="py-8">
            <ErrorAlert 
              message={error.message || 'Failed to load containers'}
              onRetry={reload}
            />
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="p-4 bg-[#F9FAFB] min-h-screen">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
        {isRefreshing && (
          <span className="ml-2 text-xs text-muted-foreground">
            Refreshing…
          </span>
        )}
      </header>

      {/* Top row: 6 KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4">
        <KpiCard
          title="Projected Cost (7 days)"
          value={formatCurrency(projectedCost7Days)}
          icon={<DollarSign className="h-4 w-4 text-[#D97706]" />}
          valueClassName="text-[#D97706]"
          description="Projected demurrage fees if no action taken"
          tooltip="Based on current overdue containers and those likely to go overdue within 7 days."
        />
        <KpiCard
          title="Total Active"
          value={kpis.total}
          icon={<Package className="h-4 w-4 text-[#2563EB]" />}
          description="Open containers currently being handled."
          tooltip="All containers that are not yet closed."
        />
        <KpiCard
          title="Overdue"
          value={kpis.overdue}
          icon={<AlertTriangle className="h-4 w-4 text-[#DC2626]" />}
          valueClassName="text-[#DC2626]"
          description="Containers now in demurrage."
          tooltip="These containers have passed free time. Demurrage applies."
        />
        <KpiCard
          title="At Risk Soon"
          value={kpis.atRisk}
          icon={<Clock className="h-4 w-4 text-[#D97706]" />}
          valueClassName="text-[#D97706]"
          description="Free time almost finished."
          tooltip="Containers with only a few free days left."
        />
        <KpiCard
          title="Detention Running"
          value={kpis.detentionRunning}
          icon={<Activity className="h-4 w-4 text-[#DC2626]" />}
          valueClassName="text-[#DC2626]"
          description="Container out — detention charges running."
          tooltip="Containers that have left the port and detention is charging."
        />
        <KpiCard
          title="New Today"
          value={kpis.newIn24h}
          icon={<TrendingUp className="h-4 w-4 text-[#059669]" />}
          valueClassName="text-[#059669]"
          description="Containers added to the system today."
          tooltip="Containers added today (via import or manual entry)."
        />
      </section>

      {/* Second row: 3-column layout - Core operational widgets */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Column A: Critical Today */}
        <CriticalIssuesCard containers={criticalIssues} totalCount={criticalIssuesCount} />

        {/* Column B: At Risk Soon */}
        <AtRiskSoonCard containers={atRiskSoon} totalCount={atRiskSoonCount} />

        {/* Column C: Today's Activity */}
        <TodaysActivityCard alerts={recentAlerts.slice(0, 10)} />
      </section>

      {/* Secondary scrollable section: List Overview */}
      <section className="mt-6">
        <ListOverviewCard
          lists={lists}
          allContainers={allContainers}
          activeListId={activeListId}
        />
      </section>

      {allContainers.length === 0 && (
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm mt-4">
          <CardContent className="py-12">
            <EmptyState
              title="No containers yet"
              description="Start tracking demurrage and detention by adding your first container."
              icon={<LayoutDashboard className="h-12 w-12 text-muted-foreground" />}
            />
          </CardContent>
        </Card>
      )}
    </main>
  )
}
