# Container Type Refactor Discovery Report

## Problem Statement

Multiple conflicting container type definitions and type casts create a risk of fields like `weekend_chargeable` being dropped or ignored. This report maps all container types, derived computation functions, call sites, and risky type casts to identify where a single source of truth should be established.

---

## A) Container Type Inventory

### 1. Database Types (Source of Truth)

**File:** `types/database.ts`

| Type Name | Lines | weekend_chargeable | Source |
|-----------|-------|-------------------|---------|
| `Database['public']['Tables']['containers']['Row']` | 228-262 | ✅ **Required** (`boolean`) | Database schema |
| `Database['public']['Tables']['containers']['Insert']` | 263-297 | ✅ **Optional** (`boolean?`) | Database schema |
| `Database['public']['Tables']['containers']['Update']` | 298-332 | ✅ **Optional** (`boolean?`) | Database schema |

**Details:**
- `Row.weekend_chargeable: boolean` (line 249) - **REQUIRED, NON-NULL**
- `Insert.weekend_chargeable?: boolean` (line 296) - **OPTIONAL**
- `Update.weekend_chargeable?: boolean` (line 331) - **OPTIONAL**

---

### 2. lib/data/containers-actions.ts Types

**File:** `lib/data/containers-actions.ts`

| Type Name | Line | weekend_chargeable | Source | Notes |
|-----------|------|-------------------|---------|-------|
| `ContainerRecord` | 20 | ✅ **Required** (`boolean`) | Alias of `Database['public']['Tables']['containers']['Row']` | **DB-SOURCED** |
| `ContainerInsert` | 21 | ✅ **Optional** (`boolean?`) | Alias of `Database['public']['Tables']['containers']['Insert']` | DB-SOURCED |
| `ContainerUpdate` | 22 | ✅ **Optional** (`boolean?`) | Alias of `Database['public']['Tables']['containers']['Update']` | DB-SOURCED |
| `ClientContainerInput` | 29-47 | ✅ **Optional** (`boolean?`) | Manual interface (line 46) | UI/TRANSFORMED |
| `ContainerInsertWithPolPod` | 51-54 | ✅ **Optional** (via `ContainerInsert`) | Extends `ContainerInsert` | DB-SOURCED + pol/pod |
| `ContainerUpdateWithPolPod` | 56-59 | ✅ **Optional** (via `ContainerUpdate`) | Extends `ContainerUpdate` | DB-SOURCED + pol/pod |
| `ContainerRecordWithComputed` | 65-76 | ✅ **Required** (via `ContainerRecord`) | Extends `ContainerRecord` | DB-SOURCED + computed fields |

**Key Finding:**
- `ContainerRecord` in `containers-actions.ts` is the **database row type** (aliased from `Database['public']['Tables']['containers']['Row']`)
- `weekend_chargeable` is **required** (non-optional `boolean`) in `ContainerRecord`

---

### 3. lib/utils/containers.ts Types

**File:** `lib/utils/containers.ts`

| Type Name | Line | weekend_chargeable | Source | Notes |
|-----------|------|-------------------|---------|-------|
| `ContainerRow` (private alias) | 13 | ✅ **Required** (`boolean`) | Alias of `Database['public']['Tables']['containers']['Row']` | Internal type alias |
| `ContainerRecord` (interface) | 17-43 | ✅ **Optional** (`ContainerRow['weekend_chargeable']?`) | Manual interface (line 31) | **CUSTOM INTERFACE** - All fields optional |
| `ContainerWithDerivedFields` | 45-54 | ✅ **Optional** (via `ContainerRecord`) | Extends `ContainerRecord` | CUSTOM INTERFACE + computed fields |

**CRITICAL ISSUE:**
- `ContainerRecord` in `lib/utils/containers.ts` is a **separate, manually defined interface** (NOT an alias)
- All fields are **optional** (marked with `?`)
- `weekend_chargeable?: ContainerRow['weekend_chargeable']` (line 31) - **OPTIONAL**
- This is a **different type** from `ContainerRecord` in `containers-actions.ts`

---

### 4. Other Files Using Container Types

| File | Type Used | Line | weekend_chargeable | Source |
|------|-----------|------|-------------------|---------|
| `lib/data/alerts-logic.ts` | `ContainerRow` (alias) | 65 | ✅ **Required** | `Database['public']['Tables']['containers']['Row']` |
| `lib/email/dailyDigestFormatter.ts` | `ContainerRow` (alias) | 6 | ✅ **Required** | `Database['public']['Tables']['containers']['Row']` |

