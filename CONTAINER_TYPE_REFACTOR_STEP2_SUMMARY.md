# Container Type Refactor Step 2: Summary

## Changes Made to `lib/utils/containers.ts`

### 1. Created `DerivedContainer` Type (Lines 17-29)

**New Type:**
```typescript
export type DerivedContainer = ContainerRow & {
  days_left: number | null
  status: ContainerStatus
  demurrage_fees: number
  detention_fees: number
  lfd_date: string | null
  detention_chargeable_days: number | null
  detention_status: 'Safe' | 'Warning' | 'Overdue' | null
}
```

**Key Points:**
- Extends `ContainerRow` (database type) directly
- Contains all computed derived fields
- Single source of truth: database types

---

### 2. Updated Function Signatures

#### `computeDerivedFields` (Lines 275-278)

**Before:**
```typescript
export function computeDerivedFields(
  c: ContainerRecord,  // Custom interface (optional fields)
  warningThresholdDays?: number
): ContainerWithDerivedFields
```

**After:**
```typescript
export function computeDerivedFields(
  c: ContainerRow,  // Database type (required fields)
  warningThresholdDays?: number
): DerivedContainer
```

**Changes:**
- Parameter type: `ContainerRecord` → `ContainerRow`
- Return type: `ContainerWithDerivedFields` → `DerivedContainer`

---

#### `computeContainerStatus` (Lines 257-260)

**Before:**
```typescript
export function computeContainerStatus(
  c: ContainerRecord,  // Custom interface (optional fields)
  warningThresholdDays: number = 2
): ContainerStatus
```

**After:**
```typescript
export function computeContainerStatus(
  c: ContainerRow,  // Database type (required fields)
  warningThresholdDays: number = 2
): ContainerStatus
```

**Changes:**
- Parameter type: `ContainerRecord` → `ContainerRow`

---

### 3. Removed `?? true` Fallback for `weekend_chargeable`

#### In `computeContainerStatus` (Line 262)

**Before:**
```typescript
const includeWeekends = c.weekend_chargeable ?? true
```

**After:**
```typescript
const includeWeekends = c.weekend_chargeable
```

**Rationale:**
- `ContainerRow.weekend_chargeable` is `boolean` (required, non-null)
- No fallback needed - database guarantees the value exists

---

#### In `computeDerivedFields` (Line 279)

**Before:**
```typescript
const includeWeekends = c.weekend_chargeable ?? true
```

**After:**
```typescript
const includeWeekends = c.weekend_chargeable
```

**Rationale:**
- Same as above - database type guarantees the value

---

### 4. Updated Helper Functions

#### `normalizeTierArray` (Line 84)

**Before:**
```typescript
function normalizeTierArray(source?: ContainerRecord['demurrage_tiers']): Tier[] | undefined
```

**After:**
```typescript
function normalizeTierArray(source?: ContainerRow['demurrage_tiers']): Tier[] | undefined
```

---

#### `resolveTierArray` (Line 95)

**Before:**
```typescript
function resolveTierArray(source?: ContainerRecord['demurrage_tiers']): Tier[] | undefined
```

**After:**
```typescript
function resolveTierArray(source?: ContainerRow['demurrage_tiers']): Tier[] | undefined
```

---

#### `resolveFeeRate` (Line 99)

**Before:**
```typescript
function resolveFeeRate(value?: ContainerRecord['demurrage_fee_if_late'] | ContainerRecord['detention_fee_rate'] | null): number | undefined
```

**After:**
```typescript
function resolveFeeRate(value?: ContainerRow['demurrage_fee_if_late'] | ContainerRow['detention_fee_rate'] | null): number | undefined
```

---

### 5. Backward Compatibility

#### `ContainerWithDerivedFields` (Lines 31-35)

**Kept for backward compatibility:**
```typescript
/**
 * @deprecated Use DerivedContainer instead. This type is kept for backward compatibility.
 * Will be removed in a future version.
 */
export type ContainerWithDerivedFields = DerivedContainer
```

