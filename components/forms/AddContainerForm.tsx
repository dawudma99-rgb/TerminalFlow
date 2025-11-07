'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { DemurrageTierEditor } from './DemurrageTierEditor'
import { DetentionTierEditor } from './DetentionTierEditor'
import { Tier, validateTierConfiguration } from '@/lib/tierUtils'
import { getCarrierDefaults, saveCarrierDefaults } from '@/lib/data/carrier-actions'
import { useAuth } from '@/lib/auth/useAuth'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

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
  port: string
  arrival_date: string
  free_days: number
  carrier: string
  container_size: string
  assigned_to: string
  
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
    port: '',
    arrival_date: '',
    free_days: 7,
    carrier: '',
    container_size: '',
    assigned_to: '',
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

  const handleInputChange = (field: keyof ContainerFormData, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // If carrier changed, try to load defaults
    if (field === 'carrier' && typeof value === 'string' && value.trim() && profile?.organization_id) {
      loadCarrierDefaults(value.trim())
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
        setFormData(prev => ({
          ...prev,
          demurrage_tiers: normalizedDemurrageTiers,
          detention_tiers: normalizedDetentionTiers,
          demurrage_enabled: normalizedDemurrageTiers.length > 0,
          detention_enabled: normalizedDetentionTiers.length > 0
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
            detention_enabled: true
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

    if (!formData.port?.trim()) {
      errors.port = 'Port is required'
    }

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
      port: '',
      arrival_date: '',
      free_days: 7,
      carrier: '',
      container_size: '',
      assigned_to: '',
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-2xl font-semibold">
            <Package className="h-6 w-6 text-primary" />
            Add New Container
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6">
          {/* 1️⃣ Basic Information */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Info className="h-4 w-4 text-muted-foreground" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="container_no" className="text-sm font-medium">
                    Container Number *
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
                    className={validationErrors.container_no ? 'border-destructive' : ''}
                  />
                  {validationErrors.container_no && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.container_no}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="port" className="text-sm font-medium">
                    Port *
                  </Label>
                  <Input
                    id="port"
                    value={formData.port}
                    onChange={(e) => {
                      handleInputChange('port', e.target.value)
                      // Clear validation error when user types
                      if (validationErrors.port) {
                        setValidationErrors(prev => {
                          const newErrors = { ...prev }
                          delete newErrors.port
                          return newErrors
                        })
                      }
                    }}
                    placeholder="e.g., Los Angeles"
                    className={validationErrors.port ? 'border-destructive' : ''}
                  />
                  {validationErrors.port && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.port}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="arrival_date" className="text-sm font-medium">
                    Arrival Date *
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
                    className={validationErrors.arrival_date ? 'border-destructive' : ''}
                  />
                  {validationErrors.arrival_date && (
                    <p className="text-sm text-destructive mt-1">{validationErrors.arrival_date}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="free_days" className="text-sm font-medium">
                    Free Days
                  </Label>
                  <Input
                    id="free_days"
                    type="number"
                    value={formData.free_days}
                    onChange={(e) => handleInputChange('free_days', parseInt(e.target.value) || 7)}
                    min="1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="carrier" className="text-sm font-medium">
                    Carrier
                  </Label>
                  <Select
                    value={formData.carrier}
                    onValueChange={async (carrier) => {
                      setFormData(prev => ({ ...prev, carrier }))
                      await loadCarrierDefaults(carrier)
                    }}
                  >
                    <SelectTrigger id="carrier" className="w-full">
                      <SelectValue placeholder="Select a carrier" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARRIER_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="container_size" className="text-sm font-medium">
                    Container Size
                  </Label>
                  <Select
                    value={formData.container_size}
                    onValueChange={(value) => handleInputChange('container_size', value)}
                  >
                    <SelectTrigger id="container_size" className="w-full">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20ft">20ft</SelectItem>
                      <SelectItem value="40ft">40ft</SelectItem>
                      <SelectItem value="45ft">45ft</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assigned_to" className="text-sm font-medium">
                    Assigned To
                  </Label>
                  <Input
                    id="assigned_to"
                    type="text"
                    placeholder="Person or email"
                    value={formData.assigned_to}
                    onChange={(e) => handleInputChange('assigned_to', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2️⃣ Demurrage Tracking */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Demurrage Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="demurrage_enabled"
                  checked={formData.demurrage_enabled}
                  onChange={(e) => handleInputChange('demurrage_enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <Label htmlFor="demurrage_enabled" className="text-sm font-medium cursor-pointer">
                  Enable demurrage tracking
                </Label>
              </div>
              
              {formData.demurrage_enabled && (
                <div className="space-y-5 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="demurrage_flat_rate" className="text-sm font-medium">
                      Flat Rate (per day)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                      <Input
                        id="demurrage_flat_rate"
                        type="number"
                        value={formData.demurrage_flat_rate}
                        onChange={(e) => handleInputChange('demurrage_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {/* Carrier Defaults Info Banner */}
                  {carrierDefaultsLoaded && (
                    <div className="bg-blue-50/50 border border-blue-200 rounded-md p-3 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="text-sm text-blue-700">
                        Loaded tier defaults for {formData.carrier}
                      </span>
                    </div>
                  )}

                  {/* Loading indicator for carrier defaults */}
                  {loadingDefaults && (
                    <div className="bg-muted/50 border border-border rounded-md p-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">
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
                    <div className="pt-2 border-t">
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
            </CardContent>
          </Card>

          {/* 3️⃣ Detention Tracking */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Detention Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="detention_enabled"
                  checked={formData.detention_enabled}
                  onChange={(e) => handleInputChange('detention_enabled', e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
                />
                <Label htmlFor="detention_enabled" className="text-sm font-medium cursor-pointer">
                  Enable detention tracking
                </Label>
              </div>
              
              {formData.detention_enabled && (
                <div className="space-y-5 pt-2 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="gate_out_date" className="text-sm font-medium">
                        Gate-Out Date
                      </Label>
                      <Input
                        id="gate_out_date"
                        type="date"
                        value={formData.gate_out_date}
                        onChange={(e) => handleInputChange('gate_out_date', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="empty_return_date" className="text-sm font-medium">
                        Empty Return Date
                      </Label>
                      <Input
                        id="empty_return_date"
                        type="date"
                        value={formData.empty_return_date}
                        onChange={(e) => handleInputChange('empty_return_date', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="detention_flat_rate" className="text-sm font-medium">
                      Flat Rate (per day)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                      <Input
                        id="detention_flat_rate"
                        type="number"
                        value={formData.detention_flat_rate}
                        onChange={(e) => handleInputChange('detention_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="pl-8"
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
            </CardContent>
          </Card>

          {/* 4️⃣ Additional Notes */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notes
                </Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  placeholder="Additional notes about this container..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t bg-muted/30">
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSubmitting || !formData.container_no || !formData.port || !formData.arrival_date}
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
