import { fetchSentEmailDraftsForCurrentOrg } from '@/lib/data/email-drafts-actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { History } from 'lucide-react'
import Link from 'next/link'

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

export default async function EmailHistoryPage() {
  const drafts = await fetchSentEmailDraftsForCurrentOrg()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Email history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {drafts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No sent emails yet.</p>
              <p className="text-sm mt-2">
                Sent emails will appear here after you send them from{' '}
                <Link href="/dashboard/client-updates" className="text-primary hover:underline">
                  Client Updates
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Sent at
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Subject
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Client / List
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((draft) => {
                    const sentAt = draft.sent_at
                      ? new Date(draft.sent_at)
                      : null
                    const sentTo = getSentToEmails(draft)
                    const listName = getListName(draft)

                    return (
                      <tr key={draft.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4 text-sm">
                          {sentAt ? formatDate(sentAt) : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm">{getEventTypeLabel(draft.event_type)}</td>
                        <td className="py-3 px-4 text-sm font-medium">{draft.subject}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {listName}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Sent
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/dashboard/email-history/${draft.id}`}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

