# Comprehensive Application Health Check Report

**Date:** Generated during codebase audit  
**Scope:** Next.js 14 + React + Supabase application (App Router)  
**Purpose:** Identify technical weaknesses, security risks, and areas for improvement

---

## 1) High-level Map of the App

### Root Layout
- **app/layout.tsx** - Root layout with global providers

### Section Layouts
- **app/dashboard/layout.tsx** - Dashboard layout wrapper (uses AppLayout component)

### Main Route Groups
- `/dashboard` - Main authenticated area
  - `/dashboard/containers` - Container management page
  - `/dashboard/settings` - Settings and configuration
  - `/dashboard/profile` - User profile page
  - `/dashboard/analytics` - Analytics and reporting
  - `/dashboard/history` - Activity history
  - `/dashboard/alerts` - Alerts management
  - `/dashboard/client-updates` - Client updates page
- `/login` - Authentication page
- `/` - Root/home page

### Core Providers (in order of nesting)
1. **GlobalErrorBoundary** - Catches unhandled errors
2. **ErrorHandlerProvider** - Registers global error handlers
3. **ThemeProvider** - Theme management (light/dark)
4. **AuthTransitionProvider** - Handles auth state transitions
5. **AuthProvider** - Authentication context (useAuth hook)
6. **ListsProvider** - Container lists management context
7. **Toaster** - Toast notifications (Sonner)

