/**
 * Author: GPT-5 Codex
 * Date: 2025-01-27
 * Purpose: Validate Sidebar navigation active states using Node.js test runner.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { render, screen } from '@testing-library/react'
import { JSDOM } from 'jsdom'

// Set up DOM environment for React Testing Library
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
})

// Setting up global DOM for React Testing Library
;(global as unknown as { window: Window }).window = dom.window as unknown as Window & typeof globalThis
;(global as unknown as { document: Document }).document = dom.window.document
;(global as unknown as { navigator: Navigator }).navigator = dom.window.navigator

import { Sidebar } from '@/components/layout/Sidebar'
import * as nextNavigation from 'next/navigation'

// Helper to check if element has class
function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className)
}

// Helper to mock usePathname
function mockUsePathname(path: string) {
  const originalUsePathname = nextNavigation.usePathname
  // Mocking for test - usePathname is a hook that returns string | null
  ;(nextNavigation as unknown as { usePathname: () => string }).usePathname = () => path
  return () => {
    // Restoring original
    ;(nextNavigation as unknown as { usePathname: typeof originalUsePathname }).usePathname = originalUsePathname
  }
}

test('highlights Dashboard only for /dashboard', () => {
  const restore = mockUsePathname('/dashboard')
  try {
    render(<Sidebar />)

    const dashboard = screen.getByText('Dashboard')
    const containers = screen.getByText('Containers')

    assert.ok(hasClass(dashboard, 'bg-[#ECF2FD]'), 'Dashboard should have active class')
    assert.ok(!hasClass(containers, 'bg-[#ECF2FD]'), 'Containers should not have active class')
  } finally {
    restore()
  }
})

test('highlights Containers only for /dashboard/containers', () => {
  const restore = mockUsePathname('/dashboard/containers')
  try {
    render(<Sidebar />)

    const containers = screen.getByText('Containers')
    const dashboard = screen.getByText('Dashboard')

    assert.ok(hasClass(containers, 'bg-[#ECF2FD]'), 'Containers should have active class')
    assert.ok(!hasClass(dashboard, 'bg-[#ECF2FD]'), 'Dashboard should not have active class')
  } finally {
    restore()
  }
})

test('highlights Analytics and Reports for /dashboard/analytics/reports', () => {
  const restore = mockUsePathname('/dashboard/analytics/reports')
  try {
    render(<Sidebar />)

    const analytics = screen.getByText('Analytics')
    const reports = screen.getByText('Reports')

    assert.ok(hasClass(analytics, 'bg-[#ECF2FD]'), 'Analytics should have active class')
    assert.ok(hasClass(reports, 'bg-[#DCE9FE]'), 'Reports should have nested active class')
  } finally {
    restore()
  }
})

test('highlights Settings only for /dashboard/settings', () => {
  const restore = mockUsePathname('/dashboard/settings')
  try {
    render(<Sidebar />)

    const settings = screen.getByText('Settings')

    assert.ok(hasClass(settings, 'bg-[#ECF2FD]'), 'Settings should have active class')
  } finally {
    restore()
  }
})

test('renders no active state for unknown route', () => {
  const restore = mockUsePathname('/unknown')
  try {
    render(<Sidebar />)

    const activeElements = document.querySelectorAll('.bg-[#ECF2FD]')
    const nestedActiveElements = document.querySelectorAll('.bg-[#DCE9FE]')

    assert.equal(activeElements.length, 0, 'Should have no active elements')
    assert.equal(nestedActiveElements.length, 0, 'Should have no nested active elements')
  } finally {
    restore()
  }
})

