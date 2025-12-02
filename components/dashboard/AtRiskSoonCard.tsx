import clsx from 'clsx'
import Link from 'next/link'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { Clock } from 'lucide-react'

type AtRiskSoonCardProps = {
  containers: Array<{
    id: string
    container_no: string
    days_left: number | null
    port: string | null
    list_id: string | null
    list_name?: string | null
  }>
  totalCount?: number
  className?: string
}

export function AtRiskSoonCard({ containers, totalCount, className }: AtRiskSoonCardProps) {
  const displayCount = containers.length
  const remainingCount = totalCount !== undefined ? totalCount - displayCount : 0

  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] shadow h-full flex flex-col', className)}>
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#D97706]" />
          <h2 className="text-base font-semibold text-[#111827]">At Risk Soon</h2>
        </div>
      </div>
      <div className="p-4 flex-1 overflow-hidden">

        {containers.length === 0 ? (
          <p className="text-xs text-[#6B7280]">No containers at risk right now.</p>
        ) : (
          <div className="space-y-2">
            {containers.map((container) => {
              const daysLeft = container.days_left ?? 0
              const port = container.port || null

              return (
                <div
                  key={container.id}
                  className="border-l-2 border-[#D97706] bg-[#FFFBEB] rounded-r p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-[#111827] truncate">{container.container_no}</div>
                      <div className="text-xs text-[#374151] mt-0.5">
                        {daysLeft > 0 && (
                          <span className="font-medium text-[#D97706]">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                        )}
                        {port && (
                          <span className="text-[#6B7280]">{daysLeft > 0 ? ' • ' : ''}{port}</span>
                        )}
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
            +{remainingCount} more at-risk containers →
          </Link>
        </div>
      )}
    </div>
  )
}

