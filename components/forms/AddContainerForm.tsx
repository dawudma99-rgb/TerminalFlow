'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { 
  Package, 
  DollarSign, 
  Clock, 
  FileText, 
  Info
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DemurrageTierEditor } from './DemurrageTierEditor'
import { DetentionTierEditor } from './DetentionTierEditor'
import { Tier, validateTierConfiguration } from '@/lib/tierUtils'
import { getCarrierDefaults, saveCarrierDefaults } from '@/lib/data/carrier-actions'
import { useAuth } from '@/lib/auth/useAuth'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  CONTAINER_MILESTONES,
  DEFAULT_MILESTONE,
  isValidMilestone,
  type ContainerMilestone,
} from '@/lib/utils/milestones'

// UK carrier presets with realistic tiered demurrage/detention rates.
// Note: Day 1 = first chargeable day (arrival date + free days).
const UK_CARRIER_PRESETS = {
  'MSC': {
    demurrage_tiers: [
      { from_day: 1, to_day: 5, rate: 85 },
      { from_day: 6, to_day: 10, rate: 125 },
      { from_day: 11, to_day: 999, rate: 175 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 5, rate: 70 },
      { from_day: 6, to_day: 10, rate: 100 },
      { from_day: 11, to_day: 999, rate: 140 }
    ],
    freeDays: 7
  },
  'CMA-CGM': {
    demurrage_tiers: [
      { from_day: 1, to_day: 6, rate: 88 },
      { from_day: 7, to_day: 12, rate: 132 },
      { from_day: 13, to_day: 999, rate: 176 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 6, rate: 72 },
      { from_day: 7, to_day: 12, rate: 108 },
      { from_day: 13, to_day: 999, rate: 144 }
    ],
    freeDays: 7
  },
  'Maersk': {
    demurrage_tiers: [
      { from_day: 1, to_day: 5, rate: 90 },
      { from_day: 6, to_day: 10, rate: 135 },
      { from_day: 11, to_day: 999, rate: 180 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 5, rate: 75 },
      { from_day: 6, to_day: 10, rate: 110 },
      { from_day: 11, to_day: 999, rate: 150 }
    ],
    freeDays: 5
  },
  'Hapag-Lloyd': {
    demurrage_tiers: [
      { from_day: 1, to_day: 5, rate: 92 },
      { from_day: 6, to_day: 10, rate: 138 },
      { from_day: 11, to_day: 999, rate: 184 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 5, rate: 78 },
      { from_day: 6, to_day: 10, rate: 115 },
      { from_day: 11, to_day: 999, rate: 155 }
    ],
    freeDays: 5
  },
  'Evergreen': {
    demurrage_tiers: [
      { from_day: 1, to_day: 6, rate: 87 },
      { from_day: 7, to_day: 12, rate: 130 },
      { from_day: 13, to_day: 999, rate: 174 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 6, rate: 69 },
      { from_day: 7, to_day: 12, rate: 104 },
      { from_day: 13, to_day: 999, rate: 139 }
    ],
    freeDays: 6
  },
  'ONE': {
    demurrage_tiers: [
      { from_day: 1, to_day: 5, rate: 91 },
      { from_day: 6, to_day: 10, rate: 136 },
      { from_day: 11, to_day: 999, rate: 182 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 5, rate: 74 },
      { from_day: 6, to_day: 10, rate: 111 },
      { from_day: 11, to_day: 999, rate: 148 }
    ],
    freeDays: 5
  },
  'OOCL': {
    demurrage_tiers: [
      { from_day: 1, to_day: 5, rate: 89 },
      { from_day: 6, to_day: 10, rate: 134 },
      { from_day: 11, to_day: 999, rate: 179 }
    ],
    detention_tiers: [
      { from_day: 1, to_day: 5, rate: 70 },
      { from_day: 6, to_day: 10, rate: 105 },
      { from_day: 11, to_day: 999, rate: 145 }
    ],
    freeDays: 5
  }
}

const CARRIER_NAMES = Object.keys(UK_CARRIER_PRESETS)

interface AddContainerFormProps {
  isOpen: boolean
  onClose: () => void
  onSave?: (data: ContainerFormData) => void
}

