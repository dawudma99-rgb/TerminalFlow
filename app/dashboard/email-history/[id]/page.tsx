import { fetchEmailDraftById } from '@/lib/data/email-drafts-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Mail } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'long',
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

function getListName(draft: any): string {
  const metadata = draft.metadata
  if (metadata && typeof metadata === 'object' && 'list_name' in metadata) {
    return metadata.list_name || '—'
  }
  return '—'
}

function getSentToEmails(draft: any): string[] {
  const sentTo = draft.sent_to_emails
  if (Array.isArray(sentTo)) {
    return sentTo
  }
  if (typeof sentTo === 'string' && sentTo) {
    return [sentTo]
  }
  // Fallback to to_email if sent_to_emails not available
  if (draft.to_email) {
    return [draft.to_email]
  }
  return []
}

export default async function EmailHistoryDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const draft = await fetchEmailDraftById(params.id)

  if (!draft) {
    notFound()
  }

  const sentAt = draft.sent_at ? new Date(draft.sent_at) : null
  const sentTo = getSentToEmails(draft)
  const listName = getListName(draft)
  const bodyHtml = (draft as any).body_html || null

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/email-history">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to history
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Sent at</div>
              <div className="text-sm">
                {sentAt ? formatDate(sentAt) : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Type</div>
              <div className="text-sm">{getEventTypeLabel(draft.event_type)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Client / List
              </div>
              <div className="text-sm">{listName}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Sent
                </span>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Recipients
              </div>
              <div className="text-sm">
                {sentTo.length > 0 ? sentTo.join(', ') : '—'}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Subject</div>
            <div className="text-base font-semibold">{draft.subject}</div>
          </div>

          {/* Body */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Email Body</div>
            {bodyHtml ? (
              <div
                className="border rounded-md p-4 bg-muted/50 overflow-auto max-h-[600px]"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <div className="border rounded-md p-4 bg-muted/50">
                <pre className="whitespace-pre-wrap text-sm font-mono">
                  {draft.body_text}
                </pre>
              </div>
            )}
          </div>

          {draft.last_error && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Last Error</div>
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {draft.last_error}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

