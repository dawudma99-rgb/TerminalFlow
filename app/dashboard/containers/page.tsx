'use client'

import { logger } from '@/lib/utils/logger'
import { useContainers } from '@/lib/data/useContainers'
import { insertContainer, updateContainer, deleteContainer, type ContainerInsert, type ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { AddContainerForm } from '@/components/forms/AddContainerForm'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import clsx from 'clsx'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, Edit, Trash2, Lock, Unlock, Container, Search, X, RefreshCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Tier } from '@/lib/tierUtils'
import type { ContainerUpdate } from '@/lib/data/containers-actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function AddContainerTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = async (data: {
    container_no: string
    port: string
    arrival_date: string
    free_days: number
    carrier: string
    container_size: string
    demurrage_enabled: boolean
    demurrage_flat_rate: number
    demurrage_tiers: Tier[]
    detention_enabled: boolean
    detention_flat_rate: number
    detention_tiers: Tier[]
    notes: string
  }) => {
    try {
      const containerData = {
        container_no: data.container_no,
        port: data.port,
        arrival_date: data.arrival_date,
        free_days: data.free_days,
        carrier: data.carrier || null,
        container_size: data.container_size || null,
        notes: data.notes || null,
      }

      await insertContainer(containerData as ContainerInsert)
      toast.success('Container added successfully!')
      logger.log('Container added successfully!')
    } catch (error) {
      logger.error('Error adding container:', error)
      toast.error('Failed to add container. Please try again.')
    }
  }

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Container
      </Button>
      
      <AddContainerForm 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateString
  }
}

function StatusBadge({ status }: { status?: string | null }) {
  const badgeClass = clsx(
    status === 'Safe' && 'bg-success text-success-foreground',
    status === 'Warning' && 'bg-warning text-warning-foreground',
    status === 'Overdue' && 'bg-destructive text-destructive-foreground',
    status === 'Closed' && 'bg-muted text-muted-foreground',
    !status && 'bg-muted text-muted-foreground'
  )

  return (
    <Badge className={badgeClass}>
      {status || 'N/A'}
    </Badge>
  )
}

