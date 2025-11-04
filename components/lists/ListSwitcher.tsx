'use client'

/**
 * ListSwitcher — Visual component for viewing, switching, and creating container lists
 * 
 * Features:
 * - Displays all lists as clickable buttons/pills
 * - Highlights active list
 * - Allows creating new lists
 * - Handles loading states
 */

import { useListsContext } from '@/components/providers/ListsProvider'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/LoadingState'
import { Plus, X, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import clsx from 'clsx'
import { useSWRConfig } from 'swr'

export function ListSwitcher() {
  const { lists, activeListId, setActiveList, createList, deleteList, loading } = useListsContext()
  const { mutate: mutateSWR } = useSWRConfig()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [switchingListId, setSwitchingListId] = useState<string | null>(null)

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name')
      return
    }

    setIsCreating(true)
    try {
      logger.info('[ListSwitcher] Created list:', newListName.trim())
      const newList = await createList(newListName.trim())
      setNewListName('')
      setIsCreateDialogOpen(false)
      // Automatically switch to the newly created list
      await setActiveList(newList.id)
      // Optimistically update containers cache
      mutateSWR(['containers', newList.id])
    } catch (error) {
      logger.error('[ListSwitcher] Failed to create list:', error)
      // Error toast is handled by createList
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteList = async (listId: string, listName: string) => {
    try {
      await deleteList(listId)
      // Optimistically clear containers cache for deleted list
      mutateSWR(['containers', listId], undefined, { revalidate: false })
    } catch (error) {
      logger.error('[ListSwitcher] Failed to delete list:', error)
      // Error toast is handled by deleteList
    }
  }

  const handleSwitchList = async (listId: string) => {
    if (listId === activeListId) {
      return // Already active
    }

    setSwitchingListId(listId)
    try {
      // Optimistically update containers cache immediately
      mutateSWR(['containers', listId], undefined, { revalidate: true })
      await setActiveList(listId)
    } catch (error) {
      logger.error('[ListSwitcher] Failed to switch list:', error)
      // Error toast is handled by setActiveList
      // Revert cache on error
      mutateSWR(['containers', activeListId], undefined, { revalidate: true })
    } finally {
      setSwitchingListId(null)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <LoadingState message="Loading lists..." />
      </div>
    )
  }

  // No lists state (shouldn't happen due to auto-create, but handle gracefully)
  if (lists.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">No lists available</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* List buttons */}
      {lists.map((list) => {
        const isActive = list.id === activeListId
        return (
          <div key={list.id} className="flex items-center gap-1 group">
            <Button
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSwitchList(list.id)}
              disabled={switchingListId === list.id}
              className={clsx(
                'transition-all duration-200 ease-in-out',
                isActive && 'shadow-sm',
                switchingListId === list.id && 'opacity-70'
              )}
              aria-label={`Switch to ${list.name}`}
              aria-pressed={isActive}
            >
              {switchingListId === list.id ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : null}
              {list.name}
            </Button>
            
            {/* Delete button (only show on hover for non-active lists, skip "Main List") */}
            {list.name !== 'Main List' && !isActive && switchingListId !== list.id && (
              <ConfirmDialog
                title="Delete List"
                description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
                onConfirm={() => handleDeleteList(list.id, list.name)}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Delete ${list.name}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                }
              />
            )}
          </div>
        )
      })}

      {/* Create new list button */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed hover:border-solid hover:bg-accent/50 transition-all duration-200 ease-in-out"
            aria-label="Add new list"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add List
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby="create-list-dialog-description">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
            <DialogDescription id="create-list-dialog-description">
              Enter a name to create a new list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="list-name" className="text-sm font-medium">
                List Name
              </label>
              <Input
                id="list-name"
                placeholder="Enter list name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating) {
                    handleCreateList()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false)
                setNewListName('')
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={isCreating || !newListName.trim()}
            >
              {isCreating ? 'Creating...' : 'Create List'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

