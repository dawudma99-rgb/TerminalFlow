'use client'

import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useContainers } from '@/lib/data/useContainers'
import { insertContainer, updateContainer, deleteContainer, type ContainerInsert, type ContainerUpdate, type ContainerRecordWithComputed } from '@/lib/data/containers-actions'
import type { Json } from '@/types/database'
import { useListsContext } from '@/components/providers/ListsProvider'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { AddContainerForm } from '@/components/forms/AddContainerForm'
import clsx from 'clsx'
import { useState } from 'react'
import { Plus, Edit, Trash2, Lock, Unlock, Container } from 'lucide-react'
import { Tier } from '@/lib/tierUtils'

function AddContainerTrigger() {
  const [isOpen, setIsOpen] = useState(false)

  const handleSave = async (data: {
    container_no: string
    port: string
    arrival_date: string
    free_days: number
    carrier: string
    container_size: string
    assigned_to: string
    demurrage_enabled: boolean
    demurrage_flat_rate: number
    demurrage_tiers: Tier[]
    detention_enabled: boolean
    detention_flat_rate: number
    detention_tiers: Tier[]
    gate_out_date: string
    empty_return_date: string
    notes: string
  }) => {
    try {
      // Normalize date fields: empty string -> null
      const normalizeDate = (dateStr: string): string | null => {
        return dateStr.trim() === '' ? null : dateStr
      }

      const containerData = {
        container_no: data.container_no,
        port: data.port,
        arrival_date: normalizeDate(data.arrival_date),
        free_days: data.free_days,
        carrier: data.carrier || null,
        container_size: data.container_size || null,
        notes: data.notes || null,
        assigned_to: data.assigned_to || null,
        gate_out_date: normalizeDate(data.gate_out_date),
        empty_return_date: normalizeDate(data.empty_return_date),
        demurrage_tiers: data.demurrage_enabled && data.demurrage_tiers?.length > 0
          ? (data.demurrage_tiers as unknown as Json)
          : null,
        detention_tiers: data.detention_enabled && data.detention_tiers?.length > 0
          ? (data.detention_tiers as unknown as Json)
          : null,
        has_detention: data.detention_enabled,
      }

      await insertContainer(containerData as ContainerInsert)
      toast.success('Container added successfully!')
      logger.log('Container added successfully!')
    } catch (error) {
      logger.error('Error adding container:', error)
      toast.error('Failed to add container. Please try again.')
    }
  }

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Container
      </Button>
      
      <AddContainerForm 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
      />
    </>
  )
}

