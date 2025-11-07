'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { updateContainer, type ContainerRecordWithComputed, type ContainerUpdate } from '@/lib/data/containers-actions'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'

interface EditContainerDialogProps {
  container: ContainerRecordWithComputed | null
  isOpen: boolean
  onClose: () => void
}

export const EditContainerDialog: React.FC<EditContainerDialogProps> = ({
  container,
  isOpen,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!container) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData(e.currentTarget)
      const updatedData: ContainerUpdate = {
        container_no: formData.get('container_no') as string,
        port: formData.get('port') as string,
        arrival_date: formData.get('arrival_date') as string,
        free_days: parseInt(formData.get('free_days') as string) || 7,
        carrier: (formData.get('carrier') as string) || null,
        container_size: (formData.get('container_size') as string) || null,
        notes: (formData.get('notes') as string) || null,
      }

      await updateContainer(container.id, updatedData)
      toast.success('Container updated successfully')
      onClose()
    } catch (error) {
      logger.error('Error updating container:', error)
      toast.error('Failed to update container. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Container</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="edit-container_no" className="text-sm font-medium">
                Container Number *
              </label>
              <Input
                id="edit-container_no"
                name="container_no"
                defaultValue={container.container_no || ''}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-port" className="text-sm font-medium">
                Port *
              </label>
              <Input
                id="edit-port"
                name="port"
                defaultValue={container.port || ''}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-arrival_date" className="text-sm font-medium">
                Arrival Date *
              </label>
              <Input
                id="edit-arrival_date"
                name="arrival_date"
                type="date"
                defaultValue={container.arrival_date ? container.arrival_date.split('T')[0] : ''}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-free_days" className="text-sm font-medium">
                Free Days
              </label>
              <Input
                id="edit-free_days"
                name="free_days"
                type="number"
                defaultValue={container.free_days || 7}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-carrier" className="text-sm font-medium">
                Carrier
              </label>
              <Input
                id="edit-carrier"
                name="carrier"
                defaultValue={container.carrier || ''}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-container_size" className="text-sm font-medium">
                Container Size
              </label>
              <select
                id="edit-container_size"
                name="container_size"
                defaultValue={container.container_size || ''}
                className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground"
              >
                <option value="">Select size</option>
                <option value="20ft">20ft</option>
                <option value="40ft">40ft</option>
                <option value="45ft">45ft</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="edit-notes" className="text-sm font-medium">
              Notes
            </label>
            <textarea
              id="edit-notes"
              name="notes"
              rows={3}
              defaultValue={container.notes || ''}
              className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground resize-y"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

