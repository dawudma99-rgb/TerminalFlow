# Enterprise Duplicate Alerts Audit Report

**Date:** Investigation Date  
**Status:** Read-Only Discovery (No Changes Made)  
**Issue:** Duplicate "Warning" alerts for the same container

---

## Executive Summary

**Root Cause:** Race condition between multiple alert creation paths with non-atomic check-then-insert operations.

**Risk Level:** **MEDIUM**

**Impact:** UI noise and alert list clutter. Does NOT affect fees, container status, billing, or notifications.

**Conclusion:** This is a **database enforcement gap** combined with a **logic bug** (non-atomic operations).

---

## 1️⃣ All Alert Creation Paths

| # | File | Function | Trigger Condition | Execution Type | Alert Types Created |
|---|------|----------|-------------------|----------------|---------------------|
| **1** | `lib/data/alerts-logic.ts` | `createAlertsForContainerChange()` | Container state change (insert/update) | **Immediately** (on update) | `became_warning`, `became_overdue`, `detention_started`, `container_closed` |
| **2** | `lib/data/overdue-sweep.ts` | `backfillOverdueAlertsForCurrentOrg()` | Dashboard page load | **Lazily** (on page load) | `became_overdue` |
| **3** | `lib/data/overdue-sweep.ts` | `backfillWarningAlertsForCurrentOrg()` | Dashboard page load | **Lazily** (on page load) | `became_warning` |

### Detailed Path Analysis

#### Path 1: Event-Driven Alert Creation

**File:** `lib/data/alerts-logic.ts`  
**Function:** `createAlertsForContainerChange()`  
**Lines:** 64-287

**Triggered From:**
- `lib/data/containers-actions.ts` → `insertContainer()` (line 226)
- `lib/data/containers-actions.ts` → `updateContainer()` (line 333)

