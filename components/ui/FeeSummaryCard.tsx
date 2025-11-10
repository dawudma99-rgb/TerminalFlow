import clsx from "clsx"

type FeeSummaryCardProps = {
  className?: string
}

export function FeeSummaryCard({ className }: FeeSummaryCardProps) {
  return (
    <div className={clsx("bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-4", className)}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Demurrage &amp; Detention Fees</h2>
        <p className="text-sm text-gray-500">Daily cost exposure summary</p>
      </div>
      <div className="space-y-2 text-sm text-gray-700">
        <div className="flex justify-between">
          <span>Total Fees</span>
          <span className="font-semibold text-gray-900">$35,919 / day</span>
        </div>
        <div className="flex justify-between">
          <span>Today</span>
          <span className="text-red-600 font-medium">$6,966</span>
        </div>
        <div className="flex justify-between">
          <span>Tomorrow</span>
          <span className="text-amber-600 font-medium">$743</span>
        </div>
      </div>
    </div>
  )
}

