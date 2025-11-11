'use server'

import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/utils/logger'
import {
  DEFAULT_MILESTONE,
  isValidMilestone,
  resolveMilestone,
} from '@/lib/utils/milestones'

export type LegacyMigrationSummary = {
  total: number
  candidates: number
  updated: number
  unchanged: number
  failures: Array<{ id: string; error: string }>
}

const BATCH_SIZE = 50

function chunk<T>(items: readonly T[], size: number): T[][] {
  const buckets: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    buckets.push(items.slice(i, i + size))
  }
  return buckets
}

/**
 * Normalize existing container milestones in Supabase so every record aligns
 * with the canonical set. Designed for operational use by admins or support
 * tooling.
 */
export async function migrateLegacyMilestones(): Promise<LegacyMigrationSummary> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('containers')
    .select('id, organization_id, milestone, gate_out_date, empty_return_date')

  if (error) {
    logger.error('migrateLegacyMilestones fetch error', { error })
    throw new Error(`Failed to load containers for milestone migration: ${error.message}`)
  }

  const summary: LegacyMigrationSummary = {
    total: data?.length ?? 0,
    candidates: 0,
    updated: 0,
    unchanged: 0,
    failures: [],
  }

  if (!data || data.length === 0) {
    logger.info('migrateLegacyMilestones no data')
    return summary
  }

  const needsReview = data.filter((record) => !isValidMilestone(record.milestone))
  summary.candidates = needsReview.length

  if (needsReview.length === 0) {
    logger.info('migrateLegacyMilestones nothing to normalize')
    return summary
  }

  for (const batch of chunk(needsReview, BATCH_SIZE)) {
    await Promise.all(
      batch.map(async (record) => {
        const normalized = resolveMilestone(record.milestone, {
          gate_out_date: record.gate_out_date,
          empty_return_date: record.empty_return_date,
        })

        if (normalized === record.milestone || (!record.milestone && normalized === DEFAULT_MILESTONE)) {
          summary.unchanged += 1
          return
        }

        const { error: updateError } = await supabase
          .from('containers')
          .update({ milestone: normalized })
          .eq('id', record.id)
          .eq('organization_id', record.organization_id)

        if (updateError) {
          summary.failures.push({ id: record.id, error: updateError.message })
          logger.error('migrateLegacyMilestones update error', { id: record.id, updateError })
          return
        }

        summary.updated += 1
      })
    )
  }

  logger.info('migrateLegacyMilestones complete', {
    total: summary.total,
    candidates: summary.candidates,
    updated: summary.updated,
    unchanged: summary.unchanged,
    failures: summary.failures.length,
  })

  return summary
}
