'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
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
  seedDemoData,
} from '@/lib/data/data-management-actions'
import {
  getAllCarrierDefaults,
  saveCarrierDefaults,
  deleteCarrierDefaults,
  type CarrierDefaults,
} from '@/lib/data/carrier-actions'
import { DemurrageTierEditor } from '@/components/forms/DemurrageTierEditor'
import { DetentionTierEditor } from '@/components/forms/DetentionTierEditor'
import type { Tier } from '@/lib/tierUtils'
import {
  Download,
  Upload,
  Trash2,
  FlaskConical,
  DollarSign,
  Calendar,
  Settings as SettingsIcon,
  Database,
  Package,
  PlusCircle,
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
  const [seeding, setSeeding] = useState(false)
  const [carrierDefaults, setCarrierDefaults] = useState<CarrierDefaults[]>([])
  const [loadingCarriers, setLoadingCarriers] = useState(true)
  const [editingCarrier, setEditingCarrier] = useState<string | null>(null)
  const [editingCarrierName, setEditingCarrierName] = useState<string>('')
  const [demurrageTiers, setDemurrageTiers] = useState<Tier[]>([])
  const [detentionTiers, setDetentionTiers] = useState<Tier[]>([])
  const [savingCarrier, setSavingCarrier] = useState(false)

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
        if (profile?.organization_id) {
          getAllCarrierDefaults(profile.organization_id)
            .then((carrierData) => {
              setCarrierDefaults(carrierData)
            })
            .catch((err) => {
              logger.error('Failed to load carrier defaults', err)
              toast.error('Failed to load carrier defaults')
            })
            .finally(() => setLoadingCarriers(false))
        } else {
          setLoadingCarriers(false)
        }
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
        }
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

  const handleSeedDemo = async () => {
    if (!user || !profile?.organization_id) return
    try {
      setSeeding(true)
      await seedDemoData()
      toast.success('Demo data seeded successfully')
      // Refresh the page to show new data
      router.refresh()
    } catch (err) {
      logger.error('Seeding failed:', err)
      toast.error(err instanceof Error ? err.message : 'Seeding failed')
    } finally {
      setSeeding(false)
    }
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
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <LoadingState message="Loading settings..." />
        </div>
      </AppLayout>
    )
  }

  if (!user || !profile || !settings) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Please sign in to view settings.
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="h-8 w-8 text-primary" />
            Settings & Configuration
          </h1>
          <p className="text-muted-foreground">
            Manage your application preferences, fee defaults, and organization data.
          </p>
        </div>

        {/* Fee Configuration */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Fee Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="demurrageDailyRate">Demurrage Daily Rate (£)</Label>
                <Input
                  id="demurrageDailyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.demurrageDailyRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      demurrageDailyRate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default daily rate for demurrage charges
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="detentionDailyRate">Detention Daily Rate (£)</Label>
                <Input
                  id="detentionDailyRate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.detentionDailyRate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      detentionDailyRate: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default daily rate for detention charges
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Days Configuration */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Free Days Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="demFreeDays">Demurrage Free Days</Label>
                <Input
                  id="demFreeDays"
                  type="number"
                  min="0"
                  max="30"
                  value={settings.demFreeDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      demFreeDays: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of free days before demurrage charges apply
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="detFreeDays">Detention Free Days</Label>
                <Input
                  id="detFreeDays"
                  type="number"
                  min="0"
                  max="30"
                  value={settings.detFreeDays}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      detFreeDays: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Number of free days before detention charges apply
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekend Charging */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle>Weekend Charging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="weekendChargeable"
                checked={settings.weekendChargeable}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, weekendChargeable: checked })
                }
              />
              <Label htmlFor="weekendChargeable" className="cursor-pointer">
                Include weekends in detention calculations
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              When unchecked, weekends are excluded from detention free day calculations. This
              affects how detention fees are calculated for containers.
            </p>
          </CardContent>
        </Card>

        {/* Carrier Defaults */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Carrier Defaults
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingCarriers ? (
              <p className="text-sm text-muted-foreground">Loading carrier defaults...</p>
            ) : carrierDefaults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No carrier defaults yet. Add one below.
              </p>
            ) : (
              <div className="space-y-3">
                {carrierDefaults.map((cd) => (
                  <div
                    key={cd.id}
                    className="flex justify-between items-center border rounded-lg p-3 hover:bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{cd.carrier_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cd.demurrage_tiers.length} demurrage / {cd.detention_tiers.length} detention tiers
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCarrier(cd.id)
                          setEditingCarrierName(cd.carrier_name)
                          setDemurrageTiers(cd.demurrage_tiers)
                          setDetentionTiers(cd.detention_tiers)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          if (!profile?.organization_id) return
                          try {
                            await deleteCarrierDefaults(cd.carrier_name, profile.organization_id)
                            toast.success(`Deleted defaults for ${cd.carrier_name}`)
                            const updated = carrierDefaults.filter((x) => x.id !== cd.id)
                            setCarrierDefaults(updated)
                          } catch (err) {
                            toast.error('Failed to delete carrier defaults')
                            logger.error('Failed to delete carrier defaults:', err)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              className="mt-3"
              onClick={() => {
                setEditingCarrier('new')
                setEditingCarrierName('')
                setDemurrageTiers([])
                setDetentionTiers([])
              }}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Add Carrier Default
            </Button>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="hover:shadow-md transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Data Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

              <Button
                variant="outline"
                onClick={handleSeedDemo}
                disabled={seeding || !profile.organization_id}
              >
                <FlaskConical className="w-4 h-4 mr-2" />
                {seeding ? 'Seeding...' : 'Seed Demo Data'}
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
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving} size="lg">
            {saving ? 'Saving...' : '💾 Save Settings'}
          </Button>
        </div>
      </div>

      {/* Carrier Default Editor Modal */}
      {editingCarrier && (
        <AlertDialog open={!!editingCarrier} onOpenChange={(open) => {
          if (!open) {
            setEditingCarrier(null)
            setEditingCarrierName('')
            setDemurrageTiers([])
            setDetentionTiers([])
          }
        }}>
          <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Carrier Defaults: {editingCarrier === 'new' ? 'New Carrier' : editingCarrierName}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogDescription asChild>
              <div className="space-y-6 p-2">
                {editingCarrier === 'new' && (
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
                )}
                <DemurrageTierEditor
                  tiers={demurrageTiers}
                  onTiersChange={setDemurrageTiers}
                  carrier={editingCarrierName || editingCarrier === 'new' ? 'New Carrier' : editingCarrierName}
                />
                <DetentionTierEditor
                  tiers={detentionTiers}
                  onTiersChange={setDetentionTiers}
                  carrier={editingCarrierName || editingCarrier === 'new' ? 'New Carrier' : editingCarrierName}
                />
              </div>
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setEditingCarrier(null)
                setEditingCarrierName('')
                setDemurrageTiers([])
                setDetentionTiers([])
              }}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={savingCarrier || (editingCarrier === 'new' && !editingCarrierName.trim())}
                onClick={async () => {
                  if (!profile?.organization_id) return
                  if (editingCarrier === 'new' && !editingCarrierName.trim()) {
                    toast.error('Please enter a carrier name')
                    return
                  }
                  try {
                    setSavingCarrier(true)
                    const carrierName = editingCarrier === 'new' ? editingCarrierName.trim() : editingCarrierName
                    await saveCarrierDefaults(
                      carrierName,
                      profile.organization_id,
                      demurrageTiers,
                      detentionTiers
                    )
                    toast.success(`Carrier defaults saved for ${carrierName}`)
                    setEditingCarrier(null)
                    setEditingCarrierName('')
                    setDemurrageTiers([])
                    setDetentionTiers([])
                    const updated = await getAllCarrierDefaults(profile.organization_id)
                    setCarrierDefaults(updated)
                  } catch (err) {
                    toast.error('Failed to save carrier defaults')
                    logger.error('Failed to save carrier defaults:', err)
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
    </AppLayout>
  )
}

