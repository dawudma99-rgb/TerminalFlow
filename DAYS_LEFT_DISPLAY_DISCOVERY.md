# Days Left Display Discovery Report

## Problem Statement

Two containers have identical data except `weekend_chargeable` (one `true`, one `false`). Database shows different values, but UI shows identical `days_left`.

---

## 1) Test Data Analysis

### Container Data Structure

For both containers, the key fields are:
- `arrival_date`: Timestamp string
- `free_days`: Number (typically 7)
- `weekend_chargeable`: Boolean (`true` vs `false`)
- `current "now"`: Server time (`new Date()` in `computeDaysLeft`)

### Expiry Date Calculation Logic

**File:** `lib/utils/containers.ts:224-250` (`computeDaysLeft`)

**Logic Flow:**
```typescript
export function computeDaysLeft(arrival?: string | null, freeDays = 7, includeWeekends = true): number | null {
  const arrivalDate = parseDateFlexible(arrival)
  if (!arrivalDate) return null

  const now = new Date()  // ← Current server time
  const nowNormalized = startOfDay(now)
  const normalizedArrival = startOfDay(arrivalDate)

  if (includeWeekends) {
    // Calendar days: expiry = arrival + freeDays calendar days
    const expiryDate = new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
    const diff = expiryDate.getTime() - nowNormalized.getTime()
    return Math.ceil(diff / DAY_IN_MS)
  } else {
    // Business days: expiry = arrival + freeDays business days (skips weekends)
    const expiryDate = addChargeableDays(normalizedArrival, freeDays, false)
    const daysLeft = countChargeableDaysBetween(nowNormalized, expiryDate, false)
    
    if (expiryDate.getTime() < nowNormalized.getTime()) {
      const daysOverdue = countChargeableDaysBetween(expiryDate, nowNormalized, false)
      return -daysOverdue
    }
    
    return daysLeft
  }
}
```

**Key Finding:**
- `includeWeekends=true`: Adds `freeDays` calendar days to arrival date
- `includeWeekends=false`: Adds `freeDays` business days (skips Saturday/Sunday) to arrival date

**Why Expiry Dates Might Match:**
- If the date range doesn't cross a weekend, both calculations yield the same expiry date
- Example: Arrival Monday + 3 days = Thursday (no weekend crossed)
- If the date range crosses a weekend, expiry dates differ:
  - `includeWeekends=true`: Arrival Friday + 3 days = Monday (counts weekend)
  - `includeWeekends=false`: Arrival Friday + 3 business days = Wednesday (skips weekend)

---

## 2) Exact Source of days_left Used by Containers Page

### UI Rendering Code

**File:** `app/dashboard/containers/components/ContainerTable.tsx:399`

**JSX:**
```typescript
<TableCell>
  {container.days_left ?? '—'}
</TableCell>
```

**Data Field Used:**
- ✅ `container.days_left` (direct property access)

**Not Used:**
- ❌ `container.last_free_day` (not used for display)
- ❌ `container.lfd_date` (only used for detention calculations)
- ❌ Inline computed values (no computation in JSX)

**Location:**
- File: `app/dashboard/containers/components/ContainerTable.tsx`
- Line: 399
- Component: `ContainerTable` function component
- Context: Demurrage view mode table cell

---

## 3) Compute Pipeline for List Data

### Data Flow

**Step 1: Container List Fetch**

**File:** `app/dashboard/containers/page.tsx:376`
```typescript
const { containers, loading, ... } = useContainers(activeListId)
```

**Step 2: useContainers Hook**

**File:** `lib/data/useContainers.ts:34-36`
```typescript
const fetcher = async () => {
  const data = await fetchContainers(listId ?? undefined)
  return data
}
```

**Step 3: fetchContainers Server Action**

**File:** `lib/data/containers-actions.ts:84-132`

**Function:** `fetchContainers(listId?: string | null): Promise<ContainerRecordWithComputed[]>`

**Process:**
1. Queries database: `.from('containers').select('*')`
2. Gets `data: ContainerRecord[]` (database rows)
3. **Calls `computeDerivedFields` for each container:**
   ```typescript
   const withDerived: ContainerRecordWithComputed[] = data.map((c: ContainerRecord) => {
     const computed = computeDerivedFields(c)  // ← WEEKEND LOGIC HERE
     return { ...c, ...computed } as ContainerRecordWithComputed
   })
   ```
