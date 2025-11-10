import clsx from "clsx"
import { ReactNode } from "react"

type KpiCardProps = {
  title: string
  value: number | string
  icon?: ReactNode
  valueClassName?: string
  className?: string
}

export function KpiCard({ title, value, icon, valueClassName, className }: KpiCardProps) {
  return (
    <div
      className={clsx(
        "bg-white border border-[#E5E7EB] rounded-md p-6 shadow hover:shadow-md transition-all duration-150",
        className
      )}
    >
      <div className="flex justify-between items-center">
        <p className="text-sm font-medium text-[#374151] uppercase tracking-wide">{title}</p>
        {icon ? <span className="text-gray-400">{icon}</span> : null}
      </div>
      <p className={clsx("text-4xl font-semibold mt-3 text-[#004F71]", valueClassName)}>{value}</p>
    </div>
  )
}

