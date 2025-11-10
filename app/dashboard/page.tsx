'use client'

import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { useContainers } from '@/lib/data/useContainers'
import { insertContainer, type ContainerInsert } from '@/lib/data/containers-actions'
import type { Json } from '@/types/database'
import { useListsContext } from '@/components/providers/ListsProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { AddContainerForm } from '@/components/forms/AddContainerForm'
import { useMemo, useState } from 'react'
import { Plus, AlertTriangle, ShieldCheck, Clock, LayoutDashboard, Package } from 'lucide-react'
import { Tier } from '@/lib/tierUtils'
import { KpiCard } from '@/components/ui/KpiCard'
import { AttentionCard } from '@/components/ui/AttentionCard'
import { OperationalCard } from '@/components/ui/OperationalCard'

function AddContainerTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = async (data: {
    container_no: string
    port: string
    arrival_date: string
    free_days: number
    carrier: string
    container_size: string
    assigned_to: string
    demurrage_enabled: boolean
    demurrage_flat_rate: number
    demurrage_tiers: Tier[]
    detention_enabled: boolean
    detention_flat_rate: number
    detention_tiers: Tier[]
    gate_out_date: string
    empty_return_date: string
    notes: string
  }) => {
    try {
      // Normalize date fields: empty string -> null
      const normalizeDate = (dateStr: string): string | null => {
        return dateStr.trim() === '' ? null : dateStr
      }

      const containerData = {
        container_no: data.container_no,
        port: data.port,
        arrival_date: normalizeDate(data.arrival_date),
        free_days: data.free_days,
        carrier: data.carrier || null,
        container_size: data.container_size || null,
        notes: data.notes || null,
        assigned_to: data.assigned_to || null,
        gate_out_date: normalizeDate(data.gate_out_date),
        empty_return_date: normalizeDate(data.empty_return_date),
        demurrage_tiers: data.demurrage_enabled && data.demurrage_tiers?.length > 0
          ? (data.demurrage_tiers as unknown as Json)
          : null,
        detention_tiers: data.detention_enabled && data.detention_tiers?.length > 0
          ? (data.detention_tiers as unknown as Json)
          : null,
        has_detention: data.detention_enabled,
      }

      await insertContainer(containerData as ContainerInsert)
      toast.success('Container added successfully!')
      logger.log('Container added successfully!')
    } catch (error) {
      logger.error('Error adding container:', error)
      toast.error('Failed to add container. Please try again.')
    }
  }

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 h-10 px-5 font-medium"
      >
        <Plus className="h-4 w-4" />
        Add Container
      </Button>
      
      <AddContainerForm 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}

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

  const attentionContainers = useMemo(
    () =>
      containers
        .filter((c) => c.status === 'Overdue' || c.status === 'Warning')
        .sort((a, b) => {
          const aDays = a.days_left ?? Number.POSITIVE_INFINITY
          const bDays = b.days_left ?? Number.POSITIVE_INFINITY
          return aDays - bDays
        })
        .slice(0, 5),
    [containers],
  )

  if (loading) {
    return (
      <AppLayout>
        <main className="p-8 bg-[#F9FAFB] min-h-screen space-y-8">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
            </div>
            <AddContainerTrigger />
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
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
              <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
            </div>
            <AddContainerTrigger />
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

  const urgentContainers = attentionContainers

  return (
    <AppLayout>
      <main className="p-8 bg-[#F9FAFB] min-h-screen space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#111827] tracking-tight">Dashboard</h1>
            <p className="text-sm text-[#6B7280]">Overview of container activity and demurrage exposure</p>
          </div>
          <AddContainerTrigger />
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
          <AttentionCard containers={urgentContainers} />
          <OperationalCard />
        </section>

        {containers.length === 0 && (
          <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
            <CardContent>
              <EmptyState
                title="No containers yet"
                description="Start tracking demurrage and detention by adding your first container."
                icon={<LayoutDashboard className="h-12 w-12 text-muted-foreground" />}
                action={<AddContainerTrigger />}
              />
            </CardContent>
          </Card>
        )}
      </main>
    </AppLayout>
  )
}