4. Returns containers with computed fields

**Step 4: computeDerivedFields**

**File:** `lib/utils/containers.ts:275-280`

**Function:** `computeDerivedFields(c: ContainerRow): DerivedContainer`

**Key Code:**
```typescript
export function computeDerivedFields(
  c: ContainerRow,
  warningThresholdDays?: number
): DerivedContainer {
  const includeWeekends = c.weekend_chargeable  // ← Reads from DB row
  const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)  // ← Uses weekend logic
  // ...
}
```

**Returned Object Shape:**
- All database fields from `ContainerRow` (including `weekend_chargeable`)
- Plus computed fields: `days_left`, `status`, `demurrage_fees`, `detention_fees`, etc.

**Step 5: SWR Cache**

**File:** `lib/data/useContainers.ts:40-46`
```typescript
const swrKey = orgId ? ['containers', orgId, listId] : null

const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000, // refresh every minute
  keepPreviousData: true,
})
```

**Cache Key:** `['containers', orgId, listId]`
- ✅ Does NOT include `weekend_chargeable` (correct - computed on fetch)
- ✅ Caches computed results (includes `days_left`)
- ✅ Refresh interval: 60 seconds

---

## 4) Alternative Computation Paths

### Search Results

**A) `computeDaysLeft` Call Sites**

**File:** `lib/utils/containers.ts`
- Line 263: `computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)` - Called from `computeContainerStatus`
- Line 280: `computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)` - Called from `computeDerivedFields`

**Usage:**
- ✅ Only used internally within `computeDerivedFields` pipeline
- ✅ Not called directly from UI components

---

**B) Direct Math.ceil/Math.floor with DAY_IN_MS**

**File:** `lib/utils/containers.ts:236`
```typescript
return Math.ceil(diff / DAY_IN_MS)  // ← Inside computeDaysLeft when includeWeekends=true
```

**File:** `app/dashboard/containers/components/ContainerTable.tsx:431`
```typescript
detentionDaysLeft = Math.floor(diffMs / DAY_IN_MS)  // ← For detention display only
```

**Analysis:**
- ✅ `Math.ceil` in `computeDaysLeft` is used when `includeWeekends=true` (calendar days)
- ✅ `Math.floor` in `ContainerTable.tsx` is for detention display only (not demurrage `days_left`)
- ✅ No alternative computation for demurrage `days_left`

---

**C) DB Columns: `last_free_day` / `lfd_date`**

**File:** `app/dashboard/containers/components/ContainerTable.tsx:427`
```typescript
else if (container.lfd_date) {
  // Detention not started yet: days until LFD
  const lfd = startOfDay(new Date(container.lfd_date))
  const diffMs = lfd.getTime() - today.getTime()
  detentionDaysLeft = Math.floor(diffMs / DAY_IN_MS)
}
```

**Analysis:**
- ✅ `lfd_date` is used for **detention** display only (not demurrage)
- ✅ `last_free_day` is NOT used for `days_left` calculation
- ✅ No DB column is used to infer demurrage `days_left`

---

### Conclusion: Single Computation Path

**Demurrage `days_left` has ONE computation path:**
1. `fetchContainers` → `computeDerivedFields` → `computeDaysLeft` → `days_left`
2. Stored in `ContainerRecordWithComputed.days_left`
3. Displayed directly from `container.days_left`

**No alternative paths found.**

---

## 5) Caching / Memoization Check

### A) React useMemo / useEffect / State

**File:** `app/dashboard/containers/page.tsx`

**Search Results:**
- ✅ No `useMemo` for containers data
- ✅ No `useEffect` that recomputes `days_left`
- ✅ Containers data comes directly from `useContainers` hook (no local state transformation)

**Data Flow:**
```typescript
const { containers, ... } = useContainers(activeListId)  // ← Direct from hook
// ...
<ContainerTable containers={containers} ... />  // ← Passed directly
```

---

### B) SWR Caching

**File:** `lib/data/useContainers.ts:40-46`

**Cache Configuration:**
```typescript
const swrKey = orgId ? ['containers', orgId, listId] : null

const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000, // refresh every minute
  keepPreviousData: true,
})
```

