'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Search, X, RefreshCcw } from 'lucide-react'

interface FilterToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusChange: (value: string) => void
  ownerFilter: string
  onOwnerChange: (value: string) => void
  viewMode: 'demurrage' | 'detention' | 'both'
  onViewModeChange: (mode: 'demurrage' | 'detention' | 'both') => void
  onClearFilters: () => void
  onRefresh?: () => void
  isRefreshing?: boolean
  owners: string[]
  hasActiveFilters: boolean
  filteredCount: number
  totalCount: number
  timeAgo?: string
  loading?: boolean
}

// ✅ Memoized: Prevents re-renders when unrelated props or parent state change
export const FilterToolbar = memo(function FilterToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  ownerFilter,
  onOwnerChange,
  viewMode,
  onViewModeChange,
  onClearFilters,
  onRefresh,
  isRefreshing = false,
  owners,
  hasActiveFilters,
  filteredCount,
  totalCount,
  timeAgo,
  loading = false,
}: FilterToolbarProps) {
  // Temporary render marker for performance verification (Phase 3-D)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Render] FilterToolbar', { 
      searchQuery, 
      statusFilter, 
      ownerFilter, 
      viewMode 
    })
  }

  return (
    <>
      {/* Last Updated & Refresh Controls */}
      {!loading && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
          <div className="flex items-center gap-2">
            {timeAgo && (
              <span className="text-sm text-muted-foreground">
                Last updated: {timeAgo}
              </span>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing || loading}
                className="h-8 w-8 p-0"
                aria-label="Refresh containers"
              >
                <RefreshCcw 
                  className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} 
                />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-foreground">View Mode:</span>
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value) => {
              if (value === 'demurrage' || value === 'detention' || value === 'both') {
                onViewModeChange(value)
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
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-[160px]">
            <Select value={statusFilter} onValueChange={onStatusChange}>
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
            <Select value={ownerFilter} onValueChange={onOwnerChange}>
              <SelectTrigger>
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {owners.map((owner) => (
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
              onClick={onClearFilters}
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
            Showing {filteredCount} of {totalCount} containers
          </div>
        )}
      </div>
    </>
  )
})

