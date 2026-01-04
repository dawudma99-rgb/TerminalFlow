'use client'

import { RefreshCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function AnalyticsHero() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Analytics & Insights</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Cost exposure, port performance and container risk patterns based on your live data.
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2 w-fit">
          <RefreshCcw className="h-3 w-3" />
          Updated from live container data
        </Badge>
      </div>
    </div>
  )
}


