# Dual-Input LFD Discovery Report

## Executive Summary

This report analyzes the current state of `lfd_date` and `last_free_day` handling to prepare for implementing a dual-input model where users can enter either **Free Days** OR **Last Free Day (LFD)**, with the app deriving the other value.

**Key Finding:** There are **TWO separate LFD fields** with different purposes:
1. **`last_free_day`** (DB column) - Demurrage LFD, computed by database trigger (calendar days only)
2. **`lfd_date`** (computed field) - Can be demurrage OR detention LFD, computed in `computeDerivedFields` (weekend-aware)

---

## 1. Is lfd_date Currently Treated as Derived-Only, or Is It Ever an Authoritative Input?

### Answer: **DERIVED-ONLY** ✅

**Evidence:**

**A) `lfd_date` is NOT in database schema as a writable column**
- **File:** `types/database.ts:251`
- **Type:** `lfd_date: string | null` (in Row type)
- **Status:** Present in Row type but **NOT in Insert/Update types** (lines 285, 320)
- **Conclusion:** Database accepts `lfd_date` in reads but **does not accept it in writes**

**B) `lfd_date` is NOT written in insert/update operations**
- **File:** `lib/data/containers-actions.ts:180-203` (`insertContainer`)
  - `containerToInsert` does NOT include `lfd_date`
  - Only writes: `arrival_date`, `free_days`, `weekend_chargeable`, etc.
- **File:** `lib/data/containers-actions.ts:254-351` (`updateContainer`)
  - `safeFields` does NOT include `lfd_date`
  - Only updates user-provided fields

**C) `lfd_date` is computed on-read only**
- **File:** `lib/utils/containers.ts:404`
  - Computed in `computeDerivedFields()` return statement
  - Formula: `computedLfdDate ?? demurrageLfdDate ?? c.lfd_date ?? null`
  - Priority: Detention LFD → Demurrage LFD → DB value → null

**D) `lfd_date` is NOT in ClientContainerInput type**
- **File:** `lib/data/containers-actions.ts:29-47`
  - `ClientContainerInput` does NOT include `lfd_date`
  - Only includes: `arrival_date`, `free_days`, etc.

**Conclusion:** `lfd_date` is **100% derived-only**. It is never written to the database and is always computed from other fields on read.

---

## 2. Where Exactly Is lfd_date Calculated and/or Persisted Today?

### Calculation Locations

**A) Demurrage LFD Calculation**
- **File:** `lib/utils/containers.ts:287-302`
- **Function:** `computeDerivedFields()`
- **Code:**
  ```typescript
  let demurrageLfdDate: string | null = null
  if (c.arrival_date) {
    const arrivalDate = parseDateFlexible(c.arrival_date)
    if (arrivalDate) {
      const normalizedArrival = startOfDay(arrivalDate)
      const freeDays = c.free_days ?? 7
      const lfdDateObj = includeWeekends
        ? new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
        : addChargeableDays(normalizedArrival, freeDays, false)
      
      if (!Number.isNaN(lfdDateObj.getTime())) {
        demurrageLfdDate = startOfDay(lfdDateObj).toISOString()
      }
    }
  }
  ```
- **Weekend Logic:** ✅ Applied (uses `includeWeekends` flag from `c.weekend_chargeable`)
- **Trigger:** Called on every `fetchContainers()` (line 126)

**B) Detention LFD Calculation**
- **File:** `lib/utils/containers.ts:335-342`
- **Function:** `computeDerivedFields()` (detention section)
- **Code:**
  ```typescript
  let computedLfdDate: string | null = null
  if (c.has_detention) {
    const gateOut = c.gate_out_date ? parseDateFlexible(c.gate_out_date) : null
    const detentionFreeDays = c.detention_free_days ?? 7
    
    if (gateOut) {
      const lfdDateObj = includeWeekends
        ? new Date(normalizedGateOut.getTime() + detentionFreeDays * DAY_IN_MS)
        : addChargeableDays(normalizedGateOut, detentionFreeDays, false)
      
      if (!Number.isNaN(lfdDateObj.getTime())) {
        computedLfdDate = normalizedLfd.toISOString()
      }
    }
  }
  ```
