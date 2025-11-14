/**
 * Author: GPT-5 Codex
 * Date: 2025-11-11
 * Purpose: Centralize sidebar navigation metadata with predictable active-state resolution.
 */

import type { ComponentType } from 'react'
import { Clock } from 'lucide-react'

import { isActiveRoute, normalizePath } from '../utils/navigation'

/**
 * Descriptor for a sidebar navigation entry surfaced throughout the application.
 *
 * Each item intentionally describes only pure metadata (no React state) so the
 * configuration can be consumed by any environment (SSR, SSG, CLI utilities).
 */
export interface AppNavItem {
  /** Display label rendered in the navigation UI. */
  label: string
  /** Canonical href used both for linking and active-state evaluation. */
  href: string
  /** Optional icon component rendered alongside the label. */
  icon?: ComponentType<{ className?: string }>
  /** High-level grouping displayed in analytics and telemetry dashboards. */
  section?: 'dashboard' | 'containers' | 'analytics' | 'settings'
  /** Nested navigation entries scoped beneath this item. */
  children?: AppNavItem[]
}

/**
 * Immutable set of navigation items representing the sidebar structure.
 *
 * Consumers (e.g., `Sidebar`, breadcrumbs, analytics trackers) should read
 * from this source of truth to keep labels, links, and route logic consistent.
 */
export const APP_NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    section: 'dashboard',
  },
  {
    label: 'Containers',
    href: '/dashboard/containers',
    section: 'containers',
  },
  {
    label: 'Analytics',
    href: '/dashboard/analytics',
    section: 'analytics',
  },
  {
    label: 'History',
    href: '/dashboard/history',
    section: 'analytics',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    section: 'settings',
  },
] as const satisfies ReadonlyArray<AppNavItem>

type ReadonlyNavItem = (typeof APP_NAV_ITEMS)[number]

/**
 * Traverse the navigation tree and yield each item for evaluation.
 *
 * @param items - The navigation items to iterate over.
 * @param collector - The accumulator capturing discovered items.
 * @returns The same accumulator populated with every item reference.
 */
function collectNavItems(
  items: ReadonlyArray<ReadonlyNavItem>,
  collector: AppNavItem[] = []
): AppNavItem[] {
  for (const item of items) {
    collector.push(item)
    if (item.children?.length) {
      collectNavItems(item.children, collector)
    }
  }
  return collector
}

const FLATTENED_NAV_ITEMS = collectNavItems(APP_NAV_ITEMS)

/**
 * Resolve the most specific navigation entry that should appear active for a
 * given pathname by leveraging {@link isActiveRoute}.
 *
 * @param pathname - The current location (e.g., from Next.js router).
 * @returns The deepest matching navigation item, or `null` when no match exists.
 */
export function getActiveNavItem(pathname: string): AppNavItem | null {
  const normalizedPath = normalizePath(pathname)

  let bestMatch: AppNavItem | null = null
  let bestHrefLength = -1

  for (const item of FLATTENED_NAV_ITEMS) {
    const normalizedHref = normalizePath(item.href)
    if (!isActiveRoute(normalizedPath, normalizedHref)) {
      continue
    }

    if (normalizedHref.length > bestHrefLength) {
      bestMatch = item
      bestHrefLength = normalizedHref.length
    }
  }

  return bestMatch
}


