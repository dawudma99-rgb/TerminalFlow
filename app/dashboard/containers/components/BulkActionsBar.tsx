'use client'

import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface BulkActionsBarProps {
  selectedCount: number
  onDelete: () => Promise<void>
  onExit: () => void
  isDeleting?: boolean
}

export function BulkActionsBar({ selectedCount, onDelete, onExit, isDeleting = false }: BulkActionsBarProps) {
  return (
    <div className="flex items-center gap-4 border-b border-[#D4D7DE] bg-[#F8FAFD] px-4 py-3">
      <span className="text-sm font-medium text-slate-700">
        {selectedCount} {selectedCount === 1 ? 'container' : 'containers'} selected
      </span>
      <div className="flex items-center gap-2">
        <ConfirmDialog
          title={`Delete ${selectedCount} ${selectedCount === 1 ? 'container' : 'containers'}?`}
          description={`This will permanently delete ${selectedCount} ${selectedCount === 1 ? 'container' : 'containers'}. This action cannot be undone.`}
          onConfirm={onDelete}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
          trigger={
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              className="h-8 gap-1.5 text-xs"
            >
              {isDeleting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete selected
                </>
              )}
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          disabled={isDeleting}
          className="h-8 gap-1.5 text-xs text-slate-600 hover:bg-slate-100"
        >
          <X className="h-3.5 w-3.5" />
          Done
        </Button>
      </div>
    </div>
  )
}

