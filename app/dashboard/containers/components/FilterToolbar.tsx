'use client'

import { useMemo, useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Search, SlidersHorizontal, X, Download } from 'lucide-react'

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
  owners: string[]
  hasActiveFilters: boolean
  addAction: React.ReactNode
  onExport?: () => void
  exporting?: boolean
}

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  ownerFilter,
  onOwnerChange,
  viewMode,
  onViewModeChange,
  onClearFilters,
  owners,
  hasActiveFilters,
  addAction,
  onExport,
  exporting = false,
}: FilterToolbarProps) {
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false)

  const ownerOptions = useMemo(() => owners.map((owner) => ({
    label: owner,
    value: owner,
  })), [owners])

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#D4D7DE] bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-1 min-w-[260px] items-center gap-2">
          <div className="relative w-full max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Quick search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 rounded border border-[#D4D7DE] bg-white pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-0"
            />
          </div>

          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="h-8 w-[140px] rounded border border-[#D4D7DE] bg-white text-xs text-slate-700 focus:border-[#2563EB] focus:ring-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="text-xs">
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
              <SelectItem value="Safe">Safe</SelectItem>
              <SelectItem value="Warning">Warning</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden lg:flex">
            <Select value={ownerFilter} onValueChange={onOwnerChange}>
              <SelectTrigger className="h-8 w-[160px] rounded border border-[#D4D7DE] bg-white text-xs text-slate-700 focus:border-[#2563EB] focus:ring-0">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All owners</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {ownerOptions.map((owner) => (
                  <SelectItem key={owner.value} value={owner.value}>
                    {owner.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6] lg:hidden"
            onClick={() => setIsFiltersDialogOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </Button>

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="hidden h-8 items-center gap-1 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6] lg:inline-flex"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => {
              if (value === 'demurrage' || value === 'detention' || value === 'both') {
                onViewModeChange(value)
              }
            }}
            className="h-8 rounded border border-[#D4D7DE] bg-white text-xs"
          >
            <ToggleGroupItem value="demurrage" aria-label="Demurrage" className="px-3 text-xs data-[state=on]:bg-[#2563EB] data-[state=on]:text-white">
              Demurrage
            </ToggleGroupItem>
            <ToggleGroupItem value="detention" aria-label="Detention" className="px-3 text-xs data-[state=on]:bg-[#2563EB] data-[state=on]:text-white">
              Detention
            </ToggleGroupItem>
            <ToggleGroupItem value="both" aria-label="Both" className="px-3 text-xs data-[state=on]:bg-[#2563EB] data-[state=on]:text-white">
              Both
            </ToggleGroupItem>
          </ToggleGroup>

          {onExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exporting}
              className="h-8 gap-1.5 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6] disabled:opacity-50"
              aria-label="Export containers to CSV"
              title="Export containers to CSV"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          )}

          {addAction}
        </div>
      </div>

      <Dialog open={isFiltersDialogOpen} onOpenChange={setIsFiltersDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Additional Filters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Owner
              </label>
              <Select value={ownerFilter} onValueChange={onOwnerChange}>
                <SelectTrigger className="h-9 rounded border border-[#D4D7DE] bg-white text-sm text-slate-700 focus:border-[#2563EB] focus:ring-0">
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent className="text-sm">
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {ownerOptions.map((owner) => (
                    <SelectItem key={owner.value} value={owner.value}>
                      {owner.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            {hasActiveFilters ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearFilters()
                  setIsFiltersDialogOpen(false)
                }}
              >
                Clear filters
              </Button>
            ) : (
              <div />
            )}
            <Button
              size="sm"
              onClick={() => setIsFiltersDialogOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

