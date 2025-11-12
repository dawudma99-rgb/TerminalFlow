/**
 * Author: GPT-5 Codex
 * Date: 2025-11-11
 * Purpose: Validate navigation helpers to ensure deterministic sidebar highlighting.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { isActiveRoute, normalizePath } from '../../../lib/utils/navigation'

test('normalizePath removes trailing slashes, query strings, and normalizes case', () => {
  assert.equal(
    normalizePath('/Dashboard/Containers/?view=SUMMARY#section'),
    '/dashboard/containers'
  )
  assert.equal(normalizePath(''), '/')
  assert.equal(normalizePath('/'), '/')
})

test('/dashboard matches only the root route', () => {
  assert.equal(isActiveRoute('/dashboard', '/dashboard'), true)
  assert.equal(isActiveRoute('/dashboard/?panel=open', '/dashboard'), true)
  assert.equal(isActiveRoute('/dashboard/containers', '/dashboard'), false)
  assert.equal(isActiveRoute('/dashboard-archive', '/dashboard'), false)
})

test('containers route stays active for nested descendants', () => {
  assert.equal(isActiveRoute('/dashboard/containers', '/dashboard/containers'), true)
  assert.equal(isActiveRoute('/dashboard/containers/details', '/dashboard/containers'), true)
  assert.equal(
    isActiveRoute('/dashboard/containers/details/history', '/dashboard/containers'),
    true
  )
  assert.equal(isActiveRoute('/dashboard/container', '/dashboard/containers'), false)
})

test('analytics route highlights reports subpages without false positives', () => {
  assert.equal(isActiveRoute('/dashboard/analytics', '/dashboard/analytics'), true)
  assert.equal(
    isActiveRoute('/dashboard/analytics/reports', '/dashboard/analytics'),
    true
  )
  assert.equal(
    isActiveRoute('/dashboard/analytics/reports', '/dashboard/analytics/reports'),
    true
  )
  assert.equal(isActiveRoute('/dashboard/analytics-experimental', '/dashboard/analytics'), false)
})

test('dynamic container detail routes respect parameterized segments', () => {
  assert.equal(isActiveRoute('/dashboard/containers/123', '/dashboard/containers/[id]'), true)
  assert.equal(
    isActiveRoute('/dashboard/containers/123/activity', '/dashboard/containers/[id]'),
    true
  )
  assert.equal(isActiveRoute('/dashboard/containers/details', '/dashboard/containers/[id]'), true)
  assert.equal(isActiveRoute('/dashboard/containers', '/dashboard/containers/[id]'), false)
})

test('negative cases prevent prefix overlap across unrelated sections', () => {
  assert.equal(isActiveRoute('/dashboarding', '/dashboard'), false)
  assert.equal(isActiveRoute('/dashboards', '/dashboard'), false)
  assert.equal(isActiveRoute('/dashboard-archive', '/dashboard/analytics'), false)
})


