'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import type { AlertRow } from '@/lib/data/alerts-actions'

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

interface UseRealtimeAlertsReturn {
  latestAlert: AlertRow | null
  resetLatest: () => void
  connectionStatus: ConnectionStatus
}

const RECONNECT_DELAY = 3000 // 3 seconds
const MAX_RECONNECT_ATTEMPTS = 5

export function useRealtimeAlerts(): UseRealtimeAlertsReturn {
  const [latestAlert, setLatestAlert] = useState<AlertRow | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  const resetLatest = useCallback(() => {
    setLatestAlert(null)
  }, [])

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const subscribe = useCallback(() => {
    if (!isMountedRef.current) return

    try {
      setConnectionStatus('connecting')
      logger.debug('[useRealtimeAlerts] Attempting to subscribe to alerts')

      // Clean up any existing subscription
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }

      // Create new channel subscription
      const channel = supabase
        .channel('alerts-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'alerts',
          },
          (payload) => {
            if (!isMountedRef.current) return

            try {
              logger.debug('[useRealtimeAlerts] New alert received', {
                alertId: payload.new.id,
                eventType: (payload.new as any).event_type,
              })

              // Transform the payload to match AlertRow type
              // Note: We need to fetch container_no and list_name separately
              // For now, we'll set them as null and let the component handle it
              const newAlert: AlertRow = {
                ...(payload.new as AlertRow),
                container_no: null, // Will be populated by the component if needed
                list_name: null, // Will be populated by the component if needed
              }

              setLatestAlert(newAlert)
              setConnectionStatus('connected')
              reconnectAttemptsRef.current = 0 // Reset on successful message
            } catch (error) {
              logger.error('[useRealtimeAlerts] Error processing alert', {
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
        )
        .subscribe((status) => {
          if (!isMountedRef.current) return

          logger.debug('[useRealtimeAlerts] Subscription status changed', { status })

          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0
          } else if (status === 'CLOSED') {
            // CLOSED is normal during cleanup/unmount, don't warn
            setConnectionStatus('disconnected')
            logger.debug('[useRealtimeAlerts] Channel closed (normal during cleanup)')
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('disconnected')
            // Attempt to reconnect if we haven't exceeded max attempts
            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttemptsRef.current += 1
              // Use debug for early attempts, warn only when max attempts reached
              if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
                logger.warn('[useRealtimeAlerts] Connection lost, max reconnection attempts reached', {
                  attempt: reconnectAttemptsRef.current,
                  maxAttempts: MAX_RECONNECT_ATTEMPTS,
                  status,
                })
              } else {
                logger.debug('[useRealtimeAlerts] Connection lost, attempting reconnect', {
                  attempt: reconnectAttemptsRef.current,
                  maxAttempts: MAX_RECONNECT_ATTEMPTS,
                  status,
                })
              }
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  subscribe()
                }
              }, RECONNECT_DELAY)
            } else {
              logger.error('[useRealtimeAlerts] Max reconnection attempts reached', {
                attempts: reconnectAttemptsRef.current,
                status,
              })
            }
          } else if (status === 'JOINING') {
            setConnectionStatus('connecting')
          }
        })

      channelRef.current = channel
    } catch (error) {
      logger.error('[useRealtimeAlerts] Error setting up subscription', {
        error: error instanceof Error ? error.message : String(error),
      })
      setConnectionStatus('disconnected')

      // Attempt to reconnect after delay
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            subscribe()
          }
        }, RECONNECT_DELAY)
      }
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    subscribe()

    return () => {
      isMountedRef.current = false
      cleanup()
      setConnectionStatus('disconnected')
    }
  }, [subscribe, cleanup])

  return {
    latestAlert,
    resetLatest,
    connectionStatus,
  }
}

