'use client'

import { useState, useEffect, useRef } from 'react'
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
import { getCarrierDefaults, getAllCarrierDefaults } from '@/lib/data/carrier-actions'
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
import { deriveLfdFromFreeDays, deriveFreeDaysFromLfd } from '@/lib/utils/containers'

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

export interface ContainerFormData {
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
  
  // Calendar Settings
  weekend_chargeable?: boolean
  
  // LFD Input Mode
  lfd_input_mode: 'FREE_DAYS' | 'LFD'
  lfd_date: string
  
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
    weekend_chargeable: true,
    lfd_input_mode: 'FREE_DAYS',
    lfd_date: '',
    notes: ''
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [carrierDefaultsLoaded, setCarrierDefaultsLoaded] = useState(false)
  const [loadingDefaults, setLoadingDefaults] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [availableCarriers, setAvailableCarriers] = useState<string[]>([])
  const [loadingCarriers, setLoadingCarriers] = useState(true)
  const [autoFillWarning, setAutoFillWarning] = useState<string | null>(null)
  const [detentionAutoFillInfo, setDetentionAutoFillInfo] = useState<string | null>(null)
  // Local state for free_days input to allow clearing/typing
  const [freeDaysInput, setFreeDaysInput] = useState<string>('7')
  // Ref to track if free_days change came from user input (to prevent sync loop)
  const freeDaysInputRef = useRef(false)
  // Local states for flat rate inputs to allow clearing/typing
  const [demurrageFlatRateInput, setDemurrageFlatRateInput] = useState<string>('0')
  const [detentionFlatRateInput, setDetentionFlatRateInput] = useState<string>('0')

  // Sync freeDaysInput with formData.free_days when it changes from external sources
  // (like carrier defaults or form reset), but not when user is typing
  useEffect(() => {
    if (!freeDaysInputRef.current) {
      setFreeDaysInput(String(formData.free_days))
    }
    freeDaysInputRef.current = false
  }, [formData.free_days])

  // Sync flat rate inputs with formData when it changes from external sources
  useEffect(() => {
    setDemurrageFlatRateInput(String(formData.demurrage_flat_rate))
  }, [formData.demurrage_flat_rate])

  useEffect(() => {
    setDetentionFlatRateInput(String(formData.detention_flat_rate))
  }, [formData.detention_flat_rate])

  // Load available carriers from templates when form opens
  useEffect(() => {
    if (isOpen) {
      const loadCarriers = async () => {
        try {
          setLoadingCarriers(true)
          const defaults = await getAllCarrierDefaults()
          const carrierNames = defaults
            .map(cd => cd.carrier_name)
            .filter(name => name && name.trim().length > 0)
            .sort()
          setAvailableCarriers(carrierNames)
        } catch (error) {
          logger.error('Failed to load carriers:', error)
          // Fallback to empty list
          setAvailableCarriers([])
          // If a carrier was selected, show warning
          if (formData.carrier) {
            setAutoFillWarning('Carrier templates could not be loaded. Please review fees manually.')
          }
        } finally {
          setLoadingCarriers(false)
        }
      }
      loadCarriers()
    }
  }, [isOpen])

  // Retry auto-fill when carriers finish loading if a carrier was already selected
  useEffect(() => {
    if (!loadingCarriers && formData.carrier && availableCarriers.length > 0) {
      const carrierTrimmed = formData.carrier.trim()
      if (availableCarriers.includes(carrierTrimmed)) {
        // Carrier exists, retry auto-fill (only if not already loaded)
        if (!carrierDefaultsLoaded) {
          void loadCarrierDefaults(carrierTrimmed)
        }
      } else if (availableCarriers.length > 0) {
        // Carrier not found in templates
        setAutoFillWarning(`Carrier "${carrierTrimmed}" not found in templates. Please review fees manually.`)
      }
    }
  }, [loadingCarriers, formData.carrier, availableCarriers])

