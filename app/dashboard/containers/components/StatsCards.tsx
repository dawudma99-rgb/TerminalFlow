'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'

interface StatsCardsProps {
  stats: {
    total: number
    open: number
    closed: number
    overdue: number
    safe: number
  }
}

// ✅ Memoized: Prevents re-renders when unrelated props or parent state change
export const StatsCards = memo(function StatsCards({ stats }: StatsCardsProps) {
  // Temporary render marker for performance verification (Phase 3-D)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Render] StatsCards', stats)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
      {/* Total */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">Total</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </CardContent>
      </Card>

      {/* Open */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-blue-700 mb-1">Open</div>
          <div className="text-2xl font-bold text-blue-900">{stats.open}</div>
        </CardContent>
      </Card>

      {/* Closed */}
      <Card className="border-slate-200 bg-slate-50/30">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-slate-700 mb-1">Closed</div>
          <div className="text-2xl font-bold text-slate-900">{stats.closed}</div>
        </CardContent>
      </Card>

      {/* Overdue */}
      <Card className="border-red-200 bg-red-50/30">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-red-700 mb-1">Overdue</div>
          <div className="text-2xl font-bold text-red-900">{stats.overdue}</div>
        </CardContent>
      </Card>

      {/* Safe */}
      <Card className="border-green-200 bg-green-50/30">
        <CardContent className="p-4">
          <div className="text-sm font-medium text-green-700 mb-1">Safe</div>
          <div className="text-2xl font-bold text-green-900">{stats.safe}</div>
        </CardContent>
      </Card>
    </div>
  )
})

