// 🧩 Modularized for Enterprise-Grade Maintainability
// Components: AddContainerTrigger, EditContainerDialog, StatsCards, EmptyStates
// Location: app/dashboard/containers/components/
// Hooks: useContainerFilters, useContainerStats, useInfiniteScroll
// Location: app/dashboard/containers/hooks/

'use client'

import { logger } from '@/lib/utils/logger'
import { useContainers } from '@/lib/data/useContainers'
import { updateContainer, deleteContainer, type ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { useListsContext } from '@/components/providers/ListsProvider'
import { ListSwitcher } from '@/components/lists/ListSwitcher'
import { AppLayout } from '@/components/layout/AppLayout'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { LoadingState } from '@/components/ui/LoadingState'
import { toast } from 'sonner'
import { ContainerTable } from './components/ContainerTable'
import { FilterToolbar } from './components/FilterToolbar'
import { AddContainerTrigger } from './components/AddContainerTrigger'
import { EditContainerDialog } from './components/EditContainerDialog'
import { StatsCards } from './components/StatsCards'
import { EmptyStates } from './components/EmptyStates'
import { useContainerFilters } from './hooks/useContainerFilters'
import { useContainerStats } from './hooks/useContainerStats'
import { useInfiniteScroll } from './hooks/useInfiniteScroll'
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

export default function ContainersPage() {
  const { activeListId } = useListsContext()
  const { containers, loading, error, reload } = useContainers(activeListId)
  
  const [editingContainer, setEditingContainer] = useState<ContainerRecordWithComputed | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [timeAgo, setTimeAgo] = useState<string>('Just now')
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Filter logic via custom hook
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    ownerFilter,
    setOwnerFilter,
    viewMode,
    setViewMode,
    filteredContainers,
    uniqueOwners,
    handleClearFilters,
    hasActiveFilters,
  } = useContainerFilters(containers)
  
  // Stats calculation via custom hook
  const stats = useContainerStats(filteredContainers)
  
  // Infinite scroll via custom hook
  const { visibleItems: visibleContainers, hasMore } = useInfiniteScroll(filteredContainers, 50)
  
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


  // Handle manual refresh - memoized for stable reference
  const handleRefresh = useCallback(async () => {
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
  }, [reload])

  // Handle container deletion - memoized for stable reference
  const handleDeleteContainer = useCallback(async (container: ContainerRecordWithComputed) => {
    try {
      await deleteContainer(container.id)
      await reload()
      toast.success(`Container "${container.container_no || 'Unnamed Container'}" deleted successfully`)
    } catch (error) {
      logger.error('Error deleting container:', error)
      toast.error('Failed to delete container. Please try again.')
    }
  }, [reload])

  // Handle container status toggle - memoized for stable reference
  const handleToggleContainerStatus = useCallback(async (container: ContainerRecordWithComputed) => {
    try {
      await updateContainer(container.id, { is_closed: !container.is_closed })
      toast.success(`Container ${container.is_closed ? 'reopened' : 'closed'} successfully`)
    } catch (error) {
      logger.error('Error updating container status:', error)
      toast.error('Failed to update container status. Please try again.')
    }
  }, [])

  // Handle edit container - memoized for stable reference
  const handleEditContainer = useCallback((container: ContainerRecordWithComputed) => {
    setEditingContainer(container)
  }, [])

  // Handle close edit dialog - memoized for stable reference
  const handleCloseEditDialog = useCallback(() => {
    setEditingContainer(null)
  }, [])

  // Don't block rendering if loading flag lags - show data immediately if available
  if (!containers) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-foreground">Containers</h1>
            <AddContainerTrigger reload={reload} />
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
            <AddContainerTrigger reload={reload} />
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Containers</h1>
          <ListSwitcher />
        </div>
        
        <div className="flex justify-end items-center mb-4">
          <AddContainerTrigger reload={reload} />
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


        {/* Stats Bar */}
        <StatsCards stats={stats} />

        {/* Filter Toolbar */}
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
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          owners={uniqueOwners}
          hasActiveFilters={hasActiveFilters}
          filteredCount={filteredContainers.length}
          totalCount={containers.length}
          timeAgo={timeAgo}
          loading={loading}
        />

        {/* Content Area - Conditionally Renders Loading, Empty, or Table */}
        {loading || containers.length === 0 || filteredContainers.length === 0 ? (
          <EmptyStates
            loading={loading}
            hasContainers={containers.length > 0}
            hasFilteredContainers={filteredContainers.length > 0}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <motion.div
            className="bg-white rounded-lg shadow-sm border border-border overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            key={lastUpdated}
          >
            <ContainerTable
              containers={visibleContainers}
              viewMode={viewMode}
              onEdit={handleEditContainer}
              onDelete={handleDeleteContainer}
              onToggleStatus={handleToggleContainerStatus}
            />
            
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

        <EditContainerDialog
          container={editingContainer}
          isOpen={editingContainer !== null}
          onClose={handleCloseEditDialog}
        />
      </div>
    </AppLayout>
  )
}

