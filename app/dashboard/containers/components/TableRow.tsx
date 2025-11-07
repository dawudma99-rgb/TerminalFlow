'use client'

// TODO: Consider react-window or react-virtual for virtualization if datasets exceed 1000 rows

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow as UITableRow } from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import clsx from 'clsx'
import { Edit, Trash2, Lock, Unlock } from 'lucide-react'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'

interface TableRowProps {
  container: ContainerRecordWithComputed
  viewMode: 'demurrage' | 'detention' | 'both'
  onEdit: (container: ContainerRecordWithComputed) => void
  onDelete: (container: ContainerRecordWithComputed) => void
  onToggleStatus: (container: ContainerRecordWithComputed) => void
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

// ✅ Memoized: Prevents unnecessary re-renders for unchanged rows
// Custom comparison function optimizes re-render decisions
export const TableRow = memo(function TableRow({
  container,
  viewMode,
  onEdit,
  onDelete,
  onToggleStatus,
}: TableRowProps) {
  // Temporary render marker for performance verification (Phase 3-D)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Render] TableRow', { 
      id: container.id, 
      container_no: container.container_no 
    })
  }

  return (
    <UITableRow>
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
          <TableCell className="text-center font-medium">
            {container.days_left != null && container.days_left < 0 && container.demurrage_fees
              ? `£${container.demurrage_fees.toLocaleString()}`
              : container.demurrage_fee_if_late != null
                ? `£${container.demurrage_fee_if_late.toFixed(2)}/day`
                : '—'}
            {Array.isArray(container.demurrage_tiers) && container.demurrage_tiers.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">(tiered)</span>
            )}
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
          <TableCell className="text-center font-medium">
            {container.days_left != null && container.days_left < 0 && container.detention_fees
              ? `£${container.detention_fees.toLocaleString()}`
              : container.detention_fee_rate != null
                ? `£${container.detention_fee_rate.toFixed(2)}/day`
                : '—'}
            {Array.isArray(container.detention_tiers) && container.detention_tiers.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">(tiered)</span>
            )}
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
                  onClick={() => onEdit(container)}
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
                  onClick={() => onToggleStatus(container)}
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
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Container</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </TableCell>
    </UITableRow>
  )
}, (prevProps, nextProps) => {
  // Shallow compare to prevent re-render if nothing relevant changed
  // Returns true if props are equal (skip re-render), false if different (re-render)
  return (
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.container.id === nextProps.container.id &&
    prevProps.container.status === nextProps.container.status &&
    prevProps.container.is_closed === nextProps.container.is_closed &&
    prevProps.container.days_left === nextProps.container.days_left &&
    prevProps.container.demurrage_fees === nextProps.container.demurrage_fees &&
    prevProps.container.detention_fees === nextProps.container.detention_fees &&
    prevProps.container.container_no === nextProps.container.container_no &&
    prevProps.container.port === nextProps.container.port &&
    prevProps.container.assigned_to === nextProps.container.assigned_to &&
    prevProps.container.carrier === nextProps.container.carrier &&
    prevProps.container.arrival_date === nextProps.container.arrival_date &&
    prevProps.container.gate_out_date === nextProps.container.gate_out_date &&
    prevProps.container.free_days === nextProps.container.free_days &&
    prevProps.container.detention_free_days === nextProps.container.detention_free_days &&
    prevProps.container.demurrage_fee_if_late === nextProps.container.demurrage_fee_if_late &&
    prevProps.container.detention_fee_rate === nextProps.container.detention_fee_rate
  )
})

