# Demurrage "Days Left", LFD, and Weekend Logic – Enterprise Review

**Date:** 2024  
**Scope:** Semantic clarity, UX correctness, enterprise expectations  
**Objective:** Understanding alignment only (no fixes proposed)

---

## 1️⃣ Canonical Definitions (Source of Truth)

### Business Terms (Not Implementation)

**free_days**
- **Business Definition:** Number of free storage days granted before demurrage charges begin
- **Operational Meaning:** The grace period (in chargeable days) between container arrival and when charges start accruing
- **Units:** Chargeable days (not calendar days when `weekend_chargeable = false`)
- **Authority:** User-entered value, stored in database

**lfd_date (Last Free Day)**
- **Business Definition:** The last calendar date on which the container can remain without incurring demurrage charges
- **Operational Meaning:** The absolute deadline date (calendar day) when free time expires
- **Units:** Calendar date (ISO string)
- **Authority:** Computed from `arrival_date + free_days` (respecting weekend logic), displayed but not stored

**days_left**
- **Business Definition:** Number of chargeable days remaining before demurrage charges begin
- **Operational Meaning:** Remaining chargeable exposure (business days or calendar days, depending on `weekend_chargeable`)
- **Units:** Chargeable days (not calendar days when `weekend_chargeable = false`)
- **Authority:** Computed field, derived on every fetch

**weekend_chargeable**
- **Business Definition:** Whether Saturdays and Sundays count toward free time consumption
- **Operational Meaning:** 
  - `true`: Weekends reduce free time (calendar days)
  - `false`: Weekends are excluded from free time (business days only)
- **Authority:** Per-container user setting, stored in database

### Critical Clarification: What is `days_left` Meant to Represent?

**Answer:** `days_left` represents **chargeable exposure remaining** (chargeable days until demurrage starts), NOT calendar days until demurrage starts.

**Evidence:**
- Implementation: `computeDaysLeft()` uses `countChargeableDaysBetween()` when `includeWeekends = false`
- When `weekend_chargeable = false`: Only business days are counted (Sat/Sun excluded)
- When `weekend_chargeable = true`: All calendar days are counted (Sat/Sun included)

**Business Logic:**
- If a container has 5 chargeable days left and it's Friday:
  - `weekend_chargeable = false`: Days left = 5 (Friday + Mon-Thu = 5 business days)
  - `weekend_chargeable = true`: Days left = 5 (Fri-Sat-Sun-Mon-Tue = 5 calendar days)

**Key Distinction:**
- `days_left` = Chargeable days remaining (operational metric)
- Calendar days until LFD = Different number when weekends excluded (not shown, but can be derived from LFD date)

---

## 2️⃣ Calculation Paths (Trace, Don't Assume)

### How `days_left` is Derived End-to-End

**Step 1: Database Fetch**
- **File:** `lib/data/containers-actions.ts:84-132` (`fetchContainers()`)
- **Action:** `.select('*')` from `containers` table
- **Returns:** Raw database rows (includes `arrival_date`, `free_days`, `weekend_chargeable`)

**Step 2: Derived Field Computation**
- **File:** `lib/data/containers-actions.ts:125-126`
- **Function:** `computeDerivedFields(c)` called for each container
- **Input:** `ContainerRow` (database type) with `arrival_date`, `free_days`, `weekend_chargeable`

**Step 3: Days Left Calculation**
- **File:** `lib/utils/containers.ts:332-337` (`computeDerivedFields()`)
- **Code:** `const days_left = computeDaysLeft(c.arrival_date, c.free_days ?? 7, includeWeekends)`
- **Where:** `includeWeekends = c.weekend_chargeable` (line 336, no fallback)

**Step 4: Core Logic**
- **File:** `lib/utils/containers.ts:281-307` (`computeDaysLeft()`)
- **Inputs Used:**
  - `arrival`: Container arrival date (from DB)
  - `freeDays`: Number of free days (from DB, default 7)
  - `includeWeekends`: Boolean flag (from DB `weekend_chargeable`)

**Step 5: Weekend-Aware Calculation**
- **When `includeWeekends = true`:**
  - **Line 291:** `const expiryDate = new Date(normalizedArrival.getTime() + freeDays * DAY_IN_MS)`
  - **Line 293:** `return Math.ceil(diff / DAY_IN_MS)` (calendar days)
