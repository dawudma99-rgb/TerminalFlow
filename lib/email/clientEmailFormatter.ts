import type { Database, Json } from '@/types/database'
import {
  computeDerivedFields,
  type ContainerRecord,
  type ContainerWithDerivedFields,
} from '@/lib/utils/containers'

type DbContainer = Database['public']['Tables']['containers']['Row']

/**
 * Event types supported by the client email queue.
 *
 * lfd_warning       - Free time almost exhausted (pre-overdue warning)
 * became_overdue    - Demurrage started, container overdue at destination
 * detention_started - Container remains out past LFD, detention charges accruing
 * gate_out          - Gate-out milestone confirmed
 * returned_empty    - Empty return confirmed, charges should end
 */
export type ClientEmailEventType =
  | 'lfd_warning'
  | 'became_overdue'
  | 'detention_started'
  | 'gate_out'
  | 'returned_empty'

export interface ClientEmailDraftInput {
  container: DbContainer
  eventType: ClientEmailEventType
  derived?: ContainerWithDerivedFields
}

export interface ClientEmailDraftContent {
  subject: string
  bodyText: string
  metadata: Json
}

function formatDate(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDays(value?: number | null): string {
  if (value === null || value === undefined) return 'unknown number of'
  const absolute = Math.abs(value)
  if (absolute === 0) return 'zero'
  return `${absolute} day${absolute === 1 ? '' : 's'}`
}

function buildLfdWarningCopy(container: DbContainer, derived: ContainerWithDerivedFields) {
  const daysLeft = derived.days_left ?? 0
  const subject = `Container ${container.container_no} – Free time running low`
  const bodyLines = [
    `Container ${container.container_no} at ${container.port ?? 'your destination port'} is almost out of free time.`,
    '',
    `Estimated free days remaining: ${formatDays(daysLeft)}.`,
    derived.lfd_date ? `Last free day: ${formatDate(derived.lfd_date)}.` : null,
    '',
    'Please arrange pickup or extend free time to avoid demurrage charges.',
  ].filter(Boolean)

  return {
    subject,
    bodyText: bodyLines.join('\n'),
  }
}

function buildBecameOverdueCopy(container: DbContainer, derived: ContainerWithDerivedFields) {
  const daysOverdue = derived.days_left ? Math.abs(Math.min(derived.days_left, 0)) : 0
  const subject = `Container ${container.container_no} – Overdue, demurrage started`
  const bodyLines = [
    `Container ${container.container_no} at ${container.port ?? 'the port'} is now overdue and demurrage is accruing.`,
    '',
    `Days overdue: ${formatDays(daysOverdue)}.`,
    derived.lfd_date ? `Last free day was ${formatDate(derived.lfd_date)}.` : null,
    `Estimated demurrage charges so far: $${derived.demurrage_fees.toFixed(2)}.`,
    '',
    'Please arrange pickup or storage instructions immediately to limit additional fees.',
  ].filter(Boolean)

  return {
    subject,
    bodyText: bodyLines.join('\n'),
  }
}

function buildDetentionStartedCopy(container: DbContainer, derived: ContainerWithDerivedFields) {
  const chargeable = derived.detention_chargeable_days ?? 0
  const subject = `Container ${container.container_no} – Detention now accruing`
  const bodyLines = [
    `Container ${container.container_no} has been out past the allowed free time and detention is now accruing.`,
    '',
    container.gate_out_date ? `Gate out date: ${formatDate(container.gate_out_date)}.` : null,
    derived.lfd_date ? `Detention LFD: ${formatDate(derived.lfd_date)}.` : null,
    `Chargeable detention days: ${formatDays(chargeable)}.`,
    `Estimated detention charges so far: $${derived.detention_fees.toFixed(2)}.`,
    '',
    'Please coordinate the empty return as soon as possible to stop additional detention charges.',
  ].filter(Boolean)

  return {
    subject,
    bodyText: bodyLines.join('\n'),
  }
}

function buildGateOutCopy(container: DbContainer) {
  const subject = `Container ${container.container_no} – Gate out confirmed`
  const bodyLines = [
    `Container ${container.container_no} has gated out.`,
    container.gate_out_date ? `Gate out date: ${formatDate(container.gate_out_date)}.` : null,
    container.port ? `Port / ramp: ${container.port}.` : null,
    '',
    'We will continue to monitor detention and return milestones.',
  ].filter(Boolean)

  return {
    subject,
    bodyText: bodyLines.join('\n'),
  }
}

function buildReturnedEmptyCopy(container: DbContainer) {
  const subject = `Container ${container.container_no} – Empty returned`
  const bodyLines = [
    `Container ${container.container_no} has been returned empty.`,
    container.empty_return_date ? `Empty return date: ${formatDate(container.empty_return_date)}.` : null,
    '',
    'Demurrage and detention charges should stop once the terminal processes the return.',
  ].filter(Boolean)

  return {
    subject,
    bodyText: bodyLines.join('\n'),
  }
}

/**
 * Generate user-friendly subject/body metadata blocks for client emails.
 *
 * This function is pure (no DB access) and can be shared by server actions
 * when generating drafts or previewing emails in the UI.
 */
export function buildClientEmailDraft(input: ClientEmailDraftInput): ClientEmailDraftContent {
  const { container, eventType } = input
  const derived =
    input.derived ??
    computeDerivedFields(container as unknown as ContainerRecord)

  let content: { subject: string; bodyText: string }

  switch (eventType) {
    case 'lfd_warning':
      content = buildLfdWarningCopy(container, derived)
      break
    case 'became_overdue':
      content = buildBecameOverdueCopy(container, derived)
      break
    case 'detention_started':
      content = buildDetentionStartedCopy(container, derived)
      break
    case 'gate_out':
      content = buildGateOutCopy(container)
      break
    case 'returned_empty':
      content = buildReturnedEmptyCopy(container)
      break
    default:
      content = {
        subject: `Container ${container.container_no} update`,
        bodyText: `There is an update for container ${container.container_no}.`,
      }
  }

  const metadata: Json = {
    event_type: eventType,
    container_id: container.id,
    container_no: container.container_no,
    port: container.port,
    milestone: container.milestone,
    days_left: derived.days_left,
    demurrage_fees: derived.demurrage_fees,
    detention_fees: derived.detention_fees,
    detention_chargeable_days: derived.detention_chargeable_days,
    lfd_date: derived.lfd_date,
    arrival_date: container.arrival_date,
    gate_out_date: container.gate_out_date,
    empty_return_date: container.empty_return_date,
  }

  return {
    subject: content.subject,
    bodyText: content.bodyText,
    metadata,
  }
}


