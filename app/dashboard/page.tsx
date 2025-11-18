'use client'

import { useContainers } from '@/lib/data/useContainers'
import { useListsContext } from '@/components/providers/ListsProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useMemo } from 'react'
import { AlertTriangle, ShieldCheck, Clock, LayoutDashboard, Package } from 'lucide-react'
import { KpiCard } from '@/components/ui/KpiCard'
import { AttentionCard } from '@/components/ui/AttentionCard'
import { OperationalCard } from '@/components/ui/OperationalCard'

export default function DashboardPage() {
  const { activeListId } = useListsContext()
  const { containers, loading, error, reload } = useContainers(activeListId)

  const metrics = useMemo(() => {
    const total = containers.length
    const overdue = containers.filter((c) => c.status === 'Overdue').length
    const atRisk = containers.filter((c) => c.status === 'Warning').length
    const safe = containers.filter((c) => c.status === 'Safe').length

    return {
      total,
      overdue,
      atRisk,
      safe,
    }
  }, [containers])

  // Filter containers that need attention (Overdue or Warning status)
  // Sort by most urgent (most overdue first, then by days_left ascending)
  // Limit to 5 containers max
  const attentionContainers = useMemo(
    () =>
      containers
        .filter((c) => c.status === 'Overdue' || c.status === 'Warning')
        .sort((a, b) => {
          const aDays = a.days_left ?? Number.POSITIVE_INFINITY
          const bDays = b.days_left ?? Number.POSITIVE_INFINITY
          // Most overdue (negative days) first, then by days_left ascending
          return aDays - bDays
        })
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          container_no: c.container_no,
          status: c.status,
          days_left: c.days_left,
          port: c.port,
        })),
    [containers],
  )

  if (loading) {
    return (
      <AppLayout>
        <main className="p-8 bg-[#F9FAFB] min-h-screen space-y-8">
          <header>
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
            </div>
          </header>
          <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
            <CardContent className="py-12">
              <LoadingState message="Loading containers..." />
            </CardContent>
          </Card>
        </main>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <main className="p-8 bg-[#F9FAFB] min-h-screen space-y-8">
          <header>
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
            </div>
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
      </AppLayout>
    )
  }

  const statCards = [
    {
      label: 'Total Containers',
      value: metrics.total,
      icon: <Package className="h-5 w-5 text-[#2563EB]" />,
    },
    {
      label: 'Overdue',
      value: metrics.overdue,
      icon: <AlertTriangle className="h-5 w-5 text-[#DC2626]" />,
    },
    {
      label: 'At Risk',
      value: metrics.atRisk,
      icon: <Clock className="h-5 w-5 text-[#D97706]" />,
    },
    {
      label: 'Safe',
      value: metrics.safe,
      icon: <ShieldCheck className="h-5 w-5 text-[#059669]" />,
    },
  ]

  return (
    <AppLayout>
      <main className="p-8 bg-[#F9FAFB] min-h-screen space-y-8">
        <header>
          <div>
            <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
            <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <KpiCard
              key={stat.label}
              title={stat.label}
              value={stat.value}
              icon={stat.icon}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttentionCard containers={attentionContainers} />
          <OperationalCard />
        </section>

        {containers.length === 0 && (
          <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
            <CardContent>
              <EmptyState
                title="No containers yet"
                description="Start tracking demurrage and detention by adding your first container."
                icon={<LayoutDashboard className="h-12 w-12 text-muted-foreground" />}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </AppLayout>
  )
}