**Cache Key Analysis:**
- Key: `['containers', orgId, listId]`
- ✅ Does NOT include `weekend_chargeable` (correct - it's in the data, not the key)
- ✅ Caches the **computed results** (includes `days_left` already calculated)
- ✅ Refresh interval: 60 seconds (auto-refreshes every minute)

**Cache Behavior:**
- ✅ Cache stores the result of `fetchContainers()` which includes computed `days_left`
- ✅ When cache is valid, it returns cached computed results
- ✅ When cache expires/invalidates, it refetches and recomputes

---

### C) Server Caching

**File:** `lib/data/containers-actions.ts:84`

**Function:** `fetchContainers`

**Analysis:**
- ❌ No `cache()` wrapper (Next.js cache)
- ❌ No `revalidate` configuration
- ✅ Pure server action - recomputes on every call
- ✅ `computeDerivedFields` runs fresh on each fetch

---

### Cache Impact on weekend_chargeable

**Scenario:**
1. Container A created with `weekend_chargeable=true`
2. Container B created with `weekend_chargeable=false`
3. Both containers have same `arrival_date` and `free_days`

**Expected Behavior:**
- `fetchContainers` should compute different `days_left` for each container
- SWR cache should store these different values
- UI should display different values

**Potential Issue:**
- If containers were created before database column existed, `weekend_chargeable` might be `undefined` in DB
- But TypeScript types say it's `boolean` (required)
- If DB column doesn't exist, `.select('*')` won't return it
- Runtime value would be `undefined`
- But code does: `const includeWeekends = c.weekend_chargeable` (no fallback)
- TypeScript thinks it's `boolean`, but runtime might be `undefined`
- This would cause a type mismatch that TypeScript can't catch

---

## Conclusion

### What Value Is Actually Being Displayed

**Source:** `container.days_left` (from `ContainerRecordWithComputed`)

**Origin:**
1. Database query: `.from('containers').select('*')`
2. `computeDerivedFields(c)` called for each container
3. `computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)` calculates `days_left`
4. `includeWeekends = c.weekend_chargeable` (line 279)

---

### Whether computeDerivedFields Is Being Used

**✅ YES** - `computeDerivedFields` is used on the rendering path:
- `fetchContainers` calls `computeDerivedFields(c)` for each container (line 126)
- Result includes `days_left` field
- This value is cached by SWR and displayed directly

---

### If Weekend Logic Is Used, Why Both Containers Still Match

**Possible Reasons:**

1. **Database Column Missing (Most Likely)**
   - If `weekend_chargeable` column doesn't exist in database:
     - `.select('*')` won't return the field
     - `c.weekend_chargeable` is `undefined` at runtime
     - Code does: `const includeWeekends = c.weekend_chargeable`
     - `undefined` is falsy, so `includeWeekends = false` (unexpected behavior)
     - But wait - if both containers have `undefined`, both get `includeWeekends = false`
     - Both use business days calculation
     - But if dates don't cross weekend, results still match

2. **Dates Don't Cross Weekend**
   - If both containers' date ranges don't cross a weekend:
     - `includeWeekends=true`: Arrival Monday + 3 days = Thursday
     - `includeWeekends=false`: Arrival Monday + 3 business days = Thursday
     - Same result even with different logic

3. **SWR Cache Staleness (Unlikely)**
   - If Container B was created after Container A:
     - Container A might be cached with old `days_left`
     - Container B fetches fresh and gets new `days_left`
     - But cache refreshes every 60 seconds, so unlikely to persist

---

### Single Most Likely Root Cause

**🔴 DATABASE COLUMN MISSING**

**Evidence:**
1. TypeScript types say `weekend_chargeable: boolean` (required)
2. Code reads `c.weekend_chargeable` without fallback
3. If column doesn't exist, `.select('*')` won't return it
4. Runtime value would be `undefined`
5. Both containers would have `undefined` → both get same behavior
6. Previous discovery report (`WEEKEND_CHARGEABLE_BUG_DISCOVERY.md`) identified this as the root cause

**Secondary Possibility: Dates Don't Cross Weekend**
- If date ranges don't cross Saturday/Sunday, both calculations yield same result
- This is expected behavior, not a bug
- But user says "DB shows different values" - if DB has different `weekend_chargeable`, calculation should differ

**Conclusion:**
The most likely root cause is that the `weekend_chargeable` database column doesn't exist, so both containers have `undefined` values at runtime, causing both to use the same calculation logic (likely defaulting to a single behavior).

