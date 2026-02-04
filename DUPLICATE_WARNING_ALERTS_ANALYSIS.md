# Duplicate Warning Alerts Analysis

## Issue Report

**Problem:** Three identical `became_warning` alerts were generated for a container that went into warning status.

**Date:** Investigation requested  
**Status:** Analysis complete, root cause identified

---

## Root Cause Analysis

### The Problem

When a container transitions to Warning status, multiple identical alerts can be created due to **race conditions** between different alert creation paths.

### Alert Creation Paths

There are **two separate code paths** that can create `became_warning` alerts:

#### 1. Event-Driven Alert Creation (Real-time)

**Function:** `createAlertsForContainerChange()`  
**File:** `lib/data/alerts-logic.ts`  
**Lines:** 96-127

**Triggered when:**
- User updates a container via `updateContainer()` server action
- Container status transitions from Safe/null → Warning

**Current Deduplication:**
- ✅ DOES check if alert exists before creating (lines 98-103)
- Uses `alertAlreadyExists()` function
- Checks: `container_id`, `event_type = 'became_warning'`, `cleared_at IS NULL`

#### 2. Background Backfill (On Dashboard Load)

**Function:** `backfillWarningAlertsForCurrentOrg()`  
**File:** `lib/data/overdue-sweep.ts`  
**Lines:** 296-435

**Triggered when:**
- Dashboard page loads (`app/dashboard/page.tsx`, line 20)
- Runs automatically on every dashboard visit
- Scans ALL containers in warning status
- Creates alerts for any that don't already have one

**Current Deduplication:**
- ✅ DOES check if alert exists before creating (lines 371-391)
- Uses similar check pattern
- Checks: `container_id`, `event_type = 'became_warning'`, `cleared_at IS NULL`

---

## Why Duplicates Are Created

### Race Condition Scenario

The duplicate alerts occur due to **race conditions** between these two paths:

**Scenario 1: Simultaneous Update + Dashboard Load**
1. User updates container → triggers `createAlertsForContainerChange()`
2. User navigates to dashboard → triggers `backfillWarningAlertsForCurrentOrg()`
3. Both functions check for existing alert **at nearly the same time**
4. Both see "no alert exists" (neither has inserted yet)
5. Both create alerts → **2 alerts created**

**Scenario 2: Rapid Dashboard Refreshes**
1. User refreshes dashboard multiple times quickly
2. Multiple instances of `backfillWarningAlertsForCurrentOrg()` run concurrently
3. All check for existing alert before any has inserted
4. All create alerts → **3+ alerts created**

**Scenario 3: Multiple Rapid Container Updates**
1. User updates container field → triggers alert check
2. User updates container again immediately (same transaction/session)
3. Both updates check for existing alert before first insert completes
4. Both create alerts → **2 alerts created**

### The Critical Window

The race condition occurs in this time window:

```
Time T1: Function A checks database → "no alert exists" ✓
Time T2: Function B checks database → "no alert exists" ✓  (A hasn't inserted yet)
Time T3: Function A inserts alert → Success
Time T4: Function B inserts alert → Success (duplicate!)
```

**Problem:** The check and insert are **not atomic**. There's a gap between:
1. Checking if alert exists
2. Inserting the alert

During this gap, another process can also check and find "no alert exists", then create a duplicate.

---

## Technical Details

### Current Implementation

**File:** `lib/data/alerts-logic.ts`

```typescript
// Lines 96-127
if ((oldStatus === 'Safe' || oldStatus === null) && newStatus === 'Warning') {
  // Check if alert already exists before creating
  const exists = await alertAlreadyExists(
    supabase,
    newContainer.organization_id,
    newContainer.id,
    'became_warning'
  )
  if (!exists) {
    alertsToCreate.push({
      // ... alert data
    })
  }
}

// Later, at line 268-270:
const { error } = await supabase
  .from('alerts')
  .insert(alertsToCreate)
```

**Issue:** The check (line 98) and insert (line 268) are **separate database operations**. Between them, another process can also check and insert.

### Database Constraints

**Finding:** ❌ **NO unique constraint** exists on the alerts table to prevent duplicates.

**Current Schema:**
- Primary key: `id` (UUID)
- No unique constraint on `(container_id, event_type, cleared_at IS NULL)`
- No unique constraint on `(organization_id, container_id, event_type, cleared_at IS NULL)`

**Impact:** Database allows duplicate alerts to be inserted.

---

## Evidence

### Code Evidence

1. **Two separate functions create alerts:**
   - `createAlertsForContainerChange()` - lines 96-127
   - `backfillWarningAlertsForCurrentOrg()` - lines 395-411

2. **Both check before creating, but checks are not atomic:**
   - Both use `alertAlreadyExists()` or equivalent check
   - Both have gap between check and insert

