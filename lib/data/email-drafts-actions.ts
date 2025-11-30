'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { type ClientEmailEventType } from '@/lib/email/clientEmailFormatter'
import { logger } from '@/lib/utils/logger'
import { sendAlertEmail } from '@/lib/email/sendAlertEmail'
import { getServerAuthContext, type ServerAuthContext } from '@/lib/auth/serverAuthContext'
import { buildDailyDigestForList } from '@/lib/email/dailyDigestFormatter'
import { computeDerivedFields, type ContainerWithDerivedFields } from '@/lib/utils/containers'

type EmailDraftRow = Database['public']['Tables']['email_drafts']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']
type EmailDraftStatus = Database['public']['Tables']['email_drafts']['Row']['status']
type ListRow = Database['public']['Tables']['container_lists']['Row']

interface OrgContext {
  userId: string
  organizationId: string
}

async function resolveOrgContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>
  context: OrgContext | null
}> {
  try {
    const authContext = await getServerAuthContext()
    return {
      supabase: authContext.supabase,
      context: {
        userId: authContext.user.id,
        organizationId: authContext.organizationId,
      },
    }
  } catch (error) {
    logger.error('[email-drafts-actions] Exception resolving org context', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Return a supabase client even if auth fails (for graceful error handling)
    const supabase = await createClient()
    return { supabase, context: null }
  }
}

export interface EmailDraftWithContainer {
  draft: EmailDraftRow
  container: ContainerRow | null
}

const PENDING_STATUS: EmailDraftStatus = 'pending'

export async function fetchPendingEmailDraftsForCurrentOrg(): Promise<EmailDraftWithContainer[]> {
  const { supabase, context } = await resolveOrgContext()
  if (!context) {
    logger.debug('[email-drafts-actions] fetchPendingEmailDraftsForCurrentOrg: No context resolved, returning empty array')
    return []
  }

  logger.debug('[email-drafts-actions] fetchPendingEmailDraftsForCurrentOrg: Resolved organization context', {
    organization_id: context.organizationId,
    user_id: context.userId,
    pending_status_filter: PENDING_STATUS,
  })

  const { data: drafts, error: draftsError } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .eq('event_type', 'daily_digest')
    .order('generated_at', { ascending: false })
    .limit(200)

  if (draftsError) {
    logger.error('[email-drafts-actions] Failed to fetch pending drafts', {
      organization_id: context.organizationId,
      error: draftsError.message,
      error_code: draftsError.code,
      error_details: draftsError.details,
      error_hint: draftsError.hint,
    })
    return []
  }

  logger.debug('[email-drafts-actions] fetchPendingEmailDraftsForCurrentOrg: Supabase query completed', {
    organization_id: context.organizationId,
    drafts_returned: drafts?.length ?? 0,
    drafts_data: drafts?.map(d => ({
      id: d.id,
      container_id: d.container_id,
      event_type: d.event_type,
      status: d.status,
      organization_id: d.organization_id,
    })) ?? [],
  })

  if (!drafts || drafts.length === 0) {
    logger.debug('[email-drafts-actions] fetchPendingEmailDraftsForCurrentOrg: No drafts found or empty array', {
      organization_id: context.organizationId,
      drafts_is_null: drafts === null,
      drafts_length: drafts?.length ?? 0,
    })
    return []
  }

  const containerIds = Array.from(
    new Set(
      drafts
        .map((draft) => draft.container_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const containerMap = new Map<string, ContainerRow>()

  if (containerIds.length > 0) {
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('*')
      .eq('organization_id', context.organizationId)
      .in('id', containerIds)

    if (containersError) {
      logger.error('[email-drafts-actions] Failed to fetch containers for drafts', {
        organization_id: context.organizationId,
        error: containersError.message,
      })
    } else if (containers) {
      for (const container of containers) {
        containerMap.set(container.id, container)
      }
    }
  }

  const result = drafts.map((draft) => ({
    draft,
    container: containerMap.get(draft.container_id) ?? null,
  }))

  logger.debug('[email-drafts-actions] fetchPendingEmailDraftsForCurrentOrg: Returning final result', {
    organization_id: context.organizationId,
    final_result_length: result.length,
    containers_found: containerMap.size,
    containers_missing: result.filter(r => r.container === null).length,
  })

  return result
}

/**
 * Update the content of a pending email draft (to_email, subject, body_text).
 *
 * Only updates drafts that belong to the current organization and have status='pending'.
 * Does not modify status, sent_at, or skipped_at.
 */
export async function updateEmailDraftContent(params: {
  draftId: string
  toEmail: string | null
  subject: string
  bodyText: string
}): Promise<EmailDraftRow | null> {
  const { supabase, context } = await resolveOrgContext()

  if (!context) {
    return null
  }

  // Fetch the existing draft to verify it exists and belongs to the org
  const { data: existingDraft, error: fetchError } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', params.draftId)
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .single()

  if (fetchError || !existingDraft) {
    logger.warn('[email-drafts-actions] Draft not found or not pending', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: fetchError?.message,
    })
    return null
  }

  // Normalize empty string to null for to_email
  const normalizedToEmail = params.toEmail?.trim() === '' ? null : params.toEmail

  // Update the draft
  const { data: updatedDraft, error: updateError } = await supabase
    .from('email_drafts')
    .update({
      to_email: normalizedToEmail,
      subject: params.subject.trim(),
      body_text: params.bodyText,
    })
    .eq('id', params.draftId)
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .select('*')
    .single()

  if (updateError) {
    logger.error('[email-drafts-actions] Failed to update email draft content', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: updateError.message,
    })
    return null
  }

  return updatedDraft
}

/**
 * Mark a pending email draft as approved by setting approved_by_user_id.
 *
 * Only approves drafts that belong to the current organization and have status='pending'.
 * Does not modify status, sent_at, or skipped_at.
 */
export async function approveEmailDraft(params: {
  draftId: string
}): Promise<EmailDraftRow | null> {
  const { supabase, context } = await resolveOrgContext()

  if (!context) {
    return null
  }

  // Fetch the existing draft to verify it exists and belongs to the org
  const { data: existingDraft, error: fetchError } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', params.draftId)
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .single()

  if (fetchError || !existingDraft) {
    logger.warn('[email-drafts-actions] Draft not found or not pending for approval', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: fetchError?.message,
    })
    return null
  }

  // Update approved_by_user_id
  const { data: updatedDraft, error: updateError } = await supabase
    .from('email_drafts')
    .update({
      approved_by_user_id: context.userId,
    })
    .eq('id', params.draftId)
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .select('*')
    .single()

  if (updateError) {
    logger.error('[email-drafts-actions] Failed to approve email draft', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: updateError.message,
    })
    return null
  }

  return updatedDraft
}