- **Weekend Logic:** ✅ Applied (uses `includeWeekends` flag)
- **Trigger:** Called on every `fetchContainers()` (line 126)

**C) Final lfd_date Assignment**
- **File:** `lib/utils/containers.ts:404`
- **Code:**
  ```typescript
  lfd_date: computedLfdDate ?? demurrageLfdDate ?? c.lfd_date ?? null
  ```
- **Priority:** Detention LFD → Demurrage LFD → DB value → null
- **Note:** `c.lfd_date` fallback is from database read, but it's never written by app code

### Persistence Status

**❌ NOT PERSISTED**
- `lfd_date` is **never written** to the database
- It exists only as a computed field in `ContainerRecordWithComputed` type
- Database may have `lfd_date` column (from schema), but app code never writes to it

### Database Trigger: `last_free_day`

**Separate Field:** `last_free_day` (NOT `lfd_date`)
- **File:** `supabase/migrations/schema_backup_2_after_status_fix.sql:182-194`
- **Function:** `containers_set_lfd()`
- **Code:**
  ```sql
  CREATE OR REPLACE FUNCTION public.containers_set_lfd()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF NEW.arrival_date IS NOT NULL AND NEW.free_days IS NOT NULL THEN
      -- LFD = arrival_date + free_days  (free days start the day *after* arrival)
      NEW.last_free_day := (NEW.arrival_date AT TIME ZONE 'UTC')::date + NEW.free_days;
    END IF;
    RETURN NEW;
  END;
  $$;
  ```
- **Purpose:** Sets `last_free_day` (demurrage LFD) on INSERT/UPDATE
- **Weekend Logic:** ❌ **NOT APPLIED** (simple calendar day addition)
- **Trigger:** Fires automatically on INSERT/UPDATE when `arrival_date` or `free_days` change

**Key Distinction:**
- `last_free_day` = DB column, computed by trigger (calendar days only)
- `lfd_date` = Computed field, computed in TypeScript (weekend-aware)

---

## 3. During Container Updates or Recomputation, Which Fields Are Recalculated vs Trusted?

### Fields That Are Recalculated (Never Trusted from DB)

**A) All Derived Fields in `computeDerivedFields()`**
- **File:** `lib/utils/containers.ts:275-408`
- **Called:** Every `fetchContainers()` (line 126)
- **Fields Recalculated:**
  - `days_left` - Always computed from `arrival_date` + `free_days` + `weekend_chargeable`
  - `status` - Always computed from `days_left` + `is_closed`
  - `demurrage_fees` - Always computed from `days_left` + tiers/flat rate
  - `detention_fees` - Always computed from detention chargeable days + tiers/flat rate
  - `lfd_date` - Always computed (detention or demurrage)
  - `detention_chargeable_days` - Always computed
  - `detention_status` - Always computed

**B) Database Trigger Recalculations**
- **Trigger:** `containers_set_lfd()` (BEFORE INSERT/UPDATE)
- **Field Recalculated:** `last_free_day`
- **Trigger:** `trg_set_updated_at` (BEFORE UPDATE)
- **Field Recalculated:** `updated_at`

### Fields That Are Trusted (Not Recalculated)

**A) User-Entered Fields (Trusted on Update)**
- `arrival_date` - Trusted (user input)
- `free_days` - Trusted (user input)
- `gate_out_date` - Trusted (user input)
- `empty_return_date` - Trusted (user input)
- `weekend_chargeable` - Trusted (user input)
- `demurrage_tiers` - Trusted (user input)
- `detention_tiers` - Trusted (user input)
- All other user-editable fields

