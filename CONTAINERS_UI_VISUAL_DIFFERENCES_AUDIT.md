# Containers UI Visual Differences Audit

**Purpose:** Audit why the Containers UI looks visually different when switching between lists

**Status:** Discovery only - no fixes applied

---

## 1) Layout/Styling Changes Based on Conditions

### Conditions That Affect UI Layout

#### A. Loading States (`isInitialLoading`, `isRefreshing`, `loading`)

**File:** `app/dashboard/containers/page.tsx`

**Full-page loading state (lines 644-653):**
```typescript
if (isInitialLoading && containers.length === 0) {
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header with title */}
      <LoadingState message="Loading containers..." />
    </div>
  )
}
```
- **Condition:** `isInitialLoading && containers.length === 0`
- **What changes:** Entire page structure changes - shows minimal header + loading spinner
- **When:** Only on first load when no containers exist yet

**Full-page error state (lines 657-669):**
```typescript
if (error && containers.length === 0) {
  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header with title */}
      <ErrorAlert message={...} />
    </div>
  )
}
```
- **Condition:** `error && containers.length === 0`
- **What changes:** Entire page structure changes - shows minimal header + error alert
- **When:** Error occurs and no cached containers exist

**Main content area loading (lines 751-758):**
```typescript
{loading ? (
  <motion.div className="flex h-[520px] items-center justify-center ...">
    <span>Loading container board…</span>
  </motion.div>
) : ...}
```
- **Condition:** `loading === true`
- **What changes:** Shows 520px height loading placeholder instead of table
- **When:** Any time containers are loading (initial or refresh)

**Refreshing indicator (lines 681-685):**
```typescript
{isRefreshing && (
  <span className="text-xs text-muted-foreground">
    Refreshing…
  </span>
)}
```
- **Condition:** `isRefreshing === true`
- **What changes:** Adds "Refreshing…" text next to page title
- **When:** Background refresh is happening (has data, but fetching new)

#### B. Container Count (`containers.length`, `filteredContainers.length`)

**Empty states (lines 759-766):**
```typescript
containers.length === 0 || filteredContainers.length === 0 ? (
  <EmptyStates
    loading={loading}
    hasContainers={containers.length > 0}
    hasFilteredContainers={filteredContainers.length > 0}
    hasActiveFilters={hasActiveFilters}
    onClearFilters={handleClearFilters}
  />
) : ...}
```

**EmptyStates component renders different heights:**
- **No containers at all:** `h-[360px]` (line 31 in EmptyStates.tsx)
- **Containers exist but filtered out:** `h-[280px]` (line 45 in EmptyStates.tsx)
- **Height difference:** 80px difference between the two empty states

**StatsSummary (lines 733-740):**
```typescript
<StatsSummary
  total={stats.total}        // ← filteredContainers.length
  overdue={stats.overdue}    // ← computed from filteredContainers
  warning={stats.warning}    // ← computed from filteredContainers
  safe={stats.safe}          // ← computed from filteredContainers
  closed={stats.closed}      // ← computed from filteredContainers
  updatedLabel={`Synced ${timeAgo}`}
/>
```
- **What changes:** All numbers in stats bar change based on filtered containers
- **When:** Different lists have different container counts or status distributions

**Footer text (lines 785-789):**
```typescript
<div className="border-t ...">
  {hasMore
    ? `Showing ${visibleContainers.length} of ${filteredContainers.length} containers`
    : `All ${filteredContainers.length} containers loaded`}
</div>
```
- **What changes:** Footer text and numbers change
- **When:** Different lists have different container counts

**FilterToolbar owners dropdown (line 728):**
```typescript
<FilterToolbar
  owners={uniqueOwners}  // ← computed from containers
  // ...
/>
```
- **What changes:** Owner filter dropdown options change
- **When:** Different lists have different assigned owners
- **Computed from:** `containers.map(c => c.assigned_to).filter(Boolean)` (lines 461-466)

#### C. Per-List Conditions

