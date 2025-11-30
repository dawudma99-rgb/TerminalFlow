'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Edit2, CheckCircle2, Send, MailCheck, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import {
  updateEmailDraftContent,
  approveEmailDraft,
  sendClientEmailForDraft,
  createDailyDigestDraftsForToday,
  type EmailDraftWithContainer,
  type ClientEmailEventType,
} from '@/lib/data/email-drafts-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/EmptyState'
import { KpiCard } from '@/components/ui/KpiCard'

type DraftMetadata = {
  port?: string | null
  list_id?: string | null
  list_name?: string | null
  generated_from?: string | null
}

const EVENT_LABELS: Record<ClientEmailEventType, string> = {
  daily_digest: 'Daily digest',
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

function getPortLabel(metadata: DraftMetadata | null, containerPort?: string | null) {
  return containerPort ?? metadata?.port ?? '—'
}

interface ClientUpdatesPageContentProps {
  drafts: EmailDraftWithContainer[]
}

export function ClientUpdatesPageContent({ drafts }: ClientUpdatesPageContentProps) {
  const router = useRouter()
  const [selectedDraft, setSelectedDraft] = useState<EmailDraftWithContainer | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [isApproving, startApproving] = useTransition()
  const [isGenerating, startGenerating] = useTransition()
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null)

  // Form state for edit dialog
  const [toEmail, setToEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyText, setBodyText] = useState('')

  const handleOpenEditDialog = (draft: EmailDraftWithContainer) => {
    setSelectedDraft(draft)
    setToEmail(draft.draft.to_email ?? '')
    setSubject(draft.draft.subject)
    setBodyText(draft.draft.body_text)
    setIsEditDialogOpen(true)
  }

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false)
    setSelectedDraft(null)
    setToEmail('')
    setSubject('')
    setBodyText('')
  }

  const handleSaveChanges = async () => {
    if (!selectedDraft) return

    startSaving(async () => {
      try {
        const result = await updateEmailDraftContent({
          draftId: selectedDraft.draft.id,
          toEmail: toEmail.trim() === '' ? null : toEmail.trim(),
          subject: subject.trim(),
          bodyText: bodyText.trim(),
        })

        if (result) {
          toast.success('Draft updated successfully')
          handleCloseEditDialog()
          router.refresh()
        } else {
          toast.error('Failed to update draft. Please try again.')
        }
      } catch {
        toast.error('Failed to update draft. Please try again.')
      }
    })
  }

  const handleMarkReady = async (draftId: string) => {
    startApproving(async () => {
      try {
        const result = await approveEmailDraft({ draftId })

        if (result) {
          toast.success('Draft marked as ready')
          router.refresh()
        } else {
          toast.error('Failed to approve draft. Please try again.')
        }
      } catch {
        toast.error('Failed to approve draft. Please try again.')
      }
    })
  }

  const handleSendNow = async (draftId: string, toEmail: string) => {
    setSendingDraftId(draftId)
    try {
      const result = await sendClientEmailForDraft({ draftId })

      if (result.ok) {
        toast.success(`Email sent to ${toEmail}`)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to send email. Please try again.')
      }
    } catch {
      toast.error('Failed to send email. Please try again.')
    } finally {
      setSendingDraftId(null)
    }
  }

  const handleGenerateDailyDigests = () => {
    startGenerating(async () => {
      try {
        const result = await createDailyDigestDraftsForToday()

        if (result?.created > 0) {
          toast.success(`Created ${result.created} daily digest draft(s).`)
        } else {
          toast.info('No alerts today – no digests created.')
        }

        router.refresh()
      } catch (err) {
        console.error('Failed to generate daily digests', err)
        toast.error('Failed to generate daily digests. Please try again.')
      }
    })
  }

  const pendingCount = drafts.length
  const approvedCount = drafts.filter((d) => d.draft.approved_by_user_id !== null).length
  const readyToSendCount = drafts.filter(
    (d) => d.draft.approved_by_user_id !== null && d.draft.to_email?.trim()
  ).length

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
      <header className="flex flex-col gap-1 pt-2">
        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
          Communications
        </span>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-[#1F2937]">Client Updates</h1>
          <Button
            variant="outline"
            onClick={handleGenerateDailyDigests}
            disabled={isGenerating}
            className="border-[#D4D7DE] text-slate-600 hover:bg-[#EEF1F6]"
          >
            {isGenerating ? 'Generating digests...' : 'Generate daily digests'}
          </Button>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          Review and send daily digest emails to your clients. Generate digests to see today&apos;s alerts grouped by client list.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Pending Drafts"
          value={pendingCount}
          icon={<Mail className="h-5 w-5 text-gray-400" />}
        />
        <KpiCard
          title="Approved"
          value={approvedCount}
          icon={<MailCheck className="h-5 w-5 text-gray-400" />}
        />
        <KpiCard
          title="Ready to Send"
          value={readyToSendCount}
          icon={<Send className="h-5 w-5 text-gray-400" />}
        />
      </section>

      {pendingCount === 0 ? (
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
          <CardContent className="pt-6">
            <EmptyState
              title="No daily digests pending"
              description="Click &quot;Generate daily digests&quot; to create digest emails for lists with alerts today."
              icon={<Mail className="h-12 w-12 text-muted-foreground" />}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Pending Drafts
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client List</TableHead>
                  <TableHead>Digest Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map(({ draft, container }) => {
                  const metadata = (draft.metadata as DraftMetadata | null) ?? null
                  const listName = metadata?.list_name ?? metadata?.list_id ?? null
                  const isApproved = draft.approved_by_user_id !== null
                  const hasRecipientEmail = draft.to_email?.trim() !== '' && draft.to_email !== null
                  const canSend = isApproved && hasRecipientEmail
                  const isSending = sendingDraftId === draft.id

                  return (
                    <TableRow key={draft.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <TableCell className="text-sm text-[#1F2937]">
                        {listName ? (
                          <span className="font-medium">{listName}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[#6B7280] whitespace-nowrap">
                        {formatDateTime(draft.generated_at).split(',')[0]}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          Daily digest
                        </span>
                      </TableCell>
                      <TableCell className="max-w-sm">
                        <div className="font-medium text-[#1F2937]">{draft.subject}</div>
                      </TableCell>
                      <TableCell className="text-sm text-[#6B7280]">
                        {draft.to_email ? (
                          <span className="font-mono text-xs">{draft.to_email}</span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Not set
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isApproved ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize border-yellow-200 text-yellow-800 bg-yellow-50">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDialog({ draft, container })}
                            className="h-8 gap-1.5 rounded border border-[#D4D7DE] bg-white text-xs text-slate-600 hover:bg-[#EEF1F6]"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          {!isApproved && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleMarkReady(draft.id)}
                              disabled={isApproving}
                              className="h-8 gap-1.5 rounded text-xs"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {isApproving ? 'Marking...' : 'Mark ready'}
                            </Button>
                          )}
                          {canSend && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSendNow(draft.id, draft.to_email!)}
                              disabled={isSending}
                              className="h-8 gap-1.5 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {isSending ? 'Sending...' : 'Send now'}
                            </Button>
                          )}
                          {!hasRecipientEmail && (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              No email
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Edit Email Draft
            </DialogTitle>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4">
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Type:</span>
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                      Daily digest
                    </span>
                  </div>
                  {(selectedDraft.draft.metadata as DraftMetadata)?.list_name && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">List:</span>
                      <span className="font-medium">
                        {(selectedDraft.draft.metadata as DraftMetadata).list_name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to-email" className="text-sm font-medium">
                  To Email
                </Label>
                <Input
                  id="to-email"
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="border-[#D4D7DE]"
                />
                <p className="text-xs text-[#6B7280]">
                  Leave empty if recipient email is not yet known
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">
                  Subject
                </Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  required
                  className="border-[#D4D7DE]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body-text" className="text-sm font-medium">
                  Body
                </Label>
                <textarea
                  id="body-text"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Email body text"
                  rows={10}
                  className="w-full border border-[#D4D7DE] rounded-md px-3 py-2 bg-white text-[#1F2937] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              disabled={isSaving}
              className="border-[#D4D7DE] text-slate-600 hover:bg-[#EEF1F6]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving || !subject.trim() || !bodyText.trim()}
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

