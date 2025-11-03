'use client'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, Trash2 } from 'lucide-react'
import { clearHistory, type HistoryEvent } from '@/lib/data/history-actions'
import { exportHistoryCSV } from '@/lib/analytics/history-utils'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ActivityActionsProps {
  history: HistoryEvent[]
}

export function ActivityActions({ history }: ActivityActionsProps) {
  const [isClearing, setIsClearing] = useState(false)
  const router = useRouter()

  const handleExportCSV = () => {
    try {
      const csv = exportHistoryCSV(history)
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `activity_log_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      
      toast.success('Activity log exported successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export activity log')
    }
  }

  const handleClearHistory = async () => {
    setIsClearing(true)
    try {
      await clearHistory()
      toast.success('Activity log cleared successfully')
      // Refresh the page to reload data
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear activity log')
      setIsClearing(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportCSV}
        className="flex items-center gap-2"
        aria-label="Export activity log as CSV"
      >
        <Download className="h-4 w-4" />
        Export CSV
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-destructive hover:text-destructive"
            disabled={isClearing}
            aria-label="Clear all activity log entries"
          >
            <Trash2 className="h-4 w-4" />
            Clear Log
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Activity Log?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all activity log entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isClearing}
            >
              {isClearing ? 'Clearing...' : 'Clear All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

