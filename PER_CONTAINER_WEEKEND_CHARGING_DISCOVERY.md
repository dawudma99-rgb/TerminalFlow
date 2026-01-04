# Per-Container Weekend Charging Discovery Report

## Executive Summary

This report documents the current architecture for moving weekend charging from a global Settings option to a per-container setting. The current `weekendChargeable` setting in `profiles.settings` is **never read**, so this change can be implemented without breaking existing behavior.

**Key Findings:**
- Container schema has no weekend/calendar flags (new column required)
- Calculations run server-side, computed on-read (never stored)
- All calculations use simple millisecond-to-day conversions (no weekend logic exists)
- Form structure supports adding a weekend toggle in Demurrage/Detention sections
- No migration required for existing containers (can default to `true`)

---

## 1. Container Schema & Lifecycle

### Database Schema

**Table:** `containers`  
**Source:** `supabase/migrations/schema_backup_4.sql` (lines 232-261)  
**TypeScript Types:** `types/database.ts` (lines 227-338)

#### Date-Related Fields

| Field | Type | Nullable | Default | Purpose |
|-------|------|----------|---------|---------|
| `arrival_date` | `timestamptz` | ❌ NOT NULL | - | Container arrival at port |
| `gate_out_date` | `timestamptz` | ✅ NULL | `NULL` | Date container left port (detention start) |
| `empty_return_date` | `timestamptz` | ✅ NULL | `NULL` | Date empty container returned (detention end) |
| `last_free_day` | `date` | ✅ NULL | `NULL` | **DB-computed** via trigger (arrival_date + free_days) |
| `created_at` | `timestamptz` | ❌ NOT NULL | `now()` | Record creation timestamp |
| `updated_at` | `timestamptz` | ❌ NOT NULL | `now()` | Last update timestamp (auto-updated via trigger) |

#### Fee-Related Fields

| Field | Type | Nullable | Default | Purpose |
|-------|------|----------|---------|---------|
| `free_days` | `integer` | ❌ NOT NULL | `7` | Demurrage free days (days before charges start) |
| `detention_free_days` | `integer` | ❌ NOT NULL | `7` | Detention free days (days after gate-out before charges start) |
| `demurrage_fee_if_late` | `numeric` | ❌ NOT NULL | `300` | Flat demurrage rate (used if no tiers) |
| `detention_fee_rate` | `numeric` | ❌ NOT NULL | `250` | Flat detention rate (used if no tiers) |
| `demurrage_tiers` | `jsonb` | ✅ NULL | `'[]'` | Tiered demurrage rates (array of `{from_day, to_day, rate}`) |
| `detention_tiers` | `jsonb` | ✅ NULL | `'[]'` | Tiered detention rates (array of `{from_day, to_day, rate}`) |
| `has_detention` | `boolean` | ❌ NOT NULL | `false` | Whether detention tracking is enabled |
| `actual_fee_paid` | `numeric` | ❌ NOT NULL | `0` | Manual payment tracking |

#### Calendar/Rules Flags

❌ **NO WEEKEND OR CALENDAR FLAGS EXIST**

**Confirmed:**
- No `weekend_chargeable` field
- No `count_weekends` field
- No `calendar_type` field
- No `business_days_only` field

**Conclusion:** A new column must be added to store per-container weekend preference.

---

### Container Lifecycle

#### Creation

**File:** `lib/data/containers-actions.ts` → `insertContainer()` (lines 143-252)

**Process:**
1. Client calls `insertContainer(containerData, listId?)`
2. Server resolves `organization_id` and `list_id` (via `getServerAuthContext()`)
3. Normalizes input (empty strings → null, validates POD)
4. Resolves milestone from dates
5. Inserts into `containers` table
6. Database triggers fire:
   - `containers_set_lfd_bi` - Sets `last_free_day` (arrival_date + free_days)
   - `trg_set_organization_id` - Ensures organization_id (if not set)
   - `trg_set_updated_at` - Sets `updated_at`
7. Creates alerts for state changes (via `createAlertsForContainerChange()`)
8. Revalidates Next.js cache paths
9. Returns new container record

**Fields Written at Creation:**
- All user-entered fields (container_no, arrival_date, free_days, etc.)
- Auto-set: `organization_id`, `list_id`, `created_at`, `updated_at`
- Auto-computed: `last_free_day` (via trigger)

