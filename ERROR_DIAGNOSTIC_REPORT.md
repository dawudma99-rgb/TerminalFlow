# TerminalFlow Codebase Error Diagnostic Report

Generated: $(date)

## 1. TypeScript Typecheck Errors Summary

### Files with Type Errors (Grouped)

#### `app/dashboard/containers/page.tsx`
- **Error count:** 8
- **Error types:**
  - Property 'pol' does not exist on type 'ContainerRecordWithComputed' (4 occurrences)
  - Property 'pod' does not exist on type 'ContainerRecordWithComputed' (2 occurrences)
  - Object literal may only specify known properties, and 'pol' does not exist (1 occurrence)
  - Cannot find name 'LoadingState' (1 occurrence)
  - Property 'warning' does not exist on type (1 occurrence)

#### `tests/components/layout/Sidebar.test.tsx`
- **Error count:** 15
- **Error types:**
  - Cannot find module '@jest/globals' or '@testing-library/react' (2 occurrences)
  - Cannot find name 'describe', 'test', 'expect', 'afterEach' (13 occurrences - missing test type definitions)

#### `lib/data/containers-actions.ts`
- **Error count:** 6
- **Error types:**
  - Property 'pol' does not exist on type (2 occurrences)
  - Property 'pod' does not exist on type (2 occurrences)
  - Conversion of type 'ContainerWithDerivedFields[]' to type 'ContainerRecordWithComputed[]' may be a mistake (1 occurrence)
  - Type mismatch between ContainerWithDerivedFields and ContainerRecordWithComputed (1 occurrence)

#### `components/ui/AttentionCard.tsx`
- **Error count:** 5
- **Error types:**
  - 'daysLeft' is possibly 'undefined' (3 occurrences)
  - Argument of type 'number | undefined' is not assignable to parameter of type 'number' (2 occurrences)

#### `components/layout/Sidebar.tsx`
- **Error count:** 4
- **Error types:**
  - Property 'icon' does not exist on type (1 occurrence)
  - Property 'children' does not exist on type (2 occurrences)
  - Parameter 'child' implicitly has an 'any' type (1 occurrence)

#### `app/dashboard/containers/components/AddContainerTrigger.tsx`
- **Error count:** 2
- **Error types:**
  - Conversion of type may be a mistake - missing properties 'organization_id', 'port' (1 occurrence)
  - Type mismatch: Property 'bl_number' is missing in type 'ContainerFormData' (1 occurrence)

#### `app/dashboard/containers/components/ContainerTable.tsx`
- **Error count:** 3
- **Error types:**
  - Module declares 'ContainerMilestone' locally, but it is not exported (1 occurrence)
  - Property 'pol' does not exist on type 'ContainerRecordWithComputed' (1 occurrence)
  - Property 'pod' does not exist on type 'ContainerRecordWithComputed' (1 occurrence)

#### `components/forms/AddContainerForm.tsx`
- **Error count:** 2
- **Error types:**
  - Type 'string | null' is not assignable to type 'string | undefined' (2 occurrences)

#### `app/dashboard/containers/hooks/useContainerFilters.ts`
- **Error count:** 2
- **Error types:**
  - Property 'pol' does not exist on type 'ContainerRecordWithComputed' (1 occurrence)
  - Property 'pod' does not exist on type 'ContainerRecordWithComputed' (1 occurrence)

#### `lib/utils/navigation.ts`
- **Error count:** 2
- **Error types:**
  - Expected 1-2 arguments, but got 3 (1 occurrence)
  - No overload matches this call (1 occurrence)

#### `app/dashboard/containers/import-test/commit/route.ts`
- **Error count:** 2
- **Error types:**
  - Argument of type 'unknown' is not assignable to parameter of type 'string' (1 occurrence)
  - Type 'unknown' cannot be used as an index type (1 occurrence)

#### `app/dashboard/containers/import-test/dry-run/route.ts`
- **Error count:** 2
- **Error types:**
  - Argument of type 'unknown' is not assignable to parameter of type 'string' (1 occurrence)
  - Type 'unknown' cannot be used as an index type (1 occurrence)

#### `app/dashboard/containers/import-test/preview/route.ts`
- **Error count:** 2
- **Error types:**
  - Argument of type 'unknown' is not assignable to parameter of type 'string' (1 occurrence)
  - Type 'unknown' cannot be used as an index type (1 occurrence)

