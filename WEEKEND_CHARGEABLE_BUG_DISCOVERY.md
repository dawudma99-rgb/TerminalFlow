# Weekend Chargeable Bug Discovery Report

## Problem Statement

Two containers with identical data except `weekend_chargeable` (A: `true`, B: `false`) show the same `days_left`, which is incorrect.

---

## 1. Persistence + Read Path

### Database Query

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (lines 84-135)

**Query:**
```typescript
let query = supabase
  .from('containers')
  .select('*')  // ← Line 90: Selects ALL columns
  .eq('organization_id', organizationId)
```

**Status:** ✅ **`weekend_chargeable` IS INCLUDED**

- Uses `.select('*')` which includes all columns
- Database type `containers.Row` includes `weekend_chargeable: boolean` (confirmed in `types/database.ts:249`)

**Returned Data Shape:**
- `data` is typed as `ContainerRecord[]` where `ContainerRecord = Database['public']['Tables']['containers']['Row']`
- This type includes `weekend_chargeable: boolean` (non-optional)

---

### Component Rendering

**File:** `app/dashboard/containers/components/ContainerTable.tsx` (lines 391-400)

**Display:**
```typescript
<TableCell>
  {container.days_left ?? '—'}
</TableCell>
```

**Data Source:** `container.days_left` comes from `computeDerivedFields()` result

---

## 2. Derived Fields Computation

### Where Derived Fields Are Computed

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (lines 126-131)

**Code:**
```typescript
const withDerived: ContainerRecordWithComputed[] = data.map((c: ContainerRecord) => {
  const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
  return { ...c, ...computed } as ContainerRecordWithComputed
})
```

**Container Object Shape at This Point:**
- `c` is typed as `ContainerRecord` (database row type from `containers-actions.ts:20`)
- `ContainerRecord = Database['public']['Tables']['containers']['Row']`
- This type **DOES include** `weekend_chargeable: boolean` (from `types/database.ts:249`)

**Type Cast:**
- `c as Parameters<typeof computeDerivedFields>[0]` casts to `ContainerRecord` from `lib/utils/containers.ts`
- The utils `ContainerRecord` interface **DOES include** `weekend_chargeable?: ContainerRow['weekend_chargeable']` (line 31)

---

### Type Mismatch Issue

**CRITICAL FINDING:** There are **TWO different `ContainerRecord` types**:

1. **`lib/data/containers-actions.ts:20`**
   ```typescript
   export type ContainerRecord = Database['public']['Tables']['containers']['Row']
   ```
   - Database row type
   - Includes `weekend_chargeable: boolean` (non-optional)

2. **`lib/utils/containers.ts:17`**
   ```typescript
   export interface ContainerRecord {
     // ... fields ...
     weekend_chargeable?: ContainerRow['weekend_chargeable']  // ← OPTIONAL
   }
   ```
   - Custom interface
   - Has `weekend_chargeable` as **optional** (`?`)

