'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AddContainerForm } from '@/components/forms/AddContainerForm'
import { Plus } from 'lucide-react'
import { insertContainer, type ContainerInsert } from '@/lib/data/containers-actions'
import type { Json } from '@/types/database'
import { Tier } from '@/lib/tierUtils'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'

interface AddContainerTriggerProps {
  reload?: () => Promise<void>
}

export const AddContainerTrigger: React.FC<AddContainerTriggerProps> = ({ reload }) => {
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