function EditContainerForm({ container, onClose }: { container: ContainerRecordWithComputed, onClose: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true)
    setSuccessMessage('')
    
    try {
      const updatedData = {
        container_no: formData.get('container_no') as string,
        port: formData.get('port') as string,
        arrival_date: formData.get('arrival_date') as string,
        free_days: parseInt(formData.get('free_days') as string) || 7,
        carrier: formData.get('carrier') as string || null,
        container_size: formData.get('container_size') as string || null,
        notes: formData.get('notes') as string || null,
      }

      await updateContainer(container.id, updatedData as ContainerUpdate)
      toast.success('Container updated successfully!')
      setSuccessMessage('Container updated!')
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('')
        onClose()
      }, 1500)
    } catch (error) {
      logger.error('Error updating container:', error)
      toast.error('Failed to update container. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium text-gray-900">Edit Container</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ×
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-100 text-green-700 px-3 py-2 rounded text-sm mb-3">
          {successMessage}
        </div>
      )}

      <form action={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`edit-container_no-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Container Number *
            </label>
            <input
              type="text"
              id={`edit-container_no-${container.id}`}
              name="container_no"
              defaultValue={container.container_no || ''}
              required
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-port-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Port *
            </label>
            <input
              type="text"
              id={`edit-port-${container.id}`}
              name="port"
              defaultValue={container.port || ''}
              required
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-arrival_date-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Arrival Date *
            </label>
            <input
              type="date"
              id={`edit-arrival_date-${container.id}`}
              name="arrival_date"
              defaultValue={container.arrival_date ? container.arrival_date.split('T')[0] : ''}
              required
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-free_days-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Free Days
            </label>
            <input
              type="number"
              id={`edit-free_days-${container.id}`}
              name="free_days"
              defaultValue={container.free_days || 7}
              min="1"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-carrier-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Carrier
            </label>
            <input
              type="text"
              id={`edit-carrier-${container.id}`}
              name="carrier"
              defaultValue={container.carrier || ''}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor={`edit-container_size-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
              Container Size
            </label>
            <select
              id={`edit-container_size-${container.id}`}
              name="container_size"
              defaultValue={container.container_size || ''}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select size</option>
              <option value="20ft">20ft</option>
              <option value="40ft">40ft</option>
              <option value="45ft">45ft</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`edit-notes-${container.id}`} className="block text-xs font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id={`edit-notes-${container.id}`}
            name="notes"
            rows={2}
            defaultValue={container.notes || ''}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 py-1 px-3 rounded text-sm hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default function DashboardPage() {
  const { activeListId } = useListsContext()
  const { containers, loading, error, reload } = useContainers(activeListId)
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null)

  const handleDeleteContainer = async (containerId: string, containerNo: string) => {
    try {
      await deleteContainer(containerId)
      toast.success(`Container "${containerNo}" deleted successfully`)
      // The dashboard will automatically refresh due to revalidatePath in the server action
    } catch (error) {
      logger.error('Error deleting container:', error)
      toast.error('Failed to delete container. Please try again.')
    }
  }

  const handleToggleContainerStatus = async (containerId: string, isCurrentlyClosed: boolean) => {
    try {
      await updateContainer(containerId, { is_closed: !isCurrentlyClosed })
      toast.success(`Container ${isCurrentlyClosed ? 'reopened' : 'closed'} successfully`)
      // The dashboard will automatically refresh due to revalidatePath in the server action
    } catch (error) {
      logger.error('Error updating container status:', error)
      toast.error('Failed to update container status. Please try again.')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Manage your container operations</p>
            </div>
            <AddContainerTrigger />
          </div>
          <LoadingState message="Loading containers..." />
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Manage your container operations</p>
            </div>
            <AddContainerTrigger />
          </div>
          <ErrorAlert 
            message={error.message || "Failed to load containers"}
            onRetry={reload}
          />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Manage your container operations</p>
          </div>
          <AddContainerTrigger />
        </div>

        {containers.length === 0 ? (
          <EmptyState
            title="No containers found"
            description="Get started by adding your first container to track its status and manage operations."
            icon={<Container className="h-12 w-12 text-muted-foreground" />}
            action={<AddContainerTrigger />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {containers.map((c) => (
              <Card key={c.id} className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {c.container_no || 'Unnamed Container'}
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingContainerId(c.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <ConfirmDialog
                        title="Delete Container"
                        description={`Are you sure you want to delete container "${c.container_no || 'Unnamed Container'}"? This action cannot be undone.`}
                        onConfirm={() => handleDeleteContainer(c.id, c.container_no || 'Unnamed Container')}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleContainerStatus(c.id, c.is_closed)}
                        className={clsx(
                          "h-8 w-8 p-0",
                          c.is_closed 
                            ? "text-success hover:text-success hover:bg-success/10" 
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {c.is_closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        c.status === 'Safe' ? 'default' :
                        c.status === 'Warning' ? 'secondary' :
                        c.status === 'Overdue' ? 'destructive' :
                        c.status === 'Closed' ? 'outline' : 'secondary'
                      }
                      className={clsx(
                        c.status === 'Safe' && 'bg-success text-success-foreground',
                        c.status === 'Warning' && 'bg-warning text-warning-foreground',
                        c.status === 'Overdue' && 'bg-destructive text-destructive-foreground'
                      )}
                    >
                      {c.status ?? 'N/A'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Days left:</span>
                    <span
                      className={clsx(
                        'font-medium text-sm',
                        c.days_left != null && c.days_left < 0
                          ? 'text-destructive'
                          : 'text-foreground'
                      )}
                    >
                      {c.days_left ?? '?'}
                    </span>
                  </div>

                  {editingContainerId === c.id && (
                    <EditContainerForm 
                      container={c} 
                      onClose={() => setEditingContainerId(null)} 
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
