'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddContainerForm, type ContainerFormData } from '@/components/forms/AddContainerForm'
import { Plus } from 'lucide-react'
import { insertContainer, type ClientContainerInput } from '@/lib/data/containers-actions'
import type { Json } from '@/types/database'
import { Tier } from '@/lib/tierUtils'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import {
  DEFAULT_MILESTONE,
  resolveMilestone,
  type ContainerMilestone,
} from '@/lib/utils/milestones'

interface AddContainerTriggerProps {
  reload?: () => Promise<void>
}

export const AddContainerTrigger: React.FC<AddContainerTriggerProps> = ({ reload }) => {
  const [isOpen, setIsOpen] = useState(false)

  const defaultMilestone: ContainerMilestone = DEFAULT_MILESTONE

  const handleSave = async (data: ContainerFormData) => {
    try {
      // Normalize date fields: empty string -> null
      const normalizeDate = (dateStr: string): string | null => {
        return dateStr.trim() === '' ? null : dateStr
      }

      const normalizeOptionalString = (value: string | null): string | null => {
        const trimmed = value?.trim()
        return trimmed ? trimmed : null
      }

      // Ensure pod is not null (required field) - default to empty string if null
      const podValue: string = normalizeOptionalString(data.pod) ?? ''
      
      const containerData: ClientContainerInput = {
        container_no: data.container_no,
        bl_number: normalizeOptionalString(data.bl_number),
        pol: normalizeOptionalString(data.pol),
        pod: podValue,
        arrival_date: normalizeDate(data.arrival_date),
        free_days: data.free_days,
        carrier: data.carrier || null,
        container_size: data.container_size || null,
        milestone: resolveMilestone(data.milestone, {
          gate_out_date: data.gate_out_date,
          empty_return_date: data.empty_return_date,
        }),
        notes: normalizeOptionalString(data.notes),
        assigned_to: normalizeOptionalString(data.assigned_to),
        gate_out_date: normalizeDate(data.gate_out_date),
        empty_return_date: normalizeDate(data.empty_return_date),
        demurrage_tiers:
          data.demurrage_enabled && data.demurrage_tiers?.length > 0
            ? (data.demurrage_tiers as unknown as Json)
            : null,
        detention_tiers:
          data.detention_enabled && data.detention_tiers?.length > 0
            ? (data.detention_tiers as unknown as Json)
            : null,
        has_detention: data.detention_enabled,
        weekend_chargeable: data.weekend_chargeable ?? true,
      }

      await insertContainer(containerData)
      if (reload) {
        await reload()
      }
      toast.success('Container added successfully!')
    } catch (error) {
      logger.error('Error adding container:', error)
      toast.error('Failed to add container. Please try again.')
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="sm"
        className="h-8 gap-1 rounded border border-[#2563EB] bg-[#2563EB] px-3 text-xs font-semibold uppercase tracking-wide shadow-none hover:bg-[#1D4ED8]"
      >
        <Plus className="h-3.5 w-3.5" />
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

