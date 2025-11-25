import clsx from "clsx"
import Link from "next/link"
import type { ContainerRecordWithComputed } from "@/lib/data/containers-actions"

type AttentionCardProps = {
  containers: Array<Pick<ContainerRecordWithComputed, "id" | "container_no" | "status" | "days_left" | "port">>
  className?: string
}

/**
 * Formats a human-readable description for a container based on its status and days_left.
 * Uses simple, non-technical language for forwarders.
 */
function formatContainerDescription(container: Pick<ContainerRecordWithComputed, "status" | "days_left" | "port">): string {
  const status = container.status
  // Ensure daysLeft is a number or null (handle undefined)
  const daysLeft: number | null = container.days_left ?? null
  const port = container.port || 'the port'

  if (status === 'Overdue' && daysLeft !== null && daysLeft < 0) {
    const daysOverdue = Math.abs(daysLeft)
    return `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} at ${port}`
  }

  if (status === 'Warning' && daysLeft !== null && daysLeft > 0) {
    return `LFD in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} at ${port}`
  }

  // Fallback for other statuses
  if (daysLeft !== null) {
    if (daysLeft < 0) {
      const daysOverdue = Math.abs(daysLeft)
      return `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} at ${port}`
    }
    return `LFD in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} at ${port}`
  }

  return `At ${port}`
}

export function AttentionCard({ containers, className }: AttentionCardProps) {
  return (
    <div className={clsx("bg-white rounded-md border border-[#E5E7EB] p-6 shadow", className)}>
      <h2 className="text-lg font-semibold text-[#111827] mb-1">Issues & Deadlines</h2>
      <p className="text-sm text-[#6B7280] mb-4">Containers that need your attention right now.</p>

      {containers.length === 0 ? (
        <p className="text-sm text-[#6B7280]">All containers are currently within safe thresholds.</p>
      ) : (
        <div className="space-y-4">
          {containers.map((container) => {
            const containerNo = container.container_no || "Unknown Container"
            const description = formatContainerDescription(container)

            return (
              <div key={container.id} className="border-b border-[#E5E7EB] last:border-0 pb-3 last:pb-0">
                <div className="font-semibold text-[#111827] mb-1">{containerNo}</div>
                <div className="text-sm text-[#374151]">{description}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-4 mt-4 border-t border-[#E5E7EB]">
        <Link href="/dashboard/containers" className="text-sm text-[#007EA7] hover:underline font-medium">
          View all containers →
        </Link>
      </div>
    </div>
  )
}

