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
  // Run the overdue backfill automatically on dashboard load
  // This ensures overdue containers get alerts created automatically
  // Errors are caught and logged but don't block dashboard rendering
  try {
    await backfillOverdueAlertsForCurrentOrg()
  } catch (err) {
    // Log error but don't block dashboard rendering
    logger.error('[DashboardPage] Failed to backfill overdue alerts', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Run the warning backfill automatically on dashboard load
  // This ensures warning containers get alerts created automatically
  // Errors are caught and logged but don't block dashboard rendering
  try {
    await backfillWarningAlertsForCurrentOrg()
  } catch (err) {
    // Log error but don't block dashboard rendering
    logger.error('[DashboardPage] Failed to backfill warning alerts', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Render the client component dashboard UI
  return <DashboardContent />
}
