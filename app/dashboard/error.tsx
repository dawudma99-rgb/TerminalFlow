'use client'

import { logger } from '@/lib/utils/logger'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  logger.error('🚨 [DashboardError] Dashboard failed:', error)

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 p-8">
        <div className="flex justify-center">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Dashboard Error</h2>
          <p className="text-muted-foreground max-w-md">
            {error.message || 'Something went wrong in the dashboard'}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono mt-2">
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <Button onClick={() => reset()} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Dashboard
          </Button>
          <Button
            onClick={() => (window.location.href = '/dashboard')}
            variant="outline"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </AppLayout>
  )
}

