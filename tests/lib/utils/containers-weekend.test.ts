import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addChargeableDays,
  countChargeableDaysBetween,
} from '../../../lib/utils/containers'

/**
 * Helper to create a date (local timezone, start of day)
 */
function date(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Helper to get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(d: Date): number {
  return d.getDay()
}

test('addChargeableDays: Friday + 3 days, includeWeekends=false → Tuesday', () => {
  // Friday, Jan 5, 2024 (getDay() = 5)
  const friday = date(2024, 1, 5)
  assert.equal(getDayOfWeek(friday), 5, 'Start date should be Friday')
  
  // Friday + 3 business days = Friday (day 1), Monday (day 2), Tuesday (day 3) = Tuesday
  const result = addChargeableDays(friday, 3, false)
  assert.equal(getDayOfWeek(result), 2, 'Result should be Tuesday')
  assert.equal(result.getDate(), 9, 'Result should be Jan 9, 2024')
})

test('addChargeableDays: Saturday + 1 day, includeWeekends=false → Monday', () => {
  // Saturday, Jan 6, 2024 (getDay() = 6)
  const saturday = date(2024, 1, 6)
  assert.equal(getDayOfWeek(saturday), 6, 'Start date should be Saturday')
  
  // Saturday + 1 business day = Monday (skips Sunday)
  const result = addChargeableDays(saturday, 1, false)
  assert.equal(getDayOfWeek(result), 1, 'Result should be Monday')
  assert.equal(result.getDate(), 8, 'Result should be Jan 8, 2024')
})

test('addChargeableDays: Friday + 3 days, includeWeekends=true → Monday (calendar days)', () => {
  const friday = date(2024, 1, 5)
  const result = addChargeableDays(friday, 3, true)
  
  // Friday + 3 calendar days = Monday
  assert.equal(getDayOfWeek(result), 1, 'Result should be Monday')
  assert.equal(result.getDate(), 8, 'Result should be Jan 8, 2024')
})

test('countChargeableDaysBetween: count between dates across weekend differs between true/false', () => {
  // Friday, Jan 5, 2024 to Tuesday, Jan 9, 2024 (spans weekend)
  const friday = date(2024, 1, 5)  // Friday
  const tuesday = date(2024, 1, 9)  // Tuesday
  
  // With weekends: Friday, Saturday, Sunday, Monday, Tuesday = 5 days
  const withWeekends = countChargeableDaysBetween(friday, tuesday, true)
  assert.equal(withWeekends, 4, 'Should count 4 days (Fri, Sat, Sun, Mon) excluding Tuesday itself')
  
  // Without weekends: Friday, Monday = 2 days (excluding Sat, Sun, and Tuesday itself)
  const withoutWeekends = countChargeableDaysBetween(friday, tuesday, false)
  assert.equal(withoutWeekends, 2, 'Should count 2 business days (Fri, Mon) excluding Tuesday itself')
})

test('countChargeableDaysBetween: end <= start returns 0', () => {
  const start = date(2024, 1, 5)
  const sameDay = date(2024, 1, 5)  // Same day
  const earlier = date(2024, 1, 4)  // Earlier day
  
  // End equals start should return 0
  assert.equal(countChargeableDaysBetween(start, sameDay, true), 0)
  assert.equal(countChargeableDaysBetween(start, sameDay, false), 0)
  
  // End before start should return 0
  assert.equal(countChargeableDaysBetween(start, earlier, true), 0)
  assert.equal(countChargeableDaysBetween(start, earlier, false), 0)
})

test('countChargeableDaysBetween: single day span', () => {
  const friday = date(2024, 1, 5)  // Friday
  const saturday = date(2024, 1, 6)  // Saturday
  
  // Friday to Saturday (1 day span)
  const withWeekends = countChargeableDaysBetween(friday, saturday, true)
  assert.equal(withWeekends, 1, 'Should count 1 day with weekends')
  
  const withoutWeekends = countChargeableDaysBetween(friday, saturday, false)
  assert.equal(withoutWeekends, 1, 'Should count 1 day (Friday) without weekends')
})