**B) Server-Managed Fields (Trusted)**
- `organization_id` - Set by server, never recalculated
- `list_id` - Set by server, never recalculated
- `created_at` - Set by database, never recalculated
- `id` - Set by database, never recalculated

### Update Flow

**File:** `lib/data/containers-actions.ts:254-351` (`updateContainer`)

1. **User provides fields** → `ContainerUpdateInput`
2. **Server normalizes** → Empty strings → null, validates UUID
3. **Database UPDATE** → Writes trusted fields directly
4. **Database trigger fires** → Recalculates `last_free_day` (calendar days only)
5. **App reads updated row** → `.select().single()`
6. **App recomputes derived fields** → `computeDerivedFields()` is NOT called here (only on fetch)
7. **Alerts created** → Uses `computeDerivedFields()` to compare old vs new state

**Key Insight:** After update, derived fields are NOT immediately recomputed. They are recomputed on the next `fetchContainers()` call.

---

## 4. If lfd_date Is Present in the DB, Is It Ever Overwritten Automatically?

### Answer: **NO** (App Code Never Writes It)

**Evidence:**

**A) Insert Operation**
- **File:** `lib/data/containers-actions.ts:180-203`
- **Payload:** `containerToInsert` does NOT include `lfd_date`
- **Result:** Database receives no `lfd_date` value → remains NULL or default

**B) Update Operation**
- **File:** `lib/data/containers-actions.ts:292-295`
- **Payload:** `safeFields` filters out undefined values, but `lfd_date` is never in the input
- **Result:** Database UPDATE does NOT include `lfd_date` → existing value preserved (if any)

**C) Database Trigger**
- **Trigger:** `containers_set_lfd()` only sets `last_free_day` (NOT `lfd_date`)
- **Result:** `lfd_date` is never touched by database triggers

**Conclusion:** `lfd_date` in the database (if present) is **never overwritten** by app code or triggers. It remains as-is until manually changed (which never happens in current code).

---

## 5. Identify the Single Best Place to Enforce Weekend Logic So It Is Not Applied Twice

### Current Weekend Logic Application Points

**A) Demurrage LFD Calculation**
- **File:** `lib/utils/containers.ts:287-302`
- **Location:** Inside `computeDerivedFields()`
- **Logic:**
  ```typescript
  const lfdDateObj = includeWeekends
    ? new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
    : addChargeableDays(normalizedArrival, freeDays, false)
  ```
- **Weekend Flag:** `c.weekend_chargeable`

**B) Detention LFD Calculation**
- **File:** `lib/utils/containers.ts:344-350`
- **Location:** Inside `computeDerivedFields()`
- **Logic:**
  ```typescript
  const lfdDateObj = includeWeekends
    ? new Date(normalizedGateOut.getTime() + detentionFreeDays * DAY_IN_MS)
    : addChargeableDays(normalizedGateOut, detentionFreeDays, false)
  ```
- **Weekend Flag:** `c.weekend_chargeable`

**C) Days Left Calculation**
- **File:** `lib/utils/containers.ts:224-250` (`computeDaysLeft`)
- **Location:** Called by `computeDerivedFields()` (line 280)
- **Logic:**
  ```typescript
  if (includeWeekends) {
    const expiryDate = new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)
    return Math.ceil(diff / DAY_IN_MS)
  } else {
    const expiryDate = addChargeableDays(normalizedArrival, freeDays, false)
    const daysLeft = countChargeableDaysBetween(nowNormalized, expiryDate, false)
    // ...
  }
  ```
- **Weekend Flag:** Passed as parameter `includeWeekends`

**D) Database Trigger (NO Weekend Logic)**
- **File:** `supabase/migrations/schema_backup_2_after_status_fix.sql:182-194`
- **Function:** `containers_set_lfd()`
- **Logic:** Simple calendar day addition (NO weekend logic)
- **Field:** `last_free_day` (NOT `lfd_date`)

