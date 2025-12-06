import { AnalyticsHero } from '@/components/analytics/AnalyticsHero'
import { AnalyticsOverview } from '@/components/analytics/AnalyticsOverview'
import { StatusDistributionChart } from '@/components/analytics/StatusDistributionChart'
import { OverdueTrendChart } from '@/components/analytics/OverdueTrendChart'
import { EnhancedPortPerformanceTable } from '@/components/analytics/EnhancedPortPerformanceTable'
import { ListAnalyticsTable } from '@/components/analytics/ListAnalyticsTable'
import { DetentionAnalytics } from '@/components/analytics/DetentionAnalytics'
import { EnhancedRiskTable } from '@/components/analytics/EnhancedRiskTable'
import { SectionHeader } from '@/components/analytics/SectionHeader'
import { fetchContainers } from '@/lib/data/containers-actions'
import { fetchLists } from '@/lib/data/lists-actions'
import {
  calculateCostOfInaction,
  calculateStatusDistribution,
  calculatePortPerformance,
  getTopAtRiskContainers,
  calculateListAnalytics,
  calculateDetentionAnalytics,
  calculateOverdueTrend,
} from '@/lib/analytics'

export default async function AnalyticsPage() {
  // Fetch containers and lists in parallel
  const [containers, lists] = await Promise.all([
    fetchContainers(),
    fetchLists(),
  ])

  // Create list name map for lookups
  const listNameMap = new Map<string, string>()
  lists.forEach((list) => {
    listNameMap.set(list.id, list.name)
  })

  // Calculate all analytics metrics
  const costData = calculateCostOfInaction(containers)
  const statusData = calculateStatusDistribution(containers)
  const ports = calculatePortPerformance(containers)
  const risks = getTopAtRiskContainers(containers, 20)
  const listAnalytics = calculateListAnalytics(containers, listNameMap)
  const detentionAnalytics = calculateDetentionAnalytics(containers, listNameMap)
  const trendData = calculateOverdueTrend(containers)

  // Enrich risk containers with list names
  const enrichedRisks = risks.map((risk) => ({
    ...risk,
    list_name: risk.list_id ? listNameMap.get(risk.list_id) || null : null,
  }))

  return (
    <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {/* Hero Section */}
        <AnalyticsHero />

        {/* KPI Overview Cards */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Overview Metrics"
            description="Cost exposure and health distribution"
          />
          <div className="mt-4">
            <AnalyticsOverview costData={costData} statusData={statusData} />
          </div>
        </section>

        {/* Trend & Distribution Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDistributionChart data={statusData} />
          <OverdueTrendChart data={trendData} />
        </section>

        {/* Port Performance */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Port Performance Analysis"
            description="Top ports ranked by throughput and risk."
          />
          <div className="mt-4">
            <EnhancedPortPerformanceTable data={ports} />
          </div>
        </section>

        {/* Client & List Analytics */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Client & List Analytics"
            description="Container distribution and risk by client list."
          />
          <div className="mt-4">
            <ListAnalyticsTable data={listAnalytics} />
          </div>
        </section>

        {/* Detention Analytics */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Detention Exposure"
            description="Containers currently incurring detention charges."
          />
          <div className="mt-4">
            <DetentionAnalytics
              summary={detentionAnalytics.summary}
              containers={detentionAnalytics.containers}
            />
          </div>
        </section>

        {/* Top Containers at Risk */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <SectionHeader
            title="Top Containers at Risk"
            description="Most urgent shipments requiring immediate action."
          />
          <div className="mt-4">
            <EnhancedRiskTable data={enrichedRisks} limit={20} />
          </div>
        </section>
      </div>
    </main>
  )
}