#### `lib/analytics/analytics-utils.ts`
- **Error count:** 2
- **Error types:**
  - Property 'pod' does not exist on type 'ContainerRecordWithComputed' (2 occurrences)

#### `lib/constants/nav.ts`
- **Error count:** 2
- **Error types:**
  - Property 'children' does not exist on type (2 occurrences)

#### `components/import/ImportDialog.tsx`
- **Error count:** 1
- **Error types:**
  - Conversion of type may be a mistake - missing properties from ChangeEvent (1 occurrence)

#### `lib/data/alerts-actions.ts`
- **Error count:** 1
- **Error types:**
  - Object literal may only specify known properties, and 'seen_at' does not exist (1 occurrence)

#### `lib/data/alerts-logic.ts`
- **Error count:** 1
- **Error types:**
  - Cannot find name 'newDaysLeft' (1 occurrence)

#### `lib/import/parser.ts`
- **Error count:** 2
- **Error types:**
  - Could not find a declaration file for module 'papaparse' (1 occurrence)
  - Parameter 'h' implicitly has an 'any' type (1 occurrence)

#### `lib/utils/containers.ts`
- **Error count:** 1
- **Error types:**
  - Property 'lfd_date' does not exist on type 'ContainerRecord' (1 occurrence)

#### `lib/analytics/history-utils.ts`
- **Error count:** 1
- **Error types:**
  - Property 'payload' does not exist on type 'HistoryEvent' (1 occurrence)

#### `tests/lib/utils/milestones.test.ts`
- **Error count:** 1
- **Error types:**
  - Cannot find module '../../lib/utils/milestones' (1 occurrence)

---

## 2. ESLint Errors Summary

### Files with ESLint Errors (Grouped)

#### `lib/import/parser.ts`
- **Error count:** 20
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (10 occurrences)
  - `prefer-const` – Variables never reassigned should use 'const' (6 occurrences)
  - `@typescript-eslint/no-unused-vars` – 'isCsv' is assigned but never used (1 occurrence)

#### `components/import/ImportDialog.tsx`
- **Error count:** 15
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (13 occurrences)
  - `react/no-unescaped-entities` – Apostrophe should be escaped (1 occurrence)

#### `lib/import/header-map.ts`
- **Error count:** 10
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (2 occurrences)
  - `prefer-const` – Variables never reassigned should use 'const' (6 occurrences)
  - `@typescript-eslint/no-unused-vars` – Unused imports/variables (2 occurrences)

#### `app/dashboard/containers/import-test/commit/route.ts`
- **Error count:** 5
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (4 occurrences)
  - `prefer-const` – Variable never reassigned (1 occurrence)
  - `@typescript-eslint/no-unused-vars` – Variable assigned but never used (1 occurrence)

#### `app/dashboard/containers/import-test/preview/route.ts`
- **Error count:** 4
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (4 occurrences)

#### `app/dashboard/containers/import-test/dry-run/route.ts`
- **Error count:** 4
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (4 occurrences)

#### `lib/data/import-commit.ts`
- **Error count:** 6
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (5 occurrences)
  - `prefer-const` – Variable never reassigned (1 occurrence)
  - `@typescript-eslint/no-unused-vars` – Variable assigned but never used (1 occurrence)

#### `lib/import/validate.ts`
- **Error count:** 7
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (5 occurrences)
  - `prefer-const` – Variable never reassigned (1 occurrence)
  - `@typescript-eslint/no-unused-vars` – Variable assigned but never used (1 occurrence)

#### `components/alerts/AlertsBell.tsx`
- **Error count:** 5
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (4 occurrences)
  - `@typescript-eslint/no-unused-vars` – Variables assigned but never used (2 occurrences)

#### `app/dashboard/containers/page.tsx`
- **Error count:** 3
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)
  - `react/jsx-no-undef` – 'LoadingState' is not defined (1 occurrence)
  - `@typescript-eslint/no-unused-vars` – Variables assigned but never used (2 occurrences)

#### `lib/data/export-actions.ts`
- **Error count:** 3
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (3 occurrences)

#### `lib/data/history-actions.ts`
- **Error count:** 3
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (3 occurrences)