interface ContainerFormData {
  // Basic Information
  container_no: string
  bl_number: string
  pol: string
  pod: string
  arrival_date: string
  free_days: number
  carrier: string | null
  container_size: string | null
  assigned_to: string
  milestone: ContainerMilestone
 
  // Demurrage Tracking
  demurrage_enabled: boolean
  demurrage_flat_rate: number
  demurrage_tiers: Tier[]
  
  // Detention Tracking
  detention_enabled: boolean
  detention_flat_rate: number
  detention_tiers: Tier[]
  gate_out_date: string
  empty_return_date: string
  
  // Additional Notes
  notes: string
}

export function AddContainerForm({ isOpen, onClose, onSave }: AddContainerFormProps) {
  const { profile } = useAuth()
  const [formData, setFormData] = useState<ContainerFormData>({
    container_no: '',
    bl_number: '',
    pol: '',
    pod: '',
    arrival_date: '',
    free_days: 7,
    carrier: null,
    container_size: null,
    assigned_to: '',
    milestone: DEFAULT_MILESTONE,
    demurrage_enabled: false,
    demurrage_flat_rate: 0,
    demurrage_tiers: [],
    detention_enabled: false,
    detention_flat_rate: 0,
    detention_tiers: [],
    gate_out_date: '',
    empty_return_date: '',
    notes: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [carrierDefaultsLoaded, setCarrierDefaultsLoaded] = useState(false)
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [savingDefaults, setSavingDefaults] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const handleInputChange = <K extends keyof ContainerFormData>(field: K, value: ContainerFormData[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    if (field === 'carrier') {
      const carrierValue = typeof value === 'string' ? value.trim() : ''
      if (carrierValue && profile?.organization_id) {
        void loadCarrierDefaults(carrierValue)
      }
    }
  }

  const loadCarrierDefaults = async (carrier: string) => {
    if (!profile?.organization_id || !carrier.trim()) return

    setLoadingDefaults(true)
    setCarrierDefaultsLoaded(false)
    
    try {
      const defaults = await getCarrierDefaults(carrier.trim(), profile.organization_id)
      
      if (defaults) {
        // Normalize tier keys for UI compatibility (from/to → from_day/to_day)
        const normalizedDemurrageTiers = (defaults.demurrage_tiers || []).map((t: { from?: number; from_day?: number; to?: number | null; to_day?: number | null; rate?: number }) => ({
          from_day: t.from ?? t.from_day ?? 1,
          to_day: t.to ?? t.to_day ?? null,
          rate: t.rate ?? 0,
        }))
        
        const normalizedDetentionTiers = (defaults.detention_tiers || []).map((t: { from?: number; from_day?: number; to?: number | null; to_day?: number | null; rate?: number }) => ({
          from_day: t.from ?? t.from_day ?? 1,
          to_day: t.to ?? t.to_day ?? null,
          rate: t.rate ?? 0,
        }))
        
        // Found org-specific defaults - auto-load them
        // Only auto-enable demurrage, detention must be manually enabled
        setFormData(prev => ({
          ...prev,
          demurrage_tiers: normalizedDemurrageTiers,
          detention_tiers: normalizedDetentionTiers,
          demurrage_enabled: normalizedDemurrageTiers.length > 0,
          detention_enabled: false // Keep detention disabled, user must manually enable
        }))
        setCarrierDefaultsLoaded(true)
        toast.success(`Loaded saved defaults for ${carrier}`)
      } else {
        // Fallback to UK presets
        // Free days are handled by the container; tiers define chargeable days only.
        // Day 1 in the tier = first day after free period ends.
        const preset = UK_CARRIER_PRESETS[carrier as keyof typeof UK_CARRIER_PRESETS]
        if (preset) {
          const fallbackDem: Tier[] = preset.demurrage_tiers ?? []
          const fallbackDet: Tier[] = preset.detention_tiers ?? []
          setFormData(prev => ({
            ...prev,
            demurrage_tiers: fallbackDem,
            detention_tiers: fallbackDet,
            demurrage_enabled: true,
            detention_enabled: false // Keep detention disabled, user must manually enable
          }))
          toast.info(`Applied UK standard rates for ${carrier}`)
        }
      }
    } catch (error) {
      logger.error('Error loading carrier defaults:', error)
      toast.error(`Failed to load defaults for ${carrier}`)
    } finally {
      setLoadingDefaults(false)
    }
  }

  const handleSaveDemurrageDefaults = async () => {
    if (!formData.carrier || !profile?.organization_id) {
      toast.error('Carrier and organization information required')
      return
    }

    // Validate tier configurations before saving
    const demurrageValidation = validateTierConfiguration(formData.demurrage_tiers, 'Demurrage')
    if (!demurrageValidation.valid) {
      toast.error(`Invalid tier configuration: ${demurrageValidation.errors.join(', ')}`)
      return
    }

    setSavingDefaults(true)
    try {
      await saveCarrierDefaults(
        formData.carrier,
        profile.organization_id,
        formData.demurrage_tiers,
        formData.detention_tiers
      )
      toast.success(`Carrier defaults updated for ${formData.carrier}`)
    } catch (error) {
      logger.error('Error saving carrier defaults:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save carrier defaults')
    } finally {
      setSavingDefaults(false)
    }
  }

  const handleSaveDetentionDefaults = async () => {
    if (!formData.carrier || !profile?.organization_id) {
      toast.error('Carrier and organization information required')
      return
    }

    // Validate tier configurations before saving
    const detentionValidation = validateTierConfiguration(formData.detention_tiers, 'Detention')
    if (!detentionValidation.valid) {
      toast.error(`Invalid tier configuration: ${detentionValidation.errors.join(', ')}`)
      return
    }

    setSavingDefaults(true)
    try {
      await saveCarrierDefaults(
        formData.carrier,
        profile.organization_id,
        formData.demurrage_tiers,
        formData.detention_tiers
      )
      toast.success(`Carrier defaults updated for ${formData.carrier}`)
    } catch (error) {
      logger.error('Error saving carrier defaults:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save carrier defaults')
    } finally {
      setSavingDefaults(false)
    }
  }

  const handleTierChange = (field: 'demurrage_tiers' | 'detention_tiers', tiers: Tier[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: tiers
    }))
    // Clear validation error for this field when user makes changes
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[field]
      return newErrors
    })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.container_no?.trim()) {
      errors.container_no = 'Container number is required'
    }

    // pol and pod are optional, no validation needed

    if (!formData.arrival_date) {
      errors.arrival_date = 'Arrival date is required'
    }

    // Validate tier configurations
    const demurrageValidation = validateTierConfiguration(formData.demurrage_tiers, 'Demurrage')
    if (!demurrageValidation.valid) {
      errors.demurrage_tiers = demurrageValidation.errors.join(', ')
    }

    const detentionValidation = validateTierConfiguration(formData.detention_tiers, 'Detention')
    if (!detentionValidation.valid) {
      errors.detention_tiers = detentionValidation.errors.join(', ')
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const resetForm = () => {
    setFormData({
      container_no: '',
      bl_number: '',
      pol: '',
      pod: '',
      arrival_date: '',
      free_days: 7,
      carrier: null,
      container_size: null,
      assigned_to: '',
      milestone: DEFAULT_MILESTONE,
      demurrage_enabled: false,
      demurrage_flat_rate: 0,
      demurrage_tiers: [],
      detention_enabled: false,
      detention_flat_rate: 0,
      detention_tiers: [],
      gate_out_date: '',
      empty_return_date: '',
      notes: ''
    })
    setCarrierDefaultsLoaded(false)
    setValidationErrors({})
  }

  const handleSave = async () => {
    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the validation errors before saving')
      return
    }

    setIsSubmitting(true)
    try {
      // Call parent's onSave callback to handle insertion
      if (onSave) {
        await onSave(formData)
      } else {
        toast.error('Missing onSave handler — cannot save container')
        return
      }
      
      // Reset form
      resetForm()
      
      // Auto-close modal with slight delay
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      logger.error('Error saving container:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add container')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          // Reset form when dialog is closed
          resetForm()
          onClose()
        }
      }}
    >
      <DialogContent 
        aria-describedby="add-container-dialog-description"
        className="!max-w-[85vw] !w-[1200px] !h-[500px] !max-h-[500px] overflow-y-auto p-0 rounded-md"
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-[#E5E7EB] bg-white">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-[#111827]">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#2563EB]/10">
              <Package className="h-4 w-4 text-[#2563EB]" />
            </div>
            Add New Container
          </DialogTitle>
          <DialogDescription id="add-container-dialog-description" className="text-xs text-[#6B7280] mt-1.5">
            Fill in the details below to create a new container record. Only the container number and arrival date are required.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4 bg-[#F9FAFB]">
          {/* 1️⃣ Basic Information */}
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-sm p-4">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-1">
                <Info className="h-3.5 w-3.5 text-[#2563EB]" />
                Basic Information
              </h3>
              <p className="text-xs text-[#6B7280] ml-5.5">Essential container details</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="container_no" className="text-xs font-medium text-[#111827]">
                    Container Number <span className="text-[#DC2626]">*</span>
                  </Label>
                  <Input
                    id="container_no"
                    value={formData.container_no}
                    onChange={(e) => {
                      handleInputChange('container_no', e.target.value)
                      // Clear validation error when user types
                      if (validationErrors.container_no) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.container_no
                          return newErrors
                        })
                      }
                    }}
                    placeholder="e.g., ABCD1234567"
                    className={`h-8 rounded border text-xs ${validationErrors.container_no ? 'border-[#DC2626]' : 'border-[#D4D7DE] focus:border-[#2563EB] focus:ring-0'}`}
                  />
                  {validationErrors.container_no && (
                    <p className="text-xs text-[#DC2626] mt-1">{validationErrors.container_no}</p>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="bl_number" className="text-xs font-medium text-[#111827]">
                    B/L Number
                  </Label>
                  <Input
                    id="bl_number"
                    value={formData.bl_number}
                    onChange={(e) => handleInputChange('bl_number', e.target.value)}
                    placeholder="Enter B/L number"
                    className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="pol" className="text-xs font-medium text-[#111827]">
                      POL
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-[#6B7280] cursor-help hover:text-[#111827]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Port of Loading – where the container is shipped from.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="pol"
                    value={formData.pol}
                    onChange={(e) => handleInputChange('pol', e.target.value)}
                    placeholder="Enter POL"
                    aria-label="Port of Loading"
                    title="Port of Loading – where the container is shipped from."
                    className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="pod" className="text-xs font-medium text-[#111827]">
                      POD
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-[#6B7280] cursor-help hover:text-[#111827]" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Port of Discharge – where the container arrives.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="pod"
                    value={formData.pod}
                    onChange={(e) => handleInputChange('pod', e.target.value)}
                    placeholder="Enter POD"
                    aria-label="Port of Discharge"
                    title="Port of Discharge – where the container arrives."
                    className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="milestone" className="text-xs font-medium text-[#111827]">
                    Milestone
                  </Label>
                  <Select
                    value={formData.milestone}
                    onValueChange={(value) =>
                      handleInputChange('milestone', isValidMilestone(value) ? value : DEFAULT_MILESTONE)
                    }
                  >
                    <SelectTrigger id="milestone" className="w-full h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {CONTAINER_MILESTONES.map((milestone) => (
                        <SelectItem key={milestone} value={milestone}>
                          {milestone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
 
                <div className="space-y-1.5">
                  <Label htmlFor="arrival_date" className="text-xs font-medium text-[#111827]">
                    Arrival Date <span className="text-[#DC2626]">*</span>
                  </Label>
                  <Input
                    id="arrival_date"
                    type="date"
                    value={formData.arrival_date}
                    onChange={(e) => {
                      handleInputChange('arrival_date', e.target.value)
                      // Clear validation error when user types
                      if (validationErrors.arrival_date) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.arrival_date
                          return newErrors
                        })
                      }
                    }}
                    className={`h-8 rounded border text-xs ${validationErrors.arrival_date ? 'border-[#DC2626]' : 'border-[#D4D7DE] focus:border-[#2563EB] focus:ring-0'}`}
                  />
                  {validationErrors.arrival_date && (
                    <p className="text-xs text-[#DC2626] mt-1">{validationErrors.arrival_date}</p>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="free_days" className="text-xs font-medium text-[#111827]">
                    Free Days
                  </Label>
                  <Input
                    id="free_days"
                    type="number"
                    value={formData.free_days}
                    onChange={(e) => handleInputChange('free_days', parseInt(e.target.value) || 7)}
                    min="1"
                    className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="carrier" className="text-xs font-medium text-[#111827]">
                    Carrier
                  </Label>
                  <Select
                    value={formData.carrier || ''}
                    onValueChange={async (carrier) => {
                      setFormData(prev => ({ ...prev, carrier }))
                      await loadCarrierDefaults(carrier)
                    }}
                  >
                    <SelectTrigger id="carrier" className="w-full h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0">
                      <SelectValue placeholder="Select a carrier" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      {CARRIER_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="container_size" className="text-xs font-medium text-[#111827]">
                    Container Size
                  </Label>
                  <Select
                    value={formData.container_size || ''}
                    onValueChange={(value) => handleInputChange('container_size', value)}
                  >
                    <SelectTrigger id="container_size" className="w-full h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                      <SelectItem value="20ft">20ft</SelectItem>
                      <SelectItem value="40ft">40ft</SelectItem>
                      <SelectItem value="45ft">45ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="assigned_to" className="text-xs font-medium text-[#111827]">
                    Assigned To
                  </Label>
                  <Input
                    id="assigned_to"
                    type="text"
                    placeholder="Person or email"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                    className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                  />
                </div>
              </div>
            </div>

          {/* 2️⃣ Demurrage Tracking */}
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-sm p-4">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-1">
                <DollarSign className="h-3.5 w-3.5 text-[#2563EB]" />
                Demurrage Tracking
              </h3>
              <p className="text-xs text-[#6B7280] ml-5.5">Optional: Configure demurrage charges</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5E7EB]">
                <input
                  type="checkbox"
                  id="demurrage_enabled"
                  checked={formData.demurrage_enabled}
                  onChange={(e) => handleInputChange('demurrage_enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4D7DE] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 cursor-pointer"
                />
                <Label htmlFor="demurrage_enabled" className="text-xs font-medium cursor-pointer text-[#111827]">
                  Enable demurrage tracking
                </Label>
              </div>
              
              {formData.demurrage_enabled && (
                <div className="space-y-4 pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="demurrage_flat_rate" className="text-xs font-medium text-[#111827]">
                      Flat Rate (per day)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-xs font-medium">£</span>
                      <Input
                        id="demurrage_flat_rate"
                        type="number"
                        value={formData.demurrage_flat_rate}
                        onChange={(e) => handleInputChange('demurrage_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="pl-8 h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {/* Carrier Defaults Info Banner */}
                  {carrierDefaultsLoaded && (
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-md p-2.5 flex items-center gap-2">
                      <Info className="h-3.5 w-3.5 text-[#2563EB] shrink-0" />
                      <span className="text-xs text-[#1E40AF]">
                        Loaded tier defaults for {formData.carrier}
                      </span>
                    </div>
                  )}

                  {/* Loading indicator for carrier defaults */}
                  {loadingDefaults && (
                    <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-md p-2.5 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B7280] shrink-0" />
                      <span className="text-xs text-[#6B7280]">
                        Loading defaults for {formData.carrier}...
                      </span>
                    </div>
                  )}

                  <DemurrageTierEditor 
                    tiers={formData.demurrage_tiers}
                    onTiersChange={(tiers) => handleTierChange('demurrage_tiers', tiers)}
                    onSaveDefault={handleSaveDemurrageDefaults}
                    carrier={formData.carrier}
                    savingDefaults={savingDefaults}
                  />
                  
                  {/* Quick-save button for both tiers */}
                  {formData.carrier && (
                    <div className="pt-2 border-t border-[#E5E7EB]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!profile?.organization_id || !formData.carrier) return
                          
                          // Validate both tier configurations
                          const demurrageValidation = validateTierConfiguration(formData.demurrage_tiers, 'Demurrage')
                          const detentionValidation = validateTierConfiguration(formData.detention_tiers, 'Detention')
                          
                          if (!demurrageValidation.valid || !detentionValidation.valid) {
                            const errors = [
                              ...(demurrageValidation.valid ? [] : demurrageValidation.errors),
                              ...(detentionValidation.valid ? [] : detentionValidation.errors)
                            ]
                            toast.error(`Invalid tier configuration: ${errors.join(', ')}`)
                            return
                          }
                          
                          setSavingDefaults(true)
                          try {
                            await saveCarrierDefaults(
                              formData.carrier,
                              profile.organization_id,
                              formData.demurrage_tiers,
                              formData.detention_tiers
                            )
                            toast.success(`Saved ${formData.carrier} as default`)
                          } catch (err) {
                            toast.error('Failed to save default')
                            logger.error('Error saving defaults:', err)
                          } finally {
                            setSavingDefaults(false)
                          }
                        }}
                        disabled={savingDefaults || !formData.carrier}
                        className="w-full sm:w-auto"
                      >
                        {savingDefaults ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <span className="mr-2">💾</span>
                            Save as Default
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3️⃣ Detention Tracking */}
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-sm p-4">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-1">
                <Clock className="h-3.5 w-3.5 text-[#2563EB]" />
                Detention Tracking
              </h3>
              <p className="text-xs text-[#6B7280] ml-5.5">Optional: Configure detention charges</p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E5E7EB]">
                <input
                  type="checkbox"
                  id="detention_enabled"
                  checked={formData.detention_enabled}
                  onChange={(e) => handleInputChange('detention_enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-[#D4D7DE] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 cursor-pointer"
                />
                <Label htmlFor="detention_enabled" className="text-xs font-medium cursor-pointer text-[#111827]">
                  Enable detention tracking
                </Label>
              </div>
              
              {formData.detention_enabled && (
                <div className="space-y-4 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="gate_out_date" className="text-xs font-medium text-[#111827]">
                        Gate-Out Date
                      </Label>
                      <Input
                        id="gate_out_date"
                        type="date"
                        value={formData.gate_out_date}
                        onChange={(e) => handleInputChange('gate_out_date', e.target.value)}
                        className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="empty_return_date" className="text-xs font-medium text-[#111827]">
                        Empty Return Date
                      </Label>
                      <Input
                        id="empty_return_date"
                        type="date"
                        value={formData.empty_return_date}
                        onChange={(e) => handleInputChange('empty_return_date', e.target.value)}
                        className="h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <Label htmlFor="detention_flat_rate" className="text-xs font-medium text-[#111827]">
                      Flat Rate (per day)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-xs font-medium">£</span>
                      <Input
                        id="detention_flat_rate"
                        type="number"
                        value={formData.detention_flat_rate}
                        onChange={(e) => handleInputChange('detention_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="pl-8 h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <DetentionTierEditor
                    tiers={formData.detention_tiers}
                    onTiersChange={(tiers) => handleTierChange('detention_tiers', tiers)}
                    onSaveDefault={handleSaveDetentionDefaults}
                    carrier={formData.carrier}
                    savingDefaults={savingDefaults}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4️⃣ Additional Notes */}
          <div className="bg-white rounded-md border border-[#E5E7EB] shadow-sm p-4">
            <div className="mb-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827] mb-1">
                <FileText className="h-3.5 w-3.5 text-[#2563EB]" />
                Additional Notes
              </h3>
              <p className="text-xs text-[#6B7280] ml-5.5">Any additional information about this container</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-medium text-[#111827]">
                Notes
              </Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={4}
                className="w-full border border-[#D4D7DE] rounded-md px-3 py-2 bg-white text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 text-xs"
                placeholder="Additional notes about this container..."
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-[#E5E7EB] bg-white">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="min-w-[100px] h-8 text-xs border-[#D4D7DE] hover:bg-[#F3F4F6]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !formData.container_no || !formData.arrival_date}
              className="min-w-[120px] h-8 text-xs bg-[#2563EB] hover:bg-[#1D4ED8] font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Container'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
