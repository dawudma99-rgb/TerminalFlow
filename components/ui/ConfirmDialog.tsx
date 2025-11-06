'use client'

import { useState, forwardRef } from 'react'
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

interface ConfirmDialogProps {
  title: string
  description: string
  onConfirm: () => void | Promise<void>
  trigger: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
}

export const ConfirmDialog = forwardRef<HTMLDivElement, ConfirmDialogProps>(({
  title,
  description,
  onConfirm,
  trigger,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}, ref) => {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch (error) {
      // Error handling is done by the caller
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // Wrap in a span to accept ref when used with asChild (e.g., TooltipTrigger asChild)
  // The ref is forwarded to the wrapper so Radix components can attach event handlers
  return (
    <span ref={ref} style={{ display: 'inline-block' }}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isLoading}
              className={variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {isLoading ? 'Processing...' : confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  )
})

ConfirmDialog.displayName = 'ConfirmDialog'



