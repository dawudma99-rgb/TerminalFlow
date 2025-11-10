import { AppLayout } from '@/components/layout/AppLayout'
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview'
import { PortPerformanceTable } from '@/components/analytics/PortPerformanceTable'
import { RiskTable } from '@/components/analytics/RiskTable'
import { ActivityLog } from '@/components/analytics/activity/ActivityLog'
import { SectionHeader } from '@/components/analytics/SectionHeader'
import { fetchContainers } from '@/lib/data/containers-actions'
import {
  calculateCostOfInaction,
  calculateStatusDistribution,
  calculatePortPerformance,
  getTopAtRiskContainers,
} from '@/lib/analytics'
import { RefreshCcw } from 'lucide-react'
import { Suspense } from 'react'

export default async function AnalyticsPage() {
  // Fetch containers with computed fields (cached automatically)
  const containers = await fetchContainers()

  // Calculate analytics metrics
  const costData = calculateCostOfInaction(containers)
  const statusData = calculateStatusDistribution(containers)
  const ports = calculatePortPerformance(containers)
  const risks = getTopAtRiskContainers(containers)

  return (
    <AppLayout>
      <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-[#111827]">Analytics Overview</h1>
                <p className="text-sm text-[#6B7280]">
                  Monitor performance, risk exposure, and container activity across your operations.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                <RefreshCcw className="h-4 w-4" />
                Updated from live container data
              </div>
            </div>
          </div>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader title="Overview Metrics" description="Cost exposure and health distribution" />
            <AnalyticsOverview costData={costData} statusData={statusData} />
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Port Performance Analysis"
              description="Top ports ranked by container throughput"
            />
            <PortPerformanceTable data={ports} />
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Top Containers at Risk"
              description="Most urgent shipments requiring action"
            />
            <RiskTable data={risks} />
          </section>

          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <SectionHeader
              title="Activity Log"
              description="Audit trail of container updates across the organization"
            />
            <Suspense fallback={<div className="text-sm text-[#6B7280]">Loading activity…</div>}>
              <ActivityLog />
            </Suspense>
          </section>
        </div>
      </main>
    </AppLayout>
  )
}