/**
 * Send a client email for an approved pending draft.
 *
 * Validates that the draft is approved, has a recipient email, and required content.
 * On success, updates status to 'sent' and sets sent_at.
 * On failure, updates last_error but keeps status as 'pending' for retry.
 */
export async function sendClientEmailForDraft(params: {
  draftId: string
}): Promise<
  | { ok: true; draft: EmailDraftRow }
  | { ok: false; error: string }
> {
  const { supabase, context } = await resolveOrgContext()

  if (!context) {
    return { ok: false, error: 'User not authenticated' }
  }

  // Fetch the draft to verify it exists and belongs to the org
  const { data: draft, error: fetchError } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', params.draftId)
    .eq('organization_id', context.organizationId)
    .eq('status', PENDING_STATUS)
    .single()

  if (fetchError || !draft) {
    logger.warn('[email-drafts-actions] Draft not found or not pending for sending', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: fetchError?.message,
    })
    return { ok: false, error: 'Draft not found or not pending' }
  }

  // Validate business rules
  const toEmail = draft.to_email?.trim()
  if (!toEmail || toEmail === '') {
    return { ok: false, error: 'Recipient email is required' }
  }

  const subject = draft.subject.trim()
  if (!subject || subject === '') {
    return { ok: false, error: 'Email subject is required' }
  }

  const bodyText = draft.body_text.trim()
  if (!bodyText || bodyText === '') {
    return { ok: false, error: 'Email body is required' }
  }

  // Require approval before sending
  if (!draft.approved_by_user_id) {
    return { ok: false, error: 'Draft must be approved before sending' }
  }

  // Send the email via Resend
  try {
    const emailResult = await sendAlertEmail({
      to: toEmail,
      subject,
      text: bodyText,
    })

    if (!emailResult.success) {
      // Update last_error but keep status as 'pending' for retry
      const errorMessage = emailResult.error ?? 'Unknown error'
      const { error: updateError } = await supabase
        .from('email_drafts')
        .update({
          last_error: errorMessage,
        })
        .eq('id', params.draftId)
        .eq('organization_id', context.organizationId)

      if (updateError) {
        logger.error('[email-drafts-actions] Failed to update last_error', {
          draft_id: params.draftId,
          error: updateError.message,
        })
      }

      return { ok: false, error: `Failed to send email: ${errorMessage}` }
    }

    // On success, update status to 'sent' and set sent_at
    const { data: updatedDraft, error: updateError } = await supabase
      .from('email_drafts')
      .update({
        status: 'sent' as const,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', params.draftId)
      .eq('organization_id', context.organizationId)
      .select('*')
      .single()

    if (updateError) {
      logger.error('[email-drafts-actions] Failed to update draft status after sending', {
        draft_id: params.draftId,
        organization_id: context.organizationId,
        error: updateError.message,
      })
      // Email was sent but we couldn't update the status - this is a problem
      return { ok: false, error: 'Email sent but failed to update draft status' }
    }

    logger.info('[email-drafts-actions] Client email sent successfully', {
      draft_id: params.draftId,
      to: toEmail,
      organization_id: context.organizationId,
    })

    return { ok: true, draft: updatedDraft }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unexpected error'
    logger.error('[email-drafts-actions] Exception sending client email', {
      draft_id: params.draftId,
      organization_id: context.organizationId,
      error: errorMessage,
    })

    // Try to update last_error
    await supabase
      .from('email_drafts')
      .update({
        last_error: errorMessage,
      })
      .eq('id', params.draftId)
      .eq('organization_id', context.organizationId)

    return { ok: false, error: `Unexpected error: ${errorMessage}` }
  }
}

export type { ClientEmailEventType } from '@/lib/email/clientEmailFormatter'

// --- Daily Digest Helpers ---

/**
 * Fetch all container lists for the current organization.
 * Returns lists ordered by creation date (oldest first).
 */
async function fetchListsForOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<ListRow[]> {
  const { data, error } = await supabase
    .from('container_lists')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('[email-drafts-actions] fetchListsForOrg error', {
      organization_id: organizationId,
      error: error.message,
    })
    return []
  }

  return data ?? []
}

