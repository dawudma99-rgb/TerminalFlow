'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LayoutDashboard, BarChart3, Plus, Upload, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createDailyDigestDraftsForToday } from '@/lib/data/email-drafts-actions'
import { toast } from 'sonner'
import { useState } from 'react'

type QuickActionsCardProps = {
  className?: string
}

export function QuickActionsCard({ className }: QuickActionsCardProps) {
  const router = useRouter()
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false)

  const handleGenerateDigest = async () => {
    setIsGeneratingDigest(true)
    try {
      const result = await createDailyDigestDraftsForToday()
      if (result?.created > 0) {
        toast.success(`Created ${result.created} daily digest draft(s)`)
      } else {
        toast.info('No digests created – no lists have containers in warning/overdue/detention recently.')
      }
      router.refresh()
    } catch (err) {
      console.error('Failed to generate daily digests', err)
      toast.error('Failed to generate daily digests. Please try again.')
    } finally {
      setIsGeneratingDigest(false)
    }
  }

  return (
    <div className={clsx('bg-white rounded-md border border-[#E5E7EB] p-6 shadow flex flex-col justify-between gap-4', className)}>
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Quick Actions</h2>
        <p className="text-sm text-[#6B7280]">Common daily tasks and navigation</p>
      </div>
      <div className="space-y-2">
        <Button className="w-full h-10 justify-start gap-2" asChild>
          <Link href="/dashboard/containers">
            <Plus className="h-4 w-4" />
            Add Container
          </Link>
        </Button>
        <Button variant="outline" className="w-full h-10 justify-start gap-2" asChild>
          <Link href="/dashboard/containers">
            <Upload className="h-4 w-4" />
            Import Containers
          </Link>
        </Button>
        <Button variant="outline" className="w-full h-10 justify-start gap-2" asChild>
          <Link href="/dashboard/containers">
            <LayoutDashboard className="h-4 w-4" />
            Go to Container List
          </Link>
        </Button>
        <Button variant="outline" className="w-full h-10 justify-start gap-2" asChild>
          <Link href="/dashboard/analytics">
            <BarChart3 className="h-4 w-4" />
            View Analytics
          </Link>
        </Button>
        <Button
          variant="outline"
          className="w-full h-10 justify-start gap-2"
          onClick={handleGenerateDigest}
          disabled={isGeneratingDigest}
        >
          <Mail className="h-4 w-4" />
          {isGeneratingDigest ? 'Generating...' : 'Generate Daily Digest'}
        </Button>
      </div>
    </div>
  )
}