**No special styling based on `activeListId`:**
- ✅ No conditional styling in `containers/page.tsx` based on `activeListId`
- ✅ No conditional styling based on list name (e.g., "Main List")
- ✅ No special handling for specific list IDs

**Special handling in ListTabs (not in containers page):**
- `list.name !== 'Main List'` - Only affects delete button visibility (line 132 in ListTabs.tsx)
- This doesn't affect containers page layout

---

## 2) useContainers.ts SWR Configuration

### SWR Configuration

**File:** `lib/data/useContainers.ts`

```typescript
const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
  revalidateOnFocus: false,
  refreshInterval: 60000, // refresh every minute
  keepPreviousData: true, // prevent flicker when switching lists
})
```

**SWR Key:**
```typescript
const swrKey = orgId ? ['containers', orgId, listId] : null
```
- **Key includes:** `organizationId` and `listId`
- **When `listId` changes:** SWR treats it as a different cache key
- **Result:** Triggers a new fetch for the new list

### What User Sees During List Switch

**Timeline of events:**

1. **User clicks new list tab** → `handleSwitchList(newListId)` called
2. **Optimistic update in useLists** → `activeListId` updates immediately (new refactor)
3. **ListTabs re-renders** → New tab highlighted (blue background)
4. **ContainersPage re-renders** → `useContainers(newListId)` called with new ID
5. **SWR detects key change** → `['containers', orgId, newListId]` is different from previous
6. **SWR behavior with `keepPreviousData: true`:**
   - **Old containers stay visible** (from previous list)
   - **New fetch starts in background**
   - **`isLoading: true`** but `data` still has old containers
   - **`isRefreshing: true`** (because `hasData && isLoading`)
7. **New containers arrive** → SWR updates `data` with new list's containers
8. **UI updates** → Table, stats, filters all update to new data

### Window Where activeListId ≠ Containers

**Mismatch window exists:**

- **Duration:** From when `activeListId` updates until new containers fetch completes
- **Typical duration:** 100-500ms (network latency + server processing)
- **What user sees:**
  - ✅ New list tab is highlighted (correct)
  - ❌ Old list's containers are still visible (incorrect)
  - ✅ "Refreshing…" text appears (if `isRefreshing`)
  - ❌ Stats show old list's numbers
  - ❌ Footer shows old list's count
  - ❌ Owner filter shows old list's owners

**Example scenario:**
- User on "Main List" (50 containers)
- Clicks "Asia Imports" (10 containers)
- **Immediately:** "Asia Imports" tab highlighted, but 50 containers from "Main List" still visible
- **After ~200ms:** Containers update to 10 from "Asia Imports"

---

## 3) ContainersPage Branching Logic

### All Conditional Branches

**File:** `app/dashboard/containers/page.tsx`

#### Branch 1: Initial Loading (lines 644-653)
```typescript
if (isInitialLoading && containers.length === 0) {
  return <div>...<LoadingState /></div>
}
```
- **What disappears:** Everything except header and loading spinner
- **Layout impact:** Completely different structure (centered loading)

#### Branch 2: Error with No Data (lines 657-669)
```typescript
if (error && containers.length === 0) {
  return <div>...<ErrorAlert /></div>
}
```
- **What disappears:** Everything except header and error alert
- **Layout impact:** Completely different structure (centered error)

#### Branch 3: Main Content Area (lines 750-791)
```typescript
{loading ? (
  <motion.div className="h-[520px] ...">Loading container board…</motion.div>
) : containers.length === 0 || filteredContainers.length === 0 ? (
  <EmptyStates ... />
) : (
  <motion.div>...<ContainerTable /></motion.div>
)}
```

**Sub-branch 3a: Loading (lines 751-758)**
- **What shows:** 520px height loading placeholder
- **What disappears:** Table, footer, empty state
- **Layout impact:** Fixed height placeholder

**Sub-branch 3b: Empty States (lines 759-766)**
- **What shows:** EmptyStates component
- **Height varies:**
  - No containers: `h-[360px]`
  - Filtered out: `h-[280px]`
