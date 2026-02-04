'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface TrendDataPoint {
  date: string
  overdue: number
  notOverdue: number
}

interface OverdueTrendChartProps {
  data: TrendDataPoint[]
}

export function OverdueTrendChart({ data }: OverdueTrendChartProps) {
  if (data.length === 0) {
    return (
      <Card className="hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle>Overdue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No trend data available"
            description="Insufficient data to display trend analysis."
            icon={<TrendingUp className="h-12 w-12 text-muted-foreground" />}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>Overdue Trend (Last 6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="overdue" fill="#DC2626" name="Overdue" />
              <Bar dataKey="notOverdue" fill="#6B7280" name="Not Overdue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}





