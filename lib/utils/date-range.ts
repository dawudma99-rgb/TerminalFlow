/**
 * Date range utilities for time-based queries.
 * 
 * All functions use UTC to ensure consistent behavior across timezones
 * and are safe to use in server actions.
 */

/**
 * Returns the start of today (00:00 UTC) and the current time.
 * 
 * Useful for querying records created "today" in UTC timezone.
 * 
 * @returns { start: Date, end: Date } - Start of today (00:00 UTC) and current time
 * 
 * @example
 * const { start, end } = getTodayUtcRange()
 * // Query alerts created between start and end
 */
export function getTodayUtcRange(): { start: Date; end: Date } {
  const now = new Date()

  const startOfTodayUtc = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    )
  )

  return {
    start: startOfTodayUtc,
    end: now,
  }
}