### Single Best Place: **Pre-Save Derivation Layer**

**Recommended Location:** `lib/data/containers-actions.ts` (in `insertContainer` and `updateContainer`)

**Why:**
1. **Single Source of Truth:** All derivation happens in one place before DB write
2. **No Double Application:** Weekend logic applied once, result stored in DB
3. **Database Trigger Compatibility:** Can disable/update trigger to avoid conflicts
4. **Clear Separation:** Input normalization → Derivation → DB write

**Implementation Pattern:**
```typescript
// In insertContainer/updateContainer, before DB write:
if (input.lfd_date && !input.free_days) {
  // User provided LFD, derive free_days
  const derivedFreeDays = calculateFreeDaysFromLFD(
    input.arrival_date,
    input.lfd_date,
    input.weekend_chargeable ?? true
  )
  containerToInsert.free_days = derivedFreeDays
} else if (input.free_days && !input.lfd_date) {
  // User provided free_days, derive LFD (current behavior)
  // No change needed - DB trigger or app code can compute
} else if (input.lfd_date && input.free_days) {
  // Both provided - validate consistency or prioritize one
  // Recommend: prioritize LFD, derive free_days
}
```

**Alternative (If Keeping Current Architecture):**
- Keep weekend logic in `computeDerivedFields()` (current location)
- Add pre-save derivation in `insertContainer`/`updateContainer` for LFD → free_days
- Ensure database trigger does NOT overwrite derived values

**Risk:** If database trigger `containers_set_lfd()` runs AFTER app derivation, it will overwrite `last_free_day` with calendar-day calculation (ignoring weekend logic).

**Solution:** Either:
1. Disable/modify trigger to respect weekend logic
2. Or: Don't write `last_free_day` from app, let trigger handle it (but trigger has no weekend logic)
3. Or: Write `last_free_day` AFTER trigger runs (requires two writes or trigger modification)

---

## 6. Confirm Whether Allowing LFD as Input Would Require Changing DB Writes or Only Changing Form + Pre-Save Derivation

### Answer: **REQUIRES DB WRITES** ⚠️

**Why:**

**A) Current State:**
- `lfd_date` is NOT in `ClientContainerInput` type
- `lfd_date` is NOT written to database
- `free_days` IS written to database
- Database trigger computes `last_free_day` from `arrival_date` + `free_days`

**B) If User Provides LFD Instead of Free Days:**
- Need to derive `free_days` from `lfd_date` + `arrival_date` + `weekend_chargeable`
- Must write derived `free_days` to database
- Database trigger will then compute `last_free_day` (but with wrong logic if weekend-aware)

**C) Required Changes:**

**1. Form Changes (UI Only)**
- **File:** `components/forms/AddContainerForm.tsx`
- **Changes:**
  - Add LFD input field (date picker)
  - Add toggle/radio: "Enter Free Days" vs "Enter LFD"
  - Update form state to track which field is authoritative
  - Update `ContainerFormData` type to include `lfd_date?: string | null`

**2. Pre-Save Derivation (Server Action)**
- **File:** `lib/data/containers-actions.ts`
- **Changes:**
  - Update `ClientContainerInput` type to include `lfd_date?: string | null`
  - Add derivation logic in `insertContainer()`:
    - If `lfd_date` provided → derive `free_days`
    - If `free_days` provided → keep current behavior (or derive `lfd_date` for consistency)
  - Add derivation logic in `updateContainer()`:
    - Same logic as insert

**3. Database Write Changes**
- **File:** `lib/data/containers-actions.ts:180-203` (`insertContainer`)
- **Changes:**
  - Write derived `free_days` to database (already happens)
  - **Optionally:** Write `lfd_date` to database (currently not written)
  - **Optionally:** Write `last_free_day` to database (currently computed by trigger)

