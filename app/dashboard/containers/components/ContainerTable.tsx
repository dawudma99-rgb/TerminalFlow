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
import { Edit, Trash2, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { updateContainer } from '@/lib/data/containers-actions'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ContainerTableProps {
  containers: ContainerRecordWithComputed[]
  viewMode: 'demurrage' | 'detention' | 'both'
  onEdit: (container: ContainerRecordWithComputed) => void
  onDelete: (container: ContainerRecordWithComputed) => void
  onToggleStatus: (container: ContainerRecordWithComputed) => void
  reload: () => Promise<void>
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

export function ContainerTable({
  containers,
  viewMode,
  onEdit,
  onDelete,
  onToggleStatus,
  reload,
}: ContainerTableProps) {
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false)
  const [selectedContainer, setSelectedContainer] = useState<ContainerRecordWithComputed | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)

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

  return (
    <>
      <Table className="text-[13px]">
        <TableHeader className="sticky top-0 z-10 bg-[#F8FAFD] text-[11px] uppercase tracking-[0.14em] text-slate-500">
          <TableRow className="border-b border-[#DDE1E8]">
            <TableHead className="w-32">Container</TableHead>
            <TableHead className="w-32">Port</TableHead>
            <TableHead className="w-32">Owner</TableHead>
            <TableHead className="w-32">Carrier</TableHead>
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
                <TableHead className="w-32 text-right">Detention Rate</TableHead>
              </>
            )}
            <TableHead className="w-24 text-center">Status</TableHead>
            <TableHead className="w-48">Notes</TableHead>
            <TableHead className="w-24 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&>tr]:border-[#E4E7ED]">
          {containers.map((container) => (
            <TableRow key={container.id} className="group border-b border-[#E4E7ED] hover:bg-[#F2F5FA]">
              <TableCell className="font-mono text-sm text-slate-700">
                {container.container_no || '—'}
              </TableCell>
              <TableCell className="text-slate-700">{container.port || '—'}</TableCell>
              <TableCell className="text-slate-600">
                {container.assigned_to || (
                  <span className="text-slate-400 italic">Unassigned</span>
                )}
              </TableCell>
              <TableCell className="text-slate-600">{container.carrier || '—'}</TableCell>
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
                <StatusBadge status={container.status} />
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
          ))}
        </TableBody>
      </Table>

      <Dialog open={isNoteDialogOpen} onOpenChange={(open) => (open ? setIsNoteDialogOpen(true) : handleCloseNote())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
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

