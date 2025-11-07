'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { Container } from 'lucide-react'

interface EmptyStatesProps {
  loading: boolean
  hasContainers: boolean
  hasFilteredContainers: boolean
  hasActiveFilters: boolean
  onClearFilters: () => void
}

// ✅ Memoized: Prevents re-renders when unrelated props or parent state change
export const EmptyStates = memo(function EmptyStates({
  loading,
  hasContainers,
  hasFilteredContainers,
  hasActiveFilters,
  onClearFilters,
}: EmptyStatesProps) {
  if (loading) {
    return <LoadingState message="Loading containers..." />
  }

  if (!hasContainers) {
    return (
      <div className="w-full [&>div>div]:items-start [&>div>div]:justify-start [&>div>div]:text-left [&>div>div>h3]:text-xl [&>div>div>h3]:font-semibold">
        <EmptyState
          title="No containers found"
          description="Get started by adding your first container to track its status and manage operations."
          icon={<Container className="h-12 w-12 text-muted-foreground" />}
        />
      </div>
    )
  }

  if (!hasFilteredContainers) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-border p-12 text-center">
        <Container className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          No containers match your filters
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Try adjusting your search or filter criteria.
        </p>
        {hasActiveFilters && (
          <Button variant="outline" onClick={onClearFilters}>
            Clear All Filters
          </Button>
        )}
      </div>
    )
  }

  return null
})