function EditContainerDialog({
  container,
  isOpen,
  onClose,
}: {
  container: ContainerRecordWithComputed | null
  isOpen: boolean
  onClose: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!container) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const updatedData: ContainerUpdate = {
        container_no: formData.get('container_no') as string,
        port: formData.get('port') as string,
        arrival_date: formData.get('arrival_date') as string,
        free_days: parseInt(formData.get('free_days') as string) || 7,
        carrier: (formData.get('carrier') as string) || null,
        container_size: (formData.get('container_size') as string) || null,
        notes: (formData.get('notes') as string) || null,
      }

      await updateContainer(container.id, updatedData)
      toast.success('Container updated successfully')
      onClose()
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
                defaultValue={container.container_no || ''}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-port" className="text-sm font-medium">
                Port *
              </label>
              <Input
                id="edit-port"
                name="port"
                defaultValue={container.port || ''}
                required
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
                defaultValue={container.arrival_date ? container.arrival_date.split('T')[0] : ''}
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
                defaultValue={container.free_days || 7}
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
                defaultValue={container.carrier || ''}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-container_size" className="text-sm font-medium">
                Container Size
              </label>
              <select
                id="edit-container_size"
                name="container_size"
                defaultValue={container.container_size || ''}
                className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground"
              >
                <option value="">Select size</option>
                <option value="20ft">20ft</option>
                <option value="40ft">40ft</option>
                <option value="45ft">45ft</option>
              </select>
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
              defaultValue={container.notes || ''}
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
  useEffect(() => {
    logger.log("COMPONENT: containers/page.tsx loaded")
  }, [])
  
  const { containers, loading, error, reload } = useContainers()
  
  const [editingContainer, setEditingContainer] = useState<ContainerRecordWithComputed | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [timeAgo, setTimeAgo] = useState<string>('Just now')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'demurrage' | 'detention' | 'both'>('both')
  
  // Infinite scroll state
  const [visibleCount, setVisibleCount] = useState(50)
  const previousFiltersRef = useRef({ searchQuery, statusFilter, ownerFilter, viewMode })
  
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

  // Force immediate render when containers become available
  useEffect(() => {
    if (containers?.length && visibleCount === 0) {
      setVisibleCount(Math.min(50, containers.length))
    }
  }, [containers, visibleCount])

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await reload()
      setLastUpdated(Date.now())
      setTimeAgo('Just now')
      toast.success('Containers refreshed successfully')
    } catch (err) {
      logger.error('Error refreshing containers:', err)
      toast.error('Failed to refresh containers. Please try again.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeleteContainer = async (containerId: string, containerNo: string) => {
    try {
      await deleteContainer(containerId)
      toast.success(`Container "${containerNo}" deleted successfully`)
    } catch (error) {
      logger.error('Error deleting container:', error)
      toast.error('Failed to delete container. Please try again.')
    }
  }

  const handleToggleContainerStatus = async (containerId: string, isCurrentlyClosed: boolean) => {
    try {
      await updateContainer(containerId, { is_closed: !isCurrentlyClosed })
      toast.success(`Container ${isCurrentlyClosed ? 'reopened' : 'closed'} successfully`)
    } catch (error) {
      logger.error('Error updating container status:', error)
      toast.error('Failed to update container status. Please try again.')
    }
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
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          container.container_no?.toLowerCase().includes(query) ||
          container.port?.toLowerCase().includes(query) ||
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
  }, [containers, viewMode, searchQuery, statusFilter, ownerFilter])

  const handleClearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setOwnerFilter('all')
  }

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || ownerFilter !== 'all'

  // Compute stats from filtered containers
  const stats = useMemo(() => {
    return {
      total: filteredContainers.length,
      open: filteredContainers.filter(c => !c.is_closed).length,
      closed: filteredContainers.filter(c => c.is_closed).length,
      overdue: filteredContainers.filter(c => c.status === 'Overdue').length,
      safe: filteredContainers.filter(c => c.status === 'Safe').length,
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

  // Update visible count if filtered list is smaller than visible count
  useEffect(() => {
    if (filteredContainers.length < visibleCount) {
      // Use setTimeout to defer the state update outside of the effect
      setTimeout(() => {
        setVisibleCount(filteredContainers.length)
      }, 0)
    }
  }, [filteredContainers.length, visibleCount])

  // Don't block rendering if loading flag lags - show data immediately if available
  if (!containers) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">Containers</h1>
            <AddContainerTrigger />
          </div>
          <LoadingState message="Loading containers..." />
        </div>
      </AppLayout>
    )
  }

  // Show error only if we have no data to display
  if (error && containers.length === 0) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">Containers</h1>
            <AddContainerTrigger />
          </div>
          <ErrorAlert 
            message={error.message || "Failed to load containers"}
            onRetry={reload}
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-foreground">Containers</h1>
          <AddContainerTrigger />
        </div>
        
        {/* Show error banner if error occurred but we have cached data */}
        {error && containers.length > 0 && (
          <div className="mb-4">
            <ErrorAlert 
              message={error.message || "Failed to refresh containers. Showing cached data."}
              onRetry={reload}
            />
          </div>
        )}

        {containers.length === 0 && !loading ? (
          <EmptyState
            title="No containers found"
            description="Get started by adding your first container to track its status and manage operations."
            icon={<Container className="h-12 w-12 text-muted-foreground" />}
            action={<AddContainerTrigger />}
          />
        ) : (
          <>
            {/* Last Updated & Refresh Controls - Above Stats Cards */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Last updated: {timeAgo}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isRefreshing || loading}
                  className="h-8 w-8 p-0"
                  aria-label="Refresh containers"
                >
                  <RefreshCcw 
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                  />
                </Button>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-foreground">View Mode:</span>
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(value) => {
                    if (value === 'demurrage' || value === 'detention' || value === 'both') {
                      setViewMode(value)
                    }
                  }}
                  className="border border-border rounded-md p-1"
                >
                  <ToggleGroupItem value="demurrage" aria-label="Demurrage">
                    Demurrage
                  </ToggleGroupItem>
                  <ToggleGroupItem value="detention" aria-label="Detention">
                    Detention
                  </ToggleGroupItem>
                  <ToggleGroupItem value="both" aria-label="Both">
                    Both
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              {/* Total */}
              <Card className="border-border bg-card">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Total</div>
                  <div className="text-2xl font-bold text-foreground">{stats.total}</div>
                </CardContent>
              </Card>

              {/* Open */}
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-blue-700 mb-1">Open</div>
                  <div className="text-2xl font-bold text-blue-900">{stats.open}</div>
                </CardContent>
              </Card>

              {/* Closed */}
              <Card className="border-slate-200 bg-slate-50/30">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-slate-700 mb-1">Closed</div>
                  <div className="text-2xl font-bold text-slate-900">{stats.closed}</div>
                </CardContent>
              </Card>

              {/* Overdue */}
              <Card className="border-red-200 bg-red-50/30">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-red-700 mb-1">Overdue</div>
                  <div className="text-2xl font-bold text-red-900">{stats.overdue}</div>
                </CardContent>
              </Card>

              {/* Safe */}
              <Card className="border-green-200 bg-green-50/30">
                <CardContent className="p-4">
                  <div className="text-sm font-medium text-green-700 mb-1">Safe</div>
                  <div className="text-2xl font-bold text-green-900">{stats.safe}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-lg shadow-sm border border-border p-4 mb-4">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Search Input */}
                <div className="flex-1 w-full sm:w-auto min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search containers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="w-full sm:w-[160px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                      <SelectItem value="Safe">Safe</SelectItem>
                      <SelectItem value="Warning">Warning</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Owner Filter */}
                <div className="w-full sm:w-[180px]">
                  <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {uniqueOwners.map((owner) => (
                        <SelectItem key={owner} value={owner}>
                          {owner}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                )}
              </div>

              {/* Filter Results Count */}
              {hasActiveFilters && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Showing {filteredContainers.length} of {containers.length} containers
                </div>
              )}
            </div>

            {/* Table */}
            {filteredContainers.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-border p-12 text-center">
                <Container className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No containers match your filters
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your search or filter criteria.
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={handleClearFilters}>
                    Clear All Filters
                  </Button>
                )}
              </div>
            ) : (
              <motion.div
                className="bg-white rounded-lg shadow-sm border border-border overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                key={lastUpdated}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Container No</TableHead>
                      <TableHead>Port</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Carrier</TableHead>
                      {/* Demurrage columns - hide in detention view */}
                      {viewMode !== 'detention' && (
                        <>
                          <TableHead>Arrival Date</TableHead>
                          <TableHead className="text-center">Free Days</TableHead>
                          <TableHead className="text-center">Days Left</TableHead>
                          <TableHead className="text-center">Demurrage Fee</TableHead>
                        </>
                      )}
                      {/* Detention columns - hide in demurrage view */}
                      {viewMode !== 'demurrage' && (
                        <>
                          <TableHead>Gate Out Date</TableHead>
                          <TableHead className="text-center">Detention Free Days</TableHead>
                          <TableHead className="text-center">Detention Fee Rate</TableHead>
                        </>
                      )}
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleContainers.map((container) => (
                      <TableRow key={container.id}>
                        <TableCell className="font-mono font-medium">
                          {container.container_no || '—'}
                        </TableCell>
                        <TableCell>{container.port || '—'}</TableCell>
                        <TableCell>
                          {container.assigned_to || (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>{container.carrier || '—'}</TableCell>
                        {/* Demurrage columns - hide in detention view */}
                        {viewMode !== 'detention' && (
                          <>
                            <TableCell>{formatDate(container.arrival_date)}</TableCell>
                            <TableCell className="text-center">
                              {container.free_days ?? '—'}
                            </TableCell>
                            <TableCell
                              className={clsx(
                                'text-center font-medium',
                                container.days_left != null && container.days_left < 0
                                  ? 'text-destructive'
                                  : container.days_left != null && container.days_left <= 2
                                  ? 'text-warning'
                                  : 'text-foreground'
                              )}
                            >
                              {container.days_left ?? '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {container.demurrage_fee_if_late != null 
                                ? `£${container.demurrage_fee_if_late.toFixed(2)}` 
                                : '—'}
                            </TableCell>
                          </>
                        )}
                        {/* Detention columns - hide in demurrage view */}
                        {viewMode !== 'demurrage' && (
                          <>
                            <TableCell>{formatDate(container.gate_out_date)}</TableCell>
                            <TableCell className="text-center">
                              {container.detention_free_days ?? '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              {container.detention_fee_rate != null 
                                ? `£${container.detention_fee_rate.toFixed(2)}` 
                                : '—'}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center">
                          <StatusBadge status={container.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingContainer(container)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Container</p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggleContainerStatus(container.id, container.is_closed)}
                                    className={clsx(
                                      "h-8 w-8 p-0",
                                      container.is_closed
                                        ? "text-success hover:text-success hover:bg-success/10"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    {container.is_closed ? (
                                      <Unlock className="h-4 w-4" />
                                    ) : (
                                      <Lock className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{container.is_closed ? 'Reopen Container' : 'Close Container'}</p>
                                </TooltipContent>
                              </Tooltip>

                              <ConfirmDialog
                                title="Delete Container"
                                description={`Are you sure you want to delete container "${container.container_no || 'Unnamed Container'}"? This action cannot be undone.`}
                                onConfirm={() => handleDeleteContainer(
                                  container.id,
                                  container.container_no || 'Unnamed Container'
                                )}
                                confirmText="Delete"
                                cancelText="Cancel"
                                variant="destructive"
                                trigger={
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Delete Container</p>
                                    </TooltipContent>
                                  </Tooltip>
                                }
                              />
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Loading indicator */}
                {hasMore && (
                  <div className="flex items-center justify-center py-6 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      Showing {visibleContainers.length} of {filteredContainers.length} containers
                    </div>
                  </div>
                )}
                
                {/* End of list indicator */}
                {!hasMore && filteredContainers.length > 0 && (
                  <div className="flex items-center justify-center py-4 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      All {filteredContainers.length} containers loaded
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}

        <EditContainerDialog
          container={editingContainer}
          isOpen={editingContainer !== null}
          onClose={() => setEditingContainer(null)}
        />
      </div>
    </AppLayout>
  )
}

