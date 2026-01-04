# Carrier Templates Validation Discovery Report

**Date:** 2025-01-27  
**Purpose:** Understand current data shapes and validation before implementing P0-3 server-side validation  
**Scope:** `saveCarrierDefaults` function and related types/helpers

---

## 1. `saveCarrierDefaults` Function Signature

**File:** `lib/data/carrier-actions.ts` (lines 114-124)

```typescript
export async function saveCarrierDefaults(
  carrier: string,                    // Required
  demurrageTiers: Tier[],             // Required (can be empty array)
  detentionTiers: Tier[],             // Required (can be empty array)
  options?: {                          // Optional object
    demurrage_free_days?: number       // Optional
    detention_free_days?: number      // Optional
    demurrage_flat_rate?: number      // Optional
    detention_flat_rate?: number      // Optional
  }
): Promise<CarrierDefaults>
```

### Required vs Optional Fields

**Required:**
- `carrier: string` - Carrier name (currently only checked for truthiness, line 125-127)
- `demurrageTiers: Tier[]` - Array of demurrage tiers (can be empty `[]`)
- `detentionTiers: Tier[]` - Array of detention tiers (can be empty `[]`)

**Optional:**
- `options` object entirely optional
- All fields within `options` are optional:
  - `demurrage_free_days?: number`
  - `detention_free_days?: number`
  - `demurrage_flat_rate?: number`
  - `detention_flat_rate?: number`

### Flat Rate vs Tiers Relationship

**Current behavior:**
- **Both allowed simultaneously** - No mutual exclusivity enforced
- Flat rates are stored even when tiers exist
- Business logic in `calculateTieredFees()` (lib/tierUtils.ts:43-113):
  - If tiers array exists and has length > 0 → use tiers
  - If tiers array is empty/null → fallback to flat rate
  - Both can be present in data, but tiers take precedence

**Evidence:**
- `normalizeTiers()` always processes tiers array (line 136-137)
- Flat rates stored unconditionally if provided (line 140-141)
- No validation checking if both are provided

---

## 2. Tier Array Structure

### Tier Interface

**File:** `lib/tierUtils.ts` (lines 16-23)

```typescript
export interface Tier {
  from_day: number;      // Required: Starting day (1-based)
  to_day: number | null; // Required: Ending day (null = unlimited)
  rate: number;          // Required: Rate per day
}
```

### Field Details

- **`from_day: number`**
  - Type: `number`
  - Required: Yes
  - Range: Must be >= 1 (validated in `validateTierConfiguration`, line 138)
  - Purpose: First day of this tier (1-based, so day 1 = first chargeable day)

- **`to_day: number | null`**
  - Type: `number | null`
  - Required: Yes (but can be `null`)
  - Range: If number, must be >= `from_day` (validated line 143)
  - Special value: `null` means unlimited (no upper bound)
  - Purpose: Last day of this tier

- **`rate: number`**
  - Type: `number`
  - Required: Yes
  - Range: Must be >= 0 (validated line 138)
  - Purpose: Daily rate in this tier

### Tier Array Assumptions

**Ordering:**
- Tiers are sorted by `from_day` in ascending order (line 132: `sortTiers(tiers)`)
- `sortTiers()` function (line 166-168) sorts by `a.from_day - b.from_day`
- No gaps required between tiers (not validated)
- Overlaps are not allowed (validated line 148-153)

**Range Rules:**
- `from_day` must be >= 1
- `to_day` must be >= `from_day` OR `null`
- No overlapping day ranges (checked against previous tier)
- Empty array `[]` is valid (means no tiered rates, use flat rate)

**Coverage:**
- No requirement for complete coverage (e.g., tiers could be days 1-5 and 10-15, leaving gap at 6-9)
- Last tier with `to_day: null` covers all remaining days

---

## 3. Existing Server-Side Validation

### Current Validation in `saveCarrierDefaults`

**File:** `lib/data/carrier-actions.ts` (lines 125-127)

```typescript
if (!carrier) {
  throw new Error('Carrier name is required')
}
```

**What it checks:**
- ✅ Carrier name is truthy (not `null`, `undefined`, or empty string `""`)
- ❌ Does NOT check: trimmed, length limits, whitespace-only, uniqueness

