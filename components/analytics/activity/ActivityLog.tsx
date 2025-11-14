'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'
import { ActivityFilters, type ActivityFilters as ActivityFiltersType } from './ActivityFilters'
import { ActivityTable } from './ActivityTable'
import { ActivityPagination } from './ActivityPagination'
import { ActivityActions } from './ActivityActions'
import { fetchHistory, type HistoryEvent } from '@/lib/data/history-actions'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { useRouter, useSearchParams } from 'next/navigation'

export function ActivityLog() {
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // containerId in the URL is used to pre-filter history when coming from the Containers page
  const containerIdFromUrl = searchParams.get('containerId')
  
  const [filters, setFilters] = useState<ActivityFiltersType>({
    search: '',
    type: 'all',
    range: 'all',
    user: 'all',
    container: containerIdFromUrl || 'all',
  })

  const pageSize = 10

  // Fetch history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchHistory()
        setHistory(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load activity log'))
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  // Extract unique users from history
  const availableUsers = useMemo(() => {
    const users = new Set<string>()
    history.forEach((event) => {
      if (event.user && event.user !== 'System') {
        users.add(event.user)
      }
    })
    return Array.from(users).sort()
  }, [history])

  // Extract unique containers from history
  const availableContainers = useMemo(() => {
    const containerMap = new Map<string, { id: string; label: string }>()
    history.forEach((event) => {
      if (event.container_id && !containerMap.has(event.container_id)) {
        const label = event.container_no || `${event.container_id.substring(0, 8)}…`
        containerMap.set(event.container_id, {
          id: event.container_id,
          label,
        })
      }
    })
    return Array.from(containerMap.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [history])

  // Apply filters
  const filteredHistory = useMemo(() => {
    let filtered = history

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (event) =>
          (event.summary || '').toLowerCase().includes(searchLower) ||
          (event.user || '').toLowerCase().includes(searchLower) ||
          (event.type || event.event_type || '').toLowerCase().includes(searchLower) ||
          JSON.stringify(event.details || {}).toLowerCase().includes(searchLower)
      )
    }

    // Event type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(
        (event) => event.type === filters.type || event.event_type === filters.type
      )
    }

    // Date range filter
    if (filters.range !== 'all') {
      const now = new Date()
      let startDate: Date | null = null

      switch (filters.range) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
      }

      if (startDate) {
        filtered = filtered.filter((event) => {
          const eventDate = new Date(event.created_at)
          return eventDate >= startDate!
        })
      }
    }

    // User filter
    if (filters.user !== 'all') {
      filtered = filtered.filter((event) => event.user === filters.user)
    }

    // Container filter
    if (filters.container !== 'all') {
      filtered = filtered.filter((event) => event.container_id === filters.container)
    }

    return filtered
  }, [history, filters])

  // Pagination
  const totalPages = Math.ceil(filteredHistory.length / pageSize)
  const paginatedEvents = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredHistory.slice(startIndex, startIndex + pageSize)
  }, [filteredHistory, page, pageSize])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])

  // Refresh history after clearing (handled by ActivityActions reloading the page)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState message="Loading activity log..." />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorAlert message={error.message} onRetry={() => router.refresh()} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow duration-300 space-y-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity Log
          </CardTitle>
          <ActivityActions history={history} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ActivityFilters
          filters={filters}
          onChange={setFilters}
          availableUsers={availableUsers}
          availableContainers={availableContainers}
        />
        <ActivityTable events={paginatedEvents} />
        <ActivityPagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  )
}

