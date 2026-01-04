# Settings Behavioral Audit

## Executive Summary

**5 out of 6 settings are stored but not consumed.** Only `daysBeforeFreeTimeWarning` actively affects application behavior.

---

## Settings Usage Table

| Setting Key | Stored | Read/Used Where | Real Effect | Status |
|------------|--------|-----------------|-------------|--------|
| `demurrageDailyRate` | ✅ `profiles.settings` | ❌ **Never read** | **None** - Stored but not consumed | ❌ **UNUSED** |
| `detentionDailyRate` | ✅ `profiles.settings` | ❌ **Never read** | **None** - Stored but not consumed | ❌ **UNUSED** |
| `demFreeDays` | ✅ `profiles.settings` | ❌ **Never read** | **None** - Stored but not consumed | ❌ **UNUSED** |
| `detFreeDays` | ✅ `profiles.settings` | ❌ **Never read** | **None** - Stored but not consumed | ❌ **UNUSED** |
| `weekendChargeable` | ✅ `profiles.settings` | ❌ **Never read** | **None** - Stored but not consumed | ❌ **UNUSED** |
| `daysBeforeFreeTimeWarning` | ✅ `profiles.settings` | ✅ `lib/data/alerts-logic.ts:75` | ✅ **Affects alert timing** - Controls when containers enter "Warning" status | ✅ **USED** |

---

## Detailed Analysis

### 1. `demurrageDailyRate`

**Storage**: ✅ Saved to `profiles.settings.demurrageDailyRate` (default: 80)

**Usage**: ❌ **Never read anywhere in the codebase**

**Intended Purpose**: Default daily rate for demurrage charges when creating containers

**Actual Behavior**: 
- `AddContainerForm.tsx` initializes `demurrage_flat_rate: 0` (line 184)
- Form does not call `loadSettings()` to populate defaults
- Container creation uses hardcoded values or carrier presets
- Fee calculations use container-level `demurrage_fee_if_late` field, not settings

**Files Checked**:
- `components/forms/AddContainerForm.tsx` - No `loadSettings()` call
- `lib/utils/containers.ts` - Uses `c.demurrage_fee_if_late` from container, not settings
- `lib/tierUtils.ts` - Uses container-level rates, not settings

**Conclusion**: **Stored but not consumed**

---

### 2. `detentionDailyRate`

**Storage**: ✅ Saved to `profiles.settings.detentionDailyRate` (default: 50)

**Usage**: ❌ **Never read anywhere in the codebase**

**Intended Purpose**: Default daily rate for detention charges when creating containers

**Actual Behavior**:
- `AddContainerForm.tsx` initializes `detention_flat_rate: 0` (line 187)
- Form does not call `loadSettings()` to populate defaults
- Container creation uses hardcoded values or carrier presets
- Fee calculations use container-level `detention_fee_rate` field, not settings

**Files Checked**:
- `components/forms/AddContainerForm.tsx` - No `loadSettings()` call
- `lib/utils/containers.ts` - Uses `c.detention_fee_rate` from container, not settings
- `lib/tierUtils.ts` - Uses container-level rates, not settings

**Conclusion**: **Stored but not consumed**

---

### 3. `demFreeDays`

**Storage**: ✅ Saved to `profiles.settings.demFreeDays` (default: 7)

**Usage**: ❌ **Never read anywhere in the codebase**

**Intended Purpose**: Default free days for demurrage when creating containers

**Actual Behavior**:
- `AddContainerForm.tsx` initializes `free_days: 7` (line 178) - hardcoded
- Form does not call `loadSettings()` to populate defaults
- Container creation uses hardcoded value of 7
- Calculations use container-level `free_days` field, not settings

**Files Checked**:
- `components/forms/AddContainerForm.tsx` - Hardcoded `free_days: 7`
- `lib/utils/containers.ts` - Uses `c.free_days ?? 7` from container, not settings

**Conclusion**: **Stored but not consumed**

---

### 4. `detFreeDays`

**Storage**: ✅ Saved to `profiles.settings.detFreeDays` (default: 7)

**Usage**: ❌ **Never read anywhere in the codebase**

**Intended Purpose**: Default free days for detention when creating containers

