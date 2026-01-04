# Dual-Input LFD Implementation Summary

## Overview

Implemented a dual-input model for container deadlines where users can enter either **Free Days** OR **Last Free Day (LFD)**, with the app automatically deriving the other value. The implementation respects `weekend_chargeable` settings and maintains a single source of truth (`free_days` in the database).

---

## Files Changed

### 1. `lib/utils/containers.ts`

**New Functions Added:**
- `deriveLfdFromFreeDays(arrivalDate, freeDays, includeWeekends): Date | null`
  - Derives LFD from arrival date and free days
  - Uses `addChargeableDays()` for weekend-aware calculation
  - Returns Date object or null if invalid

- `deriveFreeDaysFromLfd(arrivalDate, lfdDate, includeWeekends): number | null`
  - Derives free days from arrival date and LFD
  - Uses `countChargeableDaysBetween()` for weekend-aware calculation
  - Returns number of free days or null if invalid
  - Validates LFD is after arrival date

**Location:** Lines 198-252

---

### 2. `components/forms/AddContainerForm.tsx`

**Type Changes:**
- Added `lfd_input_mode: 'FREE_DAYS' | 'LFD'` to `ContainerFormData` interface
- Added `lfd_date: string` to `ContainerFormData` interface

**State Management:**
- Updated initial form state to include:
  - `lfd_input_mode: 'FREE_DAYS'` (default)
  - `lfd_date: ''`
- Updated `resetForm()` to reset these fields to defaults

**UI Components Added:**
- **Input Method Toggle** (Lines ~740-764)
  - Segmented control with two buttons: "Free Days" and "Last Free Day (LFD)"
  - Visual active state styling
  - Updates `lfd_input_mode` on click

- **Free Days Input Mode** (Lines ~766-800)
  - Editable number input for free days (0-365)
  - Preview LFD display showing computed LFD date
  - Format: "Preview LFD: Tue 13 Jan 2026"
  - Only visible when `lfd_input_mode === 'FREE_DAYS'`

- **LFD Input Mode** (Lines ~802-860)
  - Date input for Last Free Day
  - Helper text: "We'll calculate Free Days automatically using Arrival Date and your weekend setting."
  - Read-only "Derived Free Days" display showing computed free days
  - Preview showing derived free days count
  - Only visible when `lfd_input_mode === 'LFD'`

**Validation Logic:**
- **LFD Mode Validation** (Lines ~421-443)
  - Validates LFD date is required
  - Validates LFD is not before arrival date
  - Validates derived free days are within 0-365 range
  - Shows inline error messages

- **Free Days Mode Validation** (Lines ~444-448)
  - Validates free days is integer between 0-365

**Save Logic:**
- **Derivation on Save** (Lines ~495-512)
  - If `lfd_input_mode === 'LFD'`:
    - Derives `free_days` from `arrival_date`, `lfd_date`, and `weekend_chargeable`
    - Validates derived value is within bounds
    - Creates `finalFormData` with derived `free_days`
  - Always persists `free_days` (never persists `lfd_date` as authoritative)

**Imports:**
- Added: `import { deriveLfdFromFreeDays, deriveFreeDaysFromLfd } from '@/lib/utils/containers'`

---

## New Fields Added to Form State

1. **`lfd_input_mode: 'FREE_DAYS' | 'LFD'`**
   - Default: `'FREE_DAYS'`
   - Controls which input method is active
   - Reset to `'FREE_DAYS'` on form reset

2. **`lfd_date: string`**
   - Default: `''`
   - Stores user-entered LFD date when in LFD mode
   - Not persisted to database (only used for derivation)

---

## Where Derivation Happens

### 1. **UI Preview (Real-time)**
- **Location:** `AddContainerForm.tsx` (Lines ~793-800, ~848-860)
- **When:** On every render when arrival date and input field are present
- **Purpose:** Show user what the derived value will be
- **Functions Used:**
  - `deriveLfdFromFreeDays()` - Shows LFD preview in Free Days mode
  - `deriveFreeDaysFromLfd()` - Shows free days preview in LFD mode

### 2. **Validation (Before Save)**
- **Location:** `AddContainerForm.tsx` (Lines ~421-448)
- **When:** During form validation
- **Purpose:** Ensure derived values are valid before allowing save
- **Functions Used:**
  - `deriveFreeDaysFromLfd()` - Validates derived free days in LFD mode

### 3. **Save Time (Pre-Persistence)**
- **Location:** `AddContainerForm.tsx` (Lines ~495-512)
- **When:** On form submission, before calling `onSave()`
- **Purpose:** Derive `free_days` from LFD input and create final payload
- **Functions Used:**
  - `deriveFreeDaysFromLfd()` - Derives `free_days` when in LFD mode
- **Result:** `finalFormData` with `free_days` set to derived value

### 4. **Display (Post-Persistence)**
- **Location:** `lib/utils/containers.ts` (Lines ~287-302)
- **When:** On every container fetch (`fetchContainers()`)
- **Purpose:** Compute `lfd_date` for display in containers table
- **Functions Used:**
  - `addChargeableDays()` - Used internally in `computeDerivedFields()`

---

## Validation Rules Implemented

### LFD Mode Validation

