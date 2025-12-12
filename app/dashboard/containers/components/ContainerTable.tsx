'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import clsx from 'clsx'
import { Edit, Trash2, Lock, Unlock, Loader2, Info } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import type {
  ContainerRecordWithComputed,
  ContainerMilestone,
} from '@/lib/data/containers-actions'
import { updateContainer } from '@/lib/data/containers-actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
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
} from '@/lib/utils/milestones'

interface ContainerTableProps {
  containers: ContainerRecordWithComputed[]
  viewMode: 'demurrage' | 'detention' | 'both'
  onEdit: (container: ContainerRecordWithComputed) => void
  onDelete: (container: ContainerRecordWithComputed) => void
  onToggleStatus: (container: ContainerRecordWithComputed) => void
  reload: () => Promise<void>
  // Bulk selection props
  bulkMode?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
}

const DAY_IN_MS = 86400000

function startOfDay(date: Date): Date {
  const next = new Date(date.getTime())
  next.setHours(0, 0, 0, 0)
  return next
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
  // Safe: Green highlighted badge (same prominent style as overdue but different color)
  if (status === 'Safe') {
    return (
      <Badge className="bg-[#10B981] text-white border-transparent font-semibold hover:bg-[#10B981]/90">
        {status}
      </Badge>
    )
  }

  // Warning: Amber highlighted badge (same prominent style as overdue but different color)
  if (status === 'Warning') {
    return (
      <Badge className="bg-[#F59E0B] text-white border-transparent font-semibold hover:bg-[#F59E0B]/90">
        {status}
      </Badge>
    )
  }

  // Overdue: Red highlighted badge (already prominent)
  if (status === 'Overdue') {
    return (
      <Badge variant="destructive">
        {status}
      </Badge>
    )
  }

  // Closed and null states: muted style
  const badgeClass = clsx(
    status === 'Closed' && 'bg-muted text-muted-foreground',
    !status && 'bg-muted text-muted-foreground'
  )

  return (
    <Badge className={badgeClass}>
      {status || 'N/A'}
    </Badge>
  )
}

