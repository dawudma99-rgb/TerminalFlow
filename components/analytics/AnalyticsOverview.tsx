'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, AlertTriangle, Clock, Package } from 'lucide-react'
import type { CostOfInactionData, StatusDistributionData } from '@/lib/analytics'

interface AnalyticsOverviewProps {
  costData: CostOfInactionData
  statusData: StatusDistributionData
}

export function AnalyticsOverview({ costData, statusData }: AnalyticsOverviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  const activeContainers = statusData.safe + statusData.warning + statusData.overdue

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {/* Projected Cost */}
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Projected Cost (7 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground" aria-live="polite">
            {formatCurrency(costData.totalCost)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">If no action is taken in the next 7 days.</p>
        </CardContent>
      </Card>

      {/* Overdue Containers */}
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Overdue Containers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive" aria-live="polite">
            {costData.overdueCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Currently overdue.</p>
        </CardContent>
      </Card>

      {/* Due Soon */}
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            Due Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-warning" aria-live="polite">
            {costData.dueSoonCount}
          </div>
          <p className="text-xs text-muted-foreground mt-1">At risk in the next 7 days.</p>
        </CardContent>
      </Card>

      {/* Active Containers */}
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Active Containers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground" aria-live="polite">
            {activeContainers}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Currently open containers.</p>
        </CardContent>
      </Card>
    </div>
  )
}
