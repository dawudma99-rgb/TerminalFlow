'use client'

import { useListsContext } from '@/components/providers/ListsProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, X, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { useState } from 'react'
import { toast } from 'sonner'
import { logger } from '@/lib/utils/logger'

export function ListTabs() {
  const { lists, activeListId, setActiveList, createList, deleteList, loading } = useListsContext()
  const [switchingListId, setSwitchingListId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const handleSwitchList = async (listId: string) => {
    if (listId === activeListId) return
    setSwitchingListId(listId)
    try {
      await setActiveList(listId)
    } catch (error) {
      logger.error('[ListTabs] Failed to switch list:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to switch list')
    } finally {
      setSwitchingListId(null)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name')
      return
    }

    setIsCreating(true)
    try {
      const newList = await createList(newListName.trim())
      setNewListName('')
      setIsCreateDialogOpen(false)
      await setActiveList(newList.id)
    } catch (error) {
      logger.error('[ListTabs] Failed to create list:', error)
      // Error toast handled inside createList
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteList = async (listId: string) => {
    try {
      await deleteList(listId)
    } catch (error) {
      logger.error('[ListTabs] Failed to delete list:', error)
      // Error toast handled inside deleteList
    }
  }

  if (loading) {
    return (
      <div className="flex h-12 w-full items-center justify-center border-b border-gray-200 bg-white">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      </div>
    )
  }

  if (lists.length === 0) {
    return null
  }

  return (
    <div
      role="tablist"
      aria-label="Container Lists"
      className="flex h-10 items-center gap-1.5 overflow-x-auto rounded-md border border-[#D4D7DE] bg-white px-2 shadow-sm"
    >
      {lists.map((list) => {
        const isActive = list.id === activeListId
        return (
          <div key={list.id} className="group relative flex items-center">
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSwitchList(list.id)}
              disabled={switchingListId === list.id}
              className={clsx(
                'min-w-[120px] rounded-md px-4 py-2 flex items-center justify-between gap-2 text-[13px] font-medium tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:ring-[#2563EB]',
                isActive
                  ? 'bg-[#2563EB] text-white shadow-[inset_0_-1px_0_rgba(37,99,235,0.55)]'
                  : 'bg-[#F1F3F7] text-[#4B5563] hover:bg-[#E5E8EF]'
              )}
            >
              <span className="truncate">{list.name}</span>
              {switchingListId === list.id && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            </button>
            {list.name !== 'Main List' && !isActive && (
              <ConfirmDialog
                title="Delete List"
                description={`Are you sure you want to delete "${list.name}"? This action cannot be undone.`}
                onConfirm={() => handleDeleteList(list.id)}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                trigger={
                  <button
                    type="button"
                    className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-[#F3F4F6] text-gray-500 transition hover:bg-red-100 hover:text-red-600 group-hover:flex"
                    aria-label={`Delete ${list.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                }
              />
            )}
          </div>
        )
      })}

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-md border border-[#D4D7DE] bg-[#F8FAFD] text-[#2563EB] transition hover:bg-[#E7EDF8]"
            aria-label="Add new list"
          >
            <Plus className="h-4 w-4" />
          </button>
        </DialogTrigger>
        <DialogContent aria-describedby="create-list-description">
          <DialogHeader>
            <DialogTitle>Create new list</DialogTitle>
            <DialogDescription id="create-list-description">
              Enter a name to create a new list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label htmlFor="new-list-name" className="text-sm font-medium text-gray-700">
                List name
              </label>
              <Input
                id="new-list-name"
                placeholder="e.g. Asia Imports"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreating) {
                    e.preventDefault()
                    handleCreateList()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={isCreating || !newListName.trim()}>
              {isCreating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

