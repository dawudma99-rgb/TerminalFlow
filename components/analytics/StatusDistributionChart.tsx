'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { StatusDistributionData } from '@/lib/analytics'
import { Package } from 'lucide-react'

interface StatusDistributionChartProps {
  data: StatusDistributionData
}

const COLORS = {
  safe: '#10B981',
  warning: '#F59E0B',
  overdue: '#DC2626',
  closed: '#6B7280',
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const total = data.safe + data.warning + data.overdue + data.closed
  
  if (total === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No container data"
            description="No containers found to display status distribution."
            icon={<Package className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  const chartData = [
    { name: 'Safe', value: data.safe, color: COLORS.safe },
    { name: 'Warning', value: data.warning, color: COLORS.warning },
    { name: 'Overdue', value: data.overdue, color: COLORS.overdue },
    { name: 'Closed', value: data.closed, color: COLORS.closed },
  ].filter((item) => item.value > 0)

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => {
                  const pct = percent ?? 0
                  return `${name}: ${(pct * 100).toFixed(0)}%`
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => {
                  const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
                  return [`${value} (${percent}%)`, 'Count']
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {chartData.map((item) => {
            const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
            return (
              <div key={item.name} className="text-center">
                <div className="font-semibold" style={{ color: item.color }}>
                  {item.value}
                </div>
                <div className="text-muted-foreground text-xs">
                  {item.name} ({percent}%)
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

