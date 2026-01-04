'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { logger } from '@/lib/utils/logger'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth/useAuth'
import { loadSettings, saveSettings, type Settings } from '@/lib/data/settings-actions'
import {
  exportOrgData,
  importOrgData,
  clearOrgData,
} from '@/lib/data/data-management-actions'
import {
  getAllCarrierDefaults,
  saveCarrierDefaults,
  deleteCarrierDefaults,
  updateCarrierName,
  type CarrierDefaults,
} from '@/lib/data/carrier-actions'
import { DemurrageTierEditor } from '@/components/forms/DemurrageTierEditor'
import { DetentionTierEditor } from '@/components/forms/DetentionTierEditor'
import type { Tier } from '@/lib/tierUtils'
import {
  Download,
  Upload,
  Trash2,
  Settings as SettingsIcon,
  Database,
  Package,
  PlusCircle,
  Bell,
} from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function SettingsPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [carrierDefaults, setCarrierDefaults] = useState<CarrierDefaults[]>([])
  const [loadingCarriers, setLoadingCarriers] = useState(true)
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null)
  const [editingCarrierName, setEditingCarrierName] = useState<string>('')
  const [editingCarrierOriginalName, setEditingCarrierOriginalName] = useState<string>('')
  const [demurrageTiers, setDemurrageTiers] = useState<Tier[]>([])
  const [detentionTiers, setDetentionTiers] = useState<Tier[]>([])
  const [demurrageFreeDays, setDemurrageFreeDays] = useState<number>(7)
  const [detentionFreeDays, setDetentionFreeDays] = useState<number>(7)
  const [demurrageFlatRate, setDemurrageFlatRate] = useState<number>(0)
  const [detentionFlatRate, setDetentionFlatRate] = useState<number>(0)
  const [savingCarrier, setSavingCarrier] = useState(false)
  // Local string states for inputs to allow clearing
  const [demurrageFreeDaysInput, setDemurrageFreeDaysInput] = useState<string>('7')
  const [demurrageFlatRateInput, setDemurrageFlatRateInput] = useState<string>('0')
  const [detentionFlatRateInput, setDetentionFlatRateInput] = useState<string>('0')

  // Sync input states with number states when they change from external sources
  useEffect(() => {
    setDemurrageFreeDaysInput(String(demurrageFreeDays))
  }, [demurrageFreeDays])

  useEffect(() => {
    setDemurrageFlatRateInput(String(demurrageFlatRate))
  }, [demurrageFlatRate])

  useEffect(() => {
    setDetentionFlatRateInput(String(detentionFlatRate))
  }, [detentionFlatRate])

  // Load settings on mount
  useEffect(() => {
    logger.log('[settings-page] useEffect triggered', { user: user?.id, loading, settingsLoading })
    
    // Wait for auth to finish loading
    if (loading) {
      logger.log('[settings-page] Auth still loading, waiting...')
      return
    }
    
    // If no user after auth loads, clear loading state
    if (!user) {
      logger.log('[settings-page] No user, clearing settings loading')
      setSettingsLoading(false)
      return
    }
    
    // User exists, load settings
    logger.log('[settings-page] Loading settings for user:', user.id)
    loadSettings()
      .then((data) => {
        logger.log('[settings-page] Settings loaded successfully:', data)
        setSettings(data)
        setSettingsLoading(false)
        
        // Load carrier defaults after settings
        getAllCarrierDefaults()
          .then((carrierData) => {
            setCarrierDefaults(carrierData)
          })
          .catch((err) => {
            logger.error('Failed to load carrier defaults', err)
            toast.error('Failed to load carrier defaults')
          })
          .finally(() => setLoadingCarriers(false))
      })
      .catch((err) => {
        logger.error('[settings-page] Failed to load settings:', err)
        toast.error('Failed to load settings. Using defaults.')
        // Set defaults on error
        const defaults: Settings = {
          demurrageDailyRate: 80,
          detentionDailyRate: 50,
          demFreeDays: 7,
          detFreeDays: 7,
          weekendChargeable: true,
          daysBeforeFreeTimeWarning: 2,
        }
        // Note: Fee, free days, and weekend charging settings are no longer shown in UI
        // but kept in defaults for backward compatibility
        setSettings(defaults)
        setSettingsLoading(false)
        setLoadingCarriers(false)
      })
  }, [user, loading, profile, settingsLoading])

  const handleSaveSettings = async () => {
    if (!settings) return
    try {
      setSaving(true)
      await saveSettings(settings)
      toast.success('Settings saved successfully')
    } catch (err) {
      logger.error('Failed to save settings:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    if (!user || !profile?.organization_id) return
    try {
      const json = await exportOrgData()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ddcopilot-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch (err) {
      logger.error('Export failed:', err)
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleImport = () => {
    if (!user || !profile?.organization_id) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        setImporting(true)
        const text = await file.text()
        await importOrgData(text)
        toast.success('Data imported successfully')
        // Refresh the page to show new data
        router.refresh()
      } catch (err) {
        logger.error('Import failed:', err)
        toast.error(err instanceof Error ? err.message : 'Import failed')
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  const handleClearData = async () => {
    if (!user || !profile?.organization_id) return
    try {
      setClearing(true)
      await clearOrgData()
      toast.success('All organization data cleared')
      // Refresh the page to reflect changes
      router.refresh()
    } catch (err) {
      logger.error('Clear failed:', err)
      toast.error(err instanceof Error ? err.message : 'Clear failed')
    } finally {
      setClearing(false)
    }
  }

  if (loading || settingsLoading) {
    return (
      <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="flex h-full items-center justify-center">
          <LoadingState message="Loading settings..." />
        </div>
      </main>
    )
  }

  if (!user || !profile || !settings) {
    return (
      <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl rounded-lg border border-gray-200 bg-white p-6 text-sm text-muted-foreground shadow-sm">
          Please sign in to view settings.
        </div>
      </main>
    )
  }

  return (
    <main className="bg-[#F3F4F6] min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {/* Header */}
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-[#111827]">
                <SettingsIcon className="h-6 w-6 text-[#2563EB]" />
                Settings
              </h1>
              <p className="text-sm text-[#6B7280] mt-1">
                Manage alerts, carrier templates, and organization data.
              </p>
            </div>
          </section>

        {/* Alert Settings */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <Bell className="h-5 w-5 text-[#2563EB]" />
              Alert Settings
            </h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="daysBeforeFreeTimeWarning" className="text-sm font-medium text-[#111827]">
                Warn me X days before free time ends
              </Label>
              <Input
                id="daysBeforeFreeTimeWarning"
                type="number"
                min="1"
                max="14"
                value={settings.daysBeforeFreeTimeWarning ?? 2}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    daysBeforeFreeTimeWarning: parseInt(e.target.value) || 2,
                  })
                }
                className="max-w-xs"
              />
              <p className="text-xs text-[#6B7280]">
                Containers will enter "Warning" status this many days before free time expires.
                Default: 2 days.
              </p>
            </div>
            <Button onClick={handleSaveSettings} disabled={saving} className="w-full sm:w-auto">
              {saving ? 'Saving…' : 'Save Alert Settings'}
            </Button>
          </div>
        </section>

        {/* Carrier Fee Templates */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <Package className="h-5 w-5 text-[#2563EB]" />
              Carrier Fee Templates
            </h2>
            <p className="text-sm text-[#6B7280] mt-1">
              Manage fee templates for each carrier. These templates auto-fill when creating containers.
            </p>
          </div>
          <div className="space-y-4">
            {loadingCarriers ? (
              <p className="text-sm text-muted-foreground">Loading carrier defaults...</p>
            ) : carrierDefaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No carrier templates yet. Add one below.
              </p>
            ) : (
              <div className="space-y-3">
                {carrierDefaults.map((cd) => {
                  const demSummary = cd.demurrage_tiers.length > 0
                    ? `${cd.demurrage_free_days ?? 7} free / Tiered (${cd.demurrage_tiers.length} tiers)`
                    : cd.demurrage_flat_rate
                      ? `${cd.demurrage_free_days ?? 7} free / £${cd.demurrage_flat_rate.toFixed(2)} flat`
                      : `${cd.demurrage_free_days ?? 7} free / Not configured`
                  
                  const detSummary = cd.detention_tiers.length > 0
                    ? `${cd.detention_free_days ?? 7} free / Tiered (${cd.detention_tiers.length} tiers)`
                    : cd.detention_flat_rate
                      ? `${cd.detention_free_days ?? 7} free / £${cd.detention_flat_rate.toFixed(2)} flat`
                      : `${cd.detention_free_days ?? 7} free / Not configured`
                  
                  return (
                    <div
                      key={cd.id}
                      className="flex justify-between items-center border rounded-lg p-3 hover:bg-muted/30"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{cd.carrier_name}</p>
                        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                          <p>Demurrage: {demSummary}</p>
                          <p>Detention: {detSummary}</p>
                        </div>
                      </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCarrier(cd.id)
                          setEditingCarrierName(cd.carrier_name)
                          setEditingCarrierOriginalName(cd.carrier_name)
                          setDemurrageTiers(cd.demurrage_tiers)
                          setDetentionTiers(cd.detention_tiers)
                          setDemurrageFreeDays(cd.demurrage_free_days ?? 7)
                          setDetentionFreeDays(cd.detention_free_days ?? 7)
                          setDemurrageFlatRate(cd.demurrage_flat_rate ?? 0)
                          setDetentionFlatRate(cd.detention_flat_rate ?? 0)
                        }}
                      >
                        Edit
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Carrier Template?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <div className="space-y-2">
                                <p>
                                  Are you sure you want to delete the template for <strong>{cd.carrier_name}</strong>?
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  This will remove the template from future use. Existing containers created with this carrier will not be affected and will continue to use their saved fee configurations.
                                </p>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteCarrierDefaults(cd.carrier_name)
                                  toast.success(`Deleted template for ${cd.carrier_name}`)
                                  const updated = carrierDefaults.filter((x) => x.id !== cd.id)
                                  setCarrierDefaults(updated)
                                } catch (err) {
                                  toast.error('Failed to delete carrier template')
                                  logger.error('Failed to delete carrier template:', err)
                                }
                              }}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )})}
              </div>
            )}

            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                setEditingCarrier('new')
                setEditingCarrierName('')
                setEditingCarrierOriginalName('')
                setDemurrageTiers([])
                setDetentionTiers([])
                setDemurrageFreeDays(7)
                setDetentionFreeDays(7)
                setDemurrageFlatRate(0)
                setDetentionFlatRate(0)
              }}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Carrier Template
            </Button>
          </div>
        </section>

        {/* Data Management */}
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <Database className="h-5 w-5 text-[#2563EB]" />
              Data Management
            </h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage your organization&apos;s data. These actions are organization-scoped and
              cannot be undone.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleExport} disabled={!profile.organization_id}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>

              <Button
                variant="outline"
                onClick={handleImport}
                disabled={importing || !profile.organization_id}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : 'Import Data'}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={clearing || !profile.organization_id}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear All Organization Data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all containers and history for your
                      organization. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearData}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={clearing}
                    >
                      {clearing ? 'Clearing...' : 'Clear All'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        {/* Carrier Default Editor Modal */}
        {editingCarrier && (
          <AlertDialog open={!!editingCarrier} onOpenChange={(open) => {
            if (!open) {
              setEditingCarrier(null)
              setEditingCarrierName('')
              setEditingCarrierOriginalName('')
              setDemurrageTiers([])
              setDetentionTiers([])
              setDemurrageFreeDays(7)
              setDetentionFreeDays(7)
              setDemurrageFlatRate(0)
              setDetentionFlatRate(0)
            }
          }}>
            <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {editingCarrier === 'new' ? 'New Carrier Template' : `Edit Carrier Template: ${editingCarrierName}`}
                </AlertDialogTitle>
              </AlertDialogHeader>
              <AlertDialogDescription asChild>
                <div className="space-y-6 p-2">
                  <div className="space-y-2">
                    <Label htmlFor="carrierNameInput">Carrier Name</Label>
                    <Input
                      id="carrierNameInput"
                      value={editingCarrierName}
                      onChange={(e) => setEditingCarrierName(e.target.value)}
                      placeholder="e.g., Maersk, MSC, CMA CGM"
                      className="bg-background"
                    />
                  </div>

                  {/* Demurrage Configuration */}
                  <div className="space-y-4 border rounded-lg p-4">
                    <h4 className="font-medium text-sm">Demurrage Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="demFreeDays">Free Days</Label>
                        <Input
                          id="demFreeDays"
                          type="number"
                          min="0"
                          max="30"
                          value={demurrageFreeDaysInput}
                          onChange={(e) => {
                            const value = e.target.value
                            setDemurrageFreeDaysInput(value)
                            if (value !== '') {
                              const numValue = parseInt(value, 10)
                              if (!isNaN(numValue) && numValue >= 0 && numValue <= 365) {
                                setDemurrageFreeDays(numValue)
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value
                            const numValue = parseInt(value, 10)
                            if (value === '' || isNaN(numValue) || numValue < 1) {
                              setDemurrageFreeDaysInput('7')
                              setDemurrageFreeDays(7)
                            } else {
                              setDemurrageFreeDaysInput(String(demurrageFreeDays))
                            }
                          }}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="demFlatRate">Flat Rate (£/day) - Optional</Label>
                        <Input
                          id="demFlatRate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={demurrageFlatRateInput}
                          onChange={(e) => {
                            const value = e.target.value
                            setDemurrageFlatRateInput(value)
                            if (value !== '') {
                              const numValue = parseFloat(value)
                              if (!isNaN(numValue) && numValue >= 0) {
                                setDemurrageFlatRate(numValue)
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value
                            const numValue = parseFloat(value)
                            if (value === '' || isNaN(numValue) || numValue < 0) {
                              setDemurrageFlatRateInput('0')
                              setDemurrageFlatRate(0)
                            } else {
                              setDemurrageFlatRateInput(String(demurrageFlatRate))
                            }
                          }}
                          className="bg-background"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Used if no tiers configured
                        </p>
                      </div>
                    </div>
                    <DemurrageTierEditor
                      tiers={demurrageTiers}
                      onTiersChange={setDemurrageTiers}
                      carrier={editingCarrierName || editingCarrier === 'new' ? 'New Carrier' : editingCarrierName}
                    />
                  </div>

                  {/* Detention Configuration */}
                  <div className="space-y-4 border rounded-lg p-4">
                    <h4 className="font-medium text-sm">Detention Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="detFreeDays">Free Days</Label>
                        <Input
                          id="detFreeDays"
                          type="number"
                          min="0"
                          max="30"
                          value={detentionFreeDays}
                          onChange={(e) => setDetentionFreeDays(parseInt(e.target.value) || 7)}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="detFlatRate">Flat Rate (£/day) - Optional</Label>
                        <Input
                          id="detFlatRate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={detentionFlatRateInput}
                          onChange={(e) => {
                            const value = e.target.value
                            setDetentionFlatRateInput(value)
                            if (value !== '') {
                              const numValue = parseFloat(value)
                              if (!isNaN(numValue) && numValue >= 0) {
                                setDetentionFlatRate(numValue)
                              }
                            }
                          }}
                          onBlur={(e) => {
                            const value = e.target.value
                            const numValue = parseFloat(value)
                            if (value === '' || isNaN(numValue) || numValue < 0) {
                              setDetentionFlatRateInput('0')
                              setDetentionFlatRate(0)
                            } else {
                              setDetentionFlatRateInput(String(detentionFlatRate))
                            }
                          }}
                          className="bg-background"
                          placeholder="0.00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Used if no tiers configured
                        </p>
                      </div>
                    </div>
                    <DetentionTierEditor
                      tiers={detentionTiers}
                      onTiersChange={setDetentionTiers}
                      carrier={editingCarrierName || editingCarrier === 'new' ? 'New Carrier' : editingCarrierName}
                    />
                  </div>
                </div>
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {
                  setEditingCarrier(null)
                  setEditingCarrierName('')
                  setEditingCarrierOriginalName('')
                  setDemurrageTiers([])
                  setDetentionTiers([])
                  setDemurrageFreeDays(7)
                  setDetentionFreeDays(7)
                  setDemurrageFlatRate(0)
                  setDetentionFlatRate(0)
                }}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={savingCarrier || !editingCarrierName.trim()}
                  onClick={async () => {
                    const carrierName = editingCarrierName.trim()
                    if (!carrierName || carrierName.length === 0) {
                      toast.error('Carrier name cannot be empty or whitespace only')
                      return
                    }
                    try {
                      setSavingCarrier(true)
                      
                      // Handle rename if name changed
                      if (editingCarrier !== 'new' && editingCarrierOriginalName !== carrierName) {
                        await updateCarrierName(editingCarrierOriginalName, carrierName)
                      }
                      
                      await saveCarrierDefaults(
                        carrierName,
                        demurrageTiers,
                        detentionTiers,
                        {
                          demurrage_free_days: demurrageFreeDays,
                          detention_free_days: detentionFreeDays,
                          demurrage_flat_rate: demurrageFlatRate > 0 ? demurrageFlatRate : undefined,
                          detention_flat_rate: detentionFlatRate > 0 ? detentionFlatRate : undefined,
                        }
                      )
                      toast.success(`Carrier template saved for ${carrierName}`)
                      setEditingCarrier(null)
                      setEditingCarrierName('')
                      setEditingCarrierOriginalName('')
                      setDemurrageTiers([])
                      setDetentionTiers([])
                      setDemurrageFreeDays(7)
                      setDetentionFreeDays(7)
                      setDemurrageFlatRate(0)
                      setDetentionFlatRate(0)
                      const updated = await getAllCarrierDefaults()
                      setCarrierDefaults(updated)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to save carrier template')
                      logger.error('Failed to save carrier template:', err)
                    } finally {
                      setSavingCarrier(false)
                    }
                  }}
                >
                  {savingCarrier ? 'Saving...' : 'Save'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </main>
  )
}

