import clsx from 'clsx'
import Link from 'next/link'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { AlertTriangle, DollarSign } from 'lucide-react'

type CriticalIssuesCardProps = {
  containers: Array<{
    id: string
    container_no: string
    status: string
    days_left: number | null
    detention_chargeable_days: number | null
    demurrage_fees: number
    detention_fees: number
    port: string | null
    list_id: string | null
    list_name?: string | null
  }>
  totalCount?: number
  className?: string
}

function formatUrgency(container: CriticalIssuesCardProps['containers'][0]): string {
  if (container.status === 'Overdue' && container.days_left !== null && container.days_left < 0) {
    const daysOverdue = Math.abs(container.days_left)
    return `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`
  }
  if (container.detention_chargeable_days !== null && container.detention_chargeable_days > 0) {
    return `${container.detention_chargeable_days} day${container.detention_chargeable_days !== 1 ? 's' : ''} detention`
  }
  return 'Critical issue'
}

function getTotalFees(container: CriticalIssuesCardProps['containers'][0]): number {
  return (container.demurrage_fees || 0) + (container.detention_fees || 0)
}

export function CriticalIssuesCard({ containers, totalCount, className }: CriticalIssuesCardProps) {
  const displayCount = containers.length
  const remainingCount = totalCount !== undefined ? totalCount - displayCount : 0

  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] shadow h-full flex flex-col', className)}>
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
          <h2 className="text-base font-semibold text-[#111827]">Critical Today</h2>
        </div>
      </div>
      <div className="p-4 flex-1 overflow-hidden">

        {containers.length === 0 ? (
          <p className="text-xs text-[#6B7280]">No critical issues right now.</p>
        ) : (
          <div className="space-y-2">
            {containers.map((container) => {
              const urgency = formatUrgency(container)
              const port = container.port || null

              return (
                <div
                  key={container.id}
                  className="border-l-2 border-[#DC2626] bg-[#FEF2F2] rounded-r p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-[#111827] truncate">{container.container_no}</div>
                      <div className="text-xs text-[#374151] mt-0.5">
                        <span className="text-[#DC2626] font-medium">{urgency}</span>
                        {port && <span className="text-[#6B7280]"> • {port}</span>}
                      </div>
                      {container.list_name && (
                        <div className="text-xs text-[#6B7280] mt-0.5">{container.list_name}</div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {remainingCount > 0 && (
        <div className="p-3 border-t border-[#E5E7EB]">
          <Link
            href="/dashboard/containers"
            className="text-xs text-[#007EA7] hover:underline font-medium"
          >
            +{remainingCount} more critical containers →
          </Link>
        </div>
      )}
    </div>
  )
}

