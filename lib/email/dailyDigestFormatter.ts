import type { Database } from '@/types/database'
import { computeDerivedFields, type ContainerWithDerivedFields } from '@/lib/utils/containers'
import { getTodayUtcRange } from '@/lib/utils/date-range'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export function buildDailyDigestForList(params: {
  listName: string
  containers: ContainerRow[]
}): { subject: string; bodyText: string } | null {
  const { listName, containers } = params

  // No containers → return null so caller can skip creating a digest
  if (!containers || containers.length === 0) {
    return null
  }

  const now = new Date()
  const { start } = getTodayUtcRange()

  // Compute derived fields for each container
  const enriched = containers.map((c) => ({
    raw: c,
    derived: computeDerivedFields(c),
  }))

  // Build 4 buckets based on current container state
  const overdue = enriched.filter((e) => e.derived.status === 'Overdue')
  const warning = enriched.filter((e) => e.derived.status === 'Warning')
  const detention = enriched.filter(
    (e) => (e.derived.detention_chargeable_days ?? 0) > 0
  )
  const closedToday = enriched.filter((e) => {
    if (!e.raw.is_closed) return false
    const updated = e.raw.updated_at ? new Date(e.raw.updated_at) : null
    if (!updated) return false
    // Use UTC day comparison: same UTC date as "start" (start-of-today-UTC)
    return (
      updated.getUTCFullYear() === start.getUTCFullYear() &&
      updated.getUTCMonth() === start.getUTCMonth() &&
      updated.getUTCDate() === start.getUTCDate()
    )
  })

  // If all buckets are empty, nothing interesting to say
  if (
    overdue.length === 0 &&
    warning.length === 0 &&
    detention.length === 0 &&
    closedToday.length === 0
  ) {
    return null
  }

  const warningCount = warning.length
  const overdueCount = overdue.length
  const detentionCount = detention.length
  const closedCount = closedToday.length

  // ---- SUBJECT ----

  const subjectParts: string[] = []

  if (overdueCount > 0) subjectParts.push(`${overdueCount} overdue`)
  if (warningCount > 0) subjectParts.push(`${warningCount} in warning`)
  if (detentionCount > 0) subjectParts.push(`${detentionCount} in detention`)
  if (closedCount > 0) subjectParts.push(`${closedCount} closed`)

  const summaryText =
    subjectParts.length > 0 ? subjectParts.join(', ') : 'no changes'

  const subject = `Daily update – ${listName} (${summaryText})`

  // ---- BODY ----

  const lines: string[] = []

  lines.push(`Daily update for ${listName}`)
  lines.push('')
  lines.push(
    `Summary: ${overdueCount} overdue, ${warningCount} in warning, ${detentionCount} with detention started, ${closedCount} closed today.`
  )
  lines.push('')

  // Helper to get a readable container label
  const getContainerLabel = (c: ContainerRow) => {
    const cn = c.container_no
    // pod may not exist in DB schema but is used in codebase (see ContainerRecord type)
    const pod = (c as any).pod || c.port || null

    if (cn && pod) return `${cn} – ${pod}`
    if (cn) return cn
    return `Container ${c.id}`
  }

  // Overdue
  if (overdue.length > 0) {
    lines.push('Overdue containers (demurrage started):')
    for (const { raw, derived } of overdue) {
      const label = getContainerLabel(raw)
      const daysOverdue =
        derived.days_left !== null ? Math.abs(derived.days_left) : null
      const estFees = derived.demurrage_fees
      const extraBits: string[] = []

      if (daysOverdue !== null && daysOverdue > 0)
        extraBits.push(`${daysOverdue} days overdue`)
      if (estFees > 0) extraBits.push(`est. fees ${estFees.toFixed(2)}`)

      const extras = extraBits.length > 0 ? ` (${extraBits.join(', ')})` : ''

      lines.push(`- ${label}${extras}`)
    }
    lines.push('')
  }

  // Warning
  if (warning.length > 0) {
    lines.push('Approaching last free day (in warning):')
    for (const { raw, derived } of warning) {
      const label = getContainerLabel(raw)
      const daysLeft = derived.days_left
      const lfd = derived.lfd_date

      const bits: string[] = []
      if (daysLeft !== null && daysLeft > 0)
        bits.push(`${daysLeft} days left of free time`)
      if (lfd) bits.push(`LFD: ${lfd}`)

      const extras = bits.length > 0 ? ` (${bits.join(', ')})` : ''

      lines.push(`- ${label}${extras}`)
    }
    lines.push('')
  }

  // Detention started
  if (detention.length > 0) {
    lines.push('Detention started:')
    for (const { raw, derived } of detention) {
      const label = getContainerLabel(raw)
      const detentionDays = derived.detention_chargeable_days

      const bits: string[] = []
      if (detentionDays !== null && detentionDays > 0)
        bits.push(`${detentionDays} chargeable days so far`)

      const extras = bits.length > 0 ? ` (${bits.join(', ')})` : ''

      lines.push(`- ${label}${extras}`)
    }
    lines.push('')
  }

  // Closed today
  if (closedToday.length > 0) {
    lines.push('Recently closed containers:')
    for (const { raw } of closedToday) {
      const label = getContainerLabel(raw)
      const milestone = raw.milestone
      const extras = milestone ? ` (${milestone})` : ''

      lines.push(`- ${label}${extras}`)
    }
    lines.push('')
  }

  lines.push('')
  lines.push('Reply to this email or contact your forwarder if you need changes.')
  lines.push('')

  const bodyText = lines.join('\n')

  return { subject, bodyText }
}