**4. Database Trigger Considerations**
- **File:** `supabase/migrations/schema_backup_2_after_status_fix.sql:182-194`
- **Current Behavior:** Trigger overwrites `last_free_day` on INSERT/UPDATE
- **Risk:** If app derives `free_days` from LFD, trigger will recompute `last_free_day` using calendar days (ignoring weekend logic)
- **Options:**
  - **A)** Disable trigger for `last_free_day` (let app compute it)
  - **B)** Modify trigger to respect `weekend_chargeable` (requires SQL changes)
  - **C)** Write `last_free_day` AFTER trigger runs (requires two writes or trigger modification)
  - **D)** Don't use `last_free_day` at all (use `lfd_date` only)

**5. Type Changes**
- **File:** `lib/data/containers-actions.ts:29-47`
- **Changes:**
  - Add `lfd_date?: string | null` to `ClientContainerInput`
  - Add `last_free_day?: string | null` if writing it directly

### Minimal Change Approach (Recommended)

**Option 1: Form + Pre-Save Only (No DB Schema Changes)**
- ✅ Add LFD input to form
- ✅ Derive `free_days` from LFD in `insertContainer`/`updateContainer`
- ✅ Write derived `free_days` to database (existing field)
- ⚠️ Database trigger will recompute `last_free_day` (calendar days only)
- ⚠️ `lfd_date` remains computed-only (not persisted)
- **Risk:** `last_free_day` in DB will be wrong if weekend logic was used

**Option 2: Full Persistence (DB Schema Changes)**
- ✅ Add LFD input to form
- ✅ Derive `free_days` from LFD in `insertContainer`/`updateContainer`
- ✅ Write derived `free_days` to database
- ✅ Write `lfd_date` to database (new write path)
- ✅ Write `last_free_day` to database (override trigger)
- ✅ Modify/disable trigger to avoid conflicts
- **Risk:** More complex, requires migration

**Recommendation:** **Option 1** (minimal) for initial implementation, with clear documentation that `last_free_day` in DB may not match computed `lfd_date` when weekend logic is applied.

---

## Summary of Risks

### High Risk

1. **Database Trigger Conflict**
   - Trigger `containers_set_lfd()` overwrites `last_free_day` with calendar-day calculation
   - If app derives `free_days` from LFD (weekend-aware), trigger will recompute `last_free_day` incorrectly
   - **Mitigation:** Disable trigger or modify it to respect `weekend_chargeable`

2. **Double Weekend Logic Application**
   - If weekend logic is applied in both pre-save derivation AND `computeDerivedFields()`, results will be wrong
   - **Mitigation:** Apply weekend logic only in pre-save derivation, or only in `computeDerivedFields()`

### Medium Risk

3. **Inconsistent LFD Values**
   - `last_free_day` (DB, calendar days) vs `lfd_date` (computed, weekend-aware) may differ
   - **Mitigation:** Use only one field, or clearly document the difference

4. **Backward Compatibility**
   - Existing containers have `free_days` but no `lfd_date` input
   - **Mitigation:** Default to "Free Days" mode for existing containers

### Low Risk

5. **Form State Management**
   - Toggle between "Free Days" and "LFD" input modes
   - **Mitigation:** Clear UI indicators and validation

---

## Recommended Implementation Strategy

1. **Phase 1: Form + Pre-Save Derivation (No DB Changes)**
   - Add LFD input to form
   - Derive `free_days` from LFD in server actions
   - Write `free_days` to database (existing field)
   - Keep `lfd_date` as computed-only
   - Document that `last_free_day` may not match computed `lfd_date`

2. **Phase 2: Database Trigger Fix (If Needed)**
   - Modify trigger to respect `weekend_chargeable`
   - Or disable trigger and write `last_free_day` from app code

3. **Phase 3: Persistence (Optional)**
   - Write `lfd_date` to database for performance
   - Or remove `last_free_day` trigger and use `lfd_date` only

