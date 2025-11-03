'use client'

import { Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ 
  title = "No data found", 
  description = "There's nothing to show here yet.",
  icon = <Package className="h-12 w-12 text-muted-foreground" />,
  action
}: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
          {description}
        </p>
        {action && (
          <div className="mt-2">
            {action}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
