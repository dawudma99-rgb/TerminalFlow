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
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'

interface ContainerTableProps {
  containers: ContainerRecordWithComputed[]
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

export function ContainerTable({
  containers,
  viewMode,
  onEdit,
  onDelete,
  onToggleStatus,
}: ContainerTableProps) {
  return (
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
        {containers.map((container) => (
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