**What it does NOT check:**
- ❌ Carrier name length (no max limit)
- ❌ Carrier name trimming (whitespace allowed)
- ❌ Carrier name uniqueness (case-insensitive)
- ❌ Numeric field ranges (free days, flat rates)
- ❌ Tier array validation (overlaps, ranges, types)
- ❌ Type validation (ensuring numbers are actually numbers, not strings)

### Tier Validation (Client-Side Only)

**File:** `lib/tierUtils.ts` (lines 122-158)

`validateTierConfiguration()` exists but is **NOT called in server actions**.

**What it validates:**
- ✅ `from_day` is number, >= 1
- ✅ `rate` is number, >= 0
- ✅ `to_day` is number >= `from_day` OR `null`
- ✅ No overlapping ranges between consecutive tiers
- ✅ Empty array is valid (returns `{ valid: true, errors: [] }`)

**Where it's used:**
- ✅ Client-side: `AddContainerForm.tsx` (lines 295, 329, 378, 383, 801-802)
- ✅ Client-side: `DemurrageTierEditor.tsx` (line 88)
- ✅ Client-side: `DetentionTierEditor.tsx` (line 88)
- ❌ **NOT used in `carrier-actions.ts` server actions**

---

## 4. Error Handling

### How Errors Are Thrown

**Pattern:** All errors thrown as `Error` objects with descriptive messages

**Examples:**
- Line 125-127: `throw new Error('Carrier name is required')`
- Line 159: `throw new Error(\`Supabase updateCarrierDefaults error: ${error.message}\`)`
- Line 188: `throw new Error(\`Supabase insertCarrierDefaults error: ${error.message}\`)`

### How Errors Reach UI

**Server action errors:**
1. Thrown as `Error` objects
2. Caught in client-side try/catch blocks
3. Displayed via `toast.error()` with error message

**Evidence from call sites:**
- `app/dashboard/settings/page.tsx` (line 782-784): `catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save carrier template') }`
- `components/forms/AddContainerForm.tsx` (line 315-317): `catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to save carrier defaults') }`

**Error message format:**
- Direct error message from server action
- Falls back to generic message if error is not an Error instance

---

## 5. Database-Level Constraints

### Table Schema

**File:** `supabase/migrations/schema_carrier_defaults.sql` (lines 6-17)

```sql
CREATE TABLE IF NOT EXISTS public.carrier_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  carrier text NOT NULL,
  demurrage_tiers jsonb DEFAULT '[]'::jsonb,
  detention_tiers jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, carrier)
);
```

**Note:** Schema mismatch exists - migration uses `carrier` but TypeScript types expect `carrier_name` (see P0-2 in audit).

### DB Constraints

**NOT NULL constraints:**
- ✅ `organization_id` - NOT NULL (enforced by DB)
- ✅ `carrier` - NOT NULL (enforced by DB)
- ✅ `id` - NOT NULL (primary key)

**Unique constraints:**
- ✅ `UNIQUE(organization_id, carrier)` - Prevents duplicate carrier names per organization
- ⚠️ **Case-sensitive** - "Maersk" and "maersk" would be allowed as separate rows

**Foreign key constraints:**
- ✅ `organization_id` references `organizations(id)` with `ON DELETE CASCADE`

**No constraints on:**
- ❌ `carrier` length (text column, unlimited length)
- ❌ JSONB structure (no schema validation)
- ❌ Numeric ranges (free days, flat rates)
- ❌ Tier array structure or values

### JSONB Storage

**Structure stored in `defaults` JSONB:**
```typescript
{
  demurrage_tiers?: PersistedTier[]     // Stored as { from, to, rate }
  detention_tiers?: PersistedTier[]     // Stored as { from, to, rate }
  demurrage_free_days?: number
  detention_free_days?: number
  demurrage_flat_rate?: number
  detention_flat_rate?: number
}
```

**Note:** Tiers are normalized before storage:
- Input: `{ from_day, to_day, rate }` (Tier format)
- Stored: `{ from, to, rate }` (PersistedTier format)
- Conversion: `normalizeTiers()` (lines 65-70)

---

## 6. Data Flow Summary

### Input → Processing → Storage

