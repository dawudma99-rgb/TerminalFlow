import clsx from "clsx"
import { ReactNode } from "react"
import { Info } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"

type KpiCardProps = {
  title: string
  value: number | string
  icon?: ReactNode
  valueClassName?: string
  className?: string
  description?: string
  tooltip?: string
}

export function KpiCard({ title, value, icon, valueClassName, className, description, tooltip }: KpiCardProps) {
  return (
    <div
      className={clsx(
        "bg-white border border-[#E5E7EB] rounded-md p-3 shadow hover:shadow-md transition-all duration-150",
        className
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs font-medium text-[#374151] uppercase tracking-wide">{title}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-[#6B7280] cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {description && (
            <p className="text-[10px] text-[#6B7280] mt-0.5 leading-tight">{description}</p>
          )}
        </div>
        {icon ? <span className="text-gray-400 flex-shrink-0 opacity-70 ml-2">{icon}</span> : null}
      </div>
      <p className={clsx("text-2xl font-semibold mt-1.5 text-[#004F71]", valueClassName)}>{value}</p>
    </div>
  )
}

