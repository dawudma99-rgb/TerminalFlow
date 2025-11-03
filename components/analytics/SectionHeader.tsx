import { LucideIcon } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
}

export function SectionHeader({ title, description, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {Icon && <Icon className="w-5 h-5 text-primary" />}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
  )
}

