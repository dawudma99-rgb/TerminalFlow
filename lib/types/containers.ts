import type { Json } from '@/types/database'
import type { ContainerMilestone } from '@/lib/utils/milestones'

/**
 * Form-friendly input type for creating new containers.
 * This represents the shape of data sent from the UI form.
 * Server-side fields (organization_id, list_id) are added by insertContainer.
 */
export type NewContainerInput = {
  container_no: string
  bl_number: string | null
  pol: string | null
  pod: string | null
  arrival_date: string | null
  free_days: number
  carrier: string | null
  container_size: string | null
  milestone: ContainerMilestone | string | null
  notes: string | null
  assigned_to: string | null
  gate_out_date: string | null
  empty_return_date: string | null
  demurrage_tiers: Json | null
  detention_tiers: Json | null
  has_detention: boolean
}
