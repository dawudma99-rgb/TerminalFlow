'use client'

import { logger } from '@/lib/utils/logger'
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Clock,
  CheckCircle,
  X,
  Loader2
} from 'lucide-react'
import { 
  Tier, 
  addTierStep, 
  editTierStep, 
  deleteTierStep, 
  validateTierConfiguration, 
  getTierSummary 
} from '@/lib/tierUtils'

interface DetentionTierEditorProps {
  tiers: Tier[]
  onTiersChange: (tiers: Tier[]) => void
  onSaveDefault?: () => void
  carrier?: string
  savingDefaults?: boolean
  freeDays?: number
}

export function DetentionTierEditor({ tiers, onTiersChange, onSaveDefault, carrier, savingDefaults = false, freeDays = 0 }: DetentionTierEditorProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newTier, setNewTier] = useState<Tier>({ from_day: 1, to_day: null, rate: 0 })
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleAddTier = () => {
    try {
      const updatedTiers = addTierStep(tiers, newTier)
      onTiersChange(updatedTiers)
      setIsAddDialogOpen(false)
      setNewTier({ from_day: 1, to_day: null, rate: 0 })
      setValidationErrors([])
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Invalid tier configuration'])
    }
  }

  const handleEditTier = (index: number) => {
    try {
      const updatedTiers = editTierStep(tiers, index, newTier)
      onTiersChange(updatedTiers)
      setEditingIndex(null)
      setNewTier({ from_day: 1, to_day: null, rate: 0 })
      setValidationErrors([])
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Invalid tier configuration'])
    }
  }

  const handleDeleteTier = (index: number) => {
    try {
      const updatedTiers = deleteTierStep(tiers, index)
      onTiersChange(updatedTiers)
    } catch (error) {
      logger.error('Error deleting tier:', error)
    }
  }

  const startEdit = (index: number) => {
    setEditingIndex(index)
    setNewTier({ ...tiers[index] })
    setValidationErrors([])
  }

  const cancelEdit = () => {
    setEditingIndex(null)
    setNewTier({ from_day: 1, to_day: null, rate: 0 })
    setValidationErrors([])
  }

  const validation = validateTierConfiguration(tiers, 'Detention')

  return (
    <div className="space-y-4">
      {/* Tier List */}
      <div className="space-y-2">
        {tiers.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Day 1 = first chargeable day (free days handled separately)
          </p>
        )}
        {tiers.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No detention tiers configured
          </div>
        ) : (
          tiers.map((tier, index) => (
            <Card key={index} className="border-green-200 bg-green-50/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      {(() => {
                        const startDay = tier.from_day
                        const endDay = tier.to_day
                        const label = endDay && endDay !== 999
                          ? `Day ${startDay}–${endDay}`
                          : `Day ${startDay}+`
                        return `${label} → £${tier.rate}/day`
                      })()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(index)}
                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTier(index)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Tier Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full border-green-300 text-green-700 hover:bg-green-50">
            <Plus className="h-4 w-4 mr-2" />
            Add Detention Step
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Clock className="h-4 w-4" />
              Add Detention Tier
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="from_day" className="block text-sm font-medium text-foreground mb-1">
                  From Day
                </label>
                <Input
                  id="from_day"
                  type="number"
                  value={newTier.from_day}
                  onChange={(e) => setNewTier(prev => ({ ...prev, from_day: parseInt(e.target.value) || 1 }))}
                  min="1"
                  className="bg-background"
                />
              </div>
              <div>
                <label htmlFor="to_day" className="block text-sm font-medium text-foreground mb-1">
                  To Day (leave empty for unlimited)
                </label>
                <Input
                  id="to_day"
                  type="number"
                  value={newTier.to_day || ''}
                  onChange={(e) => setNewTier(prev => ({ 
                    ...prev, 
                    to_day: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  min="1"
                  placeholder="Unlimited"
                  className="bg-background"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="rate" className="block text-sm font-medium text-foreground mb-1">
                Rate per Day (£)
              </label>
              <Input
                id="rate"
                type="number"
                value={newTier.rate}
                onChange={(e) => setNewTier(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                className="bg-background"
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="text-red-600 text-sm">
                {validationErrors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <X className="h-3 w-3" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleAddTier}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Add Tier
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Tier Dialog */}
      <Dialog open={editingIndex !== null} onOpenChange={() => setEditingIndex(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <Edit className="h-4 w-4" />
              Edit Detention Tier
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit_from_day" className="block text-sm font-medium text-foreground mb-1">
                  From Day
                </label>
                <Input
                  id="edit_from_day"
                  type="number"
                  value={newTier.from_day}
                  onChange={(e) => setNewTier(prev => ({ ...prev, from_day: parseInt(e.target.value) || 1 }))}
                  min="1"
                  className="bg-background"
                />
              </div>
              <div>
                <label htmlFor="edit_to_day" className="block text-sm font-medium text-foreground mb-1">
                  To Day (leave empty for unlimited)
                </label>
                <Input
                  id="edit_to_day"
                  type="number"
                  value={newTier.to_day || ''}
                  onChange={(e) => setNewTier(prev => ({ 
                    ...prev, 
                    to_day: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  min="1"
                  placeholder="Unlimited"
                  className="bg-background"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="edit_rate" className="block text-sm font-medium text-foreground mb-1">
                Rate per Day (£)
              </label>
              <Input
                id="edit_rate"
                type="number"
                value={newTier.rate}
                onChange={(e) => setNewTier(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                className="bg-background"
              />
            </div>

            {validationErrors.length > 0 && (
              <div className="text-red-600 text-sm">
                {validationErrors.map((error, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <X className="h-3 w-3" />
                    {error}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => editingIndex !== null && handleEditTier(editingIndex)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tier Summary */}
      {tiers.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="h-4 w-4" />
            <span className="font-medium">Detention Configuration:</span>
          </div>
          <p className="text-green-600 text-sm mt-1">
            {getTierSummary(tiers)}
          </p>
          {!validation.valid && (
            <div className="text-red-600 text-xs mt-2">
              ⚠️ {validation.errors.join(', ')}
            </div>
          )}
          
          {/* Save as Default Button */}
          {onSaveDefault && carrier && tiers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <ConfirmDialog
                title="Save as Default"
                description={`Save these detention tier settings as the default for ${carrier}?`}
                onConfirm={onSaveDefault}
                confirmText="Save"
                cancelText="Cancel"
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={savingDefaults}
                    className="w-full border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {savingDefaults ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>💾 Save as Default for {carrier}</>
                    )}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