- **Layout impact:** 80px height difference causes layout shift

**Sub-branch 3c: Table with Data (lines 768-790)**
- **What shows:** ContainerTable + footer
- **Footer text varies:**
  - `"Showing X of Y containers"` (if hasMore)
  - `"All Y containers loaded"` (if all visible)
- **Layout impact:** Footer height might vary slightly with text length

### Parts That Always Render (Regardless of State)

**Always visible (when not in initial loading/error states):**
1. **Header** (lines 674-713)
   - Title: "Container Control Room"
   - "Refreshing…" text (conditional on `isRefreshing`)
   - Import/Export buttons

2. **ListTabs** (line 716)
   - Always renders (unless lists are loading)

3. **FilterToolbar** (lines 718-731)
   - Always renders
   - Owner dropdown options change based on `uniqueOwners` (computed from containers)

4. **StatsSummary** (lines 733-740)
   - Always renders
   - Numbers change based on `filteredContainers`

5. **Error Alert** (lines 743-748)
   - Conditionally renders if `error && containers.length > 0`
   - Shows above table when there's cached data but refresh failed

### Layout Jump Causes

**Potential layout jumps:**

1. **Empty state height difference (80px):**
   - No containers: 360px
   - Filtered out: 280px
   - **Impact:** Page height changes by 80px when switching between empty list and list with filtered results

2. **Loading placeholder (520px) vs Table:**
   - Loading: Fixed 520px height
   - Table: Variable height based on container count
   - **Impact:** Height changes when loading completes

3. **Stats numbers changing:**
   - Stats bar text length varies (e.g., "5" vs "125")
   - **Impact:** Minor, but could cause slight width changes

4. **Owner filter dropdown:**
   - Options change based on containers
   - **Impact:** Dropdown width might change if owner names are different lengths

5. **Footer text length:**
   - "Showing 10 of 50" vs "All 5 containers loaded"
   - **Impact:** Minor, footer height should be consistent

---

## 4) Special Styling/Logic for Certain Lists

### Search Results

**No special styling found:**
- ✅ No conditionals on `list.name === 'Main List'` in containers page
- ✅ No conditionals on `activeListId` in containers page
- ✅ No conditionals on `containers.length` that change padding/margins
- ✅ No conditionals that hide/show sections based on list

**Special handling only in ListTabs:**
- `list.name !== 'Main List'` - Only affects delete button visibility
- This is in the list switcher, not the containers page itself

### Data-Driven Differences

**All visual differences are data-driven:**
- Container counts → Stats numbers
- Container statuses → Stats distribution
- Assigned owners → Filter dropdown options
- Container data → Table rows
- Filter results → Empty state type

**No structural layout bugs found** - all differences are expected based on data differences between lists.

---

## 5) Analysis & Recommendations

### Are Differences Purely Data-Driven or UI Bugs?

**Answer: Mostly data-driven, but one UX issue**

#### Data-Driven Differences (Expected):
1. ✅ **Stats numbers** - Different lists have different container counts/statuses
2. ✅ **Table rows** - Different lists have different containers
3. ✅ **Owner filter options** - Different lists have different assigned owners
4. ✅ **Empty state type** - Some lists are empty, others have containers
5. ✅ **Footer text** - Shows count for current list

#### UX Issue (Not a Bug, But Could Be Better):
1. ⚠️ **`keepPreviousData: true` mismatch window**
   - New tab highlighted but old containers visible
   - Duration: ~100-500ms typically
   - **Impact:** Confusing - user sees wrong data briefly
   - **Not a bug:** This is by design to prevent flicker, but creates mismatch

2. ⚠️ **Empty state height difference (80px)**
   - Causes layout shift when switching between empty and non-empty lists
   - **Impact:** Page "jumps" 80px
   - **Not a bug:** Different empty states have different content, but height could be standardized

### keepPreviousData Mismatch Window

**How long the window lasts:**

- **Minimum:** ~50-100ms (very fast network, cached data)
- **Typical:** ~200-500ms (normal network latency)
- **Maximum:** ~1-2 seconds (slow network or server delay)

