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
      <div className="max-w-7xl mx-auto space-y-8 p-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Analytics Overview</h1>
          <p className="text-muted-foreground">
            Monitor performance, risk exposure, and container activity across your operations.
          </p>
        </div>

        {/* Analytics Overview Cards */}
        <section className="space-y-4">
          <SectionHeader title="Overview Metrics" />
          <AnalyticsOverview costData={costData} statusData={statusData} />
        </section>

        {/* Port Performance Analysis */}
        <section className="space-y-4">
          <SectionHeader
            title="Port Performance Analysis"
            description="Top 10 ports by container volume"
          />
          <PortPerformanceTable data={ports} />
        </section>

        {/* Top Containers at Risk */}
        <section className="space-y-4">
          <SectionHeader
            title="Top Containers at Risk"
            description="Most urgent containers requiring attention"
          />
          <RiskTable data={risks} />
        </section>

        {/* Activity Log */}
        <section className="space-y-4">
          <SectionHeader
            title="Activity Log"
            description="Complete audit trail of all container operations"
          />
          <ActivityLog />
        </section>
      </div>
    </AppLayout>
  )
}

