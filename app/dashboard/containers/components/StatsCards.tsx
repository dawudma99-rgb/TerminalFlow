'use client'

import clsx from 'clsx'

interface StatsSummaryProps {
  total: number
  overdue: number
  warning: number
  safe: number
  closed: number
  updatedLabel?: string
}

const statusStyles: Record<string, string> = {
  total: 'text-slate-700',
  overdue: 'text-[#B91C1C]',
  warning: 'text-[#B45309]',
  safe: 'text-[#047857]',
  closed: 'text-[#4B5563]',
}

export function StatsSummary({
  total,
  overdue,
  warning,
  safe,
  closed,
  updatedLabel,
}: StatsSummaryProps) {
  const items = [
    { key: 'total', label: 'Total', value: total },
    { key: 'overdue', label: 'Overdue', value: overdue },
    { key: 'warning', label: 'Warning', value: warning },
    { key: 'safe', label: 'Safe', value: safe },
    { key: 'closed', label: 'Closed', value: closed },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#D4D7DE] bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
      {items.map((item, index) => (
        <div key={item.key} className="flex items-center gap-1">
          {index > 0 && <span className="text-[#CBD0D8]">•</span>}
          <span className="uppercase tracking-[0.18em] text-[10px] text-slate-400">{item.label}</span>
          <span className={clsx('font-semibold', statusStyles[item.key])}>{item.value}</span>
        </div>
      ))}
      {updatedLabel && (
        <>
          <span className="text-[#CBD0D8]">•</span>
          <span className="text-[11px] text-slate-400">{updatedLabel}</span>
        </>
      )}
    </div>
  )
}
