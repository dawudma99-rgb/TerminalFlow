/**
 * Author: GPT-5 Codex
 * Date: 2025-11-11
 * Purpose: Ensure navigation configuration resolves active items accurately.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { APP_NAV_ITEMS, getActiveNavItem } from '../../../lib/constants/nav'

test('navigation items remain immutable and consistent', () => {
  assert.equal(APP_NAV_ITEMS.length, 4)
  assert.equal(APP_NAV_ITEMS[0]?.label, 'Dashboard')
})

test('dashboard route resolves to Dashboard nav item', () => {
  assert.equal(getActiveNavItem('/dashboard')?.label, 'Dashboard')
})

test('containers route resolves to Containers nav item', () => {
  assert.equal(getActiveNavItem('/dashboard/containers')?.label, 'Containers')
})

test('analytics base route resolves to Analytics nav item', () => {
  assert.equal(getActiveNavItem('/dashboard/analytics')?.label, 'Analytics')
})

test('analytics reports route resolves to Reports nav item', () => {
  assert.equal(getActiveNavItem('/dashboard/analytics/reports')?.label, 'Reports')
})

test('deep analytics child prefers the most specific match', () => {
  assert.equal(
    getActiveNavItem('/dashboard/analytics/reports/daily-summary')?.label,
    'Reports'
  )
})

test('settings route resolves to Settings nav item', () => {
  assert.equal(getActiveNavItem('/dashboard/settings')?.label, 'Settings')
})

test('unknown route returns null', () => {
  assert.equal(getActiveNavItem('/unknown'), null)
})


