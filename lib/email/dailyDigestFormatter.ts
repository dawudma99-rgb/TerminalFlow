import type { Database } from '@/types/database'
import { computeDerivedFields, type ContainerWithDerivedFields } from '@/lib/utils/containers'
import { logger } from '@/lib/utils/logger'
import type { DigestTimeWindow } from '@/lib/data/email-drafts-actions'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export function buildDailyDigestForList(params: {
  listName: string
  containers: ContainerRow[]
  organizationName?: string | null
  timeWindow: DigestTimeWindow
}): { subject: string; bodyText: string; bodyHtml: string } | null {
  const { listName, containers, organizationName, timeWindow } = params

  // No containers → return null so caller can skip creating a digest
  if (!containers || containers.length === 0) {
    return null
  }

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
  // Closed containers: any container in the fetched set that is closed
  // The query layer already filters by updated_at when timeWindow is not 'all',
  // so we only need to check is_closed here
  const closed = enriched.filter((e) => e.raw.is_closed)

  const overdueCount = overdue.length
  const warningCount = warning.length
  const detentionCount = detention.length
  const closedCount = closed.length

  logger.debug('[dailyDigestFormatter] buildDailyDigestForList: Bucket counts', {
    listName,
    totalContainers: containers.length,
    overdueCount,
    warningCount,
    detentionCount,
    closedCount,
  })

  // If all buckets are empty, nothing interesting to say
  if (
    overdue.length === 0 &&
    warning.length === 0 &&
    detention.length === 0 &&
    closed.length === 0
  ) {
    return null
  }

  // ---- SUBJECT ----

  function getTimeWindowLabel(timeWindow: DigestTimeWindow): string {
    switch (timeWindow) {
      case 'last_24_hours':
        return 'last 24 hours'
      case 'last_3_days':
        return 'last 3 days'
      case 'all':
      default:
        return 'all activity'
    }
  }

  // Build optional counts for subject
  const subjectCounts: string[] = []
  if (overdueCount > 0) subjectCounts.push(`${overdueCount} overdue`)
  if (warningCount > 0) subjectCounts.push(`${warningCount} at risk`)

  const countsText = subjectCounts.length > 0 ? ` (${subjectCounts.join(', ')})` : ''

  const windowLabel = getTimeWindowLabel(timeWindow)
  const subject = `Container update – ${listName} (${windowLabel})${countsText}`

  // ---- BODY ----

  // Helper to get container number and port
  const getContainerDisplay = (c: ContainerRow) => {
    const cn = c.container_no || `Container ${c.id}`
    const port = (c as any).pod || (c as any).pol || null
    return { container_no: cn, port }
  }

  // Helper to format date for closed containers
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return null
    }
  }

  // Build HTML email
  const htmlParts: string[] = []

  htmlParts.push(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px 20px 40px; background-color: #ffffff;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827;">Container update – ${escapeHtml(listName)}</h1>
            </td>
          </tr>
          
          <!-- Intro -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                Hi,
              </p>
              <p style="margin: 0 0 0 0; font-size: 15px; line-height: 1.6; color: #374151;">
                Here's an overview of your active containers. We've highlighted urgent and at-risk containers so you can act early and avoid charges.
              </p>
            </td>
          </tr>
          
          <!-- Summary -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 20px;">
  `)

  // Add summary counts (only non-zero)
  if (overdueCount > 0 || detentionCount > 0 || warningCount > 0 || closedCount > 0) {
    htmlParts.push('<tr><td style="padding: 0;">')
    htmlParts.push('<table width="100%" cellpadding="0" cellspacing="0">')
    
    if (overdueCount > 0) {
      htmlParts.push(`
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #374151;">
            <strong style="color: #dc2626;">${overdueCount}</strong> overdue container${overdueCount !== 1 ? 's' : ''}
          </td>
        </tr>
      `)
    }
    if (detentionCount > 0) {
      htmlParts.push(`
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #374151;">
            <strong style="color: #dc2626;">${detentionCount}</strong> in detention
          </td>
        </tr>
      `)
    }
    if (warningCount > 0) {
      htmlParts.push(`
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #374151;">
            <strong style="color: #d97706;">${warningCount}</strong> at risk (free time ending soon)
          </td>
        </tr>
      `)
    }
    if (closedCount > 0) {
      htmlParts.push(`
        <tr>
          <td style="padding: 4px 0; font-size: 14px; color: #374151;">
            <strong style="color: #059669;">${closedCount}</strong> closed container${closedCount !== 1 ? 's' : ''}
          </td>
        </tr>
      `)
    }
    
    htmlParts.push('</table>')
    htmlParts.push('</td></tr>')
  }

  htmlParts.push(`
              </table>
            </td>
          </tr>
  `)

  // Overdue / demurrage running section
  if (overdue.length > 0) {
    htmlParts.push(`
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #dc2626;">Overdue / demurrage running</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Container</th>
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Status</th>
                </tr>
    `)
    
    for (const { raw, derived } of overdue) {
      const { container_no, port } = getContainerDisplay(raw)
      const daysOverdue = derived.days_left !== null ? Math.abs(derived.days_left) : null
      const displayText = daysOverdue !== null && daysOverdue > 0 
        ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`
        : 'Overdue'
      
      htmlParts.push(`
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 0; font-size: 14px; color: #111827; font-weight: 500;">
                    ${escapeHtml(container_no)}${port ? ` (${escapeHtml(port)})` : ''}
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #dc2626;">
                    ${escapeHtml(displayText)}
                  </td>
                </tr>
      `)
    }
    
    htmlParts.push(`
              </table>
            </td>
          </tr>
    `)
  }

  // Detention running section
  if (detention.length > 0) {
    htmlParts.push(`
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #dc2626;">Detention running</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Container</th>
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Status</th>
                </tr>
    `)
    
    for (const { raw, derived } of detention) {
      const { container_no, port } = getContainerDisplay(raw)
      const detentionDays = derived.detention_chargeable_days
      const displayText = detentionDays !== null && detentionDays > 0
        ? `Detention: ${detentionDays} day${detentionDays !== 1 ? 's' : ''}`
        : 'Detention'
      
      htmlParts.push(`
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 0; font-size: 14px; color: #111827; font-weight: 500;">
                    ${escapeHtml(container_no)}${port ? ` (${escapeHtml(port)})` : ''}
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #dc2626;">
                    ${escapeHtml(displayText)}
                  </td>
                </tr>
      `)
    }
    
    htmlParts.push(`
              </table>
            </td>
          </tr>
    `)
  }

  // At risk section
  if (warning.length > 0) {
    htmlParts.push(`
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #d97706;">At risk (free time ending soon)</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Container</th>
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Status</th>
                </tr>
    `)
    
    for (const { raw, derived } of warning) {
      const { container_no, port } = getContainerDisplay(raw)
      const daysLeft = derived.days_left
      const displayText = daysLeft !== null && daysLeft > 0
        ? `Free time: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
        : 'At risk'
      
      htmlParts.push(`
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 0; font-size: 14px; color: #111827; font-weight: 500;">
                    ${escapeHtml(container_no)}${port ? ` (${escapeHtml(port)})` : ''}
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #d97706;">
                    ${escapeHtml(displayText)}
                  </td>
                </tr>
      `)
    }
    
    htmlParts.push(`
              </table>
            </td>
          </tr>
    `)
  }

  // Closed containers section
  if (closed.length > 0) {
    htmlParts.push(`
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #059669;">Closed containers</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Container</th>
                  <th style="text-align: left; padding: 10px 0; font-size: 13px; font-weight: 600; color: #6b7280;">Status</th>
                </tr>
    `)
    
    for (const { raw } of closed) {
      const { container_no, port } = getContainerDisplay(raw)
      const updatedDate = formatDate(raw.updated_at)
      const displayText = updatedDate ? `Closed on ${updatedDate}` : 'Closed'
      
      htmlParts.push(`
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 0; font-size: 14px; color: #111827; font-weight: 500;">
                    ${escapeHtml(container_no)}${port ? ` (${escapeHtml(port)})` : ''}
                  </td>
                  <td style="padding: 12px 0; font-size: 14px; color: #059669;">
                    ${escapeHtml(displayText)}
                  </td>
                </tr>
      `)
    }
    
    htmlParts.push(`
              </table>
            </td>
          </tr>
    `)
  }

  // Closing
  const closingName = organizationName || 'Your forwarding team'
  
  htmlParts.push(`
          <!-- Closing -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
                If you'd like us to prioritize specific containers, just reply to this email.
              </p>
              <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #374151;">
                Best regards,<br>
                ${escapeHtml(closingName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `)

  const bodyHtml = htmlParts.join('')

  // Build plain text version
  const lines: string[] = []

  lines.push(`Container update – ${listName}`)
  lines.push('')
  lines.push('Hi,')
  lines.push('')
  lines.push("Here's an overview of your active containers. We've highlighted urgent and at-risk containers so you can act early and avoid charges.")
  lines.push('')
  lines.push('Summary:')
  if (overdueCount > 0) lines.push(`- ${overdueCount} overdue container${overdueCount !== 1 ? 's' : ''}`)
  if (detentionCount > 0) lines.push(`- ${detentionCount} in detention`)
  if (warningCount > 0) lines.push(`- ${warningCount} at risk (free time ending soon)`)
  if (closedCount > 0) lines.push(`- ${closedCount} closed container${closedCount !== 1 ? 's' : ''}`)
  lines.push('')

  if (overdue.length > 0) {
    lines.push('Overdue / demurrage running:')
    for (const { raw, derived } of overdue) {
      const { container_no, port } = getContainerDisplay(raw)
      const daysOverdue = derived.days_left !== null ? Math.abs(derived.days_left) : null
      const displayText = daysOverdue !== null && daysOverdue > 0 
        ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`
        : 'Overdue'
      lines.push(`  ${container_no}${port ? ` (${port})` : ''} – ${displayText}`)
    }
    lines.push('')
  }

  if (detention.length > 0) {
    lines.push('Detention running:')
    for (const { raw, derived } of detention) {
      const { container_no, port } = getContainerDisplay(raw)
      const detentionDays = derived.detention_chargeable_days
      const displayText = detentionDays !== null && detentionDays > 0
        ? `Detention: ${detentionDays} day${detentionDays !== 1 ? 's' : ''}`
        : 'Detention'
      lines.push(`  ${container_no}${port ? ` (${port})` : ''} – ${displayText}`)
    }
    lines.push('')
  }

  if (warning.length > 0) {
    lines.push('At risk (free time ending soon):')
    for (const { raw, derived } of warning) {
      const { container_no, port } = getContainerDisplay(raw)
      const daysLeft = derived.days_left
      const displayText = daysLeft !== null && daysLeft > 0
        ? `Free time: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`
        : 'At risk'
      lines.push(`  ${container_no}${port ? ` (${port})` : ''} – ${displayText}`)
    }
    lines.push('')
  }

  if (closed.length > 0) {
    lines.push('Closed containers:')
    for (const { raw } of closed) {
      const { container_no, port } = getContainerDisplay(raw)
      const updatedDate = formatDate(raw.updated_at)
      const displayText = updatedDate ? `Closed on ${updatedDate}` : 'Closed'
      lines.push(`  ${container_no}${port ? ` (${port})` : ''} – ${displayText}`)
    }
    lines.push('')
  }

  lines.push('')
  lines.push("If you'd like us to prioritize specific containers, just reply to this email.")
  lines.push('')
  lines.push(`Best regards,`)
  lines.push(closingName)

  const bodyText = lines.join('\n')

  return { subject, bodyText, bodyHtml }
}

// Helper to escape HTML
function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