**Actual Behavior**:
- `AddContainerForm.tsx` does not initialize detention free days in form state
- Form does not call `loadSettings()` to populate defaults
- Container creation uses container-level `detention_free_days` field (defaults to 7 in database)
- Calculations use container-level `detention_free_days` field, not settings

**Files Checked**:
- `components/forms/AddContainerForm.tsx` - No default loading from settings
- `lib/utils/containers.ts` - Uses `c.detention_free_days ?? 7` from container, not settings

**Conclusion**: **Stored but not consumed**

---

### 5. `weekendChargeable`

**Storage**: ✅ Saved to `profiles.settings.weekendChargeable` (default: true)

**Usage**: ❌ **Never read anywhere in the codebase**

**Intended Purpose**: Exclude weekends from detention free day calculations when `false`

**Actual Behavior**:
- Setting exists in UI and is saved
- **Not implemented in calculation logic**
- All days (including weekends) currently count in all calculations
- Date calculations in `lib/utils/containers.ts` use simple day differences without weekend filtering

**Evidence**:
- `DETENTION_SYSTEM_DEEP_INVESTIGATION_REPORT.md` (lines 728-735) explicitly states:
  > **Current Status:** ⚠️ **Not Implemented**
  > - Settings field exists but not used in calculation
  > - All days (including weekends) currently count
  > - Future enhancement opportunity

**Files Checked**:
- `lib/utils/containers.ts` - `computeDerivedFields()` uses `Math.floor(diffMs / DAY_IN_MS)` without weekend filtering
- No weekend exclusion logic found anywhere

**Conclusion**: **Stored but not consumed** (explicitly documented as unimplemented)

---

### 6. `daysBeforeFreeTimeWarning`

**Storage**: ✅ Saved to `profiles.settings.daysBeforeFreeTimeWarning` (default: 2)

**Usage**: ✅ **Actively used in alert generation**

**Where Read**:
1. **`lib/data/alerts-logic.ts:75`** - `createAlertsForContainerChange()` function
   ```typescript
   const settings = await loadSettings()
   warningThresholdDays = settings.daysBeforeFreeTimeWarning ?? 2
   ```

**Real Effects**:

1. **Alert Timing** (`lib/data/alerts-logic.ts:86-88`):
   - Passed to `computeDerivedFields(previousContainer, warningThresholdDays)`
   - Controls when containers transition from "Safe" to "Warning" status
   - Affects `became_warning` alert creation (lines 96-131)

2. **Status Calculation** (`lib/utils/containers.ts:166-176`):
   - `computeContainerStatus()` uses threshold to determine status
   - If `daysLeft > warningThresholdDays`: "Safe"
   - If `daysLeft > 0 && daysLeft <= warningThresholdDays`: "Warning"
   - If `daysLeft <= 0`: "Overdue"

3. **Alert Generation** (`lib/data/alerts-logic.ts:96`):
   - Creates `became_warning` alerts when status transitions to "Warning"
   - Alert message includes `days_left` value
   - Alert metadata includes threshold information

**Does NOT Affect**:
- ❌ Email content (subject/body) - Email drafts use computed status, not threshold directly
- ❌ CSV exports - Exports computed `status` field, not threshold
- ❌ Analytics numbers - Analytics use computed `status`, not threshold
- ❌ Fee calculations - Fees are based on days overdue, not threshold

**Conclusion**: ✅ **USED** - Affects alert timing and status calculation

---

## Weekend Charging Confirmation

**Question**: Does `weekendChargeable` actively change date or fee calculations?

**Answer**: ❌ **NO** - It is currently unused beyond storage.

**Evidence**:
1. Setting is saved to database but never read
2. `DETENTION_SYSTEM_DEEP_INVESTIGATION_REPORT.md` explicitly documents it as "Not Implemented"
3. Date calculations in `lib/utils/containers.ts` use simple day differences:
   ```typescript
   const diffMs = normalizedEnd.getTime() - normalizedLfd.getTime()
   const diffDays = Math.floor(diffMs / DAY_IN_MS)
   ```
   No weekend filtering logic exists.

**Status**: **Stored but not consumed**

---

## Warning Thresholds Confirmation

**Question**: Are warning thresholds used in alert generation logic or only affect UI labels?

**Answer**: ✅ **USED in alert generation logic**