#### `lib/hooks/useRealtimeAlerts.ts`
- **Error count:** 2
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)
  - `react-hooks/exhaustive-deps` – Variable accessed before declaration (1 occurrence)

#### `lib/import/error-report.ts`
- **Error count:** 2
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (2 occurrences)

#### `lib/csv/containers-serializer.ts`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### `components/alerts/DashboardAlertsPanel.tsx`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### `app/dashboard/containers/export-test/route.ts`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### `app/dashboard/containers/export/route.ts`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### `app/dashboard/containers/import-test/parse/route.ts`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### `lib/analytics/history-utils.ts`
- **Error count:** 1
- **Rule violations:**
  - `@typescript-eslint/no-explicit-any` – Unexpected any types (1 occurrence)

#### Files with Warnings Only (17 warnings total)
- `app/dashboard/containers/components/AddContainerTrigger.tsx` – 1 warning (unused variable)
- `app/dashboard/containers/components/ContainerTable.tsx` – 2 warnings (unused error variables)
- `app/dashboard/containers/components/EmptyStates.tsx` – 1 warning (unused import)
- `app/dashboard/containers/page.tsx` – 2 warnings (unused variables)
- `components/alerts/AlertsBell.tsx` – 2 warnings (unused variables)
- `components/import/ImportDialog.tsx` – 1 warning (unused import)
- `lib/data/alerts-actions.ts` – 1 warning (unused function)
- `lib/data/containers-actions.ts` – 1 warning (unused function)
- `lib/email/sendAlertEmail.ts` – 1 warning (unused variable)
- `lib/import/header-map.ts` – 2 warnings (unused imports)
- `lib/import/parser.ts` – 1 warning (unused variable)
- `lib/import/validate.ts` – 1 warning (unused variable)

---

## 3. High-Level Overview

### Scale of Issues
- **Total TypeScript errors:** 60 errors across 22 files
- **Total ESLint errors:** 89 errors + 17 warnings across 30 files
- **Total affected files:** ~35 unique files (some files have both TS and ESLint errors)

### Biggest Problem Areas

#### 1. **`app/dashboard/containers/**`** (Containers Module)
- **TypeScript:** 19 errors across 7 files
- **ESLint:** 18 errors + 4 warnings across 8 files
- **Key issues:**
  - Missing `pol` and `pod` properties on `ContainerRecordWithComputed` type (appears in 8+ files)
  - Type mismatches between `ContainerFormData` and container creation types
  - Missing type definitions for import/export route handlers
  - Undefined `LoadingState` component

#### 2. **`lib/import/**`** (Import/Export System)
- **TypeScript:** 4 errors
- **ESLint:** 48 errors + 4 warnings
- **Key issues:**
  - Extensive use of `any` types (30+ occurrences)
  - Missing type definitions for CSV parsing (`papaparse` module)
  - `prefer-const` violations (variables that should be `const`)
  - Unused variables and imports

#### 3. **`components/**`** (UI Components)
- **TypeScript:** 12 errors across 4 files
- **ESLint:** 21 errors + 5 warnings across 3 files
- **Key issues:**
  - Type mismatches in form components (`null` vs `undefined`)
  - Missing properties on navigation types (`icon`, `children`)
  - Possibly undefined values in `AttentionCard` component
  - Extensive `any` usage in `ImportDialog`

#### 4. **`lib/data/**`** (Data Layer)
- **TypeScript:** 8 errors across 4 files
- **ESLint:** 12 errors + 2 warnings across 4 files
- **Key issues:**
  - Type mismatches between `ContainerWithDerivedFields` and `ContainerRecordWithComputed`
  - Missing `pol`/`pod` properties
  - `any` types in export/history actions
  - Unused helper functions

#### 5. **`tests/**`** (Test Files)
- **TypeScript:** 16 errors across 2 files
- **ESLint:** 0 errors
- **Key issues:**
  - Missing test type definitions (`@types/jest` or `@types/mocha`)
  - Missing test dependencies (`@jest/globals`, `@testing-library/react`)
  - Missing module (`lib/utils/milestones`)

### Common Error Patterns

