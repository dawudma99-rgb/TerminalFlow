import { fetchPendingEmailDraftsForCurrentOrg, fetchSentEmailDraftsForCurrentOrg } from '@/lib/data/email-drafts-actions'
import { ClientUpdatesPageContent } from './ClientUpdatesPageContent'
import { logger } from '@/lib/utils/logger'

export default async function ClientUpdatesPage() {
  const [drafts, sentEmails] = await Promise.all([
    fetchPendingEmailDraftsForCurrentOrg(),
    fetchSentEmailDraftsForCurrentOrg(),
  ])

  logger.debug('[ClientUpdatesPage] Server component received data', {
    drafts_length: drafts.length,
    sent_emails_length: sentEmails.length,
  })

  return <ClientUpdatesPageContent drafts={drafts} sentEmails={sentEmails} />
}