**Execution:**
- **Type:** Immediately (synchronous, within container insert/update transaction)
- **When:** After successful container insert/update
- **Blocking:** Non-blocking (errors logged but don't throw)

**Alert Types:**
1. `became_warning` (lines 96-127) - Safe/null → Warning
2. `became_overdue` (lines 135-173) - !Overdue → Overdue
3. `detention_started` (lines 175-219) - detention_chargeable_days <= 0 → > 0
4. `container_closed` (lines 221-255) - is_closed false → true

**Evidence:**
```typescript
// lib/data/containers-actions.ts:226-231
await createAlertsForContainerChange({
  supabase,
  previousContainer: null,
  newContainer: data,
  currentUserId: user.id,
})
```

```typescript
// lib/data/containers-actions.ts:333-338
await createAlertsForContainerChange({
  supabase,
  previousContainer: previousContainer ?? null,
  newContainer: data,
  currentUserId: user.id,
})
```

---

#### Path 2: Overdue Alerts Backfill

**File:** `lib/data/overdue-sweep.ts`  
**Function:** `backfillOverdueAlertsForCurrentOrg()`  
**Lines:** 141-281

**Triggered From:**
- `app/dashboard/page.tsx` (line 19)

**Execution:**
- **Type:** Lazily (on dashboard page load)
- **When:** Every time dashboard page is accessed
- **Blocking:** Non-blocking (runs in background via `void Promise.allSettled()`)

**Alert Types:**
- `became_overdue` (line 244)

**Evidence:**
```typescript
// app/dashboard/page.tsx:18-20
void Promise.allSettled([
  backfillOverdueAlertsForCurrentOrg(),
  backfillWarningAlertsForCurrentOrg(),
])
```

---

#### Path 3: Warning Alerts Backfill

**File:** `lib/data/overdue-sweep.ts`  
**Function:** `backfillWarningAlertsForCurrentOrg()`  
**Lines:** 296-435

**Triggered From:**
- `app/dashboard/page.tsx` (line 20)

**Execution:**
- **Type:** Lazily (on dashboard page load)
- **When:** Every time dashboard page is accessed
- **Blocking:** Non-blocking (runs in background via `void Promise.allSettled()`)

**Alert Types:**
- `became_warning` (line 399)

**Evidence:**
```typescript
// app/dashboard/page.tsx:18-20
void Promise.allSettled([
  backfillOverdueAlertsForCurrentOrg(),
  backfillWarningAlertsForCurrentOrg(),
])
```

---

### Scheduled Jobs / Background Tasks

**Finding:** ❌ **NO scheduled jobs or background tasks create alerts.**

**Evidence:**
- No cron jobs found in codebase
- No scheduled API routes
- No background workers
- No edge functions for scheduling
- System is fully event-driven (except for dashboard-triggered backfills)

**Reference:** `EMAIL_SYSTEM_DAILY_DIGEST_DISCOVERY_REPORT.md` lines 254-258 confirms no scheduled jobs exist.

---

## 2️⃣ Alert De-Duplication Logic

### Path 1: `createAlertsForContainerChange()`

**File:** `lib/data/alerts-logic.ts`

#### For `became_warning` (lines 96-127):

**Check Method:**
- Uses `alertAlreadyExists()` function (lines 98-103)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'became_warning'`, `cleared_at IS NULL`

**Implementation:**
```typescript
// Line 98-103
const exists = await alertAlreadyExists(
  supabase,
  newContainer.organization_id,
  newContainer.id,
  'became_warning'
)
if (!exists) {
  alertsToCreate.push({ /* alert data */ })
}
```

**Atomicity:**
- ❌ **NOT atomic**
- Check (line 98) and insert (line 268) are **separate database operations**
- Gap between check and insert allows race conditions

**Uniqueness Fields:**
- `organization_id` (required)
- `container_id` (required)
- `event_type` (required, value: `'became_warning'`)
- `cleared_at IS NULL` (required, only considers uncleared alerts)

**Evidence:**
```typescript
// lib/data/alerts-logic.ts:20-47
async function alertAlreadyExists(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  containerId: string,
  eventType: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('container_id', containerId)
    .eq('event_type', eventType)
    .is('cleared_at', null)
    .limit(1)
  // ...
  return (data?.length ?? 0) > 0
}
```

**Select → Insert Pattern:**
- ✅ **YES** - Explicit select-then-insert pattern
- Line 98: SELECT query to check existence
- Line 105: Push to `alertsToCreate` array
- Line 268-270: INSERT operation (batched for all alert types)

**Transaction Protection:**
- ❌ **NO** - No transaction wrapper
- No `BEGIN TRANSACTION` / `COMMIT`
- No `INSERT ... ON CONFLICT DO NOTHING`
- No database-level locking

---

#### For `became_overdue` (lines 135-173):

**Check Method:**
- Uses `alertAlreadyExists()` function (lines 137-142)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'became_overdue'`, `cleared_at IS NULL`

**Atomicity:**
- ❌ **NOT atomic** (same pattern as `became_warning`)

**Select → Insert Pattern:**
- ✅ **YES** - Same pattern as `became_warning`

**Transaction Protection:**
- ❌ **NO** - Same as `became_warning`

---

#### For `detention_started` (lines 175-219):

**Check Method:**
- Uses `alertAlreadyExists()` function (lines 184-189)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'detention_started'`, `cleared_at IS NULL`

**Atomicity:**
- ❌ **NOT atomic** (same pattern)

**Select → Insert Pattern:**
- ✅ **YES** - Same pattern

**Transaction Protection:**
- ❌ **NO** - Same as others

---

#### For `container_closed` (lines 221-255):

**Check Method:**
- Uses `alertAlreadyExists()` function (lines 227-232)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'container_closed'`, `cleared_at IS NULL`

**Atomicity:**
- ❌ **NOT atomic** (same pattern)

**Select → Insert Pattern:**
- ✅ **YES** - Same pattern

**Transaction Protection:**
- ❌ **NO** - Same as others

---

### Path 2: `backfillOverdueAlertsForCurrentOrg()`

**File:** `lib/data/overdue-sweep.ts`  
**Lines:** 216-240

**Check Method:**
- Direct Supabase query (lines 216-223)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'became_overdue'`, `cleared_at IS NULL`

**Implementation:**
```typescript
// Lines 216-223
const { data: existingAlerts, error: existingError } = await supabase
  .from('alerts')
  .select('id')
  .eq('organization_id', organizationId)
  .eq('container_id', container.id)
  .eq('event_type', 'became_overdue')
  .is('cleared_at', null)
  .limit(1)

if (existingAlerts?.length) {
  skippedExisting++
  continue
}
```

**Atomicity:**
- ❌ **NOT atomic**
- Check (line 216) and insert (line 240) are **separate database operations**

**Uniqueness Fields:**
- Same as Path 1: `organization_id`, `container_id`, `event_type`, `cleared_at IS NULL`

**Select → Insert Pattern:**
- ✅ **YES** - Explicit select-then-insert pattern

**Transaction Protection:**
- ❌ **NO** - No transaction wrapper

---

### Path 3: `backfillWarningAlertsForCurrentOrg()`

**File:** `lib/data/overdue-sweep.ts`  
**Lines:** 371-395

**Check Method:**
- Direct Supabase query (lines 371-378)
- **Fields checked:** `organization_id`, `container_id`, `event_type = 'became_warning'`, `cleared_at IS NULL`

**Implementation:**
```typescript
// Lines 371-378
const { data: existingAlerts, error: existingError } = await supabase
  .from('alerts')
  .select('id')
  .eq('organization_id', organizationId)
  .eq('container_id', container.id)
  .eq('event_type', 'became_warning')
  .is('cleared_at', null)
  .limit(1)

if (existingAlerts?.length) {
  skippedExisting++
  continue
}
```

**Atomicity:**
- ❌ **NOT atomic**
- Check (line 371) and insert (line 395) are **separate database operations**

**Uniqueness Fields:**
- Same as Path 1: `organization_id`, `container_id`, `event_type`, `cleared_at IS NULL`

**Select → Insert Pattern:**
- ✅ **YES** - Explicit select-then-insert pattern

**Transaction Protection:**
- ❌ **NO** - No transaction wrapper

---

## 3️⃣ Database Constraints Audit

### Alerts Table Schema

**Source:** TypeScript types in `dnd-copilot-next/types/database.ts` (lines 17-90)  
**Migrations:** `supabase/migrations/add_alerts_2_0_columns.sql`, `add_cleared_at_to_alerts.sql`

**Columns:**
- `id` (uuid, PRIMARY KEY)
- `organization_id` (uuid, NOT NULL, FK to organizations)
- `container_id` (uuid, NOT NULL, FK to containers)
- `list_id` (uuid, NULLABLE, FK to container_lists)
- `event_type` (text, NOT NULL)
- `severity` (text, NOT NULL)
- `title` (text, NOT NULL)
- `message` (text, NULLABLE)
- `metadata` (jsonb, NULLABLE)
- `created_by_user_id` (uuid, NULLABLE, FK to profiles)
- `created_at` (timestamptz, NOT NULL, DEFAULT now())
- `cleared_at` (timestamptz, NULLABLE) - Added via migration
- `assigned_to_user_id` (uuid, NULLABLE) - Added via migration
- `workflow_status` (text, DEFAULT 'open') - Added via migration

### Unique Constraints

**Finding:** ❌ **NO unique constraints exist on the alerts table.**

**Evidence:**
- No `CREATE UNIQUE INDEX` statements found in migration files
- No `UNIQUE` constraints in table definition
- Only primary key constraint on `id` column
- No partial unique index on `(container_id, event_type)` where `cleared_at IS NULL`

**Migration Files Checked:**
- `supabase/migrations/add_alerts_2_0_columns.sql` - No unique constraints
- `supabase/migrations/add_cleared_at_to_alerts.sql` - No unique constraints
- `supabase/migrations/schema_backup_*.sql` - No alerts table unique constraints found

**Explicit Statement:**
> **The database allows unlimited duplicate alerts for the same container and type.**

### Indexes

**Existing Indexes:**
- `idx_alerts_workflow_status` (on `workflow_status`) - Line 21 of `add_alerts_2_0_columns.sql`
- `idx_alerts_assigned_to_user_id` (on `assigned_to_user_id`) - Line 24 of `add_alerts_2_0_columns.sql`
- `idx_alerts_cleared_at` (on `cleared_at` WHERE `cleared_at IS NOT NULL`) - Line 8 of `add_cleared_at_to_alerts.sql`

**Missing Indexes:**
- No index on `(organization_id, container_id, event_type, cleared_at)`
- No index on `(container_id, event_type)` for uniqueness checks

---

## 4️⃣ Race Condition Verification

### Can Container Update and Dashboard Load Both Attempt to Create Same Alert?

**Answer:** ✅ **YES**

**Scenario:**
1. User updates container → triggers `updateContainer()` → calls `createAlertsForContainerChange()`
2. User navigates to dashboard → triggers `backfillWarningAlertsForCurrentOrg()`
3. Both functions check for existing alert **at nearly the same time**
4. Both see "no alert exists" (neither has inserted yet)
5. Both create alerts → **2 alerts created**

**Evidence:**
- `updateContainer()` calls `createAlertsForContainerChange()` synchronously (line 333)
- Dashboard page triggers `backfillWarningAlertsForCurrentOrg()` asynchronously (line 20)
- Both use non-atomic check-then-insert pattern
- No locking mechanism prevents concurrent execution

**File References:**
- `lib/data/containers-actions.ts:333` - `createAlertsForContainerChange()` called
- `app/dashboard/page.tsx:20` - `backfillWarningAlertsForCurrentOrg()` called
- Both check for existing alerts before inserting

---

### Can Two Users Trigger Alert Creation Simultaneously?

**Answer:** ✅ **YES**

**Scenario:**
1. User A updates container → triggers `createAlertsForContainerChange()`
2. User B updates same container (or navigates to dashboard) → triggers alert creation
3. Both check for existing alert **at nearly the same time**
4. Both see "no alert exists"
5. Both create alerts → **2 alerts created**

**Evidence:**
- No row-level locking in `createAlertsForContainerChange()`
- No database-level locking
- No transaction isolation that would prevent concurrent inserts
- Multiple users can update containers simultaneously

---

### Can Background Sweeps Overlap with Real-Time Updates?

**Answer:** ✅ **YES**

**Scenario:**
1. User updates container → triggers `createAlertsForContainerChange()`
2. User refreshes dashboard → triggers `backfillWarningAlertsForCurrentOrg()`
3. User refreshes dashboard again quickly → triggers `backfillWarningAlertsForCurrentOrg()` again
4. All three operations check for existing alert **at nearly the same time**
5. All three see "no alert exists"
6. All three create alerts → **3 alerts created** (matches user's reported issue)

**Evidence:**
- Dashboard backfill runs on every page load (line 20 of `app/dashboard/page.tsx`)
- No debouncing or rate limiting
- No check to prevent multiple concurrent backfill executions
- Backfill runs in background (`void Promise.allSettled()`) so doesn't block page rendering

**File Reference:**
```typescript
// app/dashboard/page.tsx:18-20
void Promise.allSettled([
  backfillOverdueAlertsForCurrentOrg(),
  backfillWarningAlertsForCurrentOrg(),
])
```

**Critical Window:**
```
Time T1: Function A checks database → "no alert exists" ✓
Time T2: Function B checks database → "no alert exists" ✓  (A hasn't inserted yet)
Time T3: Function C checks database → "no alert exists" ✓  (A & B haven't inserted yet)
Time T4: Function A inserts alert → Success
Time T5: Function B inserts alert → Success (duplicate!)
Time T6: Function C inserts alert → Success (duplicate!)
```

---

## 5️⃣ Impact Assessment

### Does Duplicate Alerts Affect Fees?

**Answer:** ❌ **NO**

**Evidence:**
- Alerts are informational records only
- Fee calculations are in `lib/tierUtils.ts` and `lib/utils/containers.ts`
- Fees computed from container data, not alert data
- No code reads alerts to calculate fees

---

### Does Duplicate Alerts Affect Container Status?

**Answer:** ❌ **NO**

**Evidence:**
- Container status computed from `computeDerivedFields()` in `lib/utils/containers.ts`
- Status derived from `arrival_date`, `free_days`, `last_free_day`, etc.
- No code reads alerts to determine container status
- Alerts are created FROM status changes, not the reverse

---

### Does Duplicate Alerts Affect Billing?

**Answer:** ❌ **NO**

**Evidence:**
- Billing calculations use container data directly
- No billing code references alerts table
- Alerts are informational only

---

### Does Duplicate Alerts Affect Notifications?

**Answer:** ❌ **NO**

**Evidence:**
- Email drafts created separately (not from alerts)
- Daily digests query alerts but don't depend on uniqueness
- Multiple identical alerts would just appear multiple times in digest
- No code counts alerts for notification logic

---

### Impact Limited To:

✅ **UI Noise:**
- Duplicate alerts appear in alerts list
- Alerts bell shows duplicate count
- Dashboard shows duplicate alerts

✅ **Alert List Clutter:**
- Multiple identical alerts for same container
- Makes it harder to see unique issues
- No functional impact, just visual noise

---

## Conclusion

### Is This a Logic Bug, Architecture Gap, or Database Enforcement Gap?

**Answer:** **BOTH - Logic Bug AND Database Enforcement Gap**

**Logic Bug:**
- Non-atomic check-then-insert operations
- No transaction protection
- No locking mechanism
- Multiple concurrent paths can create same alert

**Database Enforcement Gap:**
- No unique constraint to prevent duplicates at database level
- Database allows unlimited duplicate alerts
- No database-level enforcement of "one active alert per container per type"

**Architecture Gap:**
- Multiple alert creation paths (event-driven + backfill)
- No single source of truth for alert uniqueness
- Backfill runs on every dashboard load (no debouncing/rate limiting)

---

### Risk Level: **MEDIUM**

**Justification:**
- **Impact:** Low (UI noise only, no functional impact)
- **Frequency:** Medium (occurs when container updates and dashboard loads happen concurrently)
- **Severity:** Medium (violates data integrity expectations)
- **Fix Complexity:** Low (can be fixed with database constraint)

---

## Summary Table

| Aspect | Finding |
|--------|---------|
| **Alert Creation Paths** | 3 paths identified (1 event-driven, 2 backfill) |
| **De-Duplication Strategy** | Check-then-insert (non-atomic) |
| **Database Constraints** | ❌ NO unique constraints |
| **Race Conditions** | ✅ YES - Multiple confirmed scenarios |
| **Impact on Fees** | ❌ NO |
| **Impact on Status** | ❌ NO |
| **Impact on Billing** | ❌ NO |
| **Impact on Notifications** | ❌ NO |
| **Impact on UI** | ✅ YES - Duplicate alerts appear |
| **Risk Level** | **MEDIUM** |
| **Root Cause** | Logic bug (non-atomic) + Database enforcement gap |

---

**End of Report**