- **When `includeWeekends = false`:**
  - **Line 296:** `const expiryDate = addChargeableDays(normalizedArrival, freeDays, false)` (business days)
  - **Line 297:** `const daysLeft = countChargeableDaysBetween(nowNormalized, expiryDate, false)` (business days)
  - **Lines 300-303:** If expired, count overdue days using `countChargeableDaysBetween()`

**Step 6: Helper Functions**
- **File:** `lib/utils/containers.ts:150-196`
- **`addChargeableDays()`:** Adds chargeable days (skips weekends if `includeWeekends = false`)
- **`countChargeableDaysBetween()`:** Counts chargeable days between two dates (skips weekends if `includeWeekends = false`)

**Step 7: Display**
- **File:** `app/dashboard/containers/components/ContainerTable.tsx:391-402`
- **Code:** `{container.days_left ?? '—'}`
- **Display:** Rendered as number or '—' if null

### Dependencies Summary

**`days_left` depends on:**
- ✅ `arrival_date` (from DB)
- ✅ `free_days` (from DB)
- ✅ `today's date` (implicit: `new Date()` in `computeDaysLeft()`)
- ✅ `weekend_chargeable` (from DB, used as `includeWeekends`)
- ❌ Does NOT depend on `lfd_date` (LFD is computed separately)

**Precise Functions and Responsibilities:**
1. **`fetchContainers()`** - Fetches raw DB rows
2. **`computeDerivedFields()`** - Orchestrates all derived field computation
3. **`computeDaysLeft()`** - Computes days left using weekend-aware logic
4. **`addChargeableDays()`** - Adds chargeable days (weekend-aware)
5. **`countChargeableDaysBetween()`** - Counts chargeable days between dates (weekend-aware)

---

## 3️⃣ Weekend Behavior Validation

### Concrete Examples

**Scenario:** Container arrives Friday, Jan 5, 2024. Free days = 7. Today = Friday, Jan 5, 2024.

**Case A: `weekend_chargeable = true` (Weekends Count)**
- **LFD Calculation:** Friday + 7 calendar days = Friday, Jan 12, 2024
- **Days Left (Friday, Jan 5):** 7 chargeable days (Fri-Sat-Sun-Mon-Tue-Wed-Thu)
- **Days Left (Saturday, Jan 6):** 6 chargeable days (Sat-Sun-Mon-Tue-Wed-Thu)
- **Days Left (Sunday, Jan 7):** 5 chargeable days (Sun-Mon-Tue-Wed-Thu)
- **Days Left (Monday, Jan 8):** 4 chargeable days (Mon-Tue-Wed-Thu)
- **Behavior:** Days left decrements daily (including weekends)

