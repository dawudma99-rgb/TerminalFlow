# Weekend Charging Setting Discovery Report

## Executive Summary

**Does weekend charging currently work?** ❌ **NO**

The `weekendChargeable` setting is stored in the database but **never read or applied** in any calculation logic. All day calculations use simple millisecond-to-day conversions without weekend filtering.

---

## 1. Settings Source of Truth

### Storage Location
- **Table:** `profiles`
- **Column:** `settings` (JSONB)
- **Key:** `weekendChargeable`
- **Data Type:** `boolean`
- **Default Value:** `true`

### Type Definition
**File:** `lib/data/settings-actions.ts` (line 10)
```typescript
export interface Settings {
  demurrageDailyRate: number
  detentionDailyRate: number
  demFreeDays: number
  detFreeDays: number
  weekendChargeable: boolean
  daysBeforeFreeTimeWarning?: number
}
```

### Default Value
**File:** `lib/data/settings-actions.ts` (line 25)
```typescript
weekendChargeable: true,  // Default: weekends ARE included
```

### UI Update Path
**File:** `app/dashboard/settings/page.tsx` (lines 377-381)
- Switch component reads from `settings.weekendChargeable`
- Updates local state: `setSettings({ ...settings, weekendChargeable: checked })`
- Saved via `saveSettings()` server action (line 179)
- Persists to `profiles.settings` JSONB column via `saveSettings()` in `lib/data/settings-actions.ts` (lines 45-60)

---

## 2. Read Path

### Search Results
**Searched for:** `weekendChargeable`, `weekend_chargeable`, `charge_weekends`, `include_weekends`, `getDay()`, `Saturday`, `Sunday`, `isWeekend`

### Findings
❌ **The setting is NEVER read anywhere in the codebase**

**Files checked:**
- `lib/utils/containers.ts` - No reference to `weekendChargeable`
- `lib/data/alerts-logic.ts` - Only reads `daysBeforeFreeTimeWarning`, not `weekendChargeable`
- `lib/data/containers-actions.ts` - No reference
- `lib/tierUtils.ts` - No reference
- `app/dashboard/settings/page.tsx` - Only writes the setting, never reads for calculations

**Evidence:**
- `SETTINGS_BEHAVIORAL_AUDIT.md` (line 17) explicitly states: "❌ **Never read**"
- `DETENTION_SYSTEM_DEEP_INVESTIGATION_REPORT.md` (lines 728-735) confirms: "⚠️ **Not Implemented**"

---

## 3. Calculation Logic

### Demurrage Day Calculation

**File:** `lib/utils/containers.ts` (lines 152-158)

**Function:** `computeDaysLeft(arrival, freeDays)`
```typescript
export function computeDaysLeft(arrival?: string | null, freeDays = 7): number | null {
  const arrivalDate = parseDateFlexible(arrival)
  if (!arrivalDate) return null

  const now = new Date()
  const diff = (arrivalDate.getTime() + freeDays * 86400000) - now.getTime()
  return Math.ceil(diff / 86400000)  // ← Simple millisecond-to-day conversion
}
```

**Analysis:**
- Uses `Math.ceil(diff / 86400000)` where `86400000` = 1 day in milliseconds
- **No weekend filtering** - counts all days including Saturdays and Sundays
- Called by `computeDerivedFields()` for demurrage `days_left` calculation

### Detention Chargeable Days Calculation

**File:** `lib/utils/containers.ts` (lines 234-246)

**Function:** `computeDerivedFields()` - detention section
```typescript
if (gateOut) {
  const endDate = emptyReturn || new Date()
  const lfdDateObj = new Date(gateOut.getTime() + detentionFreeDays * DAY_IN_MS)

  if (!Number.isNaN(lfdDateObj.getTime())) {
    const normalizedLfd = startOfDay(lfdDateObj)
    const normalizedEnd = startOfDay(endDate)
    const diffMs = normalizedEnd.getTime() - normalizedLfd.getTime()

    if (!Number.isNaN(diffMs)) {
      const diffDays = Math.floor(diffMs / DAY_IN_MS)  // ← Simple millisecond-to-day conversion
      detentionChargeableDays = diffDays > 0 ? diffDays : 0
    }
  }
}
```

**Analysis:**
- Uses `Math.floor(diffMs / DAY_IN_MS)` where `DAY_IN_MS = 86400000`
- **No weekend filtering** - counts all days including Saturdays and Sundays
- Used to calculate `detention_chargeable_days` and subsequently `detention_fees`

### Weekend Exclusion Logic

**Status:** ❌ **DOES NOT EXIST**

**Search results:**
- No `getDay()` calls to check day of week
- No `isWeekend()` helper function
- No Saturday/Sunday checks
- No weekend filtering logic in any calculation function

---

## 4. Effective Scope

### Current Behavior
Since the setting is **never read**, toggling `weekendChargeable` has **no effect** on:
- Existing containers
- Future containers
- Recalculations
- Any calculations anywhere in the system

### Intended Behavior (Based on UI Text)
**File:** `app/dashboard/settings/page.tsx` (lines 384, 388-389)
- Label: "Include weekends in detention calculations"
- Description: "When unchecked, weekends are excluded from detention free day calculations. This affects how detention fees are calculated for containers."