**The Cast:**
```typescript
computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

This casts the database `ContainerRecord` (with `weekend_chargeable: boolean`) to the utils `ContainerRecord` interface (with `weekend_chargeable?: boolean`).

**Potential Issue:** If the database column doesn't exist yet, `c.weekend_chargeable` would be `undefined`, and the optional field would make TypeScript happy, but the value would be lost.

---

## 3. Demurrage Path Uses includeWeekends

### computeDerivedFields Implementation

**File:** `lib/utils/containers.ts` → `computeDerivedFields()` (lines 262-378)

**Code:**
```typescript
export function computeDerivedFields(
  c: ContainerRecord,
  warningThresholdDays?: number
): ContainerWithDerivedFields {
  const includeWeekends = c.weekend_chargeable ?? true  // ← Line 266
  const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)  // ← Line 267
  // ...
}
```

**Status:** ✅ **CORRECTLY READS `weekend_chargeable`**

- Line 266: Reads `c.weekend_chargeable ?? true`
- Line 267: Passes `includeWeekends` to `computeDaysLeft()`

### computeDaysLeft Implementation

**File:** `lib/utils/containers.ts` → `computeDaysLeft()` (lines 211-237)

**Code:**
```typescript
export function computeDaysLeft(arrival?: string | null, freeDays = 7, includeWeekends = true): number | null {
  // ...
  if (includeWeekends) {
    // Original behavior: simple calendar day calculation
    const expiryDate = new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
    const diff = expiryDate.getTime() - nowNormalized.getTime()
    return Math.ceil(diff / DAY_IN_MS)
  } else {
    // Weekend-aware: calculate expiry using business days, then count business days until expiry
    const expiryDate = addChargeableDays(normalizedArrival, freeDays, false)
    const daysLeft = countChargeableDaysBetween(nowNormalized, expiryDate, false)
    // ...
  }
}
```

**Status:** ✅ **CORRECTLY USES `includeWeekends` PARAMETER**

- Has weekend-aware logic when `includeWeekends = false`
- Has original behavior when `includeWeekends = true`

---

## 4. Caching or Memoization Issues

### Data Fetching

**File:** `lib/data/useContainers.ts` (if exists)

**Status:** Need to check if there's a custom hook that caches containers

### Container List Display

**File:** `app/dashboard/containers/page.tsx`

**Finding:** No SWR or explicit caching found in grep results

**Data Flow:**
- Uses `useContainers()` hook (line 4)
- Need to check if this hook caches data

---

## 5. Minimal Reproduction Trace

### Where weekend_chargeable is Set on Insert

**File:** `app/dashboard/containers/components/AddContainerTrigger.tsx` → `handleSave()` (line 88)
```typescript
weekend_chargeable: data.weekend_chargeable ?? true,
```

**File:** `lib/data/containers-actions.ts` → `insertContainer()` (line 204)
```typescript
weekend_chargeable: container.weekend_chargeable ?? true,
```

**Database:** Persisted to `containers.weekend_chargeable` column

---

### Where It is Fetched

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (line 90)
```typescript
.select('*')  // Includes weekend_chargeable
```

**Return Type:** `ContainerRecord[]` where `ContainerRecord = Database['public']['Tables']['containers']['Row']`

**Status:** ✅ **SHOULD BE PRESENT** in returned data

---

### Where Derived Fields Are Computed

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (line 127)
```typescript
const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

**Type Cast Issue:**
- `c` is `ContainerRecord` (database type) with `weekend_chargeable: boolean`
- Cast to `ContainerRecord` (utils interface) with `weekend_chargeable?: boolean`
- If database column doesn't exist, `c.weekend_chargeable` would be `undefined`

**Inside computeDerivedFields:**
```typescript
const includeWeekends = c.weekend_chargeable ?? true  // Line 266
```