**Case B: `weekend_chargeable = false` (Weekends Excluded)**
- **LFD Calculation:** Friday + 7 business days = Tuesday, Jan 16, 2024 (skips Sat/Sun)
- **Days Left (Friday, Jan 5):** 7 chargeable days (Fri + Mon-Thu + Mon-Thu = 7 business days)
- **Days Left (Saturday, Jan 6):** 7 chargeable days (same - Sat doesn't count)
- **Days Left (Sunday, Jan 7):** 7 chargeable days (same - Sun doesn't count)
- **Days Left (Monday, Jan 8):** 6 chargeable days (Mon-Thu + Mon-Thu = 6 business days)
- **Behavior:** Days left remains constant over weekends, then decrements on weekdays

### Answers to Specific Questions

**Q: When `weekend_chargeable = false`, should `days_left` remain constant over weekends?**
- **Answer: YES** ✅
- **Evidence:** `computeDaysLeft()` uses `countChargeableDaysBetween(now, expiry, false)` which excludes weekends
- **Current Behavior:** ✅ YES, it remains constant over weekends

**Q: When `weekend_chargeable = false`, should LFD move further into the future?**
- **Answer: YES** ✅
- **Evidence:** `addChargeableDays(normalizedArrival, freeDays, false)` skips weekends when adding days
- **Current Behavior:** ✅ YES, LFD is further in the future (e.g., Friday + 7 business days = Tuesday, not next Friday)

**Q: Are both of these currently happening?**
- **Answer: YES** ✅
- **Evidence:**
  - `days_left` uses `countChargeableDaysBetween()` which excludes weekends (remains constant)
  - `lfd_date` uses `addChargeableDays()` which skips weekends (moves further)

**Q: If not, which one is authoritative?**
- **Answer: N/A** (both are happening correctly)

### Consistency Check

**Mathematical Consistency:**
- ✅ `days_left` counts chargeable days from today to LFD
- ✅ `lfd_date` is computed by adding chargeable days to arrival
- ✅ When `weekend_chargeable = false`, both use business-day logic
- ✅ When `weekend_chargeable = true`, both use calendar-day logic

**Example Verification:**
- Arrival: Friday, Jan 5
- Free days: 7
- `weekend_chargeable = false`
- LFD: Tuesday, Jan 16 (7 business days from Friday)
- Today: Friday, Jan 5
- Days left: 7 (countChargeableDaysBetween(Fri, Tue+1) = 7 business days: Fri, Mon, Tue, Wed, Thu, Fri, Mon)
- ✅ Mathematically consistent

---

## 4️⃣ UX Consistency Check (Enterprise Lens)

### Freight Forwarder Expectations

**Question: Is it expected that `days_left` does NOT decrement daily when weekends are excluded?**
- **Answer: YES, this is expected** ✅
- **Reasoning:** When weekends don't count toward free time, chargeable exposure doesn't decrease on weekends
- **Business Logic:** Free time is "paused" on weekends, so remaining chargeable days remain constant
- **Current Behavior:** ✅ Matches expectation (days_left remains constant over weekends)

**Question: Would the current table be interpreted as a countdown or a remaining chargeable balance?**
- **Answer: Remaining chargeable balance** ✅
- **Evidence:**
  - Column name: "Days Left" (operational metric, not countdown)
  - Behavior: Remains constant over weekends when `weekend_chargeable = false` (countdown would decrement)
  - Purpose: Shows operational exposure (how many chargeable days remain before charges start)

**Semantic Analysis:**

**Column Names:**
- **"Days Left"** - Operationally correct (chargeable days remaining)
- **"LFD" (Last Free Day)** - Correctly shows deadline date
- **"Free Days"** - Correctly shows grace period length

**Values Shown:**
- **`days_left`** - Chargeable days remaining (correct)
- **`lfd_date`** - Calendar deadline date (correct)
- **`free_days`** - Grace period length (correct)

**Operational Expectations:**
- ✅ Freight forwarders expect to see remaining chargeable exposure
- ✅ They expect LFD to show the absolute deadline
- ✅ They expect weekends to be excluded when `weekend_chargeable = false`

**Potential Semantic Mismatch:**

**⚠️ Minor UX Clarity Issue:**
- **Column Label:** "Days Left" could be interpreted as "calendar days until deadline" by some users
- **Actual Behavior:** "Chargeable days remaining" (business days when weekends excluded)
- **Impact:** Low (values are correct, but label might need clarification)
- **Example:** User sees "Days Left: 5" on Friday, expects it to be "3" on Monday (if countdown), but it's actually "4" (chargeable days remaining)

**Recommendation (for future):** Consider renaming to "Chargeable Days Left" or "Business Days Left" when weekends excluded, but this is UX polish, not a correctness issue.

---

## 5️⃣ Redundancy & Ambiguity Audit

### Multiple Fields Conveying Overlapping Meaning

**Analysis:**

**Fields Related to Free Time:**
1. **`free_days`** - Grace period length (input)
2. **`lfd_date`** - Deadline date (computed)
3. **`days_left`** - Remaining chargeable days (computed)
4. **`last_free_day`** - Legacy DB column (computed by trigger, unused by app)

**Overlap Assessment:**

**`free_days` vs `lfd_date`:**
- ✅ **Not redundant** - Different semantics
  - `free_days` = Duration (7 days)
  - `lfd_date` = Absolute deadline (Jan 16, 2024)
- ✅ **Mathematically related** - LFD = arrival + free_days (weekend-aware)

**`lfd_date` vs `days_left`:**
- ✅ **Not redundant** - Different semantics
  - `lfd_date` = Absolute deadline (calendar date)
  - `days_left` = Relative exposure (chargeable days)
- ✅ **Mathematically related** - days_left = chargeable days from today to LFD

**`last_free_day` (DB column) vs `lfd_date` (computed):**
- ⚠️ **Redundant but unused** - `last_free_day` exists in DB but is not used by app code
- **Issue:** DB trigger computes `last_free_day` using calendar days only (no weekend logic)
- **Impact:** None (app code uses computed `lfd_date`, not DB `last_free_day`)
- **Status:** Legacy field, safe to ignore

### Technically Correct but Semantically Misleading

**Answer: NO** ✅

**All fields are semantically clear:**
- `free_days` = Clear (grace period length)
- `lfd_date` = Clear (deadline date)
- `days_left` = Clear (remaining chargeable days)
- `weekend_chargeable` = Clear (weekend inclusion flag)

**Potential Confusion (Not Misleading):**
- "Days Left" label might be interpreted as "calendar days until deadline" by some users
- **But:** The values are correct (chargeable days), so this is a UX clarity issue, not semantic misleading

### Same Number, Different Meaning

**Answer: NO** ✅

**No ambiguity found:**
- `days_left` always means "chargeable days remaining"
- `free_days` always means "grace period length"
- `lfd_date` always means "deadline date"
- Each field has a single, consistent meaning across the system

**Edge Case Analysis:**
- When `weekend_chargeable = false` and today is a weekend:
  - `days_left` = Chargeable days remaining (constant over weekend)
  - Calendar days until LFD = Different number (includes weekend)
  - **But:** These are different metrics (chargeable vs calendar), not the same number with different meanings

---

## 6️⃣ Single-Source-of-Truth Confirmation

### LFD as the Only True Deadline

**Answer: YES** ✅

**Confirmation:**
- ✅ `lfd_date` is the single authoritative deadline for demurrage free time
- ✅ Computed from `arrival_date + free_days` (weekend-aware)
- ✅ Used for display and operational decision-making
- ✅ No other deadline fields are used by the application

**Database Field `last_free_day`:**
- ❌ Not used by application code
- ❌ Computed by DB trigger (calendar days only, no weekend logic)
- ✅ Safe to ignore (legacy field)

### Days Left as Derived Operational Metric

**Answer: YES** ✅

**Confirmation:**
- ✅ `days_left` is computed, never stored
- ✅ Derived from: `arrival_date`, `free_days`, `today`, `weekend_chargeable`
- ✅ Recalculated on every fetch
- ✅ Operational metric (remaining chargeable exposure)

### No Hidden Deadlines

**Answer: YES** ✅

**Confirmation:**
- ✅ Only one deadline: `lfd_date` (demurrage)
- ✅ Detention has separate deadline (computed from `gate_out_date + detention_free_days`)
- ✅ No hidden or implicit deadlines found
- ✅ All deadlines are explicitly computed and displayed

---

## 7️⃣ Final Diagnosis

### Statement Selection

**"The system is correct and only labeling/UX clarification is needed"** ✅

### Explanation

**Why This Statement:**

**Logic is Correct:**
- ✅ `days_left` correctly represents chargeable days remaining
- ✅ Weekend logic is applied consistently (LFD and days_left both use weekend-aware calculations)
- ✅ Mathematical consistency: days_left = chargeable days from today to LFD
- ✅ No semantic mismatches in calculation logic

**UX Clarity (Minor Issue):**
- ⚠️ Column label "Days Left" might be interpreted as "calendar days until deadline" by some users
- ⚠️ Actual behavior: "chargeable days remaining" (business days when weekends excluded)
- ✅ Values are correct, but label could be more explicit

**No Logic Changes Needed:**
- ✅ Weekend behavior is correct (days_left remains constant over weekends when `weekend_chargeable = false`)
- ✅ LFD calculation is correct (moves further when weekends excluded)
- ✅ Both metrics are mathematically consistent

**No Semantic Mismatches:**
- ✅ All fields have clear, single meanings
- ✅ No conflicting calculations
- ✅ No redundant authoritative sources

**Recommendation:**
- Consider UX polish: Rename "Days Left" to "Chargeable Days Left" or add helper text explaining the metric
- But: This is labeling/UX clarification only, not a correctness issue

---

## Summary

**System Status:** ✅ **CORRECT** (logic is sound, only UX clarification needed)

**Key Findings:**
1. ✅ All calculations are mathematically correct and consistent
2. ✅ Weekend behavior matches business logic (days_left remains constant over weekends when excluded)
3. ✅ Single source of truth: LFD is the only deadline, days_left is a derived metric
4. ⚠️ Minor UX clarity issue: "Days Left" label could be more explicit about "chargeable days"

**No Logic Changes Required:** The system correctly implements chargeable day calculations with weekend-aware logic.

