'use client'

import { memo } from 'react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import { TableRow as ContainerTableRow } from './TableRow'

interface ContainerTableProps {
  containers: ContainerRecordWithComputed[]
  viewMode: 'demurrage' | 'detention' | 'both'
  onEdit: (container: ContainerRecordWithComputed) => void
  onDelete: (container: ContainerRecordWithComputed) => void
  onToggleStatus: (container: ContainerRecordWithComputed) => void
}

// ✅ Memoized: Prevents re-renders when unrelated props or parent state change
export const ContainerTable = memo(function ContainerTable({
  containers,
  viewMode,
  onEdit,
  onDelete,
  onToggleStatus,
}: ContainerTableProps) {
  // Temporary render marker for performance verification (Phase 3-D)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Render] ContainerTable', { 
      containerCount: containers.length, 
      viewMode 
    })
  }

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
          <ContainerTableRow
            key={container.id}
            container={container}
            viewMode={viewMode}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleStatus={onToggleStatus}
          />
        ))}
      </TableBody>
    </Table>
  )
})

