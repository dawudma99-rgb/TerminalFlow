import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CONTAINER_MILESTONES,
  DEFAULT_MILESTONE,
  isValidMilestone,
  normalizeMilestone,
  resolveMilestone,
} from '../../lib/utils/milestones'

test('isValidMilestone accepts every canonical milestone', () => {
  for (const milestone of CONTAINER_MILESTONES) {
    assert.ok(isValidMilestone(milestone), `${milestone} should be valid`)
  }
})

test('isValidMilestone rejects unknown values', () => {
  assert.ok(!isValidMilestone('Delivered'))
  assert.ok(!isValidMilestone(''))
  assert.ok(!isValidMilestone(undefined))
})

test('normalizeMilestone maps legacy values to modern ones', () => {
  assert.equal(normalizeMilestone('Delivered'), 'Returned Empty')
  assert.equal(normalizeMilestone('in transit'), 'In Transit')
  assert.equal(normalizeMilestone('In Demurrage'), 'In Demurrage')
  assert.equal(normalizeMilestone('unknown'), null)
})

test('resolveMilestone respects context and defaults', () => {
  assert.equal(
    resolveMilestone(null, { empty_return_date: '2024-01-01' }),
    'Returned Empty'
  )
  assert.equal(
    resolveMilestone(undefined, { gate_out_date: '2024-01-01' }),
    'Gate Out'
  )
  assert.equal(resolveMilestone(undefined, {}), DEFAULT_MILESTONE)
  assert.equal(resolveMilestone('Gate Out'), 'Gate Out')
})
