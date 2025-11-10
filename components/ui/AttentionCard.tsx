import clsx from "clsx"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { ContainerRecordWithComputed } from "@/lib/data/containers-actions"

type AttentionCardProps = {
  containers: Array<Pick<ContainerRecordWithComputed, "id" | "container_no" | "status" | "days_left">>
  className?: string
}

const statusStyles: Record<string, string> = {
  Overdue: "bg-red-50 text-[#DC2626] border border-red-100",
  Warning: "bg-amber-50 text-[#D97706] border border-amber-100",
  Safe: "bg-emerald-50 text-[#059669] border border-emerald-100",
}

function getDaysColor(status: string | null, daysLeft: number | null) {
  if (daysLeft == null) return "text-[#6B7280]"
  if (daysLeft < 0) return "text-[#DC2626]"
  if (status === "Warning") return "text-[#D97706]"
  if (status === "Safe") return "text-[#059669]"
  return "text-[#6B7280]"
}

export function AttentionCard({ containers, className }: AttentionCardProps) {
  return (
    <div className={clsx("bg-white rounded-md border border-[#E5E7EB] p-6 shadow", className)}>
      <h2 className="text-lg font-semibold text-[#111827] mb-1">Attention Needed</h2>
      <p className="text-sm text-[#6B7280] mb-4">Containers approaching demurrage or detention deadlines.</p>

      {containers.length === 0 ? (
        <p className="text-sm text-[#6B7280]">All monitored containers are currently within safe thresholds.</p>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {containers.map((container) => {
            const status = container.status ?? "Unknown"
            const statusLabel = status === "Warning" ? "At Risk" : status
            return (
              <div key={container.id} className="flex justify-between items-center py-3">
                <span className="font-medium text-[#111827]">{container.container_no || "Unnamed Container"}</span>
                <div className="flex items-center gap-3">
                  <Badge
                    className={clsx(
                      "rounded-sm px-2 py-0.5 text-xs font-medium",
                      statusStyles[status] ?? "bg-gray-100 text-[#6B7280] border border-gray-200"
                    )}
                  >
                    {statusLabel}
                  </Badge>
                  <span className={clsx("font-semibold", getDaysColor(container.status ?? null, container.days_left ?? null))}>
                    {container.days_left ?? "—"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-3 text-right">
        <Link href="/dashboard/containers" className="text-sm text-[#007EA7] hover:underline font-medium">
          View All →
        </Link>
      </div>
    </div>
  )
}