**If `c.weekend_chargeable` is `undefined`** (column doesn't exist), this defaults to `true`, which would make both containers behave the same.

---

### Where days_left is Displayed

**File:** `app/dashboard/containers/components/ContainerTable.tsx` (line 399)
```typescript
{container.days_left ?? '—'}
```

**Data Source:** `container.days_left` from `computeDerivedFields()` result

---

## Root Cause Analysis

### Most Likely Issue: Database Column Missing

**Hypothesis:** The `weekend_chargeable` column doesn't exist in the actual database yet, even though:
- TypeScript types include it (`types/database.ts:249`)
- Code tries to read/write it
- But the database schema hasn't been migrated

**Evidence:**
1. TypeScript types were added (Step 2)
2. UI and insert logic were added (Step 3)
3. Calculation logic was added (Step 4)
4. **But no database migration file was created**

**When Supabase returns data:**
- `.select('*')` returns all columns that exist
- If `weekend_chargeable` column doesn't exist, it won't be in the result
- TypeScript types say it should be there, but runtime data doesn't have it
- `c.weekend_chargeable` would be `undefined`
- `c.weekend_chargeable ?? true` would always be `true`
- Both containers would get `includeWeekends = true`

---

### Alternative Issue: Type Cast Losing Field

**Hypothesis:** The type cast `c as Parameters<typeof computeDerivedFields>[0]` is causing the field to be lost.

**Analysis:**
- Database `ContainerRecord` has `weekend_chargeable: boolean` (non-optional)
- Utils `ContainerRecord` has `weekend_chargeable?: boolean` (optional)
- Type cast should preserve the value, but if the database column doesn't exist, the value would be `undefined`

---

## Verification Steps Needed

1. **Check if database column exists:**
   - Run: `SELECT column_name FROM information_schema.columns WHERE table_name = 'containers' AND column_name = 'weekend_chargeable'`
   - If missing, that's the root cause

2. **Add debug logging:**
   - In `fetchContainers()`, log `c.weekend_chargeable` before calling `computeDerivedFields`
   - In `computeDerivedFields()`, log `c.weekend_chargeable` and `includeWeekends`

3. **Check actual database values:**
   - Query: `SELECT id, container_no, weekend_chargeable FROM containers WHERE container_no IN ('A', 'B')`
   - Verify the values are actually different in the database

---

## Summary

### Root Cause: Database Column Missing

**Most Likely Issue:** ❌ **DATABASE COLUMN MISSING**

The `weekend_chargeable` column likely doesn't exist in the actual database schema, even though:
- TypeScript types include it (`types/database.ts:249`)
- Code reads/writes it (`insertContainer` line 204, `computeDerivedFields` line 266)
- But **no database migration was created/run**

**Result:** 
- When Supabase returns data via `.select('*')`, the `weekend_chargeable` field is missing
- `c.weekend_chargeable` is `undefined` at runtime
- `c.weekend_chargeable ?? true` always evaluates to `true`
- Both containers get `includeWeekends = true`
- Both show the same `days_left` (calendar days calculation)

**Evidence:**
1. No migration file found for `weekend_chargeable` column
2. TypeScript types were added (Step 2) but database schema wasn't updated
3. Code assumes column exists but runtime data doesn't have it

**Fix Required:** Create and run a database migration to add:
```sql
ALTER TABLE containers
ADD COLUMN weekend_chargeable boolean NOT NULL DEFAULT true;
```

---

### Alternative Issue: SWR Cache Staleness

**Secondary Hypothesis:** SWR cache might be serving stale data

**File:** `lib/data/useContainers.ts` (lines 42-46)
```typescript
const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000, // refresh every minute
  keepPreviousData: true,
})
```

**Analysis:**
- SWR caches by key: `['containers', orgId, listId]`
- Cache does NOT key off `weekend_chargeable` changes
- If container was created/updated with different `weekend_chargeable`, cache might show old `days_left`
- However, `refreshInterval: 60000` should refresh every minute
- `keepPreviousData: true` might show stale data during refresh

**Verification:** Check if containers were created recently and cache hasn't refreshed yet.

**Note:** SWR cache keys off `['containers', orgId, listId]` - does NOT include `weekend_chargeable` in the key, so changing `weekend_chargeable` on a container won't invalidate the cache. However, `refreshInterval: 60000` should refresh every minute, so this is less likely to be the issue unless containers were just created.

---

### Verification Steps

1. **Check database column exists:**
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns 
   WHERE table_name = 'containers' 
   AND column_name = 'weekend_chargeable';
   ```

2. **Check actual database values:**
   ```sql
   SELECT id, container_no, weekend_chargeable, arrival_date, free_days
   FROM containers
   WHERE container_no IN ('CONTAINER_A', 'CONTAINER_B');
   ```

3. **Add debug logging in fetchContainers:**
   ```typescript
   console.log('[DEBUG] Container weekend_chargeable:', {
     id: c.id,
     container_no: c.container_no,
     weekend_chargeable: c.weekend_chargeable,
     hasWeekendChargeable: 'weekend_chargeable' in c
   });
   ```

4. **Add debug logging in computeDerivedFields:**
   ```typescript
   console.log('[DEBUG] computeDerivedFields weekend_chargeable:', {
     containerId: c.id,
     weekend_chargeable: c.weekend_chargeable,
     includeWeekends,
     days_left
   });
   ```

