'use client'

import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingState({ 
  message = "Loading...", 
  size = 'md' 
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-16'
  }

  return (
    <Card>
      <CardContent className={`flex flex-col items-center justify-center ${sizeClasses[size]}`}>
        <Spinner className="mb-4" />
        <p className="text-muted-foreground text-sm">
          {message}
        </p>
      </CardContent>
    </Card>
  )
}
