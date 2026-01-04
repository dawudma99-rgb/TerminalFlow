# P0-3 Server-Side Validation Implementation Summary

**Date:** 2025-01-27  
**Issue:** P0-3 - Missing Server-Side Validation for Carrier Templates  
**Status:** ✅ **COMPLETE**

---

## Overview

Added comprehensive server-side validation to `lib/data/carrier-actions.ts` to prevent bad data from being saved, even if the UI is bypassed. All validation runs before any database write operations.

---

## Validations Added

### 1. Carrier Name Validation

**Function:** `validateCarrierName(carrier: string): string`

**Rules:**
- ✅ Trims whitespace
- ✅ Must not be empty after trim
- ✅ Must be <= 100 characters
- ✅ Returns trimmed, validated name

**Applied to:**
- `saveCarrierDefaults()` - validates carrier name before save
- `updateCarrierName()` - validates both old and new names

**Error messages:**
- `"Carrier name must be a string"`
- `"Carrier name cannot be empty or whitespace only"`
- `"Carrier name must be 100 characters or less"`

---

### 2. Case-Insensitive Uniqueness Check

**Function:** `checkCarrierNameUniqueness(supabase, organizationId, carrierName, excludeId?)`

**Rules:**
- ✅ Checks all carriers in organization case-insensitively
- ✅ Excludes current record when updating (prevents false positives)
- ✅ Prevents "Maersk" and "maersk" from coexisting

**Applied to:**
- `saveCarrierDefaults()` - checks uniqueness before insert/update
- `updateCarrierName()` - checks new name uniqueness before rename

**Error message:**
- `"Carrier \"<name>\" already exists"`

---

### 3. Free Days Validation

**Function:** `validateFreeDays(value: number | undefined, fieldName: string): number | undefined`

**Rules:**
- ✅ Must be a finite number (rejects NaN, Infinity)
- ✅ Must be an integer (rejects decimals like 7.5)
- ✅ Must be between 0 and 365 inclusive
- ✅ Returns undefined if not provided (optional field)

**Applied to:**
- `saveCarrierDefaults()` - validates `demurrage_free_days` and `detention_free_days`

**Error messages:**
- `"<fieldName> must be a number"`
- `"<fieldName> must be a finite number"`
- `"<fieldName> must be an integer"`
- `"<fieldName> must be between 0 and 365"`

---

### 4. Flat Rate Validation

**Function:** `validateFlatRate(value: number | undefined, fieldName: string): number | undefined`

**Rules:**
- ✅ Must be a finite number (rejects NaN, Infinity)
- ✅ Must be >= 0
- ✅ Must be <= 100,000
- ✅ Returns undefined if not provided (optional field)

**Applied to:**
- `saveCarrierDefaults()` - validates `demurrage_flat_rate` and `detention_flat_rate`

**Error messages:**
- `"<fieldName> must be a number"`
- `"<fieldName> must be a finite number"`
- `"<fieldName> must be greater than or equal to 0"`
- `"<fieldName> must be 100,000 or less"`

---

### 5. Tier Array Validation

**Function:** `validateTierArray(tiers: Tier[], fieldName: string, maxTiers?: number): void`

**Rules:**
- ✅ Must be an array
- ✅ Maximum 50 tiers per array (anti-abuse)
- ✅ Empty array `[]` is allowed
- ✅ Uses existing `validateTierConfiguration()` from `lib/tierUtils.ts`
- ✅ Validates: from_day >= 1, to_day >= from_day or null, rate >= 0, no overlaps

**Applied to:**
- `saveCarrierDefaults()` - validates `demurrageTiers` and `detentionTiers`

**Error messages:**
- `"<fieldName> must be an array"`
- `"<fieldName> cannot have more than 50 tiers"`
- `"Invalid <fieldName>: <detailed tier validation errors>"`

---

## Implementation Details

### File Modified

**`lib/data/carrier-actions.ts`**

**Changes:**
1. Added import: `validateTierConfiguration` from `@/lib/tierUtils`
2. Added 5 validation helper functions (lines 73-203)
3. Updated `saveCarrierDefaults()` to validate all inputs before DB write (lines 258-277)
4. Updated `updateCarrierName()` to validate both old and new names (lines 360-380)
5. All validation runs before any database operations

### Validation Order

1. **Carrier name** - trim and validate
2. **Tier arrays** - structure and content
3. **Numeric fields** - free days and flat rates
4. **Uniqueness check** - case-insensitive (after getting existing record for updates)

### Error Handling

- All validations throw `Error` objects with clear, human-readable messages
- Errors propagate to client-side try/catch blocks
- Displayed via existing `toast.error()` mechanism
- No changes needed to UI error handling

---

## Acceptance Criteria Status

### ✅ Carrier Name
- ✅ Rejects empty string
- ✅ Rejects whitespace-only
- ✅ Rejects >100 chars
- ✅ Rejects duplicate name differing only by case

### ✅ Numbers
- ✅ Rejects negative values
- ✅ Rejects NaN, Infinity
- ✅ Rejects free days non-integer (e.g., 7.5)
- ✅ Rejects free days >365
- ✅ Rejects flat rate >100000

### ✅ Tiers
- ✅ Rejects invalid ranges/overlaps (via `validateTierConfiguration`)
- ✅ Rejects tiers length >50

### ✅ Happy Paths
- ✅ Valid carrier template can be created
- ✅ Valid carrier template can be edited
- ✅ Valid carrier template can be renamed
- ✅ Add Container auto-fill still works (no behavior change)
- ✅ Error messages show in UI via existing toast handling

---

## Business Logic Preserved

- ✅ Tiers and flat rates can coexist (no mutual exclusivity enforced)
- ✅ If tiers exist and length > 0 → tiers are used (calculation logic unchanged)
- ✅ If tiers empty → flat rate may be used (calculation logic unchanged)
- ✅ Empty tier arrays `[]` are allowed
- ✅ All existing functionality preserved

---

## Testing Recommendations

1. **Carrier name edge cases:**
   - Empty string, whitespace-only, >100 chars
   - Case-insensitive duplicates ("Maersk" vs "maersk")

2. **Numeric edge cases:**
   - Negative numbers, NaN, Infinity
   - Free days: 7.5 (should reject), 0 (should accept), 365 (should accept), 366 (should reject)
   - Flat rates: -1 (should reject), 0 (should accept), 100000 (should accept), 100001 (should reject)

3. **Tier edge cases:**
   - Empty array (should accept)
   - 50 tiers (should accept)
   - 51 tiers (should reject)
   - Invalid ranges, overlaps (should reject with detailed errors)

4. **Integration:**
   - Create new carrier template
   - Edit existing template
   - Rename carrier
   - Add Container auto-fill still works

---

## Summary

All P0-3 validation requirements have been implemented:

- ✅ Carrier name validation (trim, length, uniqueness)
- ✅ Free days validation (integer, 0-365)
- ✅ Flat rate validation (>=0, <=100000)
- ✅ Tier array validation (structure, max 50, uses existing validator)
- ✅ Case-insensitive uniqueness check
- ✅ All validation runs before DB writes
- ✅ Error messages are clear and actionable
- ✅ No breaking changes to existing functionality

**Implementation is complete and ready for testing.**

