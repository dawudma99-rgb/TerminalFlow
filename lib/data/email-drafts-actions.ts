'use server'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import {
  buildClientEmailDraft,
  type ClientEmailEventType,
} from '@/lib/email/clientEmailFormatter'
import { logger } from '@/lib/utils/logger'
import { sendAlertEmail } from '@/lib/email/sendAlertEmail'
import { getServerAuthContext, type ServerAuthContext } from '@/lib/auth/serverAuthContext'

type EmailDraftRow = Database['public']['Tables']['email_drafts']['Row']
type ContainerRow = Database['public']['Tables']['containers']['Row']
type EmailDraftStatus = Database['public']['Tables']['email_drafts']['Row']['status']

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

async function fetchContainer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  containerId: string,
  organizationId: string,
): Promise<ContainerRow | null> {
  const { data, error } = await supabase
    .from('containers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('id', containerId)
    .single()

  if (error) {
    logger.error('[email-drafts-actions] Failed to fetch container for email draft', {
      container_id: containerId,
      organization_id: organizationId,
      error: error.message,
    })
    return null
  }

  return data
}

async function findPendingDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    organizationId: string
    containerId: string
    eventType: ClientEmailEventType
  },
): Promise<EmailDraftRow | null> {
  const { data, error } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('organization_id', params.organizationId)
    .eq('container_id', params.containerId)
    .eq('event_type', params.eventType)
    .eq('status', 'pending')
    .maybeSingle()

  if (error) {
    logger.error('[email-drafts-actions] Failed to check for existing draft', {
      error: error.message,
      container_id: params.containerId,
      organization_id: params.organizationId,
      event_type: params.eventType,
    })
    return null
  }

  return data ?? null
}

/**
 * Create (or reuse an existing) pending email draft for a container event.
 *
 * This helper enforces tenant scoping, ensures idempotency per container/event,
 * and stores formatted subject/body/metadata for later approval.
 *
 * @param params.containerId - The container ID
 * @param params.eventType - The event type (lfd_warning, became_overdue, etc.)
 * @param params.generatedByUserId - Optional user ID who triggered this (for audit)
 * @param params.organizationId - Optional organization ID (if already known, avoids re-resolution)
 * @param params.supabase - Optional Supabase client (if already available)
 */
export async function createEmailDraftForContainerEvent(params: {
  containerId: string
  eventType: ClientEmailEventType
  generatedByUserId?: string
  organizationId?: string
  supabase?: Awaited<ReturnType<typeof createClient>>
}): Promise<EmailDraftRow | null> {
  logger.debug('[email-drafts-actions] Starting createEmailDraftForContainerEvent', {
    container_id: params.containerId,
    event_type: params.eventType,
    generated_by_user_id: params.generatedByUserId,
    organization_id_provided: !!params.organizationId,
  })

  // Use provided supabase client or create a new one
  let supabase: Awaited<ReturnType<typeof createClient>>
  let organizationId: string
  let userId: string | null = null

  if (params.supabase && params.organizationId) {
    // Use provided context
    supabase = params.supabase
    organizationId = params.organizationId
    // Try to get user ID if available
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // Ignore - userId will be null
    }
  } else {
    // Resolve context from auth
    const { supabase: resolvedSupabase, context } = await resolveOrgContext()
    supabase = resolvedSupabase

    if (!context) {
      logger.warn('[email-drafts-actions] No org context resolved - cannot create draft', {
        container_id: params.containerId,
        event_type: params.eventType,
      })
      return null
    }

    organizationId = context.organizationId
    userId = context.userId
  }

  logger.debug('[email-drafts-actions] Using organization context', {
    organization_id: organizationId,
    user_id: userId,
    container_id: params.containerId,
    event_type: params.eventType,
  })

  const container = await fetchContainer(supabase, params.containerId, organizationId)
  if (!container) {
    logger.warn('[email-drafts-actions] Container not found - cannot create draft', {
      container_id: params.containerId,
      organization_id: organizationId,
      event_type: params.eventType,
    })
    return null
  }

  logger.debug('[email-drafts-actions] Container fetched', {
    container_id: container.id,
    container_no: container.container_no,
    organization_id: organizationId,
  })

  const existingDraft = await findPendingDraft(supabase, {
    organizationId,
    containerId: container.id,
    eventType: params.eventType,
  })

  if (existingDraft) {
    logger.debug('[email-drafts-actions] Existing pending draft found - returning it', {
      draft_id: existingDraft.id,
      container_id: container.id,
      event_type: params.eventType,
    })
    return existingDraft
  }

  const draftContent = buildClientEmailDraft({
    container,
    eventType: params.eventType,
  })

  const insertPayload = {
    organization_id: organizationId,
    container_id: container.id,
    event_type: params.eventType,
    status: 'pending' as const,
    to_email: null,
    subject: draftContent.subject,
    body_text: draftContent.bodyText,
    metadata: draftContent.metadata,
    created_by_user_id: params.generatedByUserId ?? userId,
    approved_by_user_id: null,
    last_error: null,
  }

  logger.debug('[email-drafts-actions] Inserting email draft', {
    organization_id: insertPayload.organization_id,
    container_id: insertPayload.container_id,
    event_type: insertPayload.event_type,
    subject: insertPayload.subject.substring(0, 50),
    created_by_user_id: insertPayload.created_by_user_id,
  })

  const { data, error } = await supabase
    .from('email_drafts')
    .insert(insertPayload)
    .select('*')
    .single()

  if (error) {
    logger.error('[email-drafts-actions] Failed to insert email draft', {
      error: error.message,
      error_code: error.code,
      error_details: error.details,
      error_hint: error.hint,
      organization_id: organizationId,
      container_id: container.id,
      event_type: params.eventType,
      insert_payload: insertPayload,
    })
    return null
  }

  logger.info('[email-drafts-actions] Successfully created email draft', {
    draft_id: data.id,
    container_id: container.id,
    event_type: params.eventType,
    organization_id: organizationId,
  })

  return data
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


