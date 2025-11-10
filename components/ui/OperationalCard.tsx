import clsx from "clsx"
import Link from "next/link"
import { LayoutDashboard, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"

type OperationalCardProps = {
  className?: string
}

export function OperationalCard({ className }: OperationalCardProps) {
  return (
    <div className={clsx("bg-white rounded-md border border-[#E5E7EB] p-6 shadow flex flex-col justify-between gap-4", className)}>
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Quick Actions</h2>
        <p className="text-sm text-[#6B7280]">Direct access to operations and analytics</p>
      </div>
      <div className="space-y-3">
        <Button className="w-full h-10 justify-start gap-2" asChild>
          <Link href="/dashboard/containers">
            <LayoutDashboard className="h-4 w-4" />
            Manage Containers
          </Link>
        </Button>
        <Button
          variant="outline"
          className="w-full h-10 justify-start gap-2"
          asChild
        >
          <Link href="/dashboard/analytics">
            <BarChart3 className="h-4 w-4" />
            View Analytics
          </Link>
        </Button>
      </div>
    </div>
  )
}