/**
 * Fetch containers for a list with derived fields computed.
 * Returns containers enriched with computed status, fees, etc.
 */
async function fetchContainersForListWithDerived(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  listId: string
}): Promise<Array<{ raw: ContainerRow; derived: ContainerWithDerivedFields }>> {
  const { supabase, organizationId, listId } = params

  const { data, error } = await supabase
    .from('containers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('list_id', listId)

  if (error) {
    logger.error('[email-drafts-actions] fetchContainersForListWithDerived error', {
      organization_id: organizationId,
      list_id: listId,
      error: error.message,
    })
    return []
  }

  if (!data || data.length === 0) {
    return []
  }

  // Compute derived fields for each container
  const enriched = data.map((c) => ({
    raw: c,
    derived: computeDerivedFields(c),
  }))

  return enriched
}

/**
 * Check if a digest draft for a given list already exists today.
 * Uses UTC date range to determine "today".
 */
async function hasDigestDraftForListToday(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  listId: string
}): Promise<boolean> {
  const { supabase, organizationId, listId } = params

  // We treat "today" in UTC
  const today = new Date()
  const isoDate = today.toISOString().split('T')[0] // "YYYY-MM-DD"

  // Query for existing digest draft using metadata->>list_id JSON path
  // We use a filter to check the JSONB field directly
  const { data, error } = await supabase
    .from('email_drafts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('event_type', 'daily_digest')
    .gte('generated_at', `${isoDate}T00:00:00.000Z`)
    .lte('generated_at', `${isoDate}T23:59:59.999Z`)
    .filter('metadata->>list_id', 'eq', listId)
    .limit(1)

  if (error) {
    logger.error('[email-drafts-actions] hasDigestDraftForListToday error', {
      list_id: listId,
      organization_id: organizationId,
      error: error.message,
    })
    return false
  }

  return (data?.length ?? 0) > 0
}

/**
 * Create daily digest email drafts for all lists in the current organization.
 * 
 * For each list:
 * - Fetches containers for that list and computes derived fields
 * - Builds digest content using buildDailyDigestForList (container-state-based)
 * - Creates an email_draft row with event_type = 'daily_digest'
 * - Skips lists with no containers in relevant states or if a digest already exists today
 * 
 * @returns { created: number } - Number of digest drafts created
 */
export async function createDailyDigestDraftsForToday(): Promise<{
  created: number
}> {
  let context: ServerAuthContext

  try {
    context = await getServerAuthContext()
  } catch {
    logger.warn('[email-drafts-actions] createDailyDigestDraftsForToday: No auth context')
    return { created: 0 }
  }

  const { supabase, organizationId, user } = context
  const userId = user?.id ?? null

  // 1) Get all lists for this org
  const lists = await fetchListsForOrg(supabase, organizationId)
  if (!lists.length) {
    logger.debug('[email-drafts-actions] createDailyDigestDraftsForToday: No lists found', {
      organization_id: organizationId,
    })
    return { created: 0 }
  }

  let createdCount = 0

  for (const list of lists) {
    // Safety check
    if (!list.id) continue

    // 2) Avoid creating multiple digests for same list+day
    const alreadyExists = await hasDigestDraftForListToday({
      supabase,
      organizationId,
      listId: list.id,
    })

    if (alreadyExists) {
      logger.debug('[email-drafts-actions] createDailyDigestDraftsForToday: Digest already exists', {
        list_id: list.id,
        list_name: list.name,
      })
      continue
    }

    // 3) Fetch containers for this list with derived fields
    try {
      const enriched = await fetchContainersForListWithDerived({
        supabase,
        organizationId,
        listId: list.id,
      })

      // If no containers, skip this list
      if (!enriched || enriched.length === 0) {
        logger.debug('[email-drafts-actions] createDailyDigestDraftsForToday: No containers for list', {
          list_id: list.id,
          list_name: list.name,
        })
        continue
      }

      // 4) Build the digest subject/body from container state
      const containers = enriched.map((e) => e.raw)
      const digest = buildDailyDigestForList({
        listName: list.name ?? 'Unnamed list',
        containers,
      })

      if (!digest) {
        logger.debug('[email-drafts-actions] createDailyDigestDraftsForToday: Digest builder returned null', {
          list_id: list.id,
          list_name: list.name,
        })
        continue
      }

      // 5) Insert a new email_draft row
      const metadata = {
        list_id: list.id,
        list_name: list.name,
        generated_from: 'daily_digest',
      }

      // Type assertion needed: container_id is nullable in DB but types haven't been regenerated
      const { error } = await supabase.from('email_drafts').insert({
        organization_id: organizationId,
        container_id: null as any, // this is a list-level digest (nullable in DB)
        event_type: 'daily_digest',
        status: 'pending',
        to_email: null, // forwarder will fill this in
        subject: digest.subject,
        body_text: digest.bodyText,
        metadata,
        created_by_user_id: userId,
        approved_by_user_id: null,
        last_error: null,
      } as any)

      if (error) {
        logger.error('[email-drafts-actions] createDailyDigestDraftsForToday insert error', {
          list_id: list.id,
          list_name: list.name,
          organization_id: organizationId,
          error: error.message,
        })
        continue
      }

      logger.info('[email-drafts-actions] createDailyDigestDraftsForToday: Created digest draft', {
        list_id: list.id,
        list_name: list.name,
        organization_id: organizationId,
        container_count: containers.length,
      })

      createdCount += 1
    } catch (error) {
      logger.error('[email-drafts-actions] createDailyDigestDraftsForToday: Error processing list', {
        list_id: list.id,
        list_name: list.name,
        error: error instanceof Error ? error.message : String(error),
      })
      // Continue with next list
      continue
    }
  }

  logger.info('[email-drafts-actions] createDailyDigestDraftsForToday: Completed', {
    organization_id: organizationId,
    total_lists: lists.length,
    created_count: createdCount,
  })

  return { created: createdCount }
}


