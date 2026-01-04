# Carrier Fee Templates Enterprise Audit Report

**Date:** 2025-01-27  
**Scope:** Carrier Fee Templates feature (Settings + Add Container auto-fill)  
**Auditor:** AI Code Review System

---

## Executive Summary

This audit examines the Carrier Fee Templates feature for security, data integrity, multi-tenancy, reliability, UX safety, and maintainability. The feature allows organizations to create carrier-specific fee templates that auto-fill when adding containers.

**Overall Status:** ⚠️ **CRITICAL ISSUES FOUND** - Multiple P0 and P1 issues require immediate attention before production deployment.

---

## Pass/Fail Checklist

| Category | Status | Notes |
|----------|--------|-------|
| **A) Multi-tenancy & Authorization** | ❌ **FAIL** | Server actions trust client-provided `organizationId` without verification |
| **B) Input Validation & Trust Boundaries** | ❌ **FAIL** | Missing server-side validation for carrier names, numeric fields, and tier arrays |
| **C) Data Integrity & Migrations** | ⚠️ **PARTIAL** | Schema mismatch between migration and code; backward compatibility concerns |
| **D) UX Safety & Guardrails** | ⚠️ **PARTIAL** | Missing delete confirmation; silent failures in auto-fill |
| **E) Error Handling & Observability** | ⚠️ **PARTIAL** | Silent failures; errors logged but not always surfaced to users |
| **F) Performance & Caching** | ✅ **PASS** | Revalidation in place; no excessive refetching detected |
| **G) Code Quality & Maintainability** | ⚠️ **PARTIAL** | Duplicated logic; naming inconsistencies; tier normalization complexity |

---

## Prioritized Issues

### P0 - CRITICAL: Could cause data leak, corruption, or customer-facing failure

#### P0-1: Server Actions Trust Client-Provided organizationId Without Verification
**Files:**
- `lib/data/carrier-actions.ts` (lines 75, 114, 211, 249, 272)

