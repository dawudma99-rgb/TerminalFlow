'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/ui/EmptyState'
import type { DetentionAnalyticsData, DetentionSummary } from '@/lib/analytics'
import { Activity, DollarSign } from 'lucide-react'

interface DetentionAnalyticsProps {
  summary: DetentionSummary
  containers: DetentionAnalyticsData[]
}

export function DetentionAnalytics({ summary, containers }: DetentionAnalyticsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount)
  }

  if (summary.containersInDetention === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Detention Exposure</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No detention exposure"
            description="No containers are currently incurring detention charges."
            icon={<Activity className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Containers in Detention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" aria-live="polite">
              {summary.containersInDetention}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Currently incurring detention charges</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Total Detention Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" aria-live="polite">
              {formatCurrency(summary.totalDetentionFees)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Estimated total detention charges</p>
          </CardContent>
        </Card>
      </div>

      {/* Detention Containers Table */}
      <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
        <CardHeader>
          <CardTitle>Containers in Detention</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead aria-label="Container number">Container</TableHead>
                  <TableHead aria-label="Port name">Port</TableHead>
                  <TableHead aria-label="List name">List</TableHead>
                  <TableHead className="text-right" aria-label="Days in detention">
                    Days in Detention
                  </TableHead>
                  <TableHead className="text-right" aria-label="Estimated detention fees">
                    Estimated Fees
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {containers.map((container) => (
                  <TableRow key={container.container_id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-sm">{container.container_no}</TableCell>
                    <TableCell>{container.port || '—'}</TableCell>
                    <TableCell>{container.list_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      {container.days_in_detention}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(container.detention_fees)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}