1. **Required Field:**
   - `lfd_date` must be provided
   - Error: "Last Free Day (LFD) is required when using LFD input mode"

2. **Date Order:**
   - LFD must be after or equal to arrival date
   - Error: "Last Free Day cannot be before arrival date"

3. **Derived Free Days Bounds:**
   - Derived free days must be >= 0
   - Derived free days must be <= 365
   - Error: "Derived free days exceeds maximum (365 days)" or "LFD must be after arrival date"

4. **Date Validity:**
   - Both dates must be parseable
   - Error: "Invalid date combination"

### Free Days Mode Validation

1. **Integer Range:**
   - Free days must be an integer
   - Free days must be >= 0
   - Free days must be <= 365
   - Error: "Free days must be an integer between 0 and 365"

---

## Edge Cases Handled

### 1. **Mode Switching**
- **Behavior:** When user switches modes, their entered value for the active mode is preserved
- **Implementation:** Form state tracks both `free_days` and `lfd_date` independently
- **Result:** No data loss when switching between modes

### 2. **Invalid Date Combinations**
- **Behavior:** If LFD is before arrival, validation fails
- **Implementation:** `deriveFreeDaysFromLfd()` returns `null` if LFD < arrival
- **Result:** User sees clear error message, save is blocked

### 3. **Missing Arrival Date**
- **Behavior:** LFD preview/derivation requires arrival date
- **Implementation:** Functions return `null` if arrival date is missing
- **Result:** Preview shows "—" until arrival date is entered

### 4. **Weekend Logic Consistency**
- **Behavior:** All derivations use the same `weekend_chargeable` flag
- **Implementation:** Both helper functions accept `includeWeekends` parameter
- **Result:** Consistent behavior across UI preview, validation, and save

### 5. **Database Persistence**
- **Behavior:** Only `free_days` is persisted, never `lfd_date` as authoritative
- **Implementation:** Save logic derives `free_days` from LFD before calling `onSave()`
- **Result:** Single source of truth maintained, no conflicts with database triggers

### 6. **Form Reset**
- **Behavior:** Form resets to default mode (`FREE_DAYS`) and clears LFD input
- **Implementation:** `resetForm()` sets `lfd_input_mode: 'FREE_DAYS'` and `lfd_date: ''`
- **Result:** Clean state on form close/reopen

---

## Testing Checklist

### Manual Verification Required

1. **Weekend Logic:**
   - [ ] Arrival Friday + Free Days 7, weekends counted → LFD next Friday
   - [ ] Arrival Friday + Free Days 7, weekends excluded → LFD next Tuesday
   - [ ] Verify in both input modes

2. **Mode Switching:**
   - [ ] Enter free days in FREE_DAYS mode → switch to LFD mode → free days value preserved
   - [ ] Enter LFD in LFD mode → switch to FREE_DAYS mode → LFD value preserved
   - [ ] Verify previews update correctly on mode switch

3. **Save Behavior:**
   - [ ] Save in FREE_DAYS mode → `free_days` persisted correctly
   - [ ] Save in LFD mode → derived `free_days` persisted correctly
   - [ ] Verify containers table shows correct LFD (from computed fields)

4. **Validation:**
   - [ ] LFD before arrival → error shown, save blocked
   - [ ] LFD with derived free days > 365 → error shown, save blocked
   - [ ] Free days > 365 → error shown, save blocked
   - [ ] Missing LFD in LFD mode → error shown, save blocked

5. **UI/UX:**
   - [ ] Preview LFD updates in real-time when free days changes
   - [ ] Preview free days updates in real-time when LFD changes
   - [ ] Weekend checkbox toggle updates previews immediately
   - [ ] Read-only fields are clearly disabled

---

## Architecture Decisions

### 1. **Single Source of Truth**
- **Decision:** Persist only `free_days` in database
- **Rationale:** Avoids conflicts with database triggers and existing logic
- **Result:** `lfd_date` is never persisted as authoritative input

### 2. **Derivation Location**
- **Decision:** Derive `free_days` in form before save, not in server action
- **Rationale:** Keeps validation and derivation logic together, easier to test
- **Result:** Server action receives `free_days` as if user entered it directly

### 3. **Weekend Logic Application**
- **Decision:** Use existing `addChargeableDays()` and `countChargeableDaysBetween()` helpers
- **Rationale:** Consistency with existing calculation logic
- **Result:** Same weekend behavior in form preview and final calculations

### 4. **UI Mode Toggle**
- **Decision:** Segmented control (buttons) instead of radio buttons
- **Rationale:** Better visual indication of active mode
- **Result:** Clear visual feedback for active input method

---

## Summary

The dual-input LFD feature is now fully implemented with:
- ✅ Two derivation helper functions in `lib/utils/containers.ts`
- ✅ UI mode toggle and conditional input fields in `AddContainerForm.tsx`
- ✅ Real-time previews for both input modes
- ✅ Comprehensive validation for both modes
- ✅ Save-time derivation that maintains single source of truth
- ✅ Weekend-aware calculations throughout
- ✅ Edge case handling for mode switching and invalid inputs

The implementation maintains backward compatibility (defaults to FREE_DAYS mode) and does not require any database schema changes.

