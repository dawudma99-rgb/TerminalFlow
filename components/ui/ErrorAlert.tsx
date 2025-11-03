'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorAlertProps {
  title?: string
  message: string
  onRetry?: () => void
  retryText?: string
}

export function ErrorAlert({ 
  title = "Something went wrong",
  message,
  onRetry,
  retryText = "Try again"
}: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm mt-1">{message}</p>
        </div>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="ml-4 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryText}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
