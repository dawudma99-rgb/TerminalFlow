import { backfillOverdueAlertsForCurrentOrg, backfillWarningAlertsForCurrentOrg } from '@/lib/data/overdue-sweep'
import { logger } from '@/lib/utils/logger'
import { DashboardContent } from './DashboardContent'

/**
 * Server component wrapper for the Dashboard page.
 * 
 * Automatically runs the overdue and warning alerts backfill on page load to ensure
 * internal alerts appear for overdue and warning containers without requiring manual updates.
 * 
 * The backfills run in the background and do not block page rendering.
 * If they fail, the dashboard still renders normally.
 */
export default async function DashboardPage() {
  // Kick off both backfills in the background
  void Promise.allSettled([
    backfillOverdueAlertsForCurrentOrg(),
    backfillWarningAlertsForCurrentOrg(),
  ]).then((results) => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const label = index === 0 ? 'overdue' : 'warning'
        logger.error(`[DashboardPage] Failed to backfill ${label} alerts`, {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        })
      }
    })
  })

  // Immediately render dashboard UI
  return <DashboardContent />
}
