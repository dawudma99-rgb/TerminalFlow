'use client'

import { logger } from '@/lib/utils/logger'
import { useContainers } from '@/lib/data/useContainers'
import { updateContainer, deleteContainer, bulkDeleteContainers, type ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { useListsContext } from '@/components/providers/ListsProvider'
import { ListTabs } from '@/components/lists/ListTabs'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { Spinner } from '@/components/ui/spinner'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { ContainerUpdate } from '@/lib/data/containers-actions'
import { toast } from 'sonner'
import { useDebounce } from 'use-debounce'
import { downloadFromUrl } from '@/lib/utils/download'
import { ContainerTable } from './components/ContainerTable'
import { AddContainerTrigger } from './components/AddContainerTrigger'
import { FilterToolbar } from './components/FilterToolbar'
import { StatsSummary } from './components/StatsCards'
import { EmptyStates } from './components/EmptyStates'
import { BulkActionsBar } from './components/BulkActionsBar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CONTAINER_MILESTONES,
  DEFAULT_MILESTONE,
  normalizeMilestone,
  isValidMilestone,
  type ContainerMilestone,
} from '@/lib/utils/milestones'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info, Upload, Download } from 'lucide-react'
import { ImportDialog } from '@/components/import/ImportDialog'

type EditContainerFormData = {
  container_no: string
  bl_number: string
  pol: string
  pod: string
  arrival_date: string
  free_days: string
  carrier: string | null
  container_size: string | null
  milestone: ContainerMilestone
  notes: string
}

