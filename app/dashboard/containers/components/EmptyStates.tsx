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
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Container className="mb-3 h-10 w-10 text-[#9CA3AF]" />
        <h3 className="text-sm font-semibold text-slate-700 tracking-tight">
          No containers yet
        </h3>
        <p className="mt-2 max-w-sm text-xs text-slate-500">
          Import your first shipment or add an existing unit to begin monitoring demurrage and detention performance.
        </p>
      </div>
    )
  }

  if (!hasFilteredContainers) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Container className="mb-3 h-9 w-9 text-[#9CA3AF]" />
        <h3 className="text-sm font-semibold text-slate-700 tracking-tight">
          No matches for the current filters
        </h3>
        <p className="mt-2 max-w-sm text-xs text-slate-500">
          Adjust the filters or clear them to bring the full board back into view.
        </p>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="mt-4 h-8 border border-[#D4D7DE] text-xs text-slate-600 hover:bg-[#EEF1F6]"
          >
            Clear filters
          </Button>
        )}
      </div>
    )
  }

  return null
})