---

## B) Derived Functions Inventory

### 1. computeDerivedFields

**File:** `lib/utils/containers.ts:262-378`

**Signature:**
```typescript
export function computeDerivedFields(
  c: ContainerRecord,  // ← ContainerRecord from lib/utils/containers.ts (CUSTOM INTERFACE)
  warningThresholdDays?: number
): ContainerWithDerivedFields
```

**weekend_chargeable Usage:**
- Line 266: `const includeWeekends = c.weekend_chargeable ?? true`
- Line 267: Passes `includeWeekends` to `computeDaysLeft()`
- Line 318: Uses `includeWeekends` for detention LFD calculation
- Line 326: Uses `includeWeekends` for detention chargeable days

**Parameter Type:**
- Uses `ContainerRecord` from `lib/utils/containers.ts` (custom interface with **optional** `weekend_chargeable`)

---

### 2. computeDaysLeft

**File:** `lib/utils/containers.ts:211-237`

**Signature:**
```typescript
export function computeDaysLeft(
  arrival?: string | null,
  freeDays = 7,
  includeWeekends = true  // ← Parameter, not from container
): number | null
```

**weekend_chargeable Usage:**
- Does NOT directly read `weekend_chargeable` from container
- Receives `includeWeekends` as a **parameter** (defaults to `true`)
- Called by `computeDerivedFields` which passes `c.weekend_chargeable ?? true`

---

### 3. computeContainerStatus

**File:** `lib/utils/containers.ts:244-255`

**Signature:**
```typescript
export function computeContainerStatus(
  c: ContainerRecord,  // ← ContainerRecord from lib/utils/containers.ts (CUSTOM INTERFACE)
  warningThresholdDays: number = 2
): ContainerStatus
```

**weekend_chargeable Usage:**
- Line 249: `const includeWeekends = c.weekend_chargeable ?? true`
- Line 250: Passes `includeWeekends` to `computeDaysLeft()`

**Parameter Type:**
- Uses `ContainerRecord` from `lib/utils/containers.ts` (custom interface with **optional** `weekend_chargeable`)

---

## C) Call Sites Inventory

### 1. computeDerivedFields Call Sites

| File | Line | Object Passed | Origin | Cast Used |
|------|------|---------------|--------|-----------|
| `lib/data/containers-actions.ts` | 127 | `c` (ContainerRecord from containers-actions.ts) | DB fetch (`.select('*')`) | ✅ **`as Parameters<typeof computeDerivedFields>[0]`** |
| `lib/data/alerts-logic.ts` | 86, 88 | `previousContainer`, `newContainer` (ContainerRow) | Function parameters | ❌ No cast |
| `lib/data/overdue-sweep.ts` | 83, 201, 238, 356, 393 | `container` (ContainerRecord from containers-actions.ts) | DB fetch | ✅ **`as ContainerRecord`** |
| `lib/data/email-drafts-actions.ts` | 610 | `c` (ContainerRow) | DB fetch (`.select('*')`) | ❌ No cast |
| `lib/email/dailyDigestFormatter.ts` | 24 | `c` (ContainerRow) | Function parameter | ❌ No cast |

**Critical Call Site:**
- **`lib/data/containers-actions.ts:127`** - Main fetch path
  ```typescript
  const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
  ```
  - `c` is `ContainerRecord` from `containers-actions.ts` (database row type, `weekend_chargeable: boolean`)
  - Cast to `ContainerRecord` from `lib/utils/containers.ts` (custom interface, `weekend_chargeable?: boolean`)
  - **RISK:** Type cast hides the mismatch - database type has required field, utils type has optional field

---

### 2. computeContainerStatus Call Sites

| File | Line | Object Passed | Origin | Cast Used |
|------|------|---------------|--------|-----------|
| `lib/utils/containers.ts` | 268 | `c` (ContainerRecord from utils) | Parameter to `computeDerivedFields` | ❌ No cast (same type) |

**Note:** Only called internally by `computeDerivedFields`, so uses the same type.

---

### 3. computeDaysLeft Call Sites