function EditContainerDialog({
  container,
  isOpen,
  onClose,
  reload,
}: {
  container: ContainerRecordWithComputed | null
  isOpen: boolean
  onClose: () => void
  reload: () => Promise<void>
}) {
  const [formData, setFormData] = useState<EditContainerFormData>({
    container_no: container?.container_no ?? '',
    bl_number: container?.bl_number ?? '',
    pol: container?.pol ?? '',
    pod: container?.pod ?? '',
    arrival_date: container?.arrival_date ? container.arrival_date.split('T')[0] : '',
    free_days: container?.free_days?.toString() ?? '7',
    carrier: container?.carrier ?? null,
    container_size: container?.container_size ?? null,
    milestone: container ? normalizeMilestone(container.milestone) ?? DEFAULT_MILESTONE : DEFAULT_MILESTONE,
    notes: container?.notes ?? '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (container) {
      setFormData({
        container_no: container.container_no ?? '',
        bl_number: container.bl_number ?? '',
        pol: container.pol ?? '',
        pod: container.pod ?? '',
        arrival_date: container.arrival_date ? container.arrival_date.split('T')[0] : '',
        free_days: container.free_days?.toString() ?? '7',
        carrier: container.carrier ?? null,
        container_size: container.container_size ?? null,
        milestone: normalizeMilestone(container.milestone) ?? DEFAULT_MILESTONE,
        notes: container.notes ?? '',
      })
    }
  }, [container])

  if (!container) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const normalizeOptionalString = (value: string): string | null => {
        const trimmed = value.trim()
        return trimmed === '' ? null : trimmed
      }

      const updatedData: ContainerUpdate & {
        bl_number?: string | null
        milestone?: ContainerMilestone
        pol?: string | null
        pod?: string | null
      } = {
        container_no: formData.container_no.trim(),
        pol: normalizeOptionalString(formData.pol),
        pod: normalizeOptionalString(formData.pod),
        arrival_date: formData.arrival_date,
        free_days: parseInt(formData.free_days, 10) || 7,
        carrier: formData.carrier?.trim() ? formData.carrier.trim() : null,
        container_size: formData.container_size || null,
        notes: formData.notes.trim() ? formData.notes.trim() : null,
        bl_number: formData.bl_number.trim() ? formData.bl_number.trim() : null,
        milestone: formData.milestone,
      }

      await updateContainer(container.id, updatedData)
      toast.success('Container updated successfully')
      onClose()
      await reload()
    } catch (error) {
      logger.error('Error updating container:', error)
      toast.error('Failed to update container. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Container</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-container_no" className="text-sm font-medium">
                Container Number *
              </label>
              <Input
                id="edit-container_no"
                name="container_no"
                value={formData.container_no}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, container_no: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-bl_number" className="text-sm font-medium">
                B/L Number
              </label>
              <Input
                id="edit-bl_number"
                name="bl_number"
                value={formData.bl_number}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, bl_number: event.target.value }))
                }
                placeholder="Enter B/L number"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="edit-pol" className="text-sm font-medium">
                  POL
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Port of Loading – where the container is shipped from.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="edit-pol"
                name="pol"
                value={formData.pol}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, pol: event.target.value }))
                }
                placeholder="Enter POL"
                aria-label="Port of Loading"
                title="Port of Loading – where the container is shipped from."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <label htmlFor="edit-pod" className="text-sm font-medium">
                  POD
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Port of Discharge – where the container arrives.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="edit-pod"
                name="pod"
                value={formData.pod}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, pod: event.target.value }))
                }
                placeholder="Enter POD"
                aria-label="Port of Discharge"
                title="Port of Discharge – where the container arrives."
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-arrival_date" className="text-sm font-medium">
                Arrival Date *
              </label>
              <Input
                id="edit-arrival_date"
                name="arrival_date"
                type="date"
                value={formData.arrival_date}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, arrival_date: event.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-free_days" className="text-sm font-medium">
                Free Days
              </label>
              <Input
                id="edit-free_days"
                name="free_days"
                type="number"
                value={formData.free_days}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, free_days: event.target.value }))
                }
                min="1"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-carrier" className="text-sm font-medium">
                Carrier
              </label>
              <Input
                id="edit-carrier"
                name="carrier"
                value={formData.carrier ?? ''}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    carrier: event.target.value.trim() === '' ? null : event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-container_size" className="text-sm font-medium">
                Container Size
              </label>
              <select
                id="edit-container_size"
                name="container_size"
                value={formData.container_size ?? ''}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    container_size: event.target.value === '' ? null : event.target.value,
                  }))
                }
                className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground"
              >
                <option value="">Select size</option>
                <option value="20ft">20ft</option>
                <option value="40ft">40ft</option>
                <option value="45ft">45ft</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-milestone" className="text-sm font-medium">
                Milestone
              </label>
              <Select
                value={formData.milestone}
                onValueChange={(value) => {
                  setFormData((prev) => ({
                    ...prev,
                    milestone: isValidMilestone(value) ? value : DEFAULT_MILESTONE,
                  }))
                }}
              >
                <SelectTrigger id="edit-milestone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTAINER_MILESTONES.map((milestone) => (
                    <SelectItem key={milestone} value={milestone}>
                      {milestone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="edit-notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, notes: event.target.value }))
              }
              className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ContainersPage() {
  const { activeListId } = useListsContext()
  const {
    containers,
    loading,
    isInitialLoading,
    isRefreshing,
    isSwitchingList,
    error,
    reload,
  } = useContainers(activeListId)
  
  const [editingContainer, setEditingContainer] = useState<ContainerRecordWithComputed | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [timeAgo, setTimeAgo] = useState<string>('Just now')
  const [exporting, setExporting] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'demurrage' | 'detention' | 'both'>('demurrage')
  
  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(50)
  const previousFiltersRef = useRef({ searchQuery, statusFilter, ownerFilter, viewMode })
  const previousActiveListIdRef = useRef<string | null>(activeListId)
  
  // Bulk selection state
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Calculate time ago string
  const calculateTimeAgo = (timestamp: number): string => {
    const now = Date.now()
    const diffMs = now - timestamp
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    
    if (diffSeconds < 60) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Update time ago every 60 seconds
  useEffect(() => {
    const updateTimeAgo = () => {
      setTimeAgo(calculateTimeAgo(lastUpdated))
    }
    
    updateTimeAgo() // Initial update
    const interval = setInterval(updateTimeAgo, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [lastUpdated])

  // Update lastUpdated when containers change
  useEffect(() => {
    if (containers && containers.length > 0 && !loading) {
      setLastUpdated(Date.now())
      setTimeAgo('Just now')
    }
  }, [containers, loading])

  // Reset visibleCount to 50 when activeListId changes (list switch)
  useEffect(() => {
    if (previousActiveListIdRef.current !== null && activeListId !== previousActiveListIdRef.current) {
      // List changed - reset visibleCount to 50 and clear selection
      setVisibleCount(50)
      setSelectedIds([])
      setBulkMode(false)
    }
    previousActiveListIdRef.current = activeListId
  }, [activeListId])

  // Clear selection and exit bulk mode when filters change
  useEffect(() => {
    setSelectedIds([])
    setBulkMode(false)
  }, [searchQuery, statusFilter, ownerFilter, viewMode])

  // Force immediate render when containers become available (only when not loading)
  useEffect(() => {
    if (!loading && containers?.length && visibleCount === 0) {
      setVisibleCount(Math.min(50, containers.length))
    }
  }, [containers, visibleCount, loading])


  const handleDeleteContainer = async (container: ContainerRecordWithComputed) => {
    try {
      await deleteContainer(container.id)
      await reload()
      toast.success(`Container "${container.container_no || 'Unnamed Container'}" deleted successfully`)
    } catch (error) {
      logger.error('Error deleting container:', error)
      toast.error('Failed to delete container. Please try again.')
    }
  }

  const handleEditContainer = useCallback((container: ContainerRecordWithComputed) => {
    setEditingContainer(container)
  }, [])

  const handleToggleContainerStatus = async (container: ContainerRecordWithComputed) => {
    try {
      await updateContainer(container.id, { is_closed: !container.is_closed })
      toast.success(`Container ${container.is_closed ? 'reopened' : 'closed'} successfully`)
    } catch (error) {
      logger.error('Error updating container status:', error)
      toast.error('Failed to update container status. Please try again.')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    setIsDeleting(true)
    try {
      const { deleted } = await bulkDeleteContainers(selectedIds)
      toast.success(`Deleted ${deleted} ${deleted === 1 ? 'container' : 'containers'}`)
      setSelectedIds([])
      setBulkMode(false) // Exit bulk mode on success
      await reload()
    } catch (error) {
      logger.error('Error bulk deleting containers:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete containers'
      toast.error(errorMessage)
      // Keep selection on error so user can retry
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExitBulkMode = () => {
    setBulkMode(false)
    setSelectedIds([])
  }

  // Get unique owners from containers
  const uniqueOwners = useMemo(() => {
    const owners = containers
      .map(c => c.assigned_to)
      .filter((owner): owner is string => Boolean(owner))
    return Array.from(new Set(owners)).sort()
  }, [containers])

  // Apply filters
  const filteredContainers = useMemo(() => {
    const filtered = containers.filter((container) => {
      // View mode filter
      if (viewMode === 'demurrage') {
        // Demurrage: only containers with arrival_date and free_days defined
        if (!container.arrival_date || container.free_days == null) {
          return false
        }
      } else if (viewMode === 'detention') {
        // Detention: only containers where has_detention is true
        if (!container.has_detention) {
          return false
        }
      }
      // 'both' shows all containers, no filtering needed

      // Search filter (case-insensitive)
      if (debouncedSearchQuery.trim()) {
        const query = debouncedSearchQuery.toLowerCase()
        const matchesSearch =
          container.container_no?.toLowerCase().includes(query) ||
          container.pol?.toLowerCase().includes(query) ||
          container.pod?.toLowerCase().includes(query) ||
          container.assigned_to?.toLowerCase().includes(query) ||
          container.carrier?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'open') {
          // Open means not closed
          if (container.is_closed) return false
        } else {
          // Match exact status
          if (container.status !== statusFilter) return false
        }
      }

      // Owner filter
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'unassigned') {
          if (container.assigned_to) return false
        } else {
          if (container.assigned_to !== ownerFilter) return false
        }
      }

      return true
    })
    return filtered
  }, [containers, viewMode, debouncedSearchQuery, statusFilter, ownerFilter])

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setOwnerFilter('all')
  }

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || ownerFilter !== 'all'

  // Map statusFilter to export status format (capitalize first letter, handle 'open' -> 'Open')
  const statusForExport = useMemo(() => {
    if (statusFilter === 'all') return 'All'
    if (statusFilter === 'open') return 'Open'
    // Capitalize first letter for others (Safe, Warning, Overdue, Closed)
    return statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
  }, [statusFilter])

  async function handleExport() {
    try {
      setExporting(true)
      const t = toast.loading('Preparing export…')
      const url = `/dashboard/containers/export?status=${encodeURIComponent(statusForExport)}`
      const filename = await downloadFromUrl(url)
      toast.success(`Exported ${filename}`, { id: t })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed'
      toast.error(errorMessage)
    } finally {
      setExporting(false)
    }
  }

  // Compute stats from filtered containers (single-pass optimization)
  const stats = useMemo((): {
    total: number
    open: number
    closed: number
    overdue: number
    safe: number
    warning: number
  } => {
    let open = 0
    let closed = 0
    let overdue = 0
    let safe = 0
    let warning = 0

    for (const c of filteredContainers) {
      if (c.is_closed) closed++
      else open++

      if (c.status === 'Overdue') overdue++
      else if (c.status === 'Safe') safe++
      else if (c.status === 'Warning') warning++
    }

    return {
      total: filteredContainers.length,
      open,
      closed,
      overdue,
      safe,
      warning,
    }
  }, [filteredContainers])
  
  // Slice filtered containers for pagination
  const visibleContainers = useMemo(() => {
    const effectiveVisibleCount = filteredContainers.length > 0 && visibleCount === 0 
      ? Math.min(50, filteredContainers.length)
      : visibleCount
    const sliced = filteredContainers.slice(0, effectiveVisibleCount)
    return sliced
  }, [filteredContainers, visibleCount])

  // Check if more containers are available
  const hasMore = visibleCount < visibleContainers.length

  // Set up window scroll listener for infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200) {
        setVisibleCount(prev => Math.min(prev + 50, filteredContainers.length))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [filteredContainers.length])

  // Reset visible count when filters change
  useEffect(() => {
    const currentFilters = { searchQuery, statusFilter, ownerFilter, viewMode }
    const previousFilters = previousFiltersRef.current
    
    // Check if any filter has changed
    const filtersChanged = 
      currentFilters.searchQuery !== previousFilters.searchQuery ||
      currentFilters.statusFilter !== previousFilters.statusFilter ||
      currentFilters.ownerFilter !== previousFilters.ownerFilter ||
      currentFilters.viewMode !== previousFilters.viewMode
    
    if (filtersChanged) {
      previousFiltersRef.current = currentFilters
      // Use setTimeout to defer the state update outside of the effect
      setTimeout(() => {
        setVisibleCount(50)
      }, 0)
    }
  }, [searchQuery, statusFilter, ownerFilter, viewMode])

  // Removed: Effect that shrinks visibleCount to match filteredContainers.length
  // This was causing the "1 container until scroll" bug during list switches.
  // The slice operation naturally handles cases where filteredContainers.length < visibleCount.

  // Only show full-page loading on initial load with no data
  if (isInitialLoading && containers.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Containers</h1>
          <AddContainerTrigger reload={reload} />
        </div>
        <LoadingState message="Loading containers..." />
      </div>
    )
  }

  // Show error only if we have no data to display
  if (error && containers.length === 0) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Containers</h1>
          <AddContainerTrigger reload={reload} />
        </div>
        <ErrorAlert 
          message={error.message || "Failed to load containers"}
          onRetry={reload}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <header className="flex flex-col gap-1 pt-2">
          <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Operations</span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-[#1F2937]">
                Container Control Room
              </h1>
              {isRefreshing && (
                <span className="text-xs text-muted-foreground">
                  Refreshing…
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <AddContainerTrigger reload={reload} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportDialogOpen(true)}
                className="h-8 gap-1.5 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6]"
                aria-label="Import containers"
                title="Import containers from CSV/Excel"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="h-8 gap-1.5 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6] disabled:opacity-50"
                aria-label="Export containers to CSV"
                title="Export containers to CSV"
              >
                <Download className="h-3.5 w-3.5" />
                {exporting ? 'Exporting…' : 'Export'}
              </Button>
            </div>
          </div>
        </header>

        <section className="flex flex-col gap-2">
          <ListTabs />

          <FilterToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            ownerFilter={ownerFilter}
            onOwnerChange={setOwnerFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClearFilters={handleClearFilters}
            owners={uniqueOwners}
            hasActiveFilters={hasActiveFilters}
          />

          <div className="flex items-center justify-between gap-2">
            <StatsSummary
              total={stats.total}
              overdue={stats.overdue}
              warning={stats.warning}
              safe={stats.safe}
              closed={stats.closed}
              updatedLabel={`Synced ${timeAgo}`}
            />
            <Button
              variant={bulkMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (bulkMode) {
                  handleExitBulkMode()
                } else {
                  setBulkMode(true)
                }
              }}
              className={bulkMode 
                ? "h-8 gap-1.5 rounded border border-[#2563EB] bg-[#2563EB] text-xs text-white hover:bg-[#2563EB]/90"
                : "h-8 gap-1.5 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6]"
              }
              aria-label={bulkMode ? "Exit bulk actions mode" : "Enter bulk actions mode"}
            >
              {bulkMode ? (
                <>
                  <span className="h-3.5 w-3.5">✓</span>
                  Bulk actions
                </>
              ) : (
                'Bulk actions'
              )}
            </Button>
          </div>
        </section>

        {error && containers.length > 0 && (
          <ErrorAlert
            message={error.message || 'Failed to refresh containers. Showing cached data.'}
            onRetry={reload}
          />
        )}

        <div className="flex-1">
          {/* Board wrapper with consistent min-height for all states */}
          <div className="flex min-h-[520px] flex-col rounded-md border border-[#D4D7DE] bg-white shadow-sm">
            {bulkMode && selectedIds.length > 0 && (
              <BulkActionsBar
                selectedCount={selectedIds.length}
                onDelete={handleBulkDelete}
                onExit={handleExitBulkMode}
                isDeleting={isDeleting}
              />
            )}
            {isSwitchingList ? (
              // Show clean loading UI when switching lists - hide old containers completely
              <div className="flex flex-1 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-6 w-6 text-slate-400" />
                  <p className="text-sm text-slate-500">Loading containers…</p>
                </div>
              </div>
            ) : containers.length === 0 || filteredContainers.length === 0 ? (
              <EmptyStates
                loading={loading}
                hasContainers={containers.length > 0}
                hasFilteredContainers={filteredContainers.length > 0}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            ) : (
              <motion.div
                className="flex flex-1 flex-col overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                key={lastUpdated}
              >
                <div className="flex-1 overflow-auto">
                  <ContainerTable
                    containers={visibleContainers}
                    viewMode={viewMode}
                    onEdit={handleEditContainer}
                    onDelete={handleDeleteContainer}
                    onToggleStatus={handleToggleContainerStatus}
                    reload={reload}
                    bulkMode={bulkMode}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                  />
                </div>
                <div className="border-t border-[#D4D7DE] bg-[#F4F6FA] px-4 py-2 text-xs text-slate-500">
                  {hasMore
                    ? `Showing ${visibleContainers.length} of ${filteredContainers.length} containers`
                    : `All ${filteredContainers.length} containers loaded`}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <EditContainerDialog
          container={editingContainer}
          isOpen={!!editingContainer}
          onClose={() => setEditingContainer(null)}
          reload={reload}
        />

        <ImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onSuccess={reload}
        />
    </div>
  )
}