**Issue:**
All carrier server actions accept `organizationId` as a parameter from the client and use it directly in database queries without verifying the authenticated user belongs to that organization.

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:75
export async function getCarrierDefaults(carrier: string, organizationId: string): Promise<CarrierDefaults | null> {
  // ...
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('carrier_defaults')
    .select('*')
    .eq('carrier_name', carrier)
    .eq('organization_id', organizationId)  // ⚠️ Trusts client input
    .single()
}
```

**Why it matters:**
A malicious user could pass a different `organizationId` and read/modify carrier templates from other organizations. While RLS policies provide defense-in-depth, server actions should verify authorization server-side.

**Recommended fix:**
Use `getServerAuthContext()` to get the authenticated user's `organizationId` instead of accepting it as a parameter:
```typescript
export async function getCarrierDefaults(carrier: string): Promise<CarrierDefaults | null> {
  const { supabase, organizationId } = await getServerAuthContext()
  // Use organizationId from auth context, not parameter
}
```

**Impact:** Data leak risk across organizations

---

#### P0-2: Schema Mismatch: Migration Uses `carrier` but Code Uses `carrier_name`
**Files:**
- `supabase/migrations/schema_carrier_defaults.sql` (line 9: `carrier text NOT NULL`)
- `dnd-copilot-next/types/database.ts` (line 93: `carrier_name: string`)
- `lib/data/carrier-actions.ts` (line 85: `.eq('carrier_name', carrier)`)

**Issue:**
The migration file creates a column named `carrier`, but the TypeScript database types and all code references use `carrier_name`. This will cause runtime errors.

**Evidence:**
```sql
-- schema_carrier_defaults.sql:9
CREATE TABLE IF NOT EXISTS public.carrier_defaults (
  carrier text NOT NULL,  -- ⚠️ Column name is 'carrier'
```

```typescript
// types/database.ts:93
carrier_name: string  // ⚠️ Type expects 'carrier_name'
```

**Why it matters:**
This will cause all database operations to fail with "column does not exist" errors. The migration needs to be fixed or the code needs to match the actual schema.

**Recommended fix:**
Either:
1. Update migration to use `carrier_name` (preferred for consistency with other tables)
2. Or update all code references to use `carrier`

**Impact:** Complete feature failure - all carrier template operations will fail

---

#### P0-3: Missing Server-Side Validation for Carrier Name
**Files:**
- `lib/data/carrier-actions.ts` (lines 114-128, 211-218)
- `app/dashboard/settings/page.tsx` (lines 745-748)

**Issue:**
Server actions accept carrier names without validation. Only client-side validation exists (trim + non-empty check). No length limits, no sanitization, no uniqueness check (case-insensitive).

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:114
export async function saveCarrierDefaults(
  carrier: string,  // ⚠️ No validation
  organizationId: string,
  // ...
) {
  if (!carrier || !organizationId) {
    throw new Error('Carrier and organization ID are required')
  }
  // No length check, no trim, no uniqueness check
}
```

**Why it matters:**
- Extremely long carrier names could cause database errors or UI issues
- Duplicate carriers with different casing ("Maersk" vs "maersk") could be created
- SQL injection risk if carrier name is used in raw queries (currently not, but defensive)

**Recommended fix:**
Add server-side validation:
```typescript
const carrierName = carrier.trim()
if (!carrierName || carrierName.length === 0) {
  throw new Error('Carrier name cannot be empty')
}
if (carrierName.length > 100) {
  throw new Error('Carrier name must be 100 characters or less')
}
// Check uniqueness case-insensitively
const existing = await supabase
  .from('carrier_defaults')
  .select('carrier_name')
  .eq('organization_id', organizationId)
  .ilike('carrier_name', carrierName)
  .single()
if (existing.data) {
  throw new Error(`Carrier "${carrierName}" already exists`)
}
```

**Impact:** Data integrity issues, potential UI crashes, duplicate carriers

---

### P1 - HIGH: Could cause wrong fees/alerts or major confusion

#### P1-1: Missing Server-Side Validation for Numeric Fields
**Files:**
- `lib/data/carrier-actions.ts` (lines 114-143)
- `app/dashboard/settings/page.tsx` (lines 652-717)

**Issue:**
Free days and flat rates are accepted without server-side validation. Client-side has `min="0"` and `max="30"` for free days, but server doesn't enforce these.

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:139-142
demurrage_free_days: options?.demurrage_free_days,  // ⚠️ No validation
detention_free_days: options?.detention_free_days,  // ⚠️ No validation
demurrage_flat_rate: options?.demurrage_flat_rate,   // ⚠️ No validation
detention_flat_rate: options?.detention_flat_rate,  // ⚠️ No validation
```

**Why it matters:**
- Negative values could cause calculation errors
- Extremely large values could cause overflow or UI display issues
- Non-integer free days could cause date calculation errors
- Negative flat rates don't make business sense

**Recommended fix:**
Add server-side validation:
```typescript
if (options?.demurrage_free_days !== undefined) {
  const days = Math.floor(options.demurrage_free_days)
  if (days < 0 || days > 365) {
    throw new Error('Demurrage free days must be between 0 and 365')
  }
  defaultsData.demurrage_free_days = days
}
if (options?.demurrage_flat_rate !== undefined) {
  const rate = Number(options.demurrage_flat_rate)
  if (isNaN(rate) || rate < 0 || rate > 100000) {
    throw new Error('Demurrage flat rate must be between 0 and 100,000')
  }
  defaultsData.demurrage_flat_rate = rate
}
```

**Impact:** Wrong fee calculations, potential crashes

---

#### P1-2: Missing Server-Side Tier Validation
**Files:**
- `lib/data/carrier-actions.ts` (lines 114-143)
- `components/forms/AddContainerForm.tsx` (lines 294-299, 329-334)

**Issue:**
Tier arrays are saved without server-side validation. Client-side validation exists (`validateTierConfiguration`) but is not called in server actions.

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:137-138
demurrage_tiers: normalizeTiers(demurrageTiers),  // ⚠️ No validation
detention_tiers: normalizeTiers(detentionTiers),  // ⚠️ No validation
```

**Why it matters:**
- Invalid tier configurations (overlaps, negative values, invalid ranges) could be saved
- This could cause fee calculation errors or crashes
- Malicious clients could send malformed tier data

**Recommended fix:**
Import and use `validateTierConfiguration` in server actions:
```typescript
import { validateTierConfiguration } from '@/lib/tierUtils'

const demurrageValidation = validateTierConfiguration(demurrageTiers, 'Demurrage')
if (!demurrageValidation.valid) {
  throw new Error(`Invalid demurrage tiers: ${demurrageValidation.errors.join(', ')}`)
}
```

**Impact:** Wrong fee calculations, potential crashes

---

#### P1-3: Missing Delete Confirmation Dialog
**Files:**
- `app/dashboard/settings/page.tsx` (lines 495-512)

**Issue:**
Delete button directly calls `deleteCarrierDefaults` without confirmation. Only a toast shows after deletion.

**Evidence:**
```typescript
// app/dashboard/settings/page.tsx:498-509
<Button
  variant="destructive"
  size="sm"
  onClick={async () => {
    if (!profile?.organization_id) return
    try {
      await deleteCarrierDefaults(cd.carrier_name, profile.organization_id)  // ⚠️ No confirmation
      toast.success(`Deleted defaults for ${cd.carrier_name}`)
```

**Why it matters:**
Accidental clicks could delete important carrier templates. Users expect confirmation for destructive actions.

**Recommended fix:**
Wrap delete button in `AlertDialog` with confirmation, similar to "Clear All Data" (lines 578-607).

**Impact:** Accidental data loss, poor UX

---

#### P1-4: Silent Failure in Auto-Fill
**Files:**
- `components/forms/AddContainerForm.tsx` (lines 280-283)

**Issue:**
Auto-fill failures are logged but not shown to users. If carrier defaults fail to load, the form silently continues with empty/default values.

**Evidence:**
```typescript
// components/forms/AddContainerForm.tsx:280-283
} catch (error) {
  logger.error('Error loading carrier defaults:', error)
  // Silent failure - don't show toast for auto-fill  // ⚠️ User doesn't know it failed
}
```

**Why it matters:**
Users may not realize their carrier template didn't load, leading to incorrect fee configurations. They may think the template is empty when it actually failed to load.

**Recommended fix:**
Show a non-blocking toast or inline message:
```typescript
} catch (error) {
  logger.error('Error loading carrier defaults:', error)
  toast.warning(`Could not load defaults for ${carrier}. Using form defaults.`, { duration: 3000 })
}
```

**Impact:** User confusion, incorrect fee configurations

---

#### P1-5: Missing `detention_free_days` in Auto-Fill
**Files:**
- `components/forms/AddContainerForm.tsx` (lines 263-276)

**Issue:**
Auto-fill sets `free_days` (demurrage) but doesn't set `detention_free_days` even though the template has this field.

**Evidence:**
```typescript
// components/forms/AddContainerForm.tsx:264-276
setFormData(prev => ({
  ...prev,
  free_days: defaults.demurrage_free_days ?? prev.free_days,  // ✅ Sets demurrage free days
  // ...
  detention_tiers: normalizedDetentionTiers,
  detention_flat_rate: defaults.detention_flat_rate ?? 0,
  // ⚠️ Missing: detention_free_days
}))
```

**Why it matters:**
If a carrier template has `detention_free_days: 5` but the form defaults to 7, users will get incorrect detention calculations until they manually change it.

**Recommended fix:**
Add `detention_free_days` to auto-fill:
```typescript
detention_free_days: defaults.detention_free_days ?? prev.detention_free_days,
```

**Impact:** Incorrect detention fee calculations

---

### P2 - MEDIUM: Tech debt / polish

#### P2-1: Duplicated Tier Normalization Logic
**Files:**
- `lib/data/carrier-actions.ts` (lines 47-70: `toTier`, `convertPersistedTiers`, `normalizeTiers`)
- `components/forms/AddContainerForm.tsx` (lines 251-261: inline normalization)

**Issue:**
Tier normalization (from/to ↔ from_day/to_day) is duplicated between server actions and client form. The form has its own normalization logic that mirrors server-side functions.

**Evidence:**
```typescript
// components/forms/AddContainerForm.tsx:251-255
const normalizedDemurrageTiers = (defaults.demurrage_tiers || []).map((t: {...}) => ({
  from_day: t.from ?? t.from_day ?? 1,
  to_day: t.to ?? t.to_day ?? null,
  rate: t.rate ?? 0,
}))
```

**Why it matters:**
- Code duplication increases maintenance burden
- Risk of normalization logic diverging between client and server
- Harder to fix bugs (must fix in multiple places)

**Recommended fix:**
Extract normalization to a shared utility function or ensure server always returns `from_day/to_day` format so client doesn't need to normalize.

**Impact:** Maintenance burden, potential bugs

---

#### P2-2: Naming Inconsistency: `free_days` vs `demurrage_free_days`
**Files:**
- `components/forms/AddContainerForm.tsx` (line 267: `free_days`)
- `lib/data/carrier-actions.ts` (line 19: `demurrage_free_days`)

**Issue:**
Form uses `free_days` for demurrage free days, but carrier defaults use `demurrage_free_days`. This creates confusion and requires mapping.

**Evidence:**
```typescript
// AddContainerForm.tsx:267
free_days: defaults.demurrage_free_days ?? prev.free_days,  // ⚠️ Different field names
```

**Why it matters:**
- Confusing for developers
- Easy to make mistakes when mapping between form and carrier defaults
- Inconsistent with detention which uses `detention_free_days`

**Recommended fix:**
Consider renaming form field to `demurrage_free_days` for consistency, or document the mapping clearly.

**Impact:** Developer confusion, potential bugs

---

#### P2-3: Missing Backward Compatibility Check for Old Schema
**Files:**
- `lib/data/carrier-actions.ts` (lines 96, 289-302)

**Issue:**
Code assumes `defaults` JSONB always has new fields (`demurrage_free_days`, `detention_free_days`, `demurrage_flat_rate`, `detention_flat_rate`). Old rows created before these fields were added may not have them.

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:96
const defaults = (data.defaults as CarrierDefaultsData | null) || {}
return {
  // ...
  demurrage_free_days: defaults.demurrage_free_days,  // ⚠️ May be undefined for old rows
  detention_free_days: defaults.detention_free_days,  // ⚠️ May be undefined for old rows
}
```

**Why it matters:**
While optional chaining (`?.`) handles undefined, the code doesn't explicitly document or handle migration of old rows. If old rows exist, they may have inconsistent data.

**Recommended fix:**
Add explicit defaults or migration logic:
```typescript
demurrage_free_days: defaults.demurrage_free_days ?? null,
detention_free_days: defaults.detention_free_days ?? null,
```

**Impact:** Potential data inconsistencies for existing rows

---

#### P2-4: No Rate Limiting or Abuse Prevention
**Files:**
- `lib/data/carrier-actions.ts` (all functions)

**Issue:**
No rate limiting on carrier template create/update/delete operations. A malicious user could spam create/delete operations.

**Why it matters:**
- Could cause database load
- Could create many orphaned or test carrier templates
- No protection against accidental rapid clicks

**Recommended fix:**
Add rate limiting middleware or check for rapid operations. Consider adding a cooldown period for delete operations.

**Impact:** Potential abuse, database load

---

#### P2-5: Missing Index on `carrier_name` for Case-Insensitive Lookups
**Files:**
- `supabase/migrations/schema_carrier_defaults.sql` (lines 20-22)

**Issue:**
Indexes exist on `carrier` and `organization_id`, but no case-insensitive index for uniqueness checks.

**Evidence:**
```sql
-- schema_carrier_defaults.sql:20-22
CREATE INDEX IF NOT EXISTS idx_carrier_defaults_organization_id ON public.carrier_defaults(organization_id);
CREATE INDEX IF NOT EXISTS idx_carrier_defaults_carrier ON public.carrier_defaults(carrier);
```

**Why it matters:**
If uniqueness checks are done case-insensitively (recommended in P0-3), queries will be slower without a proper index.

**Recommended fix:**
Add a case-insensitive index or use a unique constraint with case-insensitive comparison:
```sql
CREATE UNIQUE INDEX idx_carrier_defaults_org_carrier_ci 
ON public.carrier_defaults(organization_id, LOWER(carrier));
```

**Impact:** Slower uniqueness checks

---

## Detailed Findings by Category

### A) Multi-tenancy & Authorization

**Status:** ❌ **FAIL**

**Findings:**
1. **Server actions trust client-provided `organizationId`** (P0-1)
   - All functions in `carrier-actions.ts` accept `organizationId` as parameter
   - No verification that authenticated user belongs to that organization
   - RLS policies provide defense-in-depth but server should also verify

2. **RLS policies exist and are correct**
   - `schema_carrier_defaults.sql` lines 29-66 define proper RLS policies
   - Policies check `auth.uid()` matches profile's `organization_id`
   - Policies cover SELECT, INSERT, UPDATE, DELETE

3. **No use of `getServerAuthContext()`**
   - Unlike `containers-actions.ts` which uses `getServerAuthContext()`
   - Carrier actions use `createClient()` directly and trust parameters

**Recommendation:**
Refactor all carrier server actions to use `getServerAuthContext()` and remove `organizationId` parameter.

---

### B) Input Validation & Trust Boundaries

**Status:** ❌ **FAIL**

**Findings:**
1. **Carrier name validation missing** (P0-3)
   - No length limits
   - No case-insensitive uniqueness check
   - Only client-side trim + non-empty check

2. **Numeric field validation missing** (P1-1)
   - Free days: no server-side min/max
   - Flat rates: no server-side min/max
   - No integer validation for free days

3. **Tier validation missing** (P1-2)
   - Client validates but server doesn't
   - Malicious clients could send invalid tiers

4. **Client-side validation exists but insufficient**
   - Settings page: trim + non-empty (line 745-748)
   - Add Container form: tier validation before save (lines 294-299, 329-334)
   - But server should also validate

**Recommendation:**
Add comprehensive server-side validation for all inputs.

---

### C) Data Integrity & Migrations

**Status:** ⚠️ **PARTIAL**

**Findings:**
1. **Schema mismatch** (P0-2)
   - Migration uses `carrier`, code uses `carrier_name`
   - This will cause runtime failures

2. **Backward compatibility** (P2-3)
   - Code handles missing new fields with optional chaining
   - But no explicit migration or documentation

3. **JSONB field preservation**
   - `saveCarrierDefaults` replaces entire `defaults` JSONB (line 151)
   - This is correct - doesn't drop unknown fields if using spread operator
   - But code doesn't use spread, so unknown fields ARE dropped

**Evidence:**
```typescript
// lib/data/carrier-actions.ts:136-143
const defaultsData: CarrierDefaultsData = {
  demurrage_tiers: normalizeTiers(demurrageTiers),
  detention_tiers: normalizeTiers(detentionTiers),
  demurrage_free_days: options?.demurrage_free_days,
  // ... ⚠️ This replaces entire object, dropping any unknown fields
}
```

**Recommendation:**
1. Fix schema mismatch immediately
2. Preserve unknown fields in JSONB when updating:
   ```typescript
   const existingDefaults = existing ? (existing.defaults as CarrierDefaultsData || {}) : {}
   const defaultsData: CarrierDefaultsData = {
     ...existingDefaults,  // Preserve unknown fields
     demurrage_tiers: normalizeTiers(demurrageTiers),
     // ... update known fields
   }
   ```

---

### D) UX Safety & Guardrails

**Status:** ⚠️ **PARTIAL**

**Findings:**
1. **Delete confirmation missing** (P1-3)
   - Delete button has no confirmation dialog
   - Only toast after deletion

2. **Auto-fill overwrites correctly** ✅
   - Only overwrites fee-related fields (lines 264-276)
   - Doesn't touch unrelated fields like `container_no`, `pod`, etc.

3. **Manual overrides work** ✅
   - Users can edit fields after auto-fill
   - Changes persist correctly

4. **Loading/empty states fixed** ✅
   - No `value=""` SelectItem (fixed in recent changes)
   - Proper conditional rendering

5. **Silent failures** (P1-4)
   - Auto-fill errors not shown to users

**Recommendation:**
Add delete confirmation dialog and show non-blocking warnings for auto-fill failures.

---

### E) Error Handling & Observability

**Status:** ⚠️ **PARTIAL**

**Findings:**
1. **Errors are logged** ✅
   - `logger.error()` calls present (lines 507, 784, 281)

2. **Errors surfaced to users** ✅
   - Toast notifications for most errors
   - Settings page shows error messages

3. **Silent failures** (P1-4)
   - Auto-fill failures logged but not shown to users

4. **Error messages are actionable** ✅
   - Most errors include context (carrier name, operation type)

5. **No Sentry integration visible**
   - Only `logger.error()` - need to verify if logger sends to Sentry

**Recommendation:**
Show non-blocking warnings for auto-fill failures. Verify logger integration with Sentry.

---

### F) Performance & Caching

**Status:** ✅ **PASS**

**Findings:**
1. **Revalidation in place** ✅
   - `revalidatePath('/dashboard')` called after save/delete (lines 163, 192, 243, 266)

2. **No excessive refetching** ✅
   - Carriers loaded once when form opens (useEffect with dependencies)
   - Settings page loads carriers once on mount

3. **Refresh after edits** ✅
   - Settings page refetches after save (line 780)
   - Add Container form would need manual refresh, but form is typically closed after use

**Recommendation:**
No changes needed. Consider adding SWR or React Query for automatic cache invalidation if this becomes a pain point.

---

### G) Code Quality & Maintainability

**Status:** ⚠️ **PARTIAL**

**Findings:**
1. **Duplicated tier normalization** (P2-1)
   - Server and client both normalize tiers
   - Risk of logic divergence

2. **Naming inconsistencies** (P2-2)
   - `free_days` vs `demurrage_free_days`
   - Confusing for developers

3. **Complex tier normalization**
   - `toTier`, `convertPersistedTiers`, `normalizeTiers` functions
   - Handles both `from/to` and `from_day/to_day` formats
   - Necessary but complex

4. **Type safety** ✅
   - TypeScript types defined
   - Database types imported

5. **Code organization** ✅
   - Server actions separated from UI
   - Utility functions in separate files

**Recommendation:**
1. Extract shared tier normalization to utility
2. Standardize naming (`demurrage_free_days` everywhere)
3. Add JSDoc comments explaining tier format conversion

---

## Recommendations Summary

### Immediate Actions (P0)
1. **Fix schema mismatch** - Update migration or code to use consistent column name
2. **Add server-side organization verification** - Use `getServerAuthContext()` instead of trusting client input
3. **Add server-side carrier name validation** - Length limits, uniqueness (case-insensitive)

### High Priority (P1)
1. **Add server-side numeric validation** - Free days and flat rates
2. **Add server-side tier validation** - Use `validateTierConfiguration`
3. **Add delete confirmation dialog**
4. **Show auto-fill failure warnings**
5. **Add `detention_free_days` to auto-fill**

### Medium Priority (P2)
1. **Extract shared tier normalization**
2. **Standardize naming** (`demurrage_free_days` everywhere)
3. **Preserve unknown JSONB fields on update**
4. **Add rate limiting**
5. **Add case-insensitive index for uniqueness checks**

---

## Conclusion

The Carrier Fee Templates feature has a solid foundation but requires critical security and validation fixes before production deployment. The most urgent issues are:

1. **Schema mismatch** (P0-2) - Will cause complete feature failure
2. **Missing organization verification** (P0-1) - Security risk
3. **Missing server-side validation** (P0-3, P1-1, P1-2) - Data integrity risk

Once these are addressed, the feature should be production-ready with the P1 and P2 improvements for polish and maintainability.

---

**Report Generated:** 2025-01-27  
**Files Audited:** 6 files, 3 migrations  
**Issues Found:** 13 (3 P0, 5 P1, 5 P2)