  const handleInputChange = <K extends keyof ContainerFormData>(field: K, value: ContainerFormData[K]) => {
    const previousData = formData
    
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))

    // Clear auto-fill warnings when user manually edits fee-related fields
    if (field === 'free_days' || field === 'demurrage_tiers' || field === 'demurrage_flat_rate' || 
        field === 'detention_tiers' || field === 'detention_flat_rate') {
      setAutoFillWarning(null)
      setDetentionAutoFillInfo(null)
    }

    if (field === 'carrier') {
      const carrierValue = typeof value === 'string' ? value.trim() : ''
      // Clear previous warnings when selecting a new carrier
      setAutoFillWarning(null)
      setDetentionAutoFillInfo(null)
      if (carrierValue) {
        void loadCarrierDefaults(carrierValue)
      }
    }
    
    // Auto-fill detention defaults when detention is enabled and carrier is selected
    if (field === 'detention_enabled' && value === true && previousData.carrier) {
      setDetentionAutoFillInfo(null) // Clear previous info
      void loadDetentionDefaults(previousData.carrier)
    }
  }

  const loadCarrierDefaults = async (carrier: string) => {
    if (!carrier.trim()) return

    setLoadingDefaults(true)
    setCarrierDefaultsLoaded(false)
    setAutoFillWarning(null)
    
    try {
      // Check if carriers are still loading
      if (loadingCarriers) {
        setAutoFillWarning('Carrier templates are still loading. Please wait a moment and try again.')
        return
      }
      
      // Check if carrier exists in available carriers
      const carrierTrimmed = carrier.trim()
      if (availableCarriers.length > 0 && !availableCarriers.includes(carrierTrimmed)) {
        setAutoFillWarning(`Carrier "${carrierTrimmed}" not found in templates. Please review fees manually.`)
        return
      }
      
      const defaults = await getCarrierDefaults(carrierTrimmed)
      
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
        
        // Auto-fill demurrage fields from template (always overwrite)
        setFormData(prev => ({
          ...prev,
          // Free days (demurrage)
          free_days: defaults.demurrage_free_days ?? prev.free_days,
          // Demurrage
          demurrage_tiers: normalizedDemurrageTiers,
          demurrage_flat_rate: defaults.demurrage_flat_rate ?? 0,
          demurrage_enabled: normalizedDemurrageTiers.length > 0 || (defaults.demurrage_flat_rate ?? 0) > 0,
          // Note: detention fields NOT auto-filled here - only when detention_enabled is toggled ON
        }))
        setCarrierDefaultsLoaded(true)
        // Success - no warning needed
      } else {
        // Carrier template doesn't exist
        setAutoFillWarning(`No template found for "${carrierTrimmed}". Please configure fees manually.`)
      }
    } catch (error) {
      logger.error('Error loading carrier defaults:', error)
      setAutoFillWarning('Carrier defaults could not be applied. Please review fees manually.')
    } finally {
      setLoadingDefaults(false)
    }
  }

  const loadDetentionDefaults = async (carrier: string) => {
    if (!carrier.trim()) return

    setDetentionAutoFillInfo(null)
    
    try {
      const defaults = await getCarrierDefaults(carrier.trim())
      
      if (defaults) {
        const hasDetentionDefaults = (defaults.detention_tiers && defaults.detention_tiers.length > 0) || 
                                     (defaults.detention_flat_rate && defaults.detention_flat_rate > 0)
        
        if (hasDetentionDefaults) {
          // Normalize tier keys for UI compatibility (from/to → from_day/to_day)
          const normalizedDetentionTiers = (defaults.detention_tiers || []).map((t: { from?: number; from_day?: number; to?: number | null; to_day?: number | null; rate?: number }) => ({
            from_day: t.from ?? t.from_day ?? 1,
            to_day: t.to ?? t.to_day ?? null,
            rate: t.rate ?? 0,
          }))
          
          // Auto-fill detention fields from template (only if detention is enabled)
          setFormData(prev => ({
            ...prev,
            // Detention
            detention_tiers: normalizedDetentionTiers,
            detention_flat_rate: defaults.detention_flat_rate ?? 0,
            // Note: detention_free_days is not in form data structure, but detention calculations use container-level field
          }))
          // Success - no info needed
        } else {
          // Carrier exists but has no detention defaults
          setDetentionAutoFillInfo('This carrier has no saved detention defaults.')
        }
      } else {
        // Carrier template doesn't exist
        setDetentionAutoFillInfo('Carrier template not found. Please configure detention fees manually.')
      }
    } catch (error) {
      logger.error('Error loading detention defaults:', error)
      setDetentionAutoFillInfo('Detention defaults could not be loaded. Please configure manually.')
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

    // Validate LFD input mode specific fields
    if (formData.lfd_input_mode === 'LFD') {
      if (!formData.lfd_date || formData.lfd_date.trim() === '') {
        errors.lfd_date = 'Last Free Day (LFD) is required when using LFD input mode'
      } else if (formData.arrival_date) {
        const arrival = new Date(formData.arrival_date)
        const lfd = new Date(formData.lfd_date)
        if (!isNaN(arrival.getTime()) && !isNaN(lfd.getTime())) {
          if (lfd < arrival) {
            errors.lfd_date = 'Last Free Day cannot be before arrival date'
          } else {
            // Validate derived free days are within sane bounds
            const derivedFreeDays = deriveFreeDaysFromLfd(
              formData.arrival_date,
              formData.lfd_date,
              formData.weekend_chargeable ?? true
            )
            if (derivedFreeDays === null) {
              errors.lfd_date = 'Invalid date combination'
            } else if (derivedFreeDays < 0) {
              errors.lfd_date = 'LFD must be after arrival date'
            } else if (derivedFreeDays > 365) {
              errors.lfd_date = 'Derived free days exceeds maximum (365 days)'
            }
          }
        }
      }
    } else {
      // Validate free_days in FREE_DAYS mode
      if (!Number.isInteger(formData.free_days) || formData.free_days < 0 || formData.free_days > 365) {
        errors.free_days = 'Free days must be an integer between 0 and 365'
      }
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
      weekend_chargeable: true,
      lfd_input_mode: 'FREE_DAYS',
      lfd_date: '',
      notes: ''
    })
    setFreeDaysInput('7')
    setDemurrageFlatRateInput('0')
    setDetentionFlatRateInput('0')
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
      // Derive free_days if in LFD mode
      let finalFormData = { ...formData }
      if (formData.lfd_input_mode === 'LFD' && formData.arrival_date && formData.lfd_date) {
        const derivedFreeDays = deriveFreeDaysFromLfd(
          formData.arrival_date,
          formData.lfd_date,
          formData.weekend_chargeable ?? true
        )
        if (derivedFreeDays === null || derivedFreeDays < 0 || derivedFreeDays > 365) {
          toast.error('Invalid LFD date. Please check your input.')
          setIsSubmitting(false)
          return
        }
        finalFormData = {
          ...formData,
          free_days: derivedFreeDays
        }
      }
      
      // Call parent's onSave callback to handle insertion
      if (onSave) {
        await onSave(finalFormData)
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
                
                {/* Free Time Subsection */}
                <div className="md:col-span-3 space-y-4 pt-2 border-t border-[#E5E7EB]">
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-[#111827] mb-0.5">Free Time</h4>
                    <p className="text-xs text-[#6B7280]">Set free time using Free Days or Last Free Day (LFD)</p>
                  </div>
                  
                  {/* Row 1: Input Method Dropdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="lfd_input_mode" className="text-xs font-medium text-[#111827]">
                        Set free time by
                      </Label>
                      <Select
                        value={formData.lfd_input_mode}
                        onValueChange={(value) => {
                          if (value === 'FREE_DAYS' || value === 'LFD') {
                            handleInputChange('lfd_input_mode', value)
                          }
                        }}
                      >
                        <SelectTrigger id="lfd_input_mode" className="w-full h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="FREE_DAYS">Free days</SelectItem>
                          <SelectItem value="LFD">Last free day (LFD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 1: Weekend Checkbox (right side on desktop) */}
                    <div className="space-y-1.5">
                      <Label htmlFor="weekend_chargeable" className="text-xs font-medium text-[#111827]">
                        Count weekends
                      </Label>
                      <div className="flex items-center space-x-2.5 pt-1">
                        <input
                          type="checkbox"
                          id="weekend_chargeable"
                          checked={formData.weekend_chargeable ?? true}
                          onChange={(e) => handleInputChange('weekend_chargeable', e.target.checked)}
                          className="h-4 w-4 rounded border-[#D4D7DE] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1 cursor-pointer"
                        />
                        <Label htmlFor="weekend_chargeable" className="text-xs font-medium cursor-pointer text-[#111827]">
                          Count weekends
                        </Label>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">If unchecked, weekends don't reduce free time.</p>
                    </div>
                  </div>

                  {/* Row 2: Dependent Input (Free Days or LFD) */}
                  {formData.lfd_input_mode === 'FREE_DAYS' ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="free_days" className="text-xs font-medium text-[#111827]">
                        Free Days <span className="text-[#DC2626]">*</span>
                      </Label>
                      <Input
                        id="free_days"
                        type="number"
                        value={freeDaysInput}
                        onChange={(e) => {
                          const value = e.target.value
                          // Mark that this change came from user input
                          freeDaysInputRef.current = true
                          // Update local input state to allow clearing
                          setFreeDaysInput(value)
                          // Update form data if value is valid
                          if (value !== '') {
                            const numValue = parseInt(value, 10)
                            if (!isNaN(numValue) && numValue >= 0 && numValue <= 365) {
                              handleInputChange('free_days', numValue)
                            }
                          }
                        }}
                        onBlur={(e) => {
                          // Apply default value of 7 if field is empty or invalid on blur
                          const value = e.target.value
                          const numValue = parseInt(value, 10)
                          if (value === '' || isNaN(numValue) || numValue < 1) {
                            setFreeDaysInput('7')
                            handleInputChange('free_days', 7)
                          } else {
                            // Sync display value with form data
                            setFreeDaysInput(String(formData.free_days))
                          }
                        }}
                        min="0"
                        max="365"
                        className={`h-8 rounded border text-xs ${
                          validationErrors.free_days
                            ? 'border-[#DC2626]'
                            : 'border-[#D4D7DE] focus:border-[#2563EB] focus:ring-0'
                        }`}
                      />
                      {validationErrors.free_days && (
                        <p className="text-xs text-[#DC2626] mt-1">{validationErrors.free_days}</p>
                      )}
                      {/* Preview LFD */}
                      {formData.arrival_date && (
                        <p className="text-xs text-[#6B7280] mt-1">
                          Preview LFD: {(() => {
                            const lfd = deriveLfdFromFreeDays(
                              formData.arrival_date,
                              formData.free_days,
                              formData.weekend_chargeable ?? true
                            )
                            if (!lfd) return '—'
                            return lfd.toLocaleDateString('en-GB', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          })()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="lfd_date" className="text-xs font-medium text-[#111827]">
                        Last Free Day (LFD) <span className="text-[#DC2626]">*</span>
                      </Label>
                      <Input
                        id="lfd_date"
                        type="date"
                        value={formData.lfd_date}
                        onChange={(e) => {
                          handleInputChange('lfd_date', e.target.value)
                          if (validationErrors.lfd_date) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev }
                              delete newErrors.lfd_date
                              return newErrors
                            })
                          }
                        }}
                        className={`h-8 rounded border text-xs ${
                          validationErrors.lfd_date
                            ? 'border-[#DC2626]'
                            : 'border-[#D4D7DE] focus:border-[#2563EB] focus:ring-0'
                        }`}
                      />
                      {validationErrors.lfd_date && (
                        <p className="text-xs text-[#DC2626] mt-1">{validationErrors.lfd_date}</p>
                      )}
                      {/* Preview Derived Free Days */}
                      {formData.arrival_date && formData.lfd_date && (
                        <p className="text-xs text-[#6B7280] mt-1">
                          Preview Free Days: {(() => {
                            const derived = deriveFreeDaysFromLfd(
                              formData.arrival_date,
                              formData.lfd_date,
                              formData.weekend_chargeable ?? true
                            )
                            return derived !== null ? `${derived}` : '—'
                          })()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="carrier" className="text-xs font-medium text-[#111827]">
                    Carrier
                  </Label>
                  <Select
                    value={formData.carrier || ''}
                    onValueChange={async (carrier) => {
                      // Always overwrite - no confirmation
                      // Clear previous warnings when selecting a new carrier
                      setAutoFillWarning(null)
                      setDetentionAutoFillInfo(null)
                      setFormData(prev => ({ ...prev, carrier }))
                      await loadCarrierDefaults(carrier)
                    }}
                    disabled={loadingCarriers || availableCarriers.length === 0}
                  >
                    <SelectTrigger id="carrier" className="w-full h-8 rounded border border-[#D4D7DE] text-xs focus:border-[#2563EB] focus:ring-0">
                      <SelectValue placeholder={loadingCarriers ? "Loading carriers..." : "Select a carrier"} />
                    </SelectTrigger>
                    {availableCarriers.length > 0 && (
                      <SelectContent className="text-xs">
                        {availableCarriers
                          .filter(name => name && name.trim().length > 0)
                          .map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    )}
                  </Select>
                  {!loadingCarriers && availableCarriers.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No carriers configured. Add templates in Settings.
                    </p>
                  )}
                  {autoFillWarning && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <span className="text-amber-500">⚠</span>
                      {autoFillWarning}
                    </p>
                  )}
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
                        value={demurrageFlatRateInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setDemurrageFlatRateInput(value)
                          if (value !== '') {
                            const numValue = parseFloat(value)
                            if (!isNaN(numValue) && numValue >= 0) {
                              handleInputChange('demurrage_flat_rate', numValue)
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value
                          const numValue = parseFloat(value)
                          if (value === '' || isNaN(numValue) || numValue < 0) {
                            setDemurrageFlatRateInput('0')
                            handleInputChange('demurrage_flat_rate', 0)
                          } else {
                            setDemurrageFlatRateInput(String(formData.demurrage_flat_rate))
                          }
                        }}
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
                    carrier={formData.carrier ?? undefined}
                  />
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
              {detentionAutoFillInfo && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <span className="text-amber-500">ℹ</span>
                  {detentionAutoFillInfo}
                </p>
              )}
              
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
                        value={detentionFlatRateInput}
                        onChange={(e) => {
                          const value = e.target.value
                          setDetentionFlatRateInput(value)
                          if (value !== '') {
                            const numValue = parseFloat(value)
                            if (!isNaN(numValue) && numValue >= 0) {
                              handleInputChange('detention_flat_rate', numValue)
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const value = e.target.value
                          const numValue = parseFloat(value)
                          if (value === '' || isNaN(numValue) || numValue < 0) {
                            setDetentionFlatRateInput('0')
                            handleInputChange('detention_flat_rate', 0)
                          } else {
                            setDetentionFlatRateInput(String(formData.detention_flat_rate))
                          }
                        }}
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
                    carrier={formData.carrier ?? undefined}
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
