'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { insertContainer, type ContainerInsert } from '@/lib/data/containers-actions'
import type { Database } from '@/types/database'

// UK carrier presets with standard demurrage/detention rates
const UK_CARRIER_PRESETS = {
  'Maersk': { dem: 90, det: 75, freeDays: 5 },
  'MSC': { dem: 85, det: 70, freeDays: 5 },
  'CMA-CGM': { dem: 88, det: 72, freeDays: 6 },
  'Hapag-Lloyd': { dem: 92, det: 78, freeDays: 5 },
  'Evergreen': { dem: 87, det: 69, freeDays: 6 },
  'ONE': { dem: 91, det: 74, freeDays: 5 },
  'OOCL': { dem: 89, det: 70, freeDays: 5 },
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
  
  // Demurrage Tracking
  demurrage_enabled: boolean
  demurrage_flat_rate: number
  demurrage_tiers: Tier[]
  
  // Detention Tracking
  detention_enabled: boolean
  detention_flat_rate: number
  detention_tiers: Tier[]
  
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
    demurrage_enabled: false,
    demurrage_flat_rate: 0,
    demurrage_tiers: [],
    detention_enabled: false,
    detention_flat_rate: 0,
    detention_tiers: [],
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
        const preset = UK_CARRIER_PRESETS[carrier as keyof typeof UK_CARRIER_PRESETS]
        if (preset) {
          const fallbackDem: Tier[] = [
            { from_day: 1, to_day: preset.freeDays, rate: 0 },
            { from_day: preset.freeDays + 1, to_day: null, rate: preset.dem },
          ]
          const fallbackDet: Tier[] = [
            { from_day: 1, to_day: preset.freeDays, rate: 0 },
            { from_day: preset.freeDays + 1, to_day: null, rate: preset.det },
          ]
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
      console.error('Error loading carrier defaults:', error)
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

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Save these tier settings as the default for ${formData.carrier}?`
    )
    
    if (!confirmed) return

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
      console.error('Error saving carrier defaults:', error)
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

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Save these tier settings as the default for ${formData.carrier}?`
    )
    
    if (!confirmed) return

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
      console.error('Error saving carrier defaults:', error)
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
      demurrage_enabled: false,
      demurrage_flat_rate: 0,
      demurrage_tiers: [],
      detention_enabled: false,
      detention_flat_rate: 0,
      detention_tiers: [],
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
      // Prepare container data (only include fields that exist in database schema)
      const containerData: Omit<ContainerInsert, 'organization_id'> = {
        container_no: formData.container_no,
        port: formData.port,
        arrival_date: formData.arrival_date,
        free_days: formData.free_days,
        carrier: formData.carrier || null,
        container_size: formData.container_size || null,
        notes: formData.notes || null,
        demurrage_tiers: formData.demurrage_tiers.length > 0 ? formData.demurrage_tiers as unknown as Database['public']['Tables']['containers']['Insert']['demurrage_tiers'] : null,
        detention_tiers: formData.detention_tiers.length > 0 ? formData.detention_tiers as unknown as Database['public']['Tables']['containers']['Insert']['detention_tiers'] : null,
        has_detention: formData.detention_enabled,
        // Note: demurrage_fee_if_late and detention_fee_rate are not set from form data in this implementation
      }

      await insertContainer(containerData)
      
      // Success toast
      toast.success('Container added successfully')
      
      // Call onSave callback if provided
      if (onSave) {
        onSave(formData)
      }
      
      // Reset form
      resetForm()
      
      // Auto-close modal with slight delay
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error('Error saving container:', error)
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Package className="h-5 w-5 text-primary" />
            Add New Container
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 1️⃣ Basic Information */}
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-blue-700 text-lg">
                <Info className="h-4 w-4" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="container_no" className="text-sm font-medium text-foreground">
                    Container Number *
                  </label>
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
                    className={`bg-background ${validationErrors.container_no ? 'border-destructive' : ''}`}
                  />
                  {validationErrors.container_no && (
                    <p className="text-sm text-destructive">{validationErrors.container_no}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="port" className="text-sm font-medium text-foreground">
                    Port *
                  </label>
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
                    className={`bg-background ${validationErrors.port ? 'border-destructive' : ''}`}
                  />
                  {validationErrors.port && (
                    <p className="text-sm text-destructive">{validationErrors.port}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="arrival_date" className="text-sm font-medium text-foreground">
                    Arrival Date *
                  </label>
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
                    className={`bg-background ${validationErrors.arrival_date ? 'border-destructive' : ''}`}
                  />
                  {validationErrors.arrival_date && (
                    <p className="text-sm text-destructive">{validationErrors.arrival_date}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="free_days" className="text-sm font-medium text-foreground">
                    Free Days
                  </label>
                  <Input
                    id="free_days"
                    type="number"
                    value={formData.free_days}
                    onChange={(e) => handleInputChange('free_days', parseInt(e.target.value) || 7)}
                    min="1"
                    className="bg-background"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="carrier" className="text-sm font-medium text-foreground">
                    Carrier
                  </Label>
                  <Select
                    value={formData.carrier}
                    onValueChange={async (carrier) => {
                      setFormData(prev => ({ ...prev, carrier }))
                      await loadCarrierDefaults(carrier)
                    }}
                  >
                    <SelectTrigger id="carrier" className="w-full bg-background">
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
                  <label htmlFor="container_size" className="text-sm font-medium text-foreground">
                    Container Size
                  </label>
                  <select
                    id="container_size"
                    value={formData.container_size}
                    onChange={(e) => handleInputChange('container_size', e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground"
                  >
                    <option value="">Select size</option>
                    <option value="20ft">20ft</option>
                    <option value="40ft">40ft</option>
                    <option value="45ft">45ft</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2️⃣ Demurrage Tracking */}
          <Card className="border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-700 text-lg">
                <DollarSign className="h-4 w-4" />
                Demurrage Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="demurrage_enabled"
                  checked={formData.demurrage_enabled}
                  onChange={(e) => handleInputChange('demurrage_enabled', e.target.checked)}
                  className="rounded border-input"
                />
                <label htmlFor="demurrage_enabled" className="text-sm font-medium text-foreground">
                  Enable demurrage tracking
                </label>
              </div>
              
              {formData.demurrage_enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="demurrage_flat_rate" className="text-sm font-medium text-foreground">
                      Flat Rate (per day)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground">£</span>
                      <Input
                        id="demurrage_flat_rate"
                        type="number"
                        value={formData.demurrage_flat_rate}
                        onChange={(e) => handleInputChange('demurrage_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="bg-background pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  {/* Carrier Defaults Info Banner */}
                  {carrierDefaultsLoaded && (
                    <div className="col-span-full">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Loaded tier defaults for {formData.carrier}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Loading indicator for carrier defaults */}
                  {loadingDefaults && (
                    <div className="col-span-full">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                        <span className="text-sm text-gray-600">
                          Loading defaults for {formData.carrier}...
                        </span>
                      </div>
                    </div>
                  )}

                  <DemurrageTierEditor 
                    tiers={formData.demurrage_tiers}
                    onTiersChange={(tiers) => handleTierChange('demurrage_tiers', tiers)}
                    onSaveDefault={handleSaveDemurrageDefaults}
                    carrier={formData.carrier}
                    savingDefaults={savingDefaults}
                    freeDays={formData.free_days}
                  />
                  
                  {/* Quick-save button for both tiers */}
                  {formData.carrier && (
                    <div className="pt-2">
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
                            console.error(err)
                          } finally {
                            setSavingDefaults(false)
                          }
                        }}
                        disabled={savingDefaults || !formData.carrier}
                      >
                        💾 Save as Default
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3️⃣ Detention Tracking */}
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-700 text-lg">
                <Clock className="h-4 w-4" />
                Detention Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="detention_enabled"
                  checked={formData.detention_enabled}
                  onChange={(e) => handleInputChange('detention_enabled', e.target.checked)}
                  className="rounded border-input"
                />
                <label htmlFor="detention_enabled" className="text-sm font-medium text-foreground">
                  Enable detention tracking
                </label>
              </div>
              
              {formData.detention_enabled && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="detention_flat_rate" className="text-sm font-medium text-foreground">
                      Flat Rate (per day)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-muted-foreground">£</span>
                      <Input
                        id="detention_flat_rate"
                        type="number"
                        value={formData.detention_flat_rate}
                        onChange={(e) => handleInputChange('detention_flat_rate', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="bg-background pl-8"
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
                    freeDays={formData.free_days}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4️⃣ Additional Notes */}
          <Card className="border-gray-200 bg-gray-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-gray-700 text-lg">
                <FileText className="h-4 w-4" />
                Additional Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label htmlFor="notes" className="text-sm font-medium text-foreground">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={4}
                  className="w-full border border-input rounded-md px-3 py-2 bg-background text-foreground resize-none"
                  placeholder="Additional notes about this container..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <Separator className="my-6" />
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-6"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !formData.container_no || !formData.port || !formData.arrival_date}
            className="px-6 bg-primary hover:bg-primary/90"
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
      </DialogContent>
    </Dialog>
  )
}