| File | Line | Object Passed | Origin | Cast Used |
|------|------|---------------|--------|-----------|
| `lib/utils/containers.ts` | 250, 267 | N/A (parameters passed directly) | Called from `computeContainerStatus` and `computeDerivedFields` | ❌ No container object passed |

**Note:** Does not take a container object as parameter - receives `includeWeekends` as a boolean parameter.

---

## D) Risky Type Casts Inventory

### 1. Casts in fetchContainers (Main Read Path)

**File:** `lib/data/containers-actions.ts:127`

```typescript
const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

**Risk Level:** 🔴 **CRITICAL**

**What's Being Cast:**
- `c` is `ContainerRecord` from `containers-actions.ts` (database row type)
  - `weekend_chargeable: boolean` (REQUIRED)
- Cast to `Parameters<typeof computeDerivedFields>[0]` which is `ContainerRecord` from `lib/utils/containers.ts`
  - `weekend_chargeable?: ContainerRow['weekend_chargeable']` (OPTIONAL)

**Why It's Risky:**
- TypeScript allows the cast because both types have `weekend_chargeable` in their shape
- However, if the database column doesn't exist, `c.weekend_chargeable` would be `undefined` at runtime
- The optional type makes TypeScript happy, but the value is lost
- `computeDerivedFields` then does `c.weekend_chargeable ?? true`, defaulting to `true`

---

### 2. Cast in fetchContainers Return

**File:** `lib/data/containers-actions.ts:130`

```typescript
return { ...c, ...computed } as ContainerRecordWithComputed
```

**Risk Level:** 🟡 **MODERATE**

**What's Being Cast:**
- Object spread of `c` (database ContainerRecord) + `computed` (ContainerWithDerivedFields)
- Cast to `ContainerRecordWithComputed`

**Why It's Risky:**
- Type assertion assumes all fields are present
- If `weekend_chargeable` was lost in `computeDerivedFields`, it won't be restored here

---

### 3. Casts in overdue-sweep.ts

**File:** `lib/data/overdue-sweep.ts:83`

```typescript
const derived = computeDerivedFields(container as ContainerRecord)
```

**Risk Level:** 🟡 **MODERATE**

**What's Being Cast:**
- `container` is `ContainerRecord` from `containers-actions.ts` (database type)
- Cast to `ContainerRecord` from `lib/utils/containers.ts` (custom interface)

**Same Issue:** Type mismatch between database type (required field) and utils type (optional field)

**Additional Casts:**
- Line 254: `(container as any).pol` - Bypasses type checking for `pol` field
- Line 255: `(container as any).pod` - Bypasses type checking for `pod` field
- Line 408: `(container as any).pol` - Same issue
- Line 409: `(container as any).pod` - Same issue

---

### 4. Casts in updateContainer

**File:** `lib/data/containers-actions.ts:287-297`

```typescript
const safeFields = Object.fromEntries(
  Object.entries(normalizedFields).filter(([, value]) => value !== undefined)
) as Partial<ContainerUpdate> & { organization_id: string }
```

**Risk Level:** 🟢 **LOW**

**What's Being Cast:**
- Filtered object to `Partial<ContainerUpdate>`
- `weekend_chargeable` would be preserved if present in `normalizedFields`

---

## E) Type Conflict Analysis

### The Core Problem: Two Different ContainerRecord Types

**Type 1: Database ContainerRecord** (`lib/data/containers-actions.ts:20`)
```typescript
export type ContainerRecord = Database['public']['Tables']['containers']['Row']
```
- `weekend_chargeable: boolean` (REQUIRED, NON-NULL)
- Source: Database schema
- Used in: DB fetch results, server actions

**Type 2: Utils ContainerRecord** (`lib/utils/containers.ts:17`)
```typescript
export interface ContainerRecord {
  // ... all fields optional ...
  weekend_chargeable?: ContainerRow['weekend_chargeable']
}
```
- `weekend_chargeable?: boolean` (OPTIONAL)
- Source: Manually defined interface
- Used in: `computeDerivedFields`, `computeContainerStatus`

### Why This Causes Issues

1. **Type Cast Hides Mismatch:**
   - `fetchContainers` fetches database `ContainerRecord` (required field)
   - Casts to utils `ContainerRecord` (optional field)
   - TypeScript allows the cast, but runtime behavior differs

2. **Runtime Value Loss:**
   - If database column doesn't exist: `c.weekend_chargeable = undefined`
   - Cast to optional type: TypeScript is happy
   - `computeDerivedFields`: `c.weekend_chargeable ?? true` → defaults to `true`
   - **Result:** Field is lost, defaults to `true`

3. **Type System Doesn't Catch It:**
   - Both types have `weekend_chargeable` in their shape
   - TypeScript sees them as compatible
   - Runtime data doesn't match TypeScript's assumptions

---

## F) Most Likely Single Point Where weekend_chargeable is Dropped

### Primary Issue: Type Cast in fetchContainers

**File:** `lib/data/containers-actions.ts:127`

```typescript
const computed = computeDerivedFields(c as Parameters<typeof computeDerivedFields>[0])
```

**Why This Is The Problem:**
1. **Database Fetch:** `.select('*')` returns `ContainerRecord` (database type) with `weekend_chargeable: boolean`
2. **Type Cast:** Casts to `ContainerRecord` (utils type) with `weekend_chargeable?: boolean`
3. **Runtime Mismatch:** If database column doesn't exist, `c.weekend_chargeable` is `undefined`
4. **Function Execution:** `computeDerivedFields` does `c.weekend_chargeable ?? true` → defaults to `true`
5. **Result:** Field value is lost, all containers get `includeWeekends = true`

### Secondary Issue: Database Column Missing

Even if the type system is fixed, if the database column doesn't exist:
- `.select('*')` won't return `weekend_chargeable`
- `c.weekend_chargeable` will be `undefined`
- `computeDerivedFields` will default to `true`

---

## G) Summary

### Container Types Found: 9 total

1. `Database['public']['Tables']['containers']['Row']` - ✅ Required field
2. `Database['public']['Tables']['containers']['Insert']` - ✅ Optional field
3. `Database['public']['Tables']['containers']['Update']` - ✅ Optional field
4. `ContainerRecord` (containers-actions.ts) - ✅ Required field (alias of #1)
5. `ContainerRecord` (utils/containers.ts) - ⚠️ **Optional field (CONFLICT)**
6. `ClientContainerInput` - ✅ Optional field
7. `ContainerRecordWithComputed` - ✅ Required field (via #4)
8. `ContainerWithDerivedFields` - ⚠️ Optional field (extends #5)
9. `ContainerRow` (aliases in other files) - ✅ Required field (alias of #1)

### Derived Functions: 3 total

1. `computeDerivedFields` - Uses utils `ContainerRecord` (optional field)
2. `computeDaysLeft` - Takes `includeWeekends` parameter (not from container)
3. `computeContainerStatus` - Uses utils `ContainerRecord` (optional field)

### Call Sites: 9 total

1. `fetchContainers` (containers-actions.ts:127) - 🔴 **CRITICAL CAST**
2. `createAlertsForContainerChange` (alerts-logic.ts:86, 88) - No cast (2 calls)
3. `overdue-sweep.ts` (multiple locations) - 🟡 **MODERATE CAST** (5 calls)
4. `fetchContainersForListWithDerived` (email-drafts-actions.ts:610) - No cast
5. `buildDailyDigestForList` (dailyDigestFormatter.ts:24) - No cast

### Risky Casts: 4 locations

1. `containers-actions.ts:127` - 🔴 **CRITICAL** - Type mismatch cast
2. `containers-actions.ts:130` - 🟡 **MODERATE** - Return type assertion
3. `overdue-sweep.ts:83` - 🟡 **MODERATE** - Type mismatch cast
4. `overdue-sweep.ts:254, 255, 408, 409` - 🟢 **LOW** - `as any` for pol/pod

---

## Recommendations (For Future Implementation)

1. **Eliminate Type Conflict:**
   - Make `lib/utils/containers.ts` use the database `ContainerRecord` type instead of a custom interface
   - OR: Make `computeDerivedFields` accept the database `ContainerRecord` type directly

2. **Remove Type Casts:**
   - Eliminate `as Parameters<typeof computeDerivedFields>[0]` cast
   - Ensure type compatibility between database types and computation functions

3. **Single Source of Truth:**
   - Use `Database['public']['Tables']['containers']['Row']` as the base type
   - All other types should extend or alias this type
   - Avoid manually defining container interfaces with optional fields

4. **Verify Database Schema:**
   - Ensure `weekend_chargeable` column exists in database
   - Run migration if needed

---

**Report Generated:** Discovery-only analysis  
**No Code Changes Made**

