/**
 * Author: GPT-5 Codex
 * Date: 2025-11-11
 * Purpose: Provide deterministic, enterprise-grade helpers for sidebar route activation.
 */

import { pathToRegexp } from 'path-to-regexp'

/**
 * Exhaustive check helper used to surface missing branches during future
 * refactors. Always throw so the call site never returns unexpectedly.
 *
 * @param value - The impossible value that should never reach this branch.
 * @param message - Additional context for the thrown error.
 * @returns Never returns; always throws.
 */
export function assertNever(value: never, message: string): never {
  // Using the value in the error makes debugging easier when the invariant breaks.
  throw new Error(`${message}: ${String(value)}`)
}

/**
 * Normalize arbitrary route-like strings into a stable, case-insensitive path.
 *
 * - Removes protocol, host, query strings, and hash fragments.
 * - Collapses duplicate separators and trims trailing slashes.
 * - Guarantees a leading slash to simplify downstream comparisons.
 *
 * @example
 * normalizePath('/Dashboard/Containers/?view=summary') // '/dashboard/containers'
 *
 * @param path - The raw path that may contain uppercase characters or suffixes.
 * @returns A lower-cased path without trailing slashes (except for the root).
 */
export function normalizePath(path: string): string {
  if (!path) return '/'

  let candidate = path.trim()
  if (!candidate) return '/'

  // Normalize Windows-style separators early so URL parsing behaves predictably.
  candidate = candidate.replace(/\\/g, '/')

  let pathname = candidate

  try {
    // Support both absolute URLs and bare paths by providing a dummy base.
    const url = new URL(candidate, candidate.startsWith('http') ? undefined : 'http://_internal-base')
    pathname = url.pathname
  } catch {
    const queryIndex = pathname.indexOf('?')
    const hashIndex = pathname.indexOf('#')
    const cutIndex = [queryIndex, hashIndex]
      .filter((index) => index >= 0)
      .reduce<number>((acc, index) => Math.min(acc, index), pathname.length)
    pathname = pathname.slice(0, cutIndex)
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`
  }

  // Collapse duplicate separators to avoid accidental empty segments.
  pathname = pathname.replace(/\/{2,}/g, '/')

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }

  if (!pathname) return '/'

  return pathname.toLowerCase()
}

type RouteDepth = 'root' | 'nested'

/**
 * Determine the depth of a route by counting path segments. Routes with no
 * segments (root) should only match exact paths, while deeper routes may have
 * meaningful descendants that should remain highlighted.
 *
 * @param segments - Normalized path segments.
 * @returns The inferred route depth category.
 */
function categorizeRouteDepth(segments: readonly string[]): RouteDepth {
  if (segments.length <= 1) return 'root'
  return 'nested'
}

/**
 * Convert Next.js-style dynamic segments (e.g. `[id]`, `[[...slug]]`) into
 * `path-to-regexp` parameters. This keeps the source path human readable while
 * leveraging the robust matching semantics provided by the library.
 *
 * @param targetPath - Normalized target path that may contain dynamic tokens.
 * @returns A matcher template compatible with `path-to-regexp`.
 */
function toMatcherTemplate(targetPath: string): string {
  return targetPath
    .replace(/\[\[\.\.\.([^[\]/]+)\]\]/g, (_match, name) => `:${name}(.*)?`)
    .replace(/\[\.\.\.([^[\]/]+)\]/g, (_match, name) => `:${name}(.*)`)
    .replace(/\[([^[\]/]+)\]/g, (_match, name) => `:${name}`)
}

/**
 * Split a normalized path into its constituent segments.
 *
 * @param path - A normalized path (output of {@link normalizePath}).
 * @returns An array of individual segments without empty strings.
 */
function getSegments(path: string): string[] {
  if (path === '/') return []
  return path.split('/').filter(Boolean)
}

/**
 * Identify whether a segment represents a dynamic token (e.g. `[id]`).
 *
 * @param segment - The raw segment from the normalized target path.
 * @returns `true` when the segment is Next.js dynamic syntax.
 */
function isDynamicSegment(segment: string): boolean {
  return /^\[(?:\.{3})?[^[\]/]+\]$/.test(segment)
}

/**
 * Determine whether a sidebar entry tied to {@code targetPath} should appear
 * active for a given {@code currentPath}. The helper intentionally avoids
 * fuzzy prefix checks to prevent overlapping highlights between unrelated
 * sections (e.g. `/dashboard` vs. `/dashboard-archive`).
 *
 * Matching rules:
 * - Exact matches always win.
 * - Root-level routes (single segment) never match deeper descendants.
 * - Nested routes stay active for any descendant path that shares the same
 *   static prefix and respects dynamic segment boundaries.
 * - All checks are case-insensitive and ignore trailing slashes, query strings,
 *   and hash fragments.
 *
 * @example
 * isActiveRoute('/dashboard', '/dashboard') // true
 * isActiveRoute('/dashboard/containers/details', '/dashboard/containers') // true
 * isActiveRoute('/dashboard/containers', '/dashboard') // false
 *
 * @param currentPath - The active URL or pathname from the router.
 * @param targetPath - The canonical route associated with the sidebar item.
 * @returns `true` when the target should be highlighted.
 */
export function isActiveRoute(currentPath: string, targetPath: string): boolean {
  const normalizedCurrent = normalizePath(currentPath)
  const normalizedTarget = normalizePath(targetPath)

  if (normalizedCurrent === normalizedTarget) {
    return true
  }

  const targetSegments = getSegments(normalizedTarget)
  const routeDepth = categorizeRouteDepth(targetSegments)

  const matcherTemplate = toMatcherTemplate(normalizedTarget)
  const matcher = pathToRegexp(matcherTemplate, {
    sensitive: false,
    end: routeDepth === 'root',
  })

  const match = normalizedCurrent.match(matcher)
  if (!match || match.index !== 0) {
    return false
  }

  switch (routeDepth) {
    case 'root': {
      // Root routes only match when paths are identical; the equality branch
      // earlier already covered the true case.
      return false
    }
    case 'nested': {
      const currentSegments = getSegments(normalizedCurrent)

      if (currentSegments.length < targetSegments.length) {
        return false
      }

      for (let index = 0; index < targetSegments.length; index += 1) {
        const targetSegment = targetSegments[index]!
        if (isDynamicSegment(targetSegment)) continue

        const currentSegment = currentSegments[index]
        if (currentSegment !== targetSegment) {
          return false
        }
      }

      const matchedValue = match[0] ?? ''
      const nextCharacter = normalizedCurrent.charAt(matchedValue.length)
      if (nextCharacter && nextCharacter !== '/') {
        return false
      }

      return true
    }
    default:
      return assertNever(routeDepth, 'Unhandled route depth category')
  }
}