export function ContainerTable({
  containers,
  viewMode,
  onEdit,
  onDelete,
  onToggleStatus,
  reload,
  bulkMode = false,
  selectedIds = [],
  onSelectionChange,
}: ContainerTableProps) {
  const isSelectionMode = bulkMode && onSelectionChange !== undefined
  const allVisibleSelected = isSelectionMode && containers.length > 0 && containers.every(c => selectedIds.includes(c.id))
  const someVisibleSelected = isSelectionMode && containers.some(c => selectedIds.includes(c.id))
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

  // Update indeterminate state of select-all checkbox
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected
    }
  }, [someVisibleSelected, allVisibleSelected])

  const handleToggleSelect = (containerId: string, e?: React.MouseEvent) => {
    if (!onSelectionChange) return
    if (e) {
      e.stopPropagation()
    }
    if (selectedIds.includes(containerId)) {
      onSelectionChange(selectedIds.filter(id => id !== containerId))
    } else {
      onSelectionChange([...selectedIds, containerId])
    }
  }

  const handleToggleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return
    const visibleIds = containers.map(c => c.id)
    if (checked) {
      // Select all visible containers
      const newSelected = [...new Set([...selectedIds, ...visibleIds])]
      onSelectionChange(newSelected)
    } else {
      // Deselect all visible containers
      onSelectionChange(selectedIds.filter(id => !visibleIds.includes(id)))
    }
  }
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<ContainerRecordWithComputed | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [milestoneOverrides, setMilestoneOverrides] = useState<Record<string, ContainerMilestone>>({})
  const [milestoneSaving, setMilestoneSaving] = useState<Record<string, boolean>>({})

  const handleOpenNote = (container: ContainerRecordWithComputed) => {
    setSelectedContainer(container)
    setNoteDraft(container.notes ?? '')
    setIsNoteDialogOpen(true)
  }

  const handleCloseNote = () => {
    if (isSavingNote) return
    setIsNoteDialogOpen(false)
    setSelectedContainer(null)
    setNoteDraft('')
  }

  const handleSaveNote = async () => {
    if (!selectedContainer) return
    setIsSavingNote(true)
    try {
      await updateContainer(selectedContainer.id, { notes: noteDraft.trim() === '' ? null : noteDraft })
      toast.success('Note updated')
      setIsSavingNote(false)
      setIsNoteDialogOpen(false)
      setSelectedContainer(null)
      await reload()
    } catch (error) {
      toast.error('Failed to update note')
      setIsSavingNote(false)
    }
  }

  const handleMilestoneChange = async (containerId: string, milestone: ContainerMilestone) => {
    const previous =
      normalizeMilestone(containers.find((c) => c.id === containerId)?.milestone) ??
      DEFAULT_MILESTONE

    setMilestoneOverrides((prev) => ({
      ...prev,
      [containerId]: milestone,
    }))
    setMilestoneSaving((prev) => ({ ...prev, [containerId]: true }))

    try {
      await updateContainer(containerId, { milestone })
    } catch (error) {
      setMilestoneOverrides((prev) => ({
        ...prev,
        [containerId]: previous,
      }))
      toast.error('Failed to update milestone. Please try again.')
    } finally {
      setMilestoneSaving((prev) => ({ ...prev, [containerId]: false }))
    }
  }

  return (
    <>
      <Table className="text-[13px]">
        <TableHeader className="sticky top-0 z-10 bg-[#F8FAFD] text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <TableRow className="border-b border-[#DDE1E8]">
            {isSelectionMode && (
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  ref={selectAllCheckboxRef}
                  checked={allVisibleSelected}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-0"
                  aria-label="Select all visible containers"
                />
              </TableHead>
            )}
            <TableHead className="w-32">Container</TableHead>
            <TableHead className="w-32">B/L Number</TableHead>
            <TableHead className="w-24">
              <div className="flex items-center gap-1">
                <span>POL</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Port of Loading – origin port</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead className="w-24">
              <div className="flex items-center gap-1">
                <span>POD</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Port of Discharge – destination port</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead className="w-32">Owner</TableHead>
            <TableHead className="w-32">Carrier</TableHead>
            <TableHead className="w-32 text-center">Milestone</TableHead>
            {viewMode !== 'detention' && (
              <>
                <TableHead className="w-32">Arrival</TableHead>
                <TableHead className="w-24 text-right">Free Days</TableHead>
                <TableHead className="w-24 text-right">Days Left</TableHead>
                <TableHead className="w-28 text-right">Demurrage</TableHead>
              </>
            )}
            {viewMode !== 'demurrage' && (
              <>
                <TableHead className="w-32">Gate Out</TableHead>
                <TableHead className="w-32 text-right">Detention Free Days</TableHead>
                {viewMode === 'detention' && (
                  <TableHead className="w-24 text-right">Days Left</TableHead>
                )}
                <TableHead className="w-32 text-right">Detention Rate</TableHead>
              </>
            )}
            <TableHead className="w-24 text-center">Status</TableHead>
            <TableHead className="w-48">Notes</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&>tr]:border-[#E4E7ED]">
          {containers.map((container) => {
            const normalizedMilestone =
              normalizeMilestone(container.milestone) ?? DEFAULT_MILESTONE
            const currentMilestone =
              milestoneOverrides[container.id] ?? normalizedMilestone
            const isSavingMilestone = !!milestoneSaving[container.id]

            const isSelected = selectedIds.includes(container.id)

            return (
              <TableRow key={container.id} className="group border-b border-[#E4E7ED] hover:bg-[#F2F5FA]">
                {isSelectionMode && (
                  <TableCell className="w-12">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleToggleSelect(container.id)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-0"
                      aria-label={`Select container ${container.container_no || container.id}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-sm text-slate-700">
                  {container.container_no || '—'}
                </TableCell>
                <TableCell className="text-slate-700">
                  {container.bl_number || '—'}
                </TableCell>
                <TableCell className="w-24 truncate text-slate-700" title="Port of Loading – origin port">{container.pol ?? '—'}</TableCell>
                <TableCell className="w-24 truncate text-slate-700" title="Port of Discharge – destination port">{container.pod ?? '—'}</TableCell>
                <TableCell className="text-slate-600">
                  {container.assigned_to || (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-600">{container.carrier || '—'}</TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <div className="relative inline-flex">
                      <Select
                        value={currentMilestone}
                        onValueChange={(value) => {
                          if (isValidMilestone(value)) {
                            handleMilestoneChange(container.id, value)
                          } else {
                            handleMilestoneChange(container.id, DEFAULT_MILESTONE)
                          }
                        }}
                        disabled={isSavingMilestone}
                      >
                        <SelectTrigger
                          className={clsx(
                            'w-[140px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                            isSavingMilestone && 'pr-9'
                          )}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTAINER_MILESTONES.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isSavingMilestone && (
                        <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
                      )}
                    </div>
                  </div>
                </TableCell>

                {viewMode !== 'detention' && (
                  <>
                    <TableCell className="text-slate-600">{formatDate(container.arrival_date)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {container.free_days ?? '—'}
                    </TableCell>
                    <TableCell
                      className={clsx(
                        'text-right tabular-nums font-semibold',
                        container.days_left != null && container.days_left < 0
                          ? 'text-[#B91C1C]'
                          : container.days_left != null && container.days_left <= 2
                            ? 'text-[#B45309]'
                            : 'text-[#1E293B]'
                      )}
                    >
                      {container.days_left ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {container.days_left != null && container.days_left < 0 && container.demurrage_fees
                        ? `£${container.demurrage_fees.toLocaleString()}`
                        : container.demurrage_fee_if_late != null
                          ? `£${container.demurrage_fee_if_late.toFixed(2)}/day`
                          : '—'}
                      {Array.isArray(container.demurrage_tiers) && container.demurrage_tiers.length > 0 && (
                        <span className="ml-1 text-[11px] uppercase tracking-wide text-slate-400">Tiered</span>
                      )}
                    </TableCell>
                  </>
                )}
                {viewMode !== 'demurrage' && (
                  <>
                    <TableCell className="text-slate-600">{formatDate(container.gate_out_date)}</TableCell>
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {container.detention_free_days ?? '—'}
                    </TableCell>
                    {viewMode === 'detention' && (() => {
                      // Calculate detention days left
                      const today = startOfDay(new Date())
                      let detentionDaysLeft: number | null = null

                      if (container.detention_chargeable_days !== null && container.detention_chargeable_days > 0) {
                        // Detention has started: show negative days (mirror demurrage style)
                        detentionDaysLeft = -container.detention_chargeable_days
                      } else if (container.lfd_date) {
                        // Detention not started yet: days until LFD
                        const lfd = startOfDay(new Date(container.lfd_date))
                        const diffMs = lfd.getTime() - today.getTime()
                        detentionDaysLeft = Math.floor(diffMs / DAY_IN_MS)
                      } else {
                        // No LFD (e.g. missing gate_out_date) → we don't know
                        detentionDaysLeft = null
                      }

                      return (
                        <TableCell
                          className={clsx(
                            'text-right tabular-nums font-semibold',
                            detentionDaysLeft !== null && detentionDaysLeft < 0
                              ? 'text-[#B91C1C]'
                              : detentionDaysLeft !== null && detentionDaysLeft <= 2
                                ? 'text-[#B45309]'
                                : 'text-[#1E293B]'
                          )}
                        >
                          {detentionDaysLeft === null ? '—' : detentionDaysLeft}
                        </TableCell>
                      )
                    })()}
                    <TableCell className="text-right tabular-nums text-slate-600">
                      {container.days_left != null && container.days_left < 0 && container.detention_fees
                        ? `£${container.detention_fees.toLocaleString()}`
                        : container.detention_fee_rate != null
                          ? `£${container.detention_fee_rate.toFixed(2)}/day`
                          : '—'}
                      {Array.isArray(container.detention_tiers) && container.detention_tiers.length > 0 && (
                        <span className="ml-1 text-[11px] uppercase tracking-wide text-slate-400">Tiered</span>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-center">
                  <StatusBadge
                    status={
                      viewMode === 'detention'
                        ? container.detention_status ?? container.status
                        : container.status
                    }
                  />
                </TableCell>
                <TableCell className="align-middle text-[13px]">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleOpenNote(container)
                          }}
                          className="block max-w-[200px] truncate text-left text-slate-700 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
                        >
                          {container.notes && container.notes.trim() !== '' ? container.notes : '—'}
                        </button>
                      </TooltipTrigger>
                      {container.notes && container.notes.trim() !== '' && (
                        <TooltipContent>
                          <p className="max-w-xs text-sm leading-relaxed">{container.notes}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onEdit(container)}
                            className="text-slate-500 hover:bg-[#E6EBF5] hover:text-[#1E293B]"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit container</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onToggleStatus(container)}
                            className={clsx(
                              "hover:bg-[#E6EBF5]",
                              container.is_closed
                                ? "text-[#047857] hover:text-[#065F46]"
                                : "text-slate-500 hover:text-[#1E293B]"
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
                          <p>{container.is_closed ? 'Reopen container' : 'Close container'}</p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ConfirmDialog
                            title="Delete Container"
                            description={`Are you sure you want to delete container "${container.container_no || 'Unnamed Container'}"? This action cannot be undone.`}
                            onConfirm={() => onDelete(container)}
                            confirmText="Delete"
                            cancelText="Cancel"
                            variant="destructive"
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-[#B91C1C] hover:bg-[#FDECEC] hover:text-[#991B1B]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete container</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog open={isNoteDialogOpen} onOpenChange={(open) => (open ? setIsNoteDialogOpen(true) : handleCloseNote())}>
        <DialogContent aria-describedby="edit-note-dialog-description">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription id="edit-note-dialog-description">
              Add or update notes for this container.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            rows={6}
            className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseNote} disabled={isSavingNote}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote} disabled={isSavingNote}>
              {isSavingNote ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