#### TypeScript Errors:
1. **Missing properties on types** (30+ occurrences)
   - `pol` and `pod` missing from `ContainerRecordWithComputed` (appears in 10+ files)
   - `icon` and `children` missing from navigation types
   - `lfd_date` missing from `ContainerRecord`
   - `payload` missing from `HistoryEvent`

2. **Type mismatches** (15+ occurrences)
   - `string | null` vs `string | undefined` (2 occurrences)
   - `ContainerWithDerivedFields` vs `ContainerRecordWithComputed` (2 occurrences)
   - Conversion type errors (3 occurrences)

3. **Missing type definitions** (5 occurrences)
   - `papaparse` module
   - Test framework types
   - Missing exports (`ContainerMilestone`)

4. **Undefined/null safety** (5 occurrences)
   - Possibly undefined values (`daysLeft`, `newDaysLeft`)
   - Unknown types used as index types

#### ESLint Errors:
1. **Explicit `any` types** (70+ occurrences)
   - Most common issue across the codebase
   - Concentrated in import/export, alerts, and data action files

2. **Unused variables/imports** (17 warnings)
   - Unused error variables in catch blocks
   - Unused helper functions
   - Unused imports

3. **`prefer-const` violations** (15+ occurrences)
   - Variables that are never reassigned should use `const`
   - Mostly in date parsing and import logic

4. **React-specific issues** (2 occurrences)
   - Undefined component (`LoadingState`)
   - Hook dependency issue (`useRealtimeAlerts`)

### Top 5 Worst Files (by total error count)

1. **`lib/import/parser.ts`**
   - TypeScript: 2 errors
   - ESLint: 20 errors
   - **Total: 22 issues**
   - Main problems: Extensive `any` usage, missing type definitions, `prefer-const` violations

2. **`components/import/ImportDialog.tsx`**
   - TypeScript: 1 error
   - ESLint: 15 errors
   - **Total: 16 issues**
   - Main problems: Extensive `any` usage, unescaped entities

3. **`app/dashboard/containers/page.tsx`**
   - TypeScript: 8 errors
   - ESLint: 3 errors
   - **Total: 11 issues**
   - Main problems: Missing `pol`/`pod` properties, undefined `LoadingState`, unused variables

4. **`lib/import/header-map.ts`**
   - TypeScript: 0 errors
   - ESLint: 10 errors
   - **Total: 10 issues**
   - Main problems: `prefer-const` violations, `any` types, unused imports

5. **`tests/components/layout/Sidebar.test.tsx`**
   - TypeScript: 15 errors
   - ESLint: 0 errors
   - **Total: 15 issues**
   - Main problems: Missing test type definitions (infrastructure issue, not code quality)

### Recommendations for Staged Cleanup

1. **Phase 1: Infrastructure fixes**
   - Install missing type definitions (`@types/papaparse`, `@types/jest`)
   - Fix missing module exports (`ContainerMilestone`)
   - Resolve missing test dependencies

2. **Phase 2: Type system fixes**
   - Add missing properties to `ContainerRecordWithComputed` (`pol`, `pod`)
   - Fix type mismatches between form data and container types
   - Resolve `null` vs `undefined` inconsistencies

3. **Phase 3: Import/Export system**
   - Replace `any` types with proper interfaces
   - Fix `prefer-const` violations
   - Remove unused variables/imports

4. **Phase 4: Component fixes**
   - Fix undefined value handling (`daysLeft`, `LoadingState`)
   - Resolve navigation type issues
   - Fix React hook dependencies

5. **Phase 5: Cleanup**
   - Remove unused variables and imports
   - Fix remaining `any` types in data layer
   - Final pass on all warnings

---

## Summary Statistics

- **Total TypeScript errors:** 60
- **Total ESLint errors:** 89
- **Total ESLint warnings:** 17
- **Total issues:** 166
- **Files with TypeScript errors:** 22
- **Files with ESLint errors/warnings:** 30
- **Unique files affected:** ~35

### Error Distribution by Category

**TypeScript:**
- Missing properties: ~35 errors
- Type mismatches: ~15 errors
- Missing definitions: ~5 errors
- Undefined/null safety: ~5 errors

**ESLint:**
- Explicit `any` types: ~70 errors
- Unused variables/imports: ~17 warnings
- `prefer-const` violations: ~15 errors
- React-specific: ~2 errors