#### Updates

**File:** `lib/data/containers-actions.ts` → `updateContainer()` (lines 254-351)

**Process:**
1. Client calls `updateContainer(id, fields)`
2. Server validates ID format (UUID)
3. Fetches previous container state (for alert detection)
4. Normalizes and validates input
5. Updates container in database
6. Database triggers fire (same as creation)
7. Compares previous vs new state using `computeDerivedFields()`
8. Creates alerts for state transitions (Safe → Warning, !Overdue → Overdue, etc.)
9. Revalidates Next.js cache paths
10. Returns updated container record

#### Recalculation

**Status:** ✅ **COMPUTED ON-READ (LAZILY)**

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (lines 77-130)

**Process:**
1. Server fetches containers from database
2. For each container, calls `computeDerivedFields(container)` (line 126)
3. Merges computed fields with database fields
4. Returns containers with computed fields (`days_left`, `status`, `demurrage_fees`, `detention_fees`, etc.)

**Key Insight:** Derived fields are **never stored** in the database. They are computed fresh on every read, which means:
- Changing calculation logic affects all containers immediately
- No migration needed for existing containers (they'll use new logic on next read)
- Weekend flag can default to `true` for existing containers (backward compatible)

---

## 2. Add Container Form Behavior

### Form Structure

**File:** `components/forms/AddContainerForm.tsx`

#### Date Fields Captured

**Lines 644-681:**
- `arrival_date` (line 650) - Date input, required
- `free_days` (line 677) - Number input, default 7 (demurrage free days)

**Lines 837-980 (Detention section):**
- `gate_out_date` - Date input (only visible if detention enabled)
- `empty_return_date` - Date input (only visible if detention enabled)
- Note: `detention_free_days` is **not** captured in form (defaults to 7 in DB)

#### Fee Fields Captured

**Demurrage Section (lines 762-834):**
- `demurrage_enabled` (line 777) - Checkbox to enable/disable
- `demurrage_flat_rate` (line 797) - Number input (flat rate per day)
- `demurrage_tiers` (line 828) - Tier editor component

**Detention Section (lines 836-980):**
- `detention_enabled` (line 851) - Checkbox to enable/disable
- `detention_flat_rate` (line 876) - Number input (flat rate per day)
- `detention_tiers` (line 879) - Tier editor component

#### Form Data Interface

**File:** `components/forms/AddContainerForm.tsx` (lines 141-168)

```typescript
interface ContainerFormData {
  // Basic Information
  container_no: string
  bl_number: string
  pol: string
  pod: string
  arrival_date: string
  free_days: number
  carrier: string | null
  container_size: string | null
  assigned_to: string
  milestone: ContainerMilestone
  
  // Demurrage Tracking
  demurrage_enabled: boolean
  demurrage_flat_rate: number
  demurrage_tiers: Tier[]
  
  // Detention Tracking
  detention_enabled: boolean
  detention_flat_rate: number
  detention_tiers: Tier[]
  gate_out_date: string
  empty_return_date: string
  
  // Additional Notes
  notes: string
}
```

**Missing Field:** `weekend_chargeable` (or similar) - **NOT IN FORM DATA**

#### Logical Placement for Weekend Toggle

**Option 1: Demurrage Section (Recommended)**
- Place after "Free Days" input (line 681)
- Label: "Count weekends in demurrage calculations"
- Aligns with "Free Days" field (affects same calculation)

**Option 2: Detention Section**
- Place after "Enable detention tracking" checkbox (line 854)
- Label: "Count weekends in detention calculations"
- Matches current Settings UI text ("Include weekends in detention calculations")

**Option 3: Separate Section**
- Create new "Calendar Settings" section
- Includes weekend toggle for both demurrage and detention
- More flexible but adds UI complexity

**Recommendation:** **Option 1** (Demurrage section) + **Option 2** (Detention section) - Separate toggles for each calculation type, since they are independent.

---

### Container Creation Payload

**File:** `app/dashboard/containers/components/AddContainerTrigger.tsx` → `handleSave()` (lines 48-99)

**Payload Structure:**
```typescript
const containerData: ClientContainerInput = {
  container_no: data.container_no,
  bl_number: normalizeOptionalString(data.bl_number),
  pol: normalizeOptionalString(data.pol),
  pod: podValue,
  arrival_date: normalizeDate(data.arrival_date),
  free_days: data.free_days,
  carrier: data.carrier || null,
  container_size: data.container_size || null,
  milestone: resolveMilestone(data.milestone, {...}),
  notes: normalizeOptionalString(data.notes),
  assigned_to: normalizeOptionalString(data.assigned_to),
  gate_out_date: normalizeDate(data.gate_out_date),
  empty_return_date: normalizeDate(data.empty_return_date),
  demurrage_tiers: data.demurrage_enabled && data.demurrage_tiers?.length > 0 ? ... : null,
  detention_tiers: data.detention_enabled && data.detention_tiers?.length > 0 ? ... : null,
  has_detention: data.detention_enabled,
}
```

**Missing Fields:**
- ❌ `demurrage_fee_if_late` (flat rate) - **NOT INCLUDED**
- ❌ `detention_fee_rate` (flat rate) - **NOT INCLUDED**
- ❌ `detention_free_days` - **NOT INCLUDED**
- ❌ `weekend_chargeable` (future) - **NOT INCLUDED**

**Note:** Flat rates and detention_free_days are not currently persisted from the form. This may be intentional (use tiers only) or a bug.

---

## 3. Container Creation & Persistence

### Data Persistence

**File:** `lib/data/containers-actions.ts` → `insertContainer()` (lines 180-203)

**ContainerInsert Payload:**
```typescript
const containerToInsert: ContainerInsert = {
  container_no: container.container_no,
  arrival_date: container.arrival_date || new Date().toISOString(),
  organization_id: organizationId,
  pod: podValue,
  list_id: finalListId,
  pol: normalizeOptionalString(container.pol),
  free_days: container.free_days,
  bl_number: container.bl_number,
  carrier: container.carrier,
  container_size: container.container_size,
  milestone: resolvedMilestone,
  notes: container.notes,
  assigned_to: container.assigned_to,
  gate_out_date: container.gate_out_date,
  empty_return_date: container.empty_return_date,
  demurrage_tiers: container.demurrage_tiers,
  detention_tiers: container.detention_tiers,
  has_detention: container.has_detention,
}
```

**Missing from Insert:**
- `demurrage_fee_if_late` - Uses DB default (300)
- `detention_fee_rate` - Uses DB default (250)
- `detention_free_days` - Uses DB default (7)
- `weekend_chargeable` (future) - Will need DB default

---

### Derived Fields Calculation

**Status:** ✅ **COMPUTED LAZILY ON-READ**

**File:** `lib/data/containers-actions.ts` → `fetchContainers()` (line 126)

```typescript
const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

**Computed Fields (Never Stored):**
- `days_left` - Days until free time expires (negative = overdue)
- `status` - Safe / Warning / Overdue / Closed
- `demurrage_fees` - Calculated fee total (based on tiers or flat rate)
- `detention_fees` - Calculated fee total (based on tiers or flat rate)
- `lfd_date` - Last Free Day for detention (gate_out + detention_free_days)
- `detention_chargeable_days` - Days beyond detention free period
- `detention_status` - Safe / Warning / Overdue (for detention)

**Key Insight:** Since derived fields are computed on-read, adding weekend logic will immediately affect all containers on their next fetch (no migration needed for calculations).

---

### Calculation Trigger Points

**Server-Side (Primary):**
- `fetchContainers()` - Every container list fetch (lines 77-130)
- `createAlertsForContainerChange()` - On container update (compares old vs new state)
- `overdue-sweep.ts` - Background job calculations (multiple functions)
- `email-drafts-actions.ts` - Email generation (line 610)
- `dailyDigestFormatter.ts` - Daily digest emails (line 24)

**Client-Side:**
- ❌ **NONE** - All calculations are server-side

**Conclusion:** All date/fee calculations are server-side, computed lazily. No client-side calculation logic exists.

---

## 4. Date & Fee Calculation Logic

### Core Calculation Functions

**File:** `lib/utils/containers.ts`

#### 4.1 Free Time Expiry Calculation

**Function:** `computeDaysLeft()` (lines 152-158)

```typescript
export function computeDaysLeft(arrival?: string | null, freeDays = 7): number | null {
  const arrivalDate = parseDateFlexible(arrival)
  if (!arrivalDate) return null

  const now = new Date()
  const diff = (arrivalDate.getTime() + freeDays * 86400000) - now.getTime()
  return Math.ceil(diff / 86400000)
}
```

**Purpose:** Calculates days remaining until free time expires (negative = overdue)

**Input Parameters:**
- `arrival` - Arrival date string (ISO format or DD/MM/YYYY)
- `freeDays` - Number of free days (default: 7)

**Assumptions:**
- Uses calendar days (86400000 ms = 1 day)
- **No weekend filtering**
- Counts all days including Saturdays and Sundays

**Used By:**
- `computeContainerStatus()` - Determines Safe/Warning/Overdue status
- `computeDerivedFields()` - Calculates `days_left` for demurrage

---

#### 4.2 Demurrage Fee Calculation

**Function:** `computeDerivedFields()` - Demurrage section (lines 194-221)

```typescript
if (days_left !== null && days_left < 0) {
  const daysOverdue = Math.abs(days_left)
  demurrage_fees = calculateTieredFees(
    daysOverdue,
    demurrageTiers,
    demurrageRate
  )
}
```

**Input Parameters:**
- `daysOverdue` - Number of days past free time (from `computeDaysLeft()`)
- `demurrageTiers` - Tier array (from container.demurrage_tiers)
- `demurrageRate` - Flat rate (from container.demurrage_fee_if_late)

**Assumptions:**
- `daysOverdue` is calendar days (includes weekends)
- Tier calculation uses `calculateTieredFees()` from `lib/tierUtils.ts`
- **No weekend filtering**

---

#### 4.3 Detention Chargeable Days Calculation

**Function:** `computeDerivedFields()` - Detention section (lines 229-281)

```typescript
if (c.has_detention) {
  const gateOut = c.gate_out_date ? parseDateFlexible(c.gate_out_date) : null
  const emptyReturn = c.empty_return_date ? parseDateFlexible(c.empty_return_date) : null
  const detentionFreeDays = c.detention_free_days ?? 7

  if (gateOut) {
    const endDate = emptyReturn || new Date()
    const lfdDateObj = new Date(gateOut.getTime() + detentionFreeDays * DAY_IN_MS)
    const normalizedLfd = startOfDay(lfdDateObj)
    const normalizedEnd = startOfDay(endDate)
    const diffMs = normalizedEnd.getTime() - normalizedLfd.getTime()
    const diffDays = Math.floor(diffMs / DAY_IN_MS)
    detentionChargeableDays = diffDays > 0 ? diffDays : 0
  }
}
```

**Input Parameters:**
- `gate_out_date` - Date container left port
- `empty_return_date` - Date empty container returned (or `null` = today)
- `detention_free_days` - Free days after gate-out (default: 7)

**Assumptions:**
- Uses calendar days (`DAY_IN_MS = 86400000`)
- **No weekend filtering**
- Counts all days including Saturdays and Sundays

**Used By:**
- Detention fee calculation (via `calculateTieredFees()`)
- Detention status (Safe/Warning/Overdue)

---

#### 4.4 Detention Fee Calculation

**Function:** `computeDerivedFields()` - Detention section (lines 261-267)

```typescript
if (detentionChargeableDays && detentionChargeableDays > 0) {
  detention_fees = calculateTieredFees(
    detentionChargeableDays,
    detentionTiers,
    detentionRate
  )
}
```

**Input Parameters:**
- `detentionChargeableDays` - Days beyond detention free period (from above)
- `detentionTiers` - Tier array (from container.detention_tiers)
- `detentionRate` - Flat rate (from container.detention_fee_rate)

**Assumptions:**
- `detentionChargeableDays` is calendar days (includes weekends)
- **No weekend filtering**

---

### Logic Sharing vs Duplication

**Status:** ✅ **SHARED LOGIC** (No Duplication)

**Helper Functions:**
- `parseDateFlexible()` - Date parsing (lines 132-147)
- `startOfDay()` - Normalize to midnight (lines 123-127)
- `calculateTieredFees()` - Tier calculation (from `lib/tierUtils.ts`)
- `resolveTierArray()` - Tier normalization (lines 113-115)
- `resolveFeeRate()` - Rate normalization (lines 117-119)

**Calculation Functions:**
- `computeDaysLeft()` - Single function for demurrage days
- `computeDerivedFields()` - Single function for all derived fields
- Detention calculation embedded in `computeDerivedFields()` (no separate function)

**Conclusion:** Logic is well-structured with shared helpers. Weekend filtering can be added to:
1. `computeDaysLeft()` - For demurrage
2. `computeDerivedFields()` detention section - For detention

---

## 5. Settings Dependency Audit

### Current Settings Usage

**File:** `lib/data/settings-actions.ts`

**Settings Interface:**
```typescript
export interface Settings {
  demurrageDailyRate: number
  detentionDailyRate: number
  demFreeDays: number
  detFreeDays: number
  weekendChargeable: boolean  // ← TO BE REMOVED
  daysBeforeFreeTimeWarning?: number
}
```

### weekendChargeable Read/Write

#### Write Locations

**1. Settings UI**
- **File:** `app/dashboard/settings/page.tsx` (lines 377-381)
- **Action:** User toggles switch
- **Path:** `setSettings()` → `saveSettings()` → `profiles.settings.weekendChargeable`

**2. Server Action**
- **File:** `lib/data/settings-actions.ts` → `saveSettings()` (lines 45-60)
- **Action:** Persists to `profiles.settings` JSONB column

**3. Default Value**
- **File:** `lib/data/settings-actions.ts` → `loadSettings()` (line 25)
- **Default:** `weekendChargeable: true`

#### Read Locations

❌ **NEVER READ**

**Confirmed:**
- `lib/utils/containers.ts` - No reference
- `lib/data/alerts-logic.ts` - Only reads `daysBeforeFreeTimeWarning`
- `lib/data/containers-actions.ts` - No reference
- `lib/tierUtils.ts` - No reference
- Any calculation function - No reference

**Evidence:** `WEEKEND_CHARGING_DISCOVERY_REPORT.md` confirms setting is stored but never consumed.

---

### Implicit Weekend Logic

**Status:** ❌ **NONE**

**Search Results:**
- No `getDay()` calls
- No `isWeekend()` functions
- No Saturday/Sunday checks
- No business-day-only logic
- All calculations use simple millisecond-to-day conversions

**Conclusion:** No implicit weekend logic exists. All calculations currently count all days.

---

## 6. Existing Containers & Backward Compatibility

### Current Container Behavior

**All containers currently:**
- Count weekends in all calculations (no weekend filtering exists)
- Use calendar days for all date differences
- Have no `weekend_chargeable` field (doesn't exist in schema)

### Migration Requirements

#### Database Migration

**Required:** ✅ **YES** (Add new column)

**Migration Steps:**
1. Add `weekend_chargeable` column to `containers` table
2. Type: `boolean NOT NULL DEFAULT true`
3. Default to `true` for all existing rows (backward compatible - matches current behavior)

**SQL:**
```sql
ALTER TABLE containers
ADD COLUMN weekend_chargeable boolean NOT NULL DEFAULT true;
```

**Why Default to `true`:**
- Current behavior counts all days (including weekends)
- Defaulting to `true` preserves existing calculation results
- Users can opt-in to weekend exclusion per container

#### Data Migration

**Required:** ❌ **NO**

**Reason:**
- Derived fields are computed on-read (never stored)
- Existing containers will use new logic immediately after code change
- No historical data needs recalculation
- Default `weekend_chargeable = true` ensures backward compatibility

#### Code Changes Required

**Required:** ✅ **YES** (But no data migration)

**Functions to Modify:**
1. `computeDaysLeft()` - Add weekend filtering parameter
2. `computeDerivedFields()` detention section - Add weekend filtering for detention calculation
3. `ContainerRecord` interface - Add `weekend_chargeable` field
4. `ClientContainerInput` type - Add `weekend_chargeable` field
5. Add Container form - Add weekend toggle UI
6. Container creation/update - Persist `weekend_chargeable` value

---

### Backward Compatibility Strategy

**Strategy:** ✅ **SAFE DEFAULT (true)**

**Approach:**
1. Add `weekend_chargeable` column with `DEFAULT true`
2. Existing containers automatically get `true` (counts weekends - matches current behavior)
3. New containers default to `true` (user can change in form)
4. Calculation logic respects container's `weekend_chargeable` flag

**Benefits:**
- No breaking changes
- Existing containers continue to work identically
- Users can opt-in to weekend exclusion per container
- No data migration scripts needed

**Risks:**
- ❌ **NONE** - Default `true` preserves current behavior

---

## 7. Naming & UX Implications

### Best UI Placement

#### Option 1: Demurrage Section (Recommended)

**Location:** After "Free Days" input (line 681)  
**Label:** "Count weekends in demurrage calculations"  
**Type:** Checkbox (`weekend_chargeable_demurrage`)

**Pros:**
- Close to related field (free_days)
- Clear scope (demurrage only)
- Matches form structure (demurrage section)

**Cons:**
- If detention also needs weekend control, requires separate toggle

---

#### Option 2: Detention Section

**Location:** After "Enable detention tracking" checkbox (line 854)  
**Label:** "Count weekends in detention calculations"  
**Type:** Checkbox (`weekend_chargeable_detention`)

**Pros:**
- Matches current Settings UI text ("Include weekends in detention calculations")
- Clear scope (detention only)

**Cons:**
- If demurrage also needs weekend control, requires separate toggle

---

#### Option 3: Single Toggle (Recommended if Unified)

**Location:** After "Free Days" input (line 681) or in Basic Information section  
**Label:** "Count weekends in fee calculations"  
**Type:** Checkbox (`weekend_chargeable`)

**Pros:**
- Single setting controls both demurrage and detention
- Simpler UX (one toggle)
- Matches current Settings structure (single global toggle)

**Cons:**
- Less flexible (can't have different settings for demurrage vs detention)

---

#### Option 4: Separate Toggles (Most Flexible)

**Location:** 
- Demurrage section: After "Free Days" (`weekend_chargeable_demurrage`)
- Detention section: After "Enable detention tracking" (`weekend_chargeable_detention`)

**Pros:**
- Maximum flexibility (different settings per calculation type)
- Clear separation of concerns

**Cons:**
- More UI complexity (two toggles)
- Requires two database columns

---

### Existing Copy/Labels

**Current Settings UI Text:**
- **File:** `app/dashboard/settings/page.tsx` (lines 384, 388-389)
- Label: "Include weekends in detention calculations"
- Description: "When unchecked, weekends are excluded from detention free day calculations. This affects how detention fees are calculated for containers."

**Form Labels:**
- **File:** `components/forms/AddContainerForm.tsx`
- "Free Days" (line 671) - No mention of weekends
- "Enable demurrage tracking" (line 781) - No mention of weekends
- "Enable detention tracking" (line 854) - No mention of weekends

**Recommendation:** Use similar wording to Settings UI for consistency: "Count weekends in [demurrage/detention] calculations"

---

## 8. Summary & Recommendations

### Where to Store Per-Container Weekend Flag

**Recommended:** Single column `weekend_chargeable` (boolean)

**Rationale:**
- Matches current Settings structure (single global toggle)
- Simpler UX and schema
- Can be extended later if separate demurrage/detention control needed

**Alternative:** Two columns (`weekend_chargeable_demurrage`, `weekend_chargeable_detention`) if flexibility required

---

### Which Calculations Must Change

**Required Changes:**

1. **`computeDaysLeft()`** (`lib/utils/containers.ts:152-158`)
   - Add `weekendChargeable` parameter
   - Implement weekend filtering logic (skip Saturday/Sunday when `false`)
   - Used for demurrage `days_left` calculation

2. **`computeDerivedFields()` detention section** (`lib/utils/containers.ts:234-246`)
   - Read `weekendChargeable` from container record
   - Implement weekend filtering for `detentionChargeableDays` calculation
   - Used for detention fee calculation

**Optional Changes:**
- Create helper function `countBusinessDays(startDate, endDate, includeWeekends)` to avoid code duplication

---

### Whether Existing Containers Need Migration

**Database Migration:** ✅ **YES** (Add column)

**Data Migration:** ❌ **NO**

**Strategy:**
- Add `weekend_chargeable boolean NOT NULL DEFAULT true`
- Existing containers automatically get `true` (backward compatible)
- No data transformation needed (derived fields computed on-read)

---

### Exact Files & Functions to Modify

**Database:**
1. `supabase/migrations/` - New migration file to add `weekend_chargeable` column

**Type Definitions:**
2. `types/database.ts` - Add `weekend_chargeable` to `containers.Row`, `Insert`, `Update`
3. `lib/utils/containers.ts` - Add `weekend_chargeable` to `ContainerRecord` interface
4. `lib/data/containers-actions.ts` - Add `weekend_chargeable` to `ClientContainerInput` type

**Calculation Logic:**
5. `lib/utils/containers.ts` - Modify `computeDaysLeft()` to accept and use `weekendChargeable` parameter
6. `lib/utils/containers.ts` - Modify `computeDerivedFields()` detention section to read and use `weekendChargeable`

**Form UI:**
7. `components/forms/AddContainerForm.tsx` - Add `weekend_chargeable` to `ContainerFormData` interface
8. `components/forms/AddContainerForm.tsx` - Add weekend toggle UI (after "Free Days" or in detention section)
9. `components/forms/AddContainerForm.tsx` - Initialize `weekend_chargeable` in form state (default `true`)

**Container Creation/Update:**
10. `app/dashboard/containers/components/AddContainerTrigger.tsx` - Include `weekend_chargeable` in `containerData` payload
11. `lib/data/containers-actions.ts` - Include `weekend_chargeable` in `containerToInsert` payload

**Settings Removal (Future):**
12. `app/dashboard/settings/page.tsx` - Remove weekend charging section (lines 369-392)
13. `lib/data/settings-actions.ts` - Remove `weekendChargeable` from `Settings` interface

---

### Risks & Edge Cases

#### Low Risk

1. **Backward Compatibility**
   - ✅ **SAFE** - Default `true` preserves current behavior
   - Existing containers work identically

2. **Calculation Consistency**
   - ✅ **SAFE** - Derived fields computed on-read (no stored values to mismatch)
   - All containers use new logic immediately

3. **Form Defaults**
   - ✅ **SAFE** - Default `true` matches current behavior
   - Users can opt-in to weekend exclusion

#### Medium Risk

1. **Weekend Filtering Logic Complexity**
   - ⚠️ **REQUIRES CAREFUL TESTING**
   - Must correctly skip Saturday (6) and Sunday (0) when `weekendChargeable = false`
   - Edge cases: date ranges spanning multiple weekends, partial weekends

2. **Performance Impact**
   - ⚠️ **MINOR** - Weekend filtering adds date iteration (count business days)
   - May impact performance for containers with long date ranges
   - Mitigation: Optimize helper function (avoid iterating all days if possible)

3. **UI/UX Confusion**
   - ⚠️ **MINOR** - Users may not understand weekend exclusion
   - Mitigation: Clear label and tooltip explaining behavior

#### Edge Cases to Consider

1. **Date Ranges Spanning Weekends**
   - Example: Arrival Friday, free days = 3, weekendChargeable = false
   - Should count: Friday, Monday, Tuesday (skip Sat/Sun)
   - Must correctly handle day-of-week logic

2. **Partial Weekends**
   - Example: Start date = Saturday, end date = Sunday
   - If `weekendChargeable = false`, should count 0 days
   - Must handle boundary conditions correctly

3. **Timezone Issues**
   - Dates stored as `timestamptz` (UTC)
   - Weekend detection must use consistent timezone (likely UTC)
   - Ensure weekend filtering uses correct day-of-week calculation

4. **Negative Day Counts**
   - `computeDaysLeft()` can return negative values (overdue)
   - Weekend filtering for negative ranges must work correctly
   - May need separate logic for past vs future dates

---

## Conclusion

Moving weekend charging from global Settings to per-container is **architecturally feasible** with minimal risk:

✅ **No breaking changes** - Default `true` preserves current behavior  
✅ **No data migration** - Derived fields computed on-read  
✅ **Clean implementation** - Single column, clear UI placement  
✅ **Backward compatible** - Existing containers work identically  

**Recommended Approach:**
1. Add `weekend_chargeable boolean NOT NULL DEFAULT true` column
2. Add single toggle in Demurrage section (after "Free Days")
3. Modify `computeDaysLeft()` and detention calculation in `computeDerivedFields()`
4. Remove weekend charging from Settings page (future cleanup)

**Implementation Complexity:** **MEDIUM**
- Requires weekend filtering logic (business day counting)
- Multiple files to modify (schema, types, calculations, UI)
- Careful testing of edge cases (weekend boundaries, negative days)