**Evidence**:
1. `daysBeforeFreeTimeWarning` is loaded in `lib/data/alerts-logic.ts:75`
2. Passed to `computeDerivedFields()` which calculates container status
3. Status calculation directly affects when `became_warning` alerts are created
4. Alert creation logic (lines 96-131) checks status transitions based on threshold

**Status**: ✅ **Actively used in alert generation**

---

## Email Content Impact

**Question**: Do any settings affect email content (subject/body)?

**Answer**: ❌ **NO** - No settings directly affect email content.

**Evidence**:
- Email drafts use computed container fields (`status`, `days_left`, `demurrage_fees`, etc.)
- `daysBeforeFreeTimeWarning` indirectly affects emails by changing container status, but email templates don't reference the threshold value directly
- No settings are passed to email formatters

**Files Checked**:
- `lib/email/dailyDigestFormatter.ts` - Uses computed container fields only
- `lib/data/email-drafts-actions.ts` - Uses computed container fields only

---

## Analytics Impact

**Question**: Do any settings affect analytics numbers?

**Answer**: ❌ **NO** - No settings directly affect analytics.

**Evidence**:
- Analytics use computed container fields (`status`, `demurrage_fees`, `detention_fees`, etc.)
- `daysBeforeFreeTimeWarning` indirectly affects analytics by changing container status counts, but analytics don't reference the threshold value directly

**Files Checked**:
- `lib/analytics/analytics-utils.ts` - Uses computed container fields only
- Analytics functions use `container.status`, `container.demurrage_fees`, etc.

---

## CSV Export Impact

**Question**: Do any settings affect CSV exports?

**Answer**: ❌ **NO** - No settings affect CSV exports.

**Evidence**:
- CSV exports use computed container fields (`status`, `days_left`, `demurrage_fees`, etc.)
- `daysBeforeFreeTimeWarning` indirectly affects exports by changing container status, but exports don't reference the threshold value directly

**Files Checked**:
- `lib/csv/containers-serializer.ts` - Exports container fields only
- `lib/data/export-actions.ts` - Uses computed container fields only

---

## Summary: Unused Settings

### Settings That Are Saved But Never Read

1. **`demurrageDailyRate`** - Intended as default for new containers, but form uses hardcoded 0
2. **`detentionDailyRate`** - Intended as default for new containers, but form uses hardcoded 0
3. **`demFreeDays`** - Intended as default for new containers, but form uses hardcoded 7
4. **`detFreeDays`** - Intended as default for new containers, but form uses hardcoded 7
5. **`weekendChargeable`** - Intended to exclude weekends from calculations, but logic not implemented

### Settings That Are Read But Only Partially Applied

**None** - `daysBeforeFreeTimeWarning` is fully applied to alert generation and status calculation.

---

## Recommendations

### High Priority

1. **Remove or implement unused settings**:
   - Either remove `demurrageDailyRate`, `detentionDailyRate`, `demFreeDays`, `detFreeDays` from UI
   - Or implement loading these defaults in `AddContainerForm.tsx` when creating new containers

2. **Implement or remove `weekendChargeable`**:
   - Either implement weekend exclusion logic in `lib/utils/containers.ts`
   - Or remove the setting from UI if not needed

### Low Priority

3. **Document that `daysBeforeFreeTimeWarning` only affects alerts**:
   - Clarify in UI that this setting affects when warnings appear, not fee calculations

---

## Code References

### Settings Definition
- **File**: `lib/data/settings-actions.ts`
- **Interface**: `Settings` (lines 5-12)
- **Load Function**: `loadSettings()` (lines 19-39)
- **Save Function**: `saveSettings()` (lines 45-60)

### Settings UI
- **File**: `app/dashboard/settings/page.tsx`
- **Lines**: 262-424 (all settings sections)

### Settings Usage (Only One)
- **File**: `lib/data/alerts-logic.ts`
- **Function**: `createAlertsForContainerChange()` (line 75)
- **Usage**: Loads `daysBeforeFreeTimeWarning` and passes to `computeDerivedFields()`

### Calculation Logic (No Settings Used)
- **File**: `lib/utils/containers.ts`
- **Function**: `computeDerivedFields()` (lines 183-298)
- **Note**: Uses container-level fields only, never calls `loadSettings()`

### Form Logic (No Settings Used)
- **File**: `components/forms/AddContainerForm.tsx`
- **Note**: Does not call `loadSettings()` to populate defaults