### Core Data/Auth Modules
- **lib/auth/**
  - `useAuth.ts` - Client-side auth hook (context provider)
  - `serverAuthContext.ts` - Server-side auth helpers (getServerAuthContext, getServerOrgContext)
  - `actions.ts` - Auth server actions (signIn, signOut, getCurrentUser, getCurrentProfile)
- **lib/data/**
  - `useLists.ts` - SWR hook for lists
  - `useContainers.ts` - SWR hook for containers
  - `lists-actions.ts` - List CRUD server actions
  - `containers-actions.ts` - Container CRUD server actions
  - `alerts-actions.ts` - Alerts management
  - `settings-actions.ts` - User settings
  - `organization-actions.ts` - Organization data
  - `user-actions.ts` - User profile actions
  - `history-actions.ts` - Activity history
  - `export-actions.ts` - Data export
  - `import-commit.ts` - Data import
  - `data-management-actions.ts` - Bulk data operations
  - `carrier-actions.ts` - Carrier defaults
  - `overdue-sweep.ts` - Overdue container processing
- **lib/supabase/**
  - `client.ts` - Browser Supabase client
  - `server.ts` - Server Supabase client
  - `middleware.ts` - Middleware Supabase client factory
- **lib/utils/**
  - `logger.ts` - Centralized logging
  - `error-handler.ts` - Error handling utilities
  - `containers.ts` - Container computation utilities
  - `milestones.ts` - Milestone resolution
  - `navigation.ts` - Navigation helpers

---

## 2) Auth & Session Layer Audit

### How User is Loaded on Client
- **lib/auth/useAuth.ts**: 
  - Initial load: `supabase.auth.getSession()` on mount
  - Profile fetch: Separate query to `profiles` table by `user.id`
  - Auth state changes: `onAuthStateChange` subscription handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, INITIAL_SESSION
  - Profile refresh: Manual `refreshProfile()` callback available
  - **Issue**: Profile fetch has 5-second timeout, but no retry mechanism

### How User/Org/Profile Resolved on Server
- **lib/auth/serverAuthContext.ts**: Centralized helpers
  - `getServerAuthContext()`: Calls `createClient()` → `supabase.auth.getUser()` → fetches profile → extracts `organization_id`
  - `getServerOrgContext()`: Extends `getServerAuthContext()` → fetches organization row
- **Usage**: All server actions use these helpers (good pattern)
- **Issue**: Each call to `getServerAuthContext()` makes 2-3 database queries (getUser + profile + optional org)

### Where Supabase Called Directly
- **Middleware** (`middleware.ts`): Calls `supabase.auth.getUser()` on every `/dashboard/*` request
- **Client auth** (`lib/auth/useAuth.ts`): Direct calls to `supabase.auth.getSession()` and `supabase.from('profiles')`
- **Server actions**: All use `getServerAuthContext()` which internally calls `createClient()` → `getUser()`

### Potential Weaknesses

1. **Duplicate Auth Resolution**
   - **Risk Level: Medium**
   - **Issue**: `getServerAuthContext()` is called in every server action, each making separate `getUser()` + profile queries
   - **Impact**: N+1 auth queries per request if multiple actions run
   - **Files**: All files in `lib/data/*` that call `getServerAuthContext()`
   - **Example**: A single page load might trigger `fetchLists()`, `fetchContainers()`, `fetchAlerts()` - each calls `getServerAuthContext()` independently

2. **No Auth Result Caching**
   - **Risk Level: Low**
   - **Issue**: Server actions don't cache auth context within a single request
   - **Impact**: Redundant database queries for user/profile/org within same request
   - **Mitigation**: Next.js request context could be used to cache, but not implemented

3. **Profile Fetch Timeout Without Retry**
   - **Risk Level: Low**
   - **Issue**: Client-side profile fetch has 5-second timeout but no retry
   - **Impact**: Slow networks might fail silently, leaving user in loading state
   - **File**: `lib/auth/useAuth.ts` lines 62-84

4. **Middleware getUser() on Every Request**
   - **Risk Level: Low**
   - **Issue**: Middleware calls `getUser()` on every `/dashboard/*` request, which may refresh session
   - **Impact**: Extra latency on every dashboard navigation
   - **File**: `middleware.ts` line 15
   - **Note**: This is actually good for session refresh, but could be optimized with conditional refresh

5. **Inconsistent Error Handling for Missing Profile**
   - **Risk Level: Medium**
   - **Issue**: Some places return empty arrays on auth failure (alerts-actions.ts), others throw errors
   - **Impact**: Inconsistent UX when profile is missing
   - **Files**: 
     - `lib/data/alerts-actions.ts` (graceful failure)
     - `lib/auth/serverAuthContext.ts` (throws error)
     - `lib/data/lists-actions.ts` (throws error)

6. **setActiveList Has Redundant Session Validation**
   - **Risk Level: Low**
   - **Issue**: `setActiveList()` explicitly calls `getSession()` and `setSession()` even though middleware already refreshed
   - **Impact**: Unnecessary extra auth calls
   - **File**: `lib/data/lists-actions.ts` lines 265-339

---

## 3) Data Access & Caching Audit

### SWR Patterns

#### Keys
- **useLists**: `['lists', orgId]` - ✅ Properly scoped by organization
- **useContainers**: `['containers', orgId, listId]` - ✅ Properly scoped by organization and list
- **Issue**: No SWR keys found for alerts, settings, or other data hooks (may not use SWR)

#### Revalidation
- **useLists**: `refreshInterval: 60000` (1 minute) - ⚠️ May be too frequent for lists (rarely change)
- **useContainers**: `refreshInterval: 60000` (1 minute) - ⚠️ May be too frequent, especially with many containers
- **Both**: `revalidateOnFocus: false` - ✅ Good (prevents unnecessary refetches)
- **Both**: `keepPreviousData: true` - ✅ Good (prevents flicker)

#### Stale or Cross-Tenant Data Risks
- **SWR keys include orgId**: ✅ Good isolation
- **Issue**: If `orgId` changes (user switches orgs, though not supported), old cache might persist briefly
- **Mitigation**: `useAuth` clears all SWR caches on SIGNED_OUT

### Server Actions

#### N+1 Queries
1. **fetchContainers** - ✅ Single query with optional list filter
2. **fetchLists** - ✅ Single query
3. **fetchAlerts** - ⚠️ Uses joins to get `container_no` and `list_name`, but joins are efficient
4. **updateContainer** - ⚠️ Fetches previous container state before update (for alerts) - adds extra query
5. **ensureMainListForCurrentOrg** - ✅ Single query for lists, then conditional insert/update

#### Unbounded Queries
1. **fetchContainers** - ⚠️ No limit - could return thousands of containers
   - **File**: `lib/data/containers-actions.ts` line 71
   - **Risk**: Memory issues with large datasets
2. **fetchLists** - ✅ Lists are typically small (< 100), but no explicit limit
3. **fetchAlerts** - ✅ Has default limit of 50, pagination available
4. **fetchAlertsPage** - ✅ Uses `.range()` for pagination

#### Error Handling
- **Most actions**: ✅ Throw errors with descriptive messages
- **alerts-actions.ts**: ⚠️ Graceful failures (returns empty arrays) - may hide auth issues
- **markAlertsSeen**: ⚠️ Swallows errors silently (logs but doesn't throw)
- **updateContainer**: ⚠️ Alert creation failures are logged but don't fail the update (good UX, but may hide issues)

### Potential Weaknesses

1. **No Query Limits on fetchContainers**
   - **Risk Level: High**
   - **Issue**: `fetchContainers()` has no limit - can return unlimited containers
   - **Impact**: Memory exhaustion, slow responses, poor UX with large datasets
   - **File**: `lib/data/containers-actions.ts` line 57-108
   - **Recommendation**: Add pagination or reasonable limit (e.g., 1000)

2. **Aggressive Refresh Intervals**
   - **Risk Level: Medium**
   - **Issue**: Both `useLists` and `useContainers` refresh every 60 seconds
   - **Impact**: Unnecessary database load, especially with many concurrent users
   - **Files**: 
     - `lib/data/useLists.ts` line 49
     - `lib/data/useContainers.ts` line 46
   - **Recommendation**: Increase to 5 minutes or use manual refresh only

3. **No SWR for Alerts/Settings**
   - **Risk Level: Low**
   - **Issue**: Alerts and settings may be fetched repeatedly without caching
   - **Impact**: Redundant API calls
   - **Recommendation**: Consider SWR for alerts/settings if fetched frequently

4. **updateContainer Fetches Previous State**
   - **Risk Level: Low**
   - **Issue**: Extra query to fetch previous container before update (for alert detection)
   - **Impact**: Slight performance hit, but necessary for alert logic
   - **File**: `lib/data/containers-actions.ts` lines 236-247
   - **Note**: This is acceptable if alerts are important

5. **No Database Indexing Hints**
   - **Risk Level: Low**
   - **Issue**: Queries don't specify indexes (relies on DB defaults)
   - **Impact**: May be slow if indexes are missing
   - **Recommendation**: Verify indexes exist on `organization_id`, `list_id`, `container_id` in alerts

6. **Cross-Tenant Data Leak Risk (Low)**
   - **Risk Level: Low**
   - **Issue**: If `getServerAuthContext()` fails and returns wrong org, queries could leak data
   - **Mitigation**: All queries explicitly filter by `organization_id` from context
   - **Note**: RLS policies should also protect, but explicit filters are good defense-in-depth

---

## 4) UI / UX Performance & Layout Audit

### Heaviest Components

1. **app/dashboard/containers/page.tsx** (810 lines)
   - **Issues**:
     - Large component with many responsibilities (filtering, pagination, editing, exporting)
     - Multiple `useMemo` hooks for filtering (good optimization)
     - Infinite scroll with state management
     - Multiple `useEffect` hooks (time updates, scroll handling, filter resets)
   - **Performance**: Should be split into smaller components

2. **app/dashboard/settings/page.tsx** (637 lines)
   - **Issues**:
     - Large form with multiple sections
     - Multiple state variables (settings, carriers, tiers)
     - Complex useEffect for loading settings
     - **Performance**: Acceptable, but could be modularized

3. **components/layout/AppLayout.tsx**
   - **Issues**: Minimal, uses dynamic imports for Sidebar/Topbar (good)
   - **Performance**: ✅ Good

4. **components/providers/ListsProvider.tsx**
   - **Issues**: Thin wrapper around `useLists()` hook
   - **Performance**: ✅ Good

### God Components
- **app/dashboard/containers/page.tsx**: ⚠️ Does too much (table, filters, stats, editing, importing, exporting)
- **Recommendation**: Split into ContainerPageContent, ContainerFilters, ContainerTable, ContainerStats

### Re-render Patterns

1. **useAuth Hook**
   - **Issue**: Profile updates trigger re-renders in all consumers
   - **Impact**: Many components re-render when profile changes
   - **Mitigation**: Components use `useMemo` and `useCallback` appropriately

2. **ListsProvider**
   - **Issue**: Wraps entire app, any list change triggers provider update
   - **Impact**: All consumers re-render (though most are memoized)
   - **File**: `components/providers/ListsProvider.tsx`

3. **Topbar**
   - **Issue**: Fetches organization name on every profile change
   - **Impact**: Extra API call on profile updates
   - **File**: `components/layout/Topbar.tsx` lines 24-43
   - **Mitigation**: Uses `useEffect` with cleanup, memoized component

### Loading States

1. **Full-Page Blocking Loaders**
   - **app/dashboard/containers/page.tsx**: ✅ Uses `isInitialLoading` vs `isRefreshing` (good)
   - **app/dashboard/settings/page.tsx**: ⚠️ Full-page loader while loading settings
   - **Recommendation**: Use skeleton loaders instead of full-page spinners

2. **Incremental Loading**
   - **Containers page**: ✅ Uses infinite scroll (good)
   - **Alerts**: ⚠️ No pagination visible in UI (though API supports it)

### Suspense Boundaries
- **Issue**: No Suspense boundaries found
- **Impact**: No progressive loading, entire pages block on data
- **Recommendation**: Add Suspense boundaries around data-fetching components

### Potential UX Issues

1. **Containers Page is Too Large**
   - **Risk Level: Medium**
   - **Issue**: 810-line component handles too many concerns
   - **Impact**: Hard to maintain, potential performance issues, harder to test
   - **File**: `app/dashboard/containers/page.tsx`
   - **Recommendation**: Split into 5-6 smaller components

2. **No Skeleton Loaders**
   - **Risk Level: Low**
   - **Issue**: Full-page spinners instead of skeleton loaders
   - **Impact**: Perceived performance is worse
   - **Files**: Settings page, containers page (initial load)

3. **Aggressive Infinite Scroll**
   - **Risk Level: Low**
   - **Issue**: Loads 50 containers at a time, no "load more" button option
   - **Impact**: May load too much data if user scrolls quickly
   - **File**: `app/dashboard/containers/page.tsx` lines 588-610

4. **Multiple useEffect Hooks in Containers Page**
   - **Risk Level: Low**
   - **Issue**: 6+ useEffect hooks managing different concerns
   - **Impact**: Potential race conditions, harder to debug
   - **File**: `app/dashboard/containers/page.tsx`
   - **Recommendation**: Consolidate or extract to custom hooks

5. **No Error Boundaries for Individual Sections**
   - **Risk Level: Low**
   - **Issue**: Only global error boundary exists
   - **Impact**: One failing component crashes entire page
   - **Recommendation**: Add error boundaries around major sections

6. **Topbar Fetches Org Name on Every Profile Change**
   - **Risk Level: Low**
   - **Issue**: `useEffect` in Topbar fetches org name whenever `profile?.organization_id` changes
   - **Impact**: Extra API call, though cleanup prevents leaks
   - **File**: `components/layout/Topbar.tsx` lines 24-43

---

## 5) Error Handling & Logging Audit

### Global Error Boundaries

1. **app/error-boundary.tsx**
   - **Type**: Client component using `useEffect` for window error handlers
   - **Scope**: Global (wraps entire app in root layout)
   - **Issues**: 
     - Filters out "noise" errors (Fast Refresh, ChunkLoadError) - ✅ Good
     - Shows toast on errors - ✅ Good
     - But doesn't render error UI (just logs/toasts)

2. **app/dashboard/error.tsx**
   - **Type**: Next.js error boundary (error.tsx)
   - **Scope**: Dashboard routes only
   - **Features**: Renders error UI with reset button - ✅ Good

3. **app/global-error.tsx**
   - **Not reviewed** (assumed to exist for root error handling)

### Server Action Error Handling

1. **Most Actions**: ✅ Throw errors with descriptive messages
2. **alerts-actions.ts**: ⚠️ Returns empty arrays on auth failure (graceful but may hide issues)
3. **markAlertsSeen**: ⚠️ Swallows errors (logs but doesn't throw)
4. **updateContainer**: ⚠️ Alert creation failures are logged but don't fail update

### Logging Patterns

1. **lib/utils/logger.ts**: ✅ Centralized logger
   - **Features**: 
     - Only logs errors in production
     - Logs all levels in development
     - Structured logging with context
   - **Issue**: No external logging service integration (e.g., Sentry, LogRocket)

2. **Usage**: ✅ Most server actions use logger
3. **Client-side**: ✅ useAuth and components use logger

### Silent Error Swallowing

1. **markAlertsSeen** (`lib/data/alerts-actions.ts` lines 208-235)
   - **Issue**: Catches all errors, logs them, but doesn't throw
   - **Impact**: User doesn't know if marking alerts as seen failed
   - **Risk Level: Low** (non-critical operation)

2. **updateContainer alert creation** (`lib/data/containers-actions.ts` lines 264-279)
   - **Issue**: Alert creation failures are caught and logged, but don't fail the update
   - **Impact**: Container updates succeed but alerts may be missing
   - **Risk Level: Low** (alerts are secondary to container updates)

3. **ensureMainListForCurrentOrg** (`lib/data/lists-actions.ts` lines 174-178)
   - **Issue**: Profile update failures are logged but don't throw
   - **Impact**: List is created but not set as active
   - **Risk Level: Low** (will be fixed on next call)

### User-Facing Error States

1. **Containers page**: ✅ Shows ErrorAlert component with retry button
2. **Settings page**: ⚠️ Shows toast on error, but no persistent error state
3. **Most pages**: ✅ Use toast notifications for errors
4. **Issue**: No centralized error reporting to external service

### Potential Weaknesses

1. **No External Error Reporting**
   - **Risk Level: Medium**
   - **Issue**: Errors only logged to console, no external service (Sentry, LogRocket)
   - **Impact**: Production errors are invisible, hard to debug issues
   - **Recommendation**: Integrate Sentry or similar

2. **Silent Failures in Non-Critical Operations**
   - **Risk Level: Low**
   - **Issue**: Some operations (markAlertsSeen, alert creation) fail silently
   - **Impact**: Users don't know operations failed
   - **Files**: 
     - `lib/data/alerts-actions.ts` (markAlertsSeen)
     - `lib/data/containers-actions.ts` (alert creation)
   - **Recommendation**: Show toast notifications for failures

3. **Inconsistent Error Handling**
   - **Risk Level: Low**
   - **Issue**: Some actions return empty arrays on auth failure, others throw
   - **Impact**: Inconsistent UX
   - **Files**: 
     - `lib/data/alerts-actions.ts` (graceful)
     - `lib/data/lists-actions.ts` (throws)
   - **Recommendation**: Standardize error handling pattern

4. **No Error Recovery for Network Failures**
   - **Risk Level: Low**
   - **Issue**: No retry logic for failed network requests
   - **Impact**: Temporary network issues cause permanent failures
   - **Recommendation**: Add retry logic to SWR or server actions

5. **Global Error Boundary Doesn't Render UI**
   - **Risk Level: Low**
   - **Issue**: `error-boundary.tsx` only logs/toasts, doesn't render error UI
   - **Impact**: Users see broken UI without clear error message
   - **File**: `app/error-boundary.tsx`
   - **Recommendation**: Add error UI rendering

---

## 6) Security & Multi-Tenant Isolation Audit

### Organization ID Filtering

**All queries filter by `organization_id`**: ✅ Good
- **containers-actions.ts**: ✅ All queries use `.eq('organization_id', organizationId)`
- **lists-actions.ts**: ✅ All queries use `.eq('organization_id', organizationId)`
- **alerts-actions.ts**: ✅ All queries use `.eq('organization_id', organizationId)`
- **history-actions.ts**: ✅ All queries use `.eq('organization_id', organizationId)`
- **Other actions**: ✅ All use `getServerAuthContext()` which provides `organizationId`

### Client-Side ID Validation

1. **updateContainer** (`lib/data/containers-actions.ts` line 189)
   - ✅ Validates UUID format before querying
   - ✅ Filters by `organization_id` in query
   - ✅ Fetches previous container to verify ownership before update

2. **deleteContainer** (`lib/data/containers-actions.ts` line 291)
   - ✅ Filters by `organization_id` in delete query
   - ⚠️ Doesn't verify container exists before deleting (but org filter protects)

3. **deleteList** (`lib/data/lists-actions.ts` lines 75-103)
   - ✅ Verifies list belongs to organization before deleting
   - ✅ Double-checks with `.eq('organization_id', organizationId)` in delete query

4. **setActiveList** (`lib/data/lists-actions.ts` lines 259-385)
   - ✅ Verifies list belongs to organization if ID provided
   - ✅ Uses `organizationId` from auth context (not client)

5. **markAlertsSeen** (`lib/data/alerts-actions.ts` lines 192-236)
   - ✅ Filters by `organization_id` in update query
   - ✅ Only updates alerts for current organization

### RLS Assumptions

- **Assumption**: RLS policies enforce `organization_id` filtering at database level
- **Defense-in-Depth**: ✅ All queries explicitly filter by `organization_id` (good)
- **Risk**: If RLS is misconfigured, explicit filters still protect

### Risky Patterns

1. **getOrganization(orgId: string)** (`lib/data/user-actions.ts` lines 58-70)
   - **Risk Level: Medium**
   - **Issue**: Accepts `orgId` parameter from client without verification
   - **Impact**: User could pass any orgId and fetch organization data
   - **File**: `lib/data/user-actions.ts`
   - **Note**: Marked as `@deprecated` but still used
   - **Usage**: `components/layout/Topbar.tsx` uses `getCurrentOrganization()` (safe), but `getOrganization(orgId)` exists
   - **Recommendation**: Remove or add org membership verification

2. **No Explicit Ownership Verification for Some Updates**
   - **Risk Level: Low**
   - **Issue**: Some update/delete operations rely solely on `organization_id` filter without pre-checking existence
   - **Mitigation**: `organization_id` filter in query prevents cross-org access
   - **Note**: This is actually fine - the filter is sufficient

3. **Client-Side orgId Usage**
   - **Risk Level: Low**
   - **Issue**: Client components use `profile?.organization_id` for SWR keys
   - **Mitigation**: Server actions always use server-resolved `organizationId`
   - **Note**: SWR keys are just for caching, not security

### Potential Weaknesses

1. **Deprecated getOrganization(orgId) Function**
   - **Risk Level: Medium**
   - **Issue**: Function accepts orgId from client without verifying user belongs to that org
   - **Impact**: Information disclosure (though limited to org name/created_at)
   - **File**: `lib/data/user-actions.ts` lines 58-70
   - **Recommendation**: Remove function or add membership check
   - **Note**: Currently only used internally, but public API

2. **No Rate Limiting on Server Actions**
   - **Risk Level: Low**
   - **Issue**: No rate limiting on expensive operations (export, import, clear data)
   - **Impact**: Potential DoS or abuse
   - **Recommendation**: Add rate limiting middleware

3. **No Input Sanitization for Text Fields**
   - **Risk Level: Low**
   - **Issue**: User input (container_no, notes, etc.) not sanitized before storage
   - **Impact**: XSS if data is rendered unsafely (but React escapes by default)
   - **Recommendation**: Validate/sanitize input, especially for notes fields

4. **Session Token Handling**
   - **Risk Level: Low**
   - **Issue**: `setActiveList` explicitly sets session tokens (lines 331-339)
   - **Impact**: Unusual pattern, but seems safe
   - **File**: `lib/data/lists-actions.ts`
   - **Note**: May be workaround for RLS issues, but should be reviewed

---

## 7) Consistency & DX (Developer Experience) Audit

### Duplicate Patterns

1. **Profile/Org Resolution**
   - **Before**: Each server action had its own `getOrgId()` helper
   - **After**: ✅ Centralized in `getServerAuthContext()` and `getServerOrgContext()`
   - **Status**: ✅ Good - no duplication found

2. **Error Handling Patterns**
   - **Issue**: Inconsistent - some throw, some return empty arrays, some swallow
   - **Files**: 
     - `alerts-actions.ts` (graceful)
     - `lists-actions.ts` (throws)
     - `containers-actions.ts` (throws)
   - **Recommendation**: Standardize error handling pattern

3. **Container Normalization (pol/pod)**
   - **Issue**: Duplicate `normalizeOptionalString` function in multiple places
   - **Files**: 
     - `lib/data/containers-actions.ts` (insertContainer, updateContainer)
   - **Recommendation**: Extract to shared utility

4. **Revalidation Patterns**
   - **Issue**: `revalidatePath('/dashboard')` and `revalidatePath('/dashboard/containers')` repeated in many actions
   - **Files**: Most server actions
   - **Recommendation**: Create helper function

### Inconsistent Naming

1. **Organization ID**
   - ✅ Consistent: `organizationId` (camelCase) used everywhere
   - ✅ Consistent: `organization_id` (snake_case) in database queries

2. **List ID**
   - ✅ Consistent: `listId` (camelCase) in code
   - ✅ Consistent: `list_id` (snake_case) in database
   - ✅ Consistent: `current_list_id` in profile

3. **User/Profile**
   - ✅ Consistent: `user` for auth user, `profile` for profile row

### Inconsistent Error Handling

1. **Auth Failures**
   - `alerts-actions.ts`: Returns empty array
   - `lists-actions.ts`: Throws error
   - `containers-actions.ts`: Throws error
   - **Recommendation**: Standardize (probably throw, but handle gracefully in UI)

2. **Database Errors**
   - Most actions: Throw with descriptive message
   - Some actions: Log and continue (markAlertsSeen, alert creation)
   - **Recommendation**: Define which operations should fail silently vs throw

### Strongly-Coupled Modules

1. **useLists and useContainers**
   - **Issue**: Both depend on `useAuth()` for `profile?.organization_id`
   - **Impact**: Changes to auth structure affect data hooks
   - **Mitigation**: ✅ Good separation - hooks are independent

2. **Server Actions and Auth Context**
   - **Issue**: All server actions depend on `getServerAuthContext()`
   - **Impact**: Changes to auth context affect all actions
   - **Mitigation**: ✅ Centralized helper makes changes easier

3. **Containers and Lists**
   - **Issue**: Containers depend on lists (list_id foreign key)
   - **Impact**: Can't delete list if containers exist (CASCADE should handle)
   - **Status**: ✅ Acceptable coupling

### Potential Improvements

1. **Extract Container Normalization**
   - **Issue**: `normalizeOptionalString` duplicated in insertContainer and updateContainer
   - **File**: `lib/data/containers-actions.ts`
   - **Recommendation**: Extract to `lib/utils/containers.ts`

2. **Standardize Error Handling**
   - **Issue**: Inconsistent error handling patterns
   - **Recommendation**: Create error handling utilities or guidelines

3. **Create Revalidation Helper**
   - **Issue**: `revalidatePath` calls repeated
   - **Recommendation**: Create `revalidateDashboard()` helper

4. **Type Safety Improvements**
   - **Issue**: Some `any` types in alerts-actions.ts (lines 69, 151)
   - **File**: `lib/data/alerts-actions.ts`
   - **Recommendation**: Properly type Supabase join results

5. **Remove Deprecated Functions**
   - **Issue**: `getOrganization(orgId)` is deprecated but still exists
   - **File**: `lib/data/user-actions.ts`
   - **Recommendation**: Remove or add migration path

---

## 8) Top 5 Technical Weaknesses (Prioritized)

### 1) [High] No Query Limits on fetchContainers - Memory & Performance Risk
   - **Area**: Data / Performance
   - **Files**: `lib/data/containers-actions.ts` (lines 57-108)
   - **Why it matters**: 
     - Can return unlimited containers in a single query
     - Organizations with thousands of containers will cause memory issues
     - Slow response times, poor UX
     - Potential database timeouts
   - **What kind of bugs or pain this could cause**:
     - App crashes or becomes unresponsive with large datasets
     - Slow page loads
     - Database connection pool exhaustion
     - Poor user experience for large organizations

### 2) [High] Deprecated getOrganization(orgId) Function - Security Risk
   - **Area**: Security / Multi-tenant Isolation
   - **Files**: `lib/data/user-actions.ts` (lines 58-70)
   - **Why it matters**:
     - Accepts `orgId` parameter from client without verifying user membership
     - Allows information disclosure (org name, created_at)
     - Even if marked deprecated, still accessible
   - **What kind of bugs or pain this could cause**:
     - Users could enumerate organization IDs
     - Potential data leak if function is called with wrong orgId
     - Security audit failures
     - Compliance issues

### 3) [Medium] Duplicate Auth Resolution - Performance & Scalability
   - **Area**: Auth / Performance
   - **Files**: All files in `lib/data/*` that call `getServerAuthContext()`
   - **Why it matters**:
     - Each server action independently calls `getUser()` + profile query
     - Multiple actions per request = multiple redundant auth queries
     - Adds latency to every request
     - Increases database load
   - **What kind of bugs or pain this could cause**:
     - Slower page loads (especially pages that call multiple actions)
     - Higher database load
     - Potential rate limiting issues
     - Poor scalability as user base grows

### 4) [Medium] Aggressive Refresh Intervals - Unnecessary Database Load
   - **Area**: Data / Caching
   - **Files**: 
     - `lib/data/useLists.ts` (line 49)
     - `lib/data/useContainers.ts` (line 46)
   - **Why it matters**:
     - Both hooks refresh every 60 seconds automatically
     - Causes unnecessary database queries even when data hasn't changed
     - Multiplies with number of concurrent users
     - Wastes resources
   - **What kind of bugs or pain this could cause**:
     - High database load
     - Increased costs (if using metered database)
     - Potential rate limiting
     - Battery drain on mobile devices
     - Unnecessary network usage

### 5) [Medium] Containers Page is Too Large - Maintainability & Performance
   - **Area**: UI / DX
   - **Files**: `app/dashboard/containers/page.tsx` (810 lines)
   - **Why it matters**:
     - Single component handles too many responsibilities
     - Hard to maintain and test
     - Multiple useEffect hooks increase complexity
     - Potential performance issues from large component tree
   - **What kind of bugs or pain this could cause**:
     - Harder to debug issues
     - Difficult to add new features
     - Higher risk of introducing bugs
     - Slower development velocity
     - Potential re-render performance issues

---

## Summary

### Strengths
- ✅ Centralized auth context helpers (`getServerAuthContext`, `getServerOrgContext`)
- ✅ All queries filter by `organization_id` (good security)
- ✅ SWR keys properly scoped by organization
- ✅ Good error boundaries and error handling infrastructure
- ✅ Consistent use of TypeScript types
- ✅ Proper separation of concerns in most areas

### Critical Issues to Address
1. **Add pagination/limits to fetchContainers** (High priority)
2. **Remove or secure getOrganization(orgId)** (High priority)
3. **Optimize auth resolution** (Medium priority)
4. **Reduce refresh intervals** (Medium priority)
5. **Refactor containers page** (Medium priority)

### Recommendations
- Add external error reporting (Sentry)
- Standardize error handling patterns
- Extract duplicate utility functions
- Add Suspense boundaries for progressive loading
- Consider request-scoped auth caching
- Add rate limiting for expensive operations

---

**Report Generated:** Comprehensive codebase audit  
**Next Steps:** Prioritize fixes based on risk level and business impact

