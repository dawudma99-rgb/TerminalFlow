'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { markAlertsSeen } from '@/lib/data/alerts-actions'
import type { AlertRow } from '@/lib/data/alerts-actions'
import { useRealtimeAlerts } from '@/lib/hooks/useRealtimeAlerts'
import { logger } from '@/lib/utils/logger'
import Link from 'next/link'
import { cn } from '@/lib/utils'

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'info':
      return 'bg-gray-400'
    case 'warning':
      return 'bg-yellow-500'
    case 'critical':
      return 'bg-red-500'
    default:
      return 'bg-gray-400'
  }
}

export function AlertsBell() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null)
  const previousUnreadCountRef = useRef(0)
  
  // Realtime subscription
  const { latestAlert, resetLatest, connectionStatus } = useRealtimeAlerts()

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/alerts?limit=20')
      if (!response.ok) {
        throw new Error('Failed to fetch alerts')
      }
      const data = await response.json()
      setAlerts(data)
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAlerts, 30000)
    return () => clearInterval(interval)
  }, [fetchAlerts])

  // Handle new alerts from realtime subscription
  useEffect(() => {
    if (latestAlert) {
      logger.debug('[AlertsBell] New realtime alert received', {
        alertId: latestAlert.id,
        eventType: latestAlert.event_type,
      })

      // Add the new alert to the beginning of the list (newest first)
      setAlerts((prev) => {
        // Check if alert already exists (avoid duplicates)
        const exists = prev.some((a) => a.id === latestAlert.id)
        if (exists) {
          return prev
        }
        return [latestAlert, ...prev].slice(0, 20) // Keep only latest 20
      })

      // Trigger pulse animation
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 2000)

      // Highlight the new alert for 2 seconds
      setHighlightedAlertId(latestAlert.id)
      setTimeout(() => setHighlightedAlertId(null), 2000)

      // Clear the latest alert after processing
      resetLatest()
    }
  }, [latestAlert, resetLatest])

  // Filter alerts that haven't been seen (seen_at is null or undefined)
  const unreadAlerts = alerts.filter((alert) => !alert.seen_at)
  const unreadCount = unreadAlerts.length
  const displayCount = unreadCount > 9 ? '9+' : unreadCount.toString()

  // Track unread count changes for animation
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
      // New alert arrived (count increased)
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 2000)
    }
    previousUnreadCountRef.current = unreadCount
  }, [unreadCount])

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen)
    if (isOpen && unreadCount > 0) {
      // Mark all unread alerts as seen (fire-and-forget)
      const unreadIds = unreadAlerts.map((a) => a.id)
      const seenAtTimestamp = new Date().toISOString()
      
      // Optimistically update local state immediately for instant UI feedback
      setAlerts((prev) =>
        prev.map((alert) =>
          unreadIds.includes(alert.id)
            ? { ...alert, seen_at: seenAtTimestamp }
            : alert
        )
      )
      
      // Then update in database (errors are logged but don't affect UI)
      markAlertsSeen(unreadIds).catch((err) => {
        logger.error('[AlertsBell] Error marking alerts as seen', {
          error: err instanceof Error ? err.message : String(err),
          alertIds: unreadIds,
        })
      })
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative transition-all duration-200',
            isPulsing && 'animate-pulse'
          )}
        >
          <Bell
            className={cn(
              'h-5 w-5 transition-all duration-200',
              isPulsing && 'scale-110'
            )}
          />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                'absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs transition-all duration-200',
                isPulsing && 'scale-125 animate-pulse'
              )}
            >
              {displayCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Alerts</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Loading...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No alerts yet
          </div>
        ) : (
          <>
            <ScrollArea className="h-[300px]">
              <div className="space-y-1 p-1">
                {alerts.map((alert) => {
                  const isUnread = !alert.seen_at
                  const isHighlighted = highlightedAlertId === alert.id
                  return (
                    <DropdownMenuItem
                      key={alert.id}
                      className={cn(
                        'flex flex-col items-start gap-1 p-3 cursor-default transition-all duration-200',
                        isHighlighted && 'bg-primary/10 border-l-2 border-l-primary'
                      )}
                      onSelect={(e) => e.preventDefault()}
                    >
                      <div className="flex items-start gap-2 w-full">
                        <div
                          className={cn(
                            'mt-1.5 h-2 w-2 rounded-full shrink-0',
                            getSeverityColor(alert.severity)
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'text-sm',
                              isUnread ? 'font-semibold' : 'font-normal'
                            )}
                          >
                            {alert.title}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {alert.container_no && (
                              <span className="font-mono">
                                {alert.container_no}
                              </span>
                            )}
                            {alert.list_name && (
                              <>
                                {alert.container_no && <span>•</span>}
                                <span>{alert.list_name}</span>
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatTimeAgo(alert.created_at)}
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/alerts" className="w-full text-center">
                View all alerts
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