1. **Client sends:**
   - `carrier: string` (untested, untrimmed)
   - `demurrageTiers: Tier[]` (with `from_day`, `to_day`, `rate`)
   - `detentionTiers: Tier[]` (with `from_day`, `to_day`, `rate`)
   - `options?: { demurrage_free_days?, detention_free_days?, demurrage_flat_rate?, detention_flat_rate? }`

2. **Server processing:**
   - Checks `if (!carrier)` → throws if falsy
   - Calls `normalizeTiers()` to convert `from_day/to_day` → `from/to`
   - Creates `defaultsData` object with normalized tiers
   - Checks if existing record via `getCarrierDefaults(carrier)`

3. **Database storage:**
   - `carrier_name` column: raw `carrier` string (no trim, no length check)
   - `defaults` JSONB: Contains `{ demurrage_tiers, detention_tiers, demurrage_free_days, detention_free_days, demurrage_flat_rate, detention_flat_rate }`
   - Tiers stored as `{ from, to, rate }` format

4. **Database constraints:**
   - `carrier` must be NOT NULL
   - `UNIQUE(organization_id, carrier)` enforced (case-sensitive)

---

## 7. Current Validation Gaps

### Missing Server-Side Validation

1. **Carrier name:**
   - ❌ No trim
   - ❌ No length limit
   - ❌ No whitespace-only check
   - ❌ No case-insensitive uniqueness check

2. **Numeric fields:**
   - ❌ No min/max for `demurrage_free_days`
   - ❌ No min/max for `detention_free_days`
   - ❌ No min/max for `demurrage_flat_rate`
   - ❌ No min/max for `detention_flat_rate`
   - ❌ No integer validation for free days

3. **Tier arrays:**
   - ❌ No validation called in server action
   - ❌ No type checking (could receive strings instead of numbers)
   - ❌ No array length limit
   - ❌ No validation of overlaps, ranges, or required fields

4. **Type safety:**
   - ❌ No runtime type checking (TypeScript types don't enforce at runtime)
   - ❌ Could receive `NaN`, `Infinity`, or other invalid numbers

---

## 8. Call Site Patterns

### How `saveCarrierDefaults` is Called

**From Settings page** (`app/dashboard/settings/page.tsx:752-761`):
```typescript
await saveCarrierDefaults(
  carrierName,              // Already trimmed on line 745
  demurrageTiers,
  detentionTiers,
  {
    demurrage_free_days: demurrageFreeDays,      // number from input
    detention_free_days: detentionFreeDays,      // number from input
    demurrage_flat_rate: demurrageFlatRate > 0 ? demurrageFlatRate : undefined,
    detention_flat_rate: detentionFlatRate > 0 ? detentionFlatRate : undefined,
  }
)
```

**From Add Container form** (`components/forms/AddContainerForm.tsx:303-312`):
```typescript
await saveCarrierDefaults(
  formData.carrier,        // string from select
  formData.demurrage_tiers,
  formData.detention_tiers,
  {
    demurrage_free_days: formData.free_days,    // number from input
    demurrage_flat_rate: formData.demurrage_flat_rate > 0 ? formData.demurrage_flat_rate : undefined,
    detention_flat_rate: formData.detention_flat_rate > 0 ? formData.detention_flat_rate : undefined,
  }
)
```

**Note:** Client-side validation exists in AddContainerForm (tier validation before save), but not in Settings page.

---

## Summary

### Current State

- ✅ Basic truthiness check for carrier name
- ✅ Database NOT NULL and UNIQUE constraints
- ✅ Client-side tier validation exists but not used server-side
- ❌ No server-side validation for carrier name (length, trim, uniqueness)
- ❌ No server-side validation for numeric fields (ranges)
- ❌ No server-side validation for tier arrays (structure, overlaps, ranges)
- ❌ No type coercion/validation (could receive invalid types)

### Data Shapes

- **Carrier name:** `string` (unvalidated, untrimmed, unlimited length)
- **Tiers:** `Tier[]` where `Tier = { from_day: number, to_day: number | null, rate: number }`
- **Free days:** `number | undefined` (no range validation)
- **Flat rates:** `number | undefined` (no range validation)
- **Storage format:** Tiers normalized to `{ from, to, rate }` before storage

### Error Handling

- Errors thrown as `Error` objects
- Caught in client try/catch
- Displayed via `toast.error()` with error message
- No structured error response format

---

**Report Complete** - Ready for P0-3 implementation planning.