**Interpretation:**
- When `weekendChargeable === false`: Exclude Saturdays and Sundays from day counts
- When `weekendChargeable === true`: Include all days (current behavior)

**Note:** The UI only mentions "detention calculations" but the setting name suggests it might apply to demurrage as well. However, since it's not implemented, this ambiguity doesn't matter.

### Snapshotting
**Status:** N/A (not implemented)
- Setting is not snapshotted to containers
- Setting is always read from `profiles.settings` (if it were used)
- Since it's never read, the question is moot

---

## 5. Failure Modes

### Confirmed Issues

#### ❌ Dead Code: Setting Saved But Never Read
- **Evidence:** `SETTINGS_BEHAVIORAL_AUDIT.md` line 17: "❌ **Never read**"
- **Impact:** Users can toggle the setting, but it has zero effect
- **Risk Level:** Medium (misleading UX - appears functional but isn't)

#### ❌ Missing Implementation: No Weekend Filtering Logic
- **Evidence:** `DETENTION_SYSTEM_DEEP_INVESTIGATION_REPORT.md` lines 728-735: "⚠️ **Not Implemented**"
- **Impact:** All calculations count weekends regardless of setting
- **Risk Level:** High (calculation accuracy issue if users expect weekend exclusion)

### Naming Consistency
✅ **CONSISTENT**
- Database key: `weekendChargeable`
- TypeScript interface: `weekendChargeable`
- UI component: `weekendChargeable`
- No mismatched naming (e.g., no `charge_weekends` or `include_weekends` variants)

### Default Behavior When Missing
**File:** `lib/data/settings-actions.ts` (lines 19-38)
- If `profiles.settings` is null/undefined, defaults to `weekendChargeable: true`
- Since the setting is never read, the default value doesn't matter

---

## 6. Detailed Code References

### Where Setting is Written
1. **Settings UI:** `app/dashboard/settings/page.tsx:377-381`
2. **Server Action:** `lib/data/settings-actions.ts:45-60` (`saveSettings()`)
3. **Database:** `profiles.settings.weekendChargeable` (JSONB)

### Where Setting Should Be Read (But Isn't)
1. **Demurrage calculation:** `lib/utils/containers.ts:152-158` (`computeDaysLeft()`)
2. **Detention calculation:** `lib/utils/containers.ts:234-246` (`computeDerivedFields()` detention section)
3. **Alert generation:** `lib/data/alerts-logic.ts` (only reads `daysBeforeFreeTimeWarning`)

### Calculation Functions That Should Respect Weekend Setting

**Demurrage:**
- `computeDaysLeft()` - calculates `days_left` (used for demurrage `daysOverdue`)
- Currently: Simple millisecond difference
- Should: Skip weekends when `weekendChargeable === false`

**Detention:**
- `computeDerivedFields()` detention section (lines 234-246) - calculates `detentionChargeableDays`
- Currently: Simple millisecond difference
- Should: Skip weekends when `weekendChargeable === false`

---

## 7. Summary Table

| Aspect | Status | Details |
|--------|--------|---------|
| **Stored?** | ✅ Yes | `profiles.settings.weekendChargeable` (boolean) |
| **Read?** | ❌ No | Never read anywhere in codebase |
| **Applied to Demurrage?** | ❌ No | `computeDaysLeft()` uses simple day difference |
| **Applied to Detention?** | ❌ No | `computeDerivedFields()` uses simple day difference |
| **Weekend Filtering Logic?** | ❌ No | No `getDay()`, `isWeekend()`, or weekend checks |
| **Affects Existing Containers?** | ❌ N/A | Not implemented |
| **Affects Future Containers?** | ❌ N/A | Not implemented |
| **UI Functional?** | ⚠️ Partially | Toggle works, but setting has no effect |
| **Naming Consistent?** | ✅ Yes | Always `weekendChargeable` |

---

## 8. Gaps Found

### Critical Gaps
1. **No weekend filtering logic** - Calculations always count all days
2. **Setting never read** - User changes have no effect
3. **Misleading UI** - Setting appears functional but isn't

### Implementation Requirements (If Fixed)
To implement weekend charging correctly, would need:

1. **Helper function** to count business days (excluding weekends when `weekendChargeable === false`)
2. **Modify `computeDaysLeft()`** to accept and use `weekendChargeable` parameter
3. **Modify `computeDerivedFields()` detention section** to accept and use `weekendChargeable` parameter
4. **Pass settings to calculation functions** - Either:
   - Load settings in callers and pass as parameter, OR
   - Load settings inside calculation functions (less ideal - coupling)

5. **Determine scope:**
   - Apply only to detention? (UI says "detention calculations")
   - Apply to both demurrage and detention? (setting name suggests general)

---

## Conclusion

**The `weekendChargeable` setting does NOT work.** It is stored in the database and can be toggled in the UI, but the calculation logic never reads it. All day calculations use simple millisecond-to-day conversions that count weekends regardless of the setting value.

**Recommendation:** Either implement the weekend filtering logic or remove the setting from the UI to avoid user confusion.

