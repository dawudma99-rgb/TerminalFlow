/**
 * Complete list of milestone values accepted by Supabase and the UI.
 *
 * - `In Transit`
 * - `At Port`
 * - `In Demurrage`
 * - `Gate Out`
 * - `Returned Empty`
 * - `Closed`
 * - `Delayed`
 *
 * Use this constant to render dropdown options so the UI always stays in sync
 * with the database constraint.
 *
 * @example
 * ```ts
 * import { CONTAINER_MILESTONES } from '@/lib/utils/milestones'
 *
 * const options = CONTAINER_MILESTONES.map(label => ({ label, value: label }))
 * ```
 */
const RAW_MILESTONES = [
  'In Transit',
  'At Port',
  'In Demurrage',
  'Gate Out',
  'Returned Empty',
  'Closed',
  'Delayed',
] as const

export const CONTAINER_MILESTONES = RAW_MILESTONES

/**
 * Strongly typed milestone values derived from {@link CONTAINER_MILESTONES}.
 */
export type ContainerMilestone = (typeof CONTAINER_MILESTONES)[number]

/**
 * Default milestone applied when no reliable signal is available. Prefer this
 * value whenever the UI or a server action cannot confidently infer a more
 * specific state.
 */
export const DEFAULT_MILESTONE: ContainerMilestone = 'At Port'

const LEGACY_KEYS = {
  'in_transit': 'In Transit',
  'in transit': 'In Transit',
  transit: 'In Transit',
  at_port: 'At Port',
  'at port': 'At Port',
  yard: 'At Port',
  in_yard: 'At Port',
  gate_out: 'Gate Out',
  'gate-out': 'Gate Out',
  departed: 'Gate Out',
  returned: 'Returned Empty',
  returned_empty: 'Returned Empty',
  'returned empty': 'Returned Empty',
  'returned-empty': 'Returned Empty',
  delivered: 'Returned Empty',
  'delivered empty': 'Returned Empty',
  in_demurrage: 'In Demurrage',
  'in demurrage': 'In Demurrage',
  demurrage: 'In Demurrage',
  closed: 'Closed',
  delayed: 'Delayed',
  'on hold': 'Delayed',
  hold: 'Delayed',
  'on-hold': 'Delayed',
  'held': 'Delayed',
} as const satisfies Record<string, ContainerMilestone>

/**
 * Mapping of legacy milestone strings to the modern canonical set. Useful when
 * backfilling data imported from older systems.
 */
export const LEGACY_MILESTONE_MAP: Record<string, ContainerMilestone> = LEGACY_KEYS

const VALID_SET = new Set<string>(CONTAINER_MILESTONES)

/**
 * Type-level guard used to surface missing branches during development.
 */
export function assertNever(value: never, message: string): never {
  throw new Error(message)
}

/**
 * Determine whether the supplied value already matches one of the canonical
 * milestones.
 *
 * @example
 * ```ts
 * isValidMilestone('Gate Out') // true
 * isValidMilestone('Delivered') // false
 * ```
 */
export function isValidMilestone(value?: string | null): value is ContainerMilestone {
  if (!value) return false
  return VALID_SET.has(value.trim())
}

/**
 * Convert user- or legacy-provided text to a canonical milestone when
 * possible. Returns `null` when the string cannot be safely mapped.
 *
 * @example
 * ```ts
 * normalizeMilestone('Delivered') // 'Returned Empty'
 * normalizeMilestone('unknown') // null
 * ```
 */
export function normalizeMilestone(value?: string | null): ContainerMilestone | null {
  if (!value) return null
  const trimmed = value.trim()
  if (isValidMilestone(trimmed)) {
    return trimmed as ContainerMilestone
  }
  const legacy = LEGACY_MILESTONE_MAP[trimmed.toLowerCase()]
  return legacy ?? null
}

/**
 * Resolve the authoritative milestone value by inspecting a candidate string
 * and optional contextual fields available on the container record.
 *
 * Order of precedence:
 * 1. Canonical milestone string (via {@link normalizeMilestone}).
 * 2. Legacy value mapping.
 * 3. Context-driven fallback (`Returned Empty` or `Gate Out`).
 * 4. {@link DEFAULT_MILESTONE} when no better signal is present.
 *
 * @example
 * ```ts
 * resolveMilestone('Delivered') // 'Returned Empty'
 * resolveMilestone(null, { gate_out_date: '2024-01-01' }) // 'Gate Out'
 * resolveMilestone(undefined) // 'At Port'
 * ```
 */
export function resolveMilestone(
  candidate?: string | null,
  context?: { gate_out_date?: unknown; empty_return_date?: unknown }
): ContainerMilestone {
  const normalized = normalizeMilestone(candidate)
  if (normalized) return normalized

  if (context?.empty_return_date) {
    const fallback: ContainerMilestone = 'Returned Empty'
    if (isValidMilestone(fallback)) return fallback
    return assertNever(fallback as never, `Unhandled milestone fallback: ${fallback}`)
  }

  if (context?.gate_out_date) {
    const fallback: ContainerMilestone = 'Gate Out'
    if (isValidMilestone(fallback)) return fallback
    return assertNever(fallback as never, `Unhandled milestone fallback: ${fallback}`)
  }

  if (isValidMilestone(DEFAULT_MILESTONE)) {
    return DEFAULT_MILESTONE
  }

  return assertNever(DEFAULT_MILESTONE as never, 'Default milestone is not valid')
}