3. **Dashboard triggers backfill on every load:**
   - `app/dashboard/page.tsx`, line 20
   - Runs in background (non-blocking)
   - Can run multiple times if user refreshes

### Database Evidence

- No unique constraint to prevent duplicates at database level
- Multiple alerts with same `container_id`, `event_type = 'became_warning'`, `cleared_at IS NULL` can exist

---

## Why Three Alerts Specifically?

The user reported **three identical alerts**. This suggests:

**Most Likely Scenario:**
1. Container was updated (triggered `createAlertsForContainerChange`)
2. User navigated to dashboard (triggered `backfillWarningAlertsForCurrentOrg`)
3. User refreshed dashboard again quickly (triggered `backfillWarningAlertsForCurrentOrg` again)

All three operations happened before any insert was committed, so all three checks found "no alert exists", and all three created alerts.

**Alternative Scenario:**
- User updated container three times rapidly
- Each update triggered alert creation
- Race condition between checks allowed all three to create alerts

---

## Impact Assessment

### Severity: **MEDIUM**

**Impact:**
- User sees duplicate alerts in UI
- Clutters alerts list
- May confuse users
- No data corruption, just UI noise

**Frequency:**
- Likely to occur when:
  - Dashboard is loaded/refreshed while container updates are happening
  - User makes multiple rapid container updates
  - Multiple users updating containers simultaneously (less likely in typical use)

---

## Solutions (For Future Implementation)

### Solution 1: Database Unique Constraint (RECOMMENDED)

**Add a partial unique index:**

```sql
CREATE UNIQUE INDEX alerts_container_event_unique 
ON alerts (container_id, event_type) 
WHERE cleared_at IS NULL;
```

**Pros:**
- Prevents duplicates at database level
- Atomic - no race conditions possible
- Simplest solution
- Works for all alert types

**Cons:**
- Requires database migration
- Need to clean up existing duplicates first

### Solution 2: Optimistic Locking / Transaction Isolation

**Use database transactions with proper isolation level:**

```typescript
// Wrap check + insert in transaction
// Use INSERT ... ON CONFLICT DO NOTHING
```

**Pros:**
- Prevents race conditions
- No code changes to alert creation logic

**Cons:**
- More complex
- Requires understanding of transaction isolation

### Solution 3: Remove Backfill on Dashboard Load

**Stop calling `backfillWarningAlertsForCurrentOrg()` on every dashboard load:**

**Pros:**
- Eliminates one source of duplicates
- Alerts only created on state changes (more correct)

**Cons:**
- Alerts won't appear for containers that were already in warning before system was deployed
- Need alternative backfill strategy (manual, scheduled job, or one-time migration)

### Solution 4: Single Alert Creation Path

**Consolidate to only use event-driven alerts (`createAlertsForContainerChange`):**

**Pros:**
- Eliminates race condition between two paths
- Simpler architecture
- Alerts only created on actual state changes

**Cons:**
- Need to backfill historical alerts via one-time migration
- Won't catch containers that are already in warning status

---

## Recommended Fix

**Immediate Fix (Quick):**
1. Add database unique constraint (Solution 1)
2. Clean up existing duplicate alerts
3. Keep both creation paths (they serve different purposes)

**Long-term Fix (Architecture):**
1. Consider removing automatic backfill on dashboard load
2. Use scheduled job or one-time migration for historical alerts
3. Rely primarily on event-driven alerts for new state changes

---

## Files Involved

1. `lib/data/alerts-logic.ts` - Event-driven alert creation
2. `lib/data/overdue-sweep.ts` - Backfill function
3. `app/dashboard/page.tsx` - Triggers backfill on load
4. `lib/data/containers-actions.ts` - Calls `createAlertsForContainerChange`
5. Database schema - Needs unique constraint

---

## Testing Recommendations

After fix is implemented:

1. **Test race condition:**
   - Update container to warning status
   - Immediately navigate to dashboard
   - Verify only one alert created

2. **Test rapid updates:**
   - Update container multiple times quickly
   - Verify only one alert created

3. **Test backfill:**
   - Create container in warning status (via direct DB insert)
   - Run backfill function
   - Verify only one alert created

4. **Test database constraint:**
   - Attempt to insert duplicate alert manually
   - Verify database rejects it

---

## Conclusion

The three duplicate `became_warning` alerts were caused by a **race condition** between:
1. Event-driven alert creation (`createAlertsForContainerChange`)
2. Background backfill (`backfillWarningAlertsForCurrentOrg`)

Both functions check if an alert exists before creating, but the check and insert are **not atomic**, allowing multiple processes to create alerts before any insert is committed.

**The fix requires either:**
- A database unique constraint (recommended)
- Or removing one of the alert creation paths
- Or implementing proper transaction/locking

No code changes should be made until the user approves a solution approach.