**Rationale:**
- Used by other files: `lib/data/alerts-logic.ts`, `lib/data/email-drafts-actions.ts`, `lib/email/dailyDigestFormatter.ts`
- Type alias ensures no breaking changes
- Can be removed in future refactor

---

#### `ContainerRecord` Interface (Lines 37-67)

**Kept but deprecated:**
```typescript
/**
 * @deprecated This custom interface is deprecated. Use ContainerRow from database types instead.
 * Kept for backward compatibility only - compute functions no longer use this type.
 */
export interface ContainerRecord {
  // ... (unchanged)
}
```

**Rationale:**
- May be used elsewhere (though not found in grep results)
- Compute functions no longer use it
- Can be removed in future refactor

---

## Expected Compile Errors (Step 3)

The following call sites will need updates because they pass types that are incompatible with `ContainerRow`:

### 1. `lib/data/containers-actions.ts:127`

**Current Code:**
```typescript
const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

**Expected Error:**
- Type cast will no longer be necessary (or will need to be removed)
- `c` is already `ContainerRecord` (database type) = `ContainerRow`
- Cast should be removed

---

### 2. `lib/data/overdue-sweep.ts:83, 201, 238, 356, 393`

**Current Code:**
```typescript
const derived = computeDerivedFields(container as ContainerRecord)
```

**Expected Error:**
- `container` is `ContainerRecord` from `containers-actions.ts` (which is `ContainerRow`)
- Cast should be removed (types already match)

---

### 3. `lib/data/alerts-logic.ts:86, 88`

**Current Code:**
```typescript
const oldDerived = previousContainer
  ? computeDerivedFields(previousContainer, warningThresholdDays)
  : null
const newDerived = computeDerivedFields(newContainer, warningThresholdDays)
```

**Expected Error:**
- `previousContainer` and `newContainer` are `ContainerRow` (database type alias)
- Should work without changes (types already match)

---

### 4. `lib/data/email-drafts-actions.ts:610`

**Current Code:**
```typescript
const enriched = data.map((c) => ({
  raw: c,
  derived: computeDerivedFields(c),
}))
```

**Expected Error:**
- `c` is `ContainerRow` (from database query)
- Should work without changes (types already match)

---

### 5. `lib/email/dailyDigestFormatter.ts:24`

**Current Code:**
```typescript
const enriched = containers.map((c) => ({
  raw: c,
  derived: computeDerivedFields(c),
}))
```

**Expected Error:**
- `c` is `ContainerRow` (function parameter)
- Should work without changes (types already match)

---

## Summary

### Files Changed
- `lib/utils/containers.ts` - All changes in this file only

### Types Changed
- `computeDerivedFields`: `ContainerRecord` → `ContainerRow` (parameter), `ContainerWithDerivedFields` → `DerivedContainer` (return)
- `computeContainerStatus`: `ContainerRecord` → `ContainerRow` (parameter)
- Helper functions: `ContainerRecord` → `ContainerRow` (type references)

### Breaking Changes
- Function signatures changed (but return type `ContainerWithDerivedFields` is aliased to `DerivedContainer` for compatibility)
- Type casts at call sites will need to be removed (Step 3)

### No Breaking Changes
- `ContainerWithDerivedFields` is still exported (as alias to `DerivedContainer`)
- `ContainerRecord` interface is still exported (deprecated but available)

### Key Improvement
- Single source of truth: Database types (`ContainerRow`) are now used throughout
- `weekend_chargeable` is guaranteed to be `boolean` (no `?? true` fallback)
- Type system now accurately reflects database schema

---

## Next Steps (Step 3)

Remove type casts at call sites:
1. `lib/data/containers-actions.ts:127` - Remove cast
2. `lib/data/overdue-sweep.ts` (multiple locations) - Remove casts
3. Verify other call sites work without changes

