import clsx from 'clsx'
import Link from 'next/link'
import type { ListRecord } from '@/lib/data/lists-actions'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { Package } from 'lucide-react'

type ListOverviewCardProps = {
  lists: ListRecord[]
  allContainers: ContainerRecordWithComputed[]
  activeListId: string | null
  className?: string
}

export function ListOverviewCard({
  lists,
  allContainers,
  activeListId,
  className,
}: ListOverviewCardProps) {
  // If only one list or we want to show active list only, simplify
  if (lists.length <= 1) {
    const list = lists[0]
    if (!list) return null

    const listContainers = allContainers.filter((c) => c.list_id === list.id)
    const overdue = listContainers.filter((c) => c.status === 'Overdue').length
    const warning = listContainers.filter((c) => c.status === 'Warning').length
    const safe = listContainers.filter((c) => c.status === 'Safe').length
    const total = listContainers.length

    return (
      <div className={clsx('bg-white rounded-md border border-[#E5E7EB] p-6 shadow', className)}>
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-5 w-5 text-[#2563EB]" />
          <h2 className="text-lg font-semibold text-[#111827]">By Client / List</h2>
        </div>
        <p className="text-sm text-[#6B7280] mb-4">Overview of containers by list.</p>

        <div className="border border-[#E5E7EB] rounded-md p-4 bg-[#F9FAFB]">
          <div className="font-medium text-[#111827] mb-3">{list.name}</div>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[#6B7280] text-xs mb-1">Total</div>
              <div className="font-semibold text-[#111827]">{total}</div>
            </div>
            <div>
              <div className="text-[#6B7280] text-xs mb-1">Overdue</div>
              <div className="font-semibold text-[#DC2626]">{overdue}</div>
            </div>
            <div>
              <div className="text-[#6B7280] text-xs mb-1">At Risk</div>
              <div className="font-semibold text-[#D97706]">{warning}</div>
            </div>
            <div>
              <div className="text-[#6B7280] text-xs mb-1">Safe</div>
              <div className="font-semibold text-[#059669]">{safe}</div>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-[#E5E7EB]">
          <Link
            href="/dashboard/containers"
            className="text-sm text-[#007EA7] hover:underline font-medium"
          >
            View all containers →
          </Link>
        </div>
      </div>
    )
  }

  // Multiple lists: show breakdown
  const listStats = lists.map((list) => {
    const listContainers = allContainers.filter((c) => c.list_id === list.id)
    return {
      list,
      overdue: listContainers.filter((c) => c.status === 'Overdue').length,
      warning: listContainers.filter((c) => c.status === 'Warning').length,
      safe: listContainers.filter((c) => c.status === 'Safe').length,
      total: listContainers.length,
    }
  })

  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] shadow', className)}>
      <div className="p-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[#2563EB]" />
          <h2 className="text-base font-semibold text-[#111827]">By client / list</h2>
        </div>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-2 px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  List / Client
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  Overdue
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  At risk
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  Total
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {listStats.map(({ list, overdue, warning, total }) => (
                <tr
                  key={list.id}
                  className={clsx(
                    'border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]',
                    list.id === activeListId && 'bg-[#EFF6FF]'
                  )}
                >
                  <td className="py-2 px-3">
                    <div className="font-medium text-sm text-[#111827]">{list.name}</div>
                    {list.id === activeListId && (
                      <div className="text-xs text-[#2563EB] font-medium mt-0.5">Active</div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-semibold text-sm text-[#DC2626]">{overdue}</span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-semibold text-sm text-[#D97706]">{warning}</span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="font-semibold text-sm text-[#111827]">{total}</span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <Link
                      href={`/dashboard/containers?list=${list.id}`}
                      className="text-xs text-[#007EA7] hover:underline font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

