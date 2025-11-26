import { fetchPendingEmailDraftsForCurrentOrg } from '@/lib/data/email-drafts-actions'
import { ClientUpdatesPageContent } from './ClientUpdatesPageContent'
import { logger } from '@/lib/utils/logger'

export default async function ClientUpdatesPage() {
  const drafts = await fetchPendingEmailDraftsForCurrentOrg()

  logger.debug('[ClientUpdatesPage] Server component received drafts', {
    drafts_length: drafts.length,
    drafts_ids: drafts.map(d => d.draft.id),
    drafts_organization_ids: drafts.map(d => d.draft.organization_id),
    drafts_statuses: drafts.map(d => d.draft.status),
  })

  return <ClientUpdatesPageContent drafts={drafts} />
}