**What happens during the window:**

1. **activeListId** = new list ID (updated optimistically)
2. **ListTabs** = new tab highlighted
3. **containers** = old list's containers (from previous SWR cache)
4. **StatsSummary** = old list's stats
5. **FilterToolbar owners** = old list's owners
6. **ContainerTable** = old list's containers
7. **Footer** = old list's count

**User perception:**
- User clicks "Asia Imports" tab
- Tab turns blue (correct)
- But still sees "Main List" containers (incorrect)
- After ~200ms, containers update to "Asia Imports" data
- **Feels like:** "The switch didn't work" or "It's laggy"

### Concrete Suggestions for Consistent Layout

#### Option 1: Show Loading Shimmer During Switch (Recommended)

**Approach:** Detect when `listId` changes and show a loading state instead of old data

**Implementation:**
- Track previous `listId` in a ref
- When `listId` changes and `isLoading`, show skeleton/shimmer
- Hide old containers during the transition
- **Pros:** No mismatch, clear feedback that switch is happening
- **Cons:** Brief flash of loading state (but better than wrong data)

#### Option 2: Standardize Empty State Heights

**Approach:** Make both empty states the same height

**Implementation:**
- Change both to `h-[360px]` (or another fixed height)
- **Pros:** Prevents layout jump
- **Cons:** Might have extra whitespace in "filtered out" state

#### Option 3: Always Render Same Shell

**Approach:** Always render header, filters, stats, table structure, but show loading/empty states inside

**Implementation:**
- Never conditionally return different layouts
- Always render the same structure
- Show loading/empty states as content within the shell
- **Pros:** Completely consistent layout
- **Cons:** Requires refactoring the early returns

#### Option 4: Disable keepPreviousData for List Switches

**Approach:** Use `keepPreviousData: false` or conditionally disable it

**Implementation:**
- Detect when `listId` changes
- Clear previous data when switching lists
- Show loading state instead
- **Pros:** No mismatch window
- **Cons:** Brief loading flash (but no wrong data)

### Safest Change Recommendation

**Recommended: Option 1 + Option 2 (Combined)**

1. **Show loading shimmer during list switch:**
   - Add a ref to track previous `listId` in `useContainers`
   - When `listId` changes and `isLoading`, show skeleton instead of old data
   - This eliminates the mismatch window

2. **Standardize empty state heights:**
   - Change both empty states to same height (e.g., `h-[360px]`)
   - Prevents layout jump when switching between empty and non-empty lists

**Why this is safest:**
- ✅ Doesn't change existing data flow
- ✅ Only affects visual presentation during transitions
- ✅ Maintains all existing functionality
- ✅ Minimal code changes
- ✅ No breaking changes

**Alternative (if shimmer is too much):**
- Just standardize empty state heights (Option 2)
- Accept the brief mismatch window as acceptable UX
- Add a subtle loading indicator in the table area during switch

---

## Summary

### Exact Conditions When UI Differs Per List

1. **Container counts differ** → Stats numbers, footer text, table rows
2. **Container statuses differ** → Stats distribution (overdue/warning/safe counts)
3. **Assigned owners differ** → FilterToolbar owner dropdown options
4. **List is empty vs has containers** → Empty state vs table (80px height difference)
5. **During list switch** → `keepPreviousData: true` shows old containers while new tab is highlighted (~100-500ms window)

### Whether Differences Are Bugs

**No structural bugs found.** All differences are:
- ✅ Data-driven (expected based on list contents)
- ✅ Functionally correct
- ⚠️ **One UX issue:** Mismatch window during list switch (not a bug, but could be improved)

### Safest Change for Consistent Layout

**Recommended:** 
1. Show loading shimmer/skeleton during list switch (eliminates mismatch)
2. Standardize empty state heights to prevent layout jump

**Alternative (minimal):**
- Just standardize empty state heights
- Accept brief mismatch as acceptable trade-off for smooth transitions

---

**End of Audit Report**

