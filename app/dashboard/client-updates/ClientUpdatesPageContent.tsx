'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Edit2, CheckCircle2, Send, MailCheck, Clock, AlertCircle, History } from 'lucide-react'
import { toast } from 'sonner'

import {
  updateEmailDraftContent,
  approveEmailDraft,
  sendClientEmailForDraft,
  createDailyDigestDraftsForToday,
  type EmailDraftWithContainer,
  type ClientEmailEventType,
  type EmailDraftRow,
  type DigestTimeWindow,
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
import { useListsContext } from '@/components/providers/ListsProvider'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

type DraftMetadata = {
  port?: string | null
  list_id?: string | null
  list_name?: string | null
  generated_from?: string | null
}

const EVENT_LABELS: Record<ClientEmailEventType, string> = {
  daily_digest: 'Digest',
}

const DIGEST_TIMEWINDOW_LABELS: Record<DigestTimeWindow, string> = {
  all: 'All time',
  last_24_hours: 'Last 24 hours',
  last_3_days: 'Last 3 days',
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

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function getEventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'daily_digest':
      return 'Digest'
    case 'became_overdue':
      return 'Overdue Alert'
    case 'detention_started':
      return 'Detention Alert'
    case 'lfd_warning':
      return 'Warning Alert'
    case 'container_closed':
      return 'Container Closed'
    default:
      return eventType.replace(/_/g, ' ')
  }
}

function getSentToEmails(draft: EmailDraftRow): string[] {
  const sentTo = draft.sent_to_emails
  if (Array.isArray(sentTo) && sentTo.length > 0) {
    return sentTo
  }
  // Fallback to to_email if sent_to_emails is not available
  if (draft.to_email) {
    return [draft.to_email]
  }
  return []
}

function formatRecipientsForDisplay(recipients: string[]): string {
  if (recipients.length === 0) {
    return '—'
  }
  if (recipients.length === 1) {
    return recipients[0]
  }
  return `${recipients.length} recipients`
}

function getListNameFromDraft(draft: any): string {
  const metadata = draft.metadata
  if (metadata && typeof metadata === 'object' && 'list_name' in metadata) {
    return metadata.list_name || '—'
  }
  return '—'
}

function getPortLabel(metadata: DraftMetadata | null, containerPort?: string | null) {
  return containerPort ?? metadata?.port ?? '—'
}

interface ClientUpdatesPageContentProps {
  drafts: EmailDraftWithContainer[]
  sentEmails: EmailDraftRow[]
}

export function ClientUpdatesPageContent({ drafts, sentEmails }: ClientUpdatesPageContentProps) {
  const [activeTab, setActiveTab] = useState<'drafts' | 'sent'>('drafts')
  const router = useRouter()
  const { lists } = useListsContext()
  const [selectedDraft, setSelectedDraft] = useState<EmailDraftWithContainer | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [isApproving, startApproving] = useTransition()
  const [isGenerating, startGenerating] = useTransition()
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null)
  const [timeWindow, setTimeWindow] = useState<DigestTimeWindow>('all')

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

  type GenerateDigestChoice =
    | { mode: 'all' }
    | { mode: 'single'; listId: string; listName?: string | null }

  const handleGenerateDailyDigestChoice = (choice: GenerateDigestChoice) => {
    startGenerating(async () => {
      try {
        let result
        const windowLabel = DIGEST_TIMEWINDOW_LABELS[timeWindow]

        if (choice.mode === 'all') {
          result = await createDailyDigestDraftsForToday({ timeWindow })
        } else {
          result = await createDailyDigestDraftsForToday({
            listId: choice.listId,
            timeWindow,
          })
        }

        const createdCount = result?.created ?? 0

        if (createdCount > 0) {
          if (choice.mode === 'all') {
            toast.success(`Created ${createdCount} digest draft(s) across all lists.`)
          } else {
            const name = choice.listName ?? 'this list'
            toast.success(`Created ${createdCount} digest draft(s) for ${name}.`)
          }
        } else {
          if (choice.mode === 'all') {
            toast.info(`No digests created – no lists have containers in warning/overdue/detention in the selected time window (${windowLabel}).`)
          } else {
            const name = choice.listName ?? 'this list'
            toast.info(`No digest created for ${name} – no containers in warning/overdue/detention in the selected time window (${windowLabel}).`)
          }
        }

        router.refresh()
      } catch (err) {
        console.error('Failed to generate digests', err)
        if (choice.mode === 'all') {
          toast.error('Failed to generate digests. Please try again.')
        } else {
          const name = choice.listName ?? 'this list'
          toast.error(`Failed to generate digest for ${name}. Please try again.`)
        }
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
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Time window:
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value as DigestTimeWindow)}
                className="rounded-md border border-[#D4D7DE] px-2 py-1 text-sm bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isGenerating}
              >
                <option value="all">All time</option>
                <option value="last_24_hours">Last 24 hours</option>
                <option value="last_3_days">Last 3 days</option>
              </select>
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isGenerating || !lists || lists.length === 0}
                  className="border-[#D4D7DE] text-slate-600 hover:bg-[#EEF1F6]"
                >
                  {isGenerating ? 'Generating…' : 'Generate digests'}
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Choose client list</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleGenerateDailyDigestChoice({ mode: 'all' })}
              >
                All client lists
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {lists && lists.length > 0 ? (
                lists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={() =>
                      handleGenerateDailyDigestChoice({
                        mode: 'single',
                        listId: list.id,
                        listName: list.name ?? 'Untitled list',
                      })
                    }
                  >
                    {list.name ?? 'Untitled list'}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>No lists available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
        <p className="text-sm text-[#6B7280] mt-1">
          Review and send digest emails to your clients. Generate digests to see container alerts grouped by client list for the selected time window.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E5E7EB]">
        <button
          onClick={() => setActiveTab('drafts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'drafts'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          Drafts
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'sent'
              ? 'border-[#2563EB] text-[#2563EB]'
              : 'border-transparent text-[#6B7280] hover:text-[#1F2937]'
          }`}
        >
          Sent emails
        </button>
      </div>

      {activeTab === 'drafts' && (
        <>
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
                          Digest
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
        </>
      )}

      {activeTab === 'sent' && (
        <Card className="bg-white rounded-md border border-[#E5E7EB] shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Sent emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sentEmails.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No sent emails yet.</p>
                <p className="text-sm mt-2">
                  Sent emails will appear here after you send them from the Drafts tab.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sent at</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Client / List</TableHead>
                      <TableHead>Sent to</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentEmails.map((draft) => {
                      const sentAt = draft.sent_at ? new Date(draft.sent_at) : null
                      const listName = getListNameFromDraft(draft)
                      const recipients = getSentToEmails(draft)
                      const recipientsDisplay = formatRecipientsForDisplay(recipients)

                      return (
                        <TableRow key={draft.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <TableCell className="text-sm">
                            {sentAt ? formatDate(sentAt) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{getEventTypeLabel(draft.event_type)}</TableCell>
                          <TableCell className="text-sm font-medium">{draft.subject}</TableCell>
                          <TableCell className="text-sm text-[#6B7280]">{listName}</TableCell>
                          <TableCell className="text-sm text-[#6B7280]">
                            {recipients.length > 1 ? (
                              <span title={recipients.join(', ')}>{recipientsDisplay}</span>
                            ) : (
                              <span>{recipientsDisplay}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Sent
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/dashboard/client-updates/email/${draft.id}`}
                              className="text-sm text-[#007EA7] hover:underline font-medium"
                            >
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
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
                      Digest
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

