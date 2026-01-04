# Settings Page End-to-End Analysis

## Entry Point

### Route/Page
- **File**: `dnd-copilot-next/app/dashboard/settings/page.tsx`
- **Route**: `/dashboard/settings`
- **Component Type**: **Client Component** (marked with `'use client'` directive on line 1)

### Route Protection
- **Middleware**: `dnd-copilot-next/middleware.ts`
  - Matches: `/dashboard/:path*` (line 38)
  - Protection logic (lines 24-29): If no authenticated user and path starts with `/dashboard`, redirects to `/login` with `redirectedFrom` query parameter
  - Uses `supabase.auth.getUser()` to check authentication

### Component Type
- **Client Component**: The page is a Client Component because:
  - Uses React hooks (`useState`, `useEffect`)
  - Uses client-side hooks (`useAuth`, `useRouter`)
  - Handles user interactions and local state
  - Calls server actions from client-side event handlers

---

## UI Sections

The Settings page is divided into 6 main sections, each rendered as a `Card` component:

### 1. Header Section (lines 244-259)
- **Title**: "Settings & Configuration" with Settings icon
- **Description**: "Manage fee defaults, carrier presets, and organization data controls."
- **Action**: "Save Settings" button (top-right) that calls `handleSaveSettings()`

### 2. Fee Configuration Section (lines 262-312)
- **Card Title**: "Fee Configuration" with DollarSign icon
- **Fields**:
  - **Demurrage Daily Rate** (`demurrageDailyRate`): Number input, min 0, step 0.01, in £
  - **Detention Daily Rate** (`detentionDailyRate`): Number input, min 0, step 0.01, in £
- **Purpose**: Set default daily rates for demurrage and detention charges

### 3. Free Days Configuration Section (lines 315-365)
- **Card Title**: "Free Days Configuration" with Calendar icon
- **Fields**:
  - **Demurrage Free Days** (`demFreeDays`): Number input, min 0, max 30
  - **Detention Free Days** (`detFreeDays`): Number input, min 0, max 30
- **Purpose**: Configure number of free days before charges apply

### 4. Weekend Charging Section (lines 368-390)
- **Card Title**: "Weekend Charging"
- **Field**: 
  - **Weekend Chargeable** (`weekendChargeable`): Switch/toggle component
- **Purpose**: Toggle whether weekends are included in detention calculations
- **Note**: When unchecked, weekends are excluded from detention free day calculations

### 5. Alert Settings Section (lines 393-424)
- **Card Title**: "Alert Settings" with Bell icon
- **Field**:
  - **Days Before Free Time Warning** (`daysBeforeFreeTimeWarning`): Number input, min 1, max 14, default 2
- **Purpose**: Configure when containers enter "Warning" status before free time expires

### 6. Carrier Defaults Section (lines 427-505)
- **Card Title**: "Carrier Defaults" with Package icon
- **Features**:
  - Lists all carrier defaults for the organization
  - Each carrier shows: name, count of demurrage/detention tiers
  - **Edit** button: Opens modal to edit carrier tiers
  - **Delete** button: Removes carrier defaults (with confirmation via toast)
  - **Add Carrier Default** button: Opens modal to create new carrier default
- **Modal** (lines 580-667): 
  - Shows `DemurrageTierEditor` and `DetentionTierEditor` components
  - For new carriers: includes carrier name input field
  - Saves via `saveCarrierDefaults()` server action

### 7. Data Management Section (lines 508-577)
- **Card Title**: "Data Management" with Database icon
- **Actions**:
  - **Export Data**: Downloads JSON file with all organization data (containers, history, profiles)
  - **Import Data**: Uploads JSON file to import containers
  - **Seed Demo Data**: Inserts 3 sample containers for testing
  - **Clear All Data**: Deletes all containers and history (requires confirmation dialog)
- **Scope**: All actions are organization-scoped

---

## Data Sources

### On Page Load

#### 1. User Authentication & Profile
- **Source**: `useAuth()` hook from `@/lib/auth/useAuth`
- **Implementation**: 
  - Uses Supabase client (`@/lib/supabase/client`)
  - Fetches session via `supabase.auth.getSession()`
  - Fetches profile from `profiles` table where `id = user.id`
- **Returns**: `{ user, profile, loading, status, authError, refreshProfile }`
- **Database Table**: `profiles`
  - Fields accessed: `id`, `organization_id`, `settings` (JSONB)

#### 2. Settings Data
- **Server Action**: `loadSettings()` from `@/lib/data/settings-actions`
- **File**: `dnd-copilot-next/lib/data/settings-actions.ts` (lines 19-39)
- **Implementation**:
  - Calls `getServerAuthContext()` to get authenticated user and profile
  - Reads `profile.settings` JSONB column
  - Merges with defaults if settings don't exist
- **Database Table**: `profiles`
  - Field: `settings` (JSONB column)
  - Default values (lines 20-27):
    ```typescript
    {
      demurrageDailyRate: 80,
      detentionDailyRate: 50,
      demFreeDays: 7,
      detFreeDays: 7,
      weekendChargeable: true,
      daysBeforeFreeTimeWarning: 2
    }
    ```
- **Called in**: `useEffect` hook (line 91) after auth loads

#### 3. Carrier Defaults Data
- **Server Action**: `getAllCarrierDefaults(organizationId)` from `@/lib/data/carrier-actions`
- **File**: `dnd-copilot-next/lib/data/carrier-actions.ts` (lines 201-229)
- **Implementation**:
  - Queries `carrier_defaults` table
  - Filters by `organization_id`
  - Orders by `carrier_name` ascending
  - Converts persisted tier format (`from`/`to`) to app format (`from_day`/`to_day`)
- **Database Table**: `carrier_defaults`
  - Fields: `id`, `organization_id`, `carrier_name`, `defaults` (JSONB)
  - JSONB structure: `{ demurrage_tiers: [], detention_tiers: [] }`
- **Called in**: `useEffect` hook (line 99) after settings load, only if `profile.organization_id` exists

---

## State Management

### Local State (React useState)

All state is managed locally in the component using `useState`:

1. **`settings`** (line 58): `Settings | null`
   - Stores the current settings object
   - Updated via `setSettings()` when user edits form fields

2. **`settingsLoading`** (line 59): `boolean`
   - Tracks loading state for initial settings fetch

3. **`saving`** (line 60): `boolean`
   - Tracks saving state for settings save operation

4. **`importing`** (line 61): `boolean`
   - Tracks import operation state

5. **`clearing`** (line 62): `boolean`
   - Tracks clear data operation state

6. **`seeding`** (line 63): `boolean`
   - Tracks seed demo data operation state

7. **`carrierDefaults`** (line 64): `CarrierDefaults[]`
   - Array of all carrier defaults for the organization
   - Updated after save/delete operations

8. **`loadingCarriers`** (line 65): `boolean`
   - Tracks loading state for carrier defaults fetch

9. **`editingCarrier`** (line 66): `string | null`
   - ID of carrier being edited, or `'new'` for new carrier
   - Controls modal visibility

10. **`editingCarrierName`** (line 67): `string`
    - Name of carrier being edited/created

11. **`demurrageTiers`** (line 68): `Tier[]`
    - Tiers for the carrier being edited

12. **`detentionTiers`** (line 69): `Tier[]`
    - Tiers for the carrier being edited

13. **`savingCarrier`** (line 70): `boolean`
    - Tracks saving state for carrier defaults

### Context/Providers

- **`useAuth()`**: Provides authentication context
  - Source: `@/lib/auth/useAuth`
  - Returns: `{ user, profile, loading, status, authError, refreshProfile }`
  - Uses `AuthProvider` context internally
  - Manages Supabase session and profile state

### Optimistic Updates / Revalidation

- **No optimistic updates**: All mutations wait for server response
- **Revalidation**:
  - `saveCarrierDefaults()` calls `revalidatePath('/dashboard')` (line 138, 163 in `carrier-actions.ts`)
  - `deleteCarrierDefaults()` calls `revalidatePath('/dashboard')` (line 195 in `carrier-actions.ts`)
  - `importOrgData()` calls `revalidatePath('/dashboard')` (line 89 in `data-management-actions.ts`)
  - `clearOrgData()` calls `revalidatePath('/dashboard')` (line 110 in `data-management-actions.ts`)
  - `seedDemoData()` calls `revalidatePath('/dashboard')` (line 169 in `data-management-actions.ts`)
  - After import/seed/clear: `router.refresh()` is called (lines 178, 196, 212) to refresh the page

---

## Mutations / Updates

### 1. Save Settings

**Trigger**: "Save Settings" button click (line 255)

**Handler**: `handleSaveSettings()` (lines 130-142)
- **Server Action**: `saveSettings(settings)` from `@/lib/data/settings-actions`
- **Implementation** (`settings-actions.ts` lines 45-60):
  1. Gets authenticated user via `getServerAuthContext()`
  2. Loads current settings to merge with new ones
  3. Updates `profiles` table: `UPDATE profiles SET settings = mergedSettings WHERE id = user.id`
  4. Throws error if update fails

**Validation**:
- No explicit validation in server action
- Client-side: Input fields have `min`, `max`, `step` attributes
- Type safety: TypeScript `Settings` interface ensures correct types

**Error Handling**:
- Try/catch in handler
- Errors logged via `logger.error()`
- Errors shown via `toast.error()` with error message
- Success shown via `toast.success()`

### 2. Save Carrier Defaults

**Trigger**: "Save" button in carrier editor modal (line 662)

**Handler**: Inline async handler (lines 632-660)
- **Server Action**: `saveCarrierDefaults(carrierName, organizationId, demurrageTiers, detentionTiers)`
- **Implementation** (`carrier-actions.ts` lines 99-173):
  1. Checks if defaults exist via `getCarrierDefaults()`
  2. Normalizes tiers: converts `from_day`/`to_day` to `from`/`to` for storage
  3. If exists: `UPDATE carrier_defaults SET defaults = ..., updated_at = ... WHERE id = existing.id`
  4. If new: `INSERT INTO carrier_defaults (organization_id, carrier_name, defaults) VALUES (...)`
  5. Calls `revalidatePath('/dashboard')`
  6. Returns normalized data

**Validation**:
- Checks: `carrier` and `organizationId` required (line 105-107)
- Client-side: Carrier name must be non-empty for new carriers (line 634)
- Tier validation: Handled by `DemurrageTierEditor` and `DetentionTierEditor` components using `validateTierConfiguration()` from `@/lib/tierUtils`

**Error Handling**:
- Try/catch in handler
- Errors logged and shown via toast
- Success: Shows toast, closes modal, refreshes carrier list

### 3. Delete Carrier Defaults

**Trigger**: Delete button (trash icon) next to each carrier (line 470)

**Handler**: Inline async handler (lines 470-481)
- **Server Action**: `deleteCarrierDefaults(carrierName, organizationId)`
- **Implementation** (`carrier-actions.ts` lines 178-196):
  1. Deletes from `carrier_defaults` table: `DELETE FROM carrier_defaults WHERE carrier_name = ... AND organization_id = ...`
  2. Calls `revalidatePath('/dashboard')`

**Validation**:
- Checks: `carrier` and `organizationId` required (line 179-181)

**Error Handling**:
- Try/catch in handler
- Optimistic update: Removes from local state immediately (line 475)
- Errors shown via toast

### 4. Export Data

**Trigger**: "Export Data" button (line 522)

**Handler**: `handleExport()` (lines 144-162)
- **Server Action**: `exportOrgData()` from `@/lib/data/data-management-actions`
- **Implementation** (`data-management-actions.ts` lines 12-46):
  1. Gets organization ID from auth context
  2. Fetches in parallel:
     - `containers` WHERE `organization_id = orgId`
     - `container_history` WHERE `organization_id = orgId`
     - `profiles` WHERE `organization_id = orgId` (selects `settings`, `email`, `role`, `organization_id`)
  3. Returns JSON string with all data
- **Client-side**: Creates blob, triggers download with filename `ddcopilot-backup-YYYY-MM-DD.json`

**Error Handling**:
- Try/catch in handler
- Errors shown via toast

### 5. Import Data

**Trigger**: "Import Data" button (line 527)

**Handler**: `handleImport()` (lines 164-187)
- **Server Action**: `importOrgData(fileContent)` from `@/lib/data/data-management-actions`
- **Implementation** (`data-management-actions.ts` lines 52-91):
  1. Parses JSON file
  2. Validates: requires `containers` array
  3. Maps containers: removes `id`, sets `organization_id` to current org
  4. Inserts: `INSERT INTO containers (containersToInsert)`
  5. Calls `revalidatePath('/dashboard')`
- **Client-side**: 
  - Creates file input, accepts `.json` files
  - Reads file as text, calls server action
  - Calls `router.refresh()` after success

**Validation**:
- JSON parsing: Try/catch for invalid JSON (line 67-69)
- Format validation: Checks for `containers` array (line 71-73)

**Error Handling**:
- Try/catch in handler
- Errors shown via toast
- Success: Shows toast, refreshes page

### 6. Seed Demo Data

**Trigger**: "Seed Demo Data" button (line 536)

**Handler**: `handleSeedDemo()` (lines 189-203)
- **Server Action**: `seedDemoData()` from `@/lib/data/data-management-actions`
- **Implementation** (`data-management-actions.ts` lines 118-171):
  1. Gets organization ID
  2. Creates 3 demo containers with realistic data
  3. Inserts: `INSERT INTO containers (demo)`
  4. Calls `revalidatePath('/dashboard')`
- **Client-side**: Calls `router.refresh()` after success

**Error Handling**:
- Try/catch in handler
- Errors shown via toast
- Success: Shows toast, refreshes page

### 7. Clear All Data

**Trigger**: "Clear All Data" button in confirmation dialog (line 565)

**Handler**: `handleClearData()` (lines 205-219)
- **Server Action**: `clearOrgData()` from `@/lib/data/data-management-actions`
- **Implementation** (`data-management-actions.ts` lines 97-112):
  1. Gets organization ID
  2. Deletes in parallel:
     - `DELETE FROM containers WHERE organization_id = orgId`
     - `DELETE FROM container_history WHERE organization_id = orgId`
  3. Calls `revalidatePath('/dashboard')`
- **Client-side**: Calls `router.refresh()` after success
- **Confirmation**: Uses `AlertDialog` component (lines 545-574)

**Error Handling**:
- Try/catch in handler
- Errors shown via toast
- Success: Shows toast, refreshes page

---

## Auth & Permissions

### Authentication

**On Page Load**:
- **Middleware** (`middleware.ts` lines 24-29): Redirects unauthenticated users to `/login`
- **Component** (`page.tsx` lines 56, 73-87): 
  - Uses `useAuth()` hook to get user and profile
  - Waits for `loading` to complete
  - If no user after loading, shows "Please sign in" message (lines 231-239)

**Server Actions**:
- All server actions use `getServerAuthContext()` from `@/lib/auth/serverAuthContext`
- **Implementation** (`serverAuthContext.ts` lines 31-65):
  1. Creates Supabase server client
  2. Calls `supabase.auth.getUser()` to get authenticated user
  3. Throws error if no user: `'Not authenticated'`
  4. Queries `profiles` table by `user.id`
  5. Throws error if no profile: `'User profile not found'`
  6. Throws error if no `organization_id`: `'User profile missing organization_id'`
  7. Returns `{ supabase, user, profile, organizationId }`

### Role Restrictions

**No role-based restrictions**:
- All authenticated users with a profile and `organization_id` can access all settings
- No checks for `profile.role` in any server actions
- All operations are organization-scoped (users can only access/modify their organization's data)

### Organization Scoping

**All data operations are organization-scoped**:
- Settings: Stored per user (in `profiles.settings`), but users belong to organizations
- Carrier defaults: Filtered by `organization_id` (RLS policies enforce this)
- Data management: All operations filter by `organization_id` from user's profile

**RLS (Row Level Security)**:
- `carrier_defaults` table has RLS enabled
- Policies ensure users can only access/modify defaults for their organization
- Policies check: `organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())`

---

## Side Effects

### Cache Revalidation

**Next.js Cache Revalidation**:
- `saveCarrierDefaults()`: `revalidatePath('/dashboard')` (lines 138, 163)
- `deleteCarrierDefaults()`: `revalidatePath('/dashboard')` (line 195)
- `importOrgData()`: `revalidatePath('/dashboard')` (line 89)
- `clearOrgData()`: `revalidatePath('/dashboard')` (line 110)
- `seedDemoData()`: `revalidatePath('/dashboard')` (line 169)

**Router Refresh**:
- After import: `router.refresh()` (line 178)
- After seed: `router.refresh()` (line 196)
- After clear: `router.refresh()` (line 212)

### Downstream Impact

**Settings Changes**:
- Settings are stored in `profiles.settings` JSONB
- Used by other parts of the app when calculating fees, free days, warnings
- No automatic propagation - other pages/components must call `loadSettings()` to get updated values
- **Note**: Settings are user-specific, not organization-wide

**Carrier Defaults Changes**:
- Carrier defaults are used when creating/editing containers
- Other pages that load carrier defaults will see updates after revalidation
- Changes affect all users in the same organization (organization-scoped)

**Data Management Operations**:
- **Export**: No side effects (read-only)
- **Import**: Adds new containers, visible to all users in organization
- **Seed**: Adds demo containers, visible to all users in organization
- **Clear**: Removes all containers and history, affects all users in organization

### SWR Mutations

**No SWR usage**:
- The Settings page does not use SWR for data fetching
- Uses direct server action calls and local state
- `useAuth()` uses SWR internally for profile caching, but Settings page doesn't directly use SWR

---

## Files Involved

### Pages/Components

1. **`dnd-copilot-next/app/dashboard/settings/page.tsx`**
   - Main Settings page component (671 lines)
   - Client component that renders all UI sections

2. **`dnd-copilot-next/components/forms/DemurrageTierEditor.tsx`**
   - Component for editing demurrage tiers
   - Used in carrier defaults modal

3. **`dnd-copilot-next/components/forms/DetentionTierEditor.tsx`**
   - Component for editing detention tiers
   - Used in carrier defaults modal

### Server Actions

4. **`dnd-copilot-next/lib/data/settings-actions.ts`**
   - `loadSettings()`: Loads settings from `profiles.settings`
   - `saveSettings()`: Saves settings to `profiles.settings`
   - Type: `Settings` interface

5. **`dnd-copilot-next/lib/data/carrier-actions.ts`**
   - `getAllCarrierDefaults()`: Fetches all carrier defaults for organization
   - `getCarrierDefaults()`: Fetches defaults for specific carrier
   - `saveCarrierDefaults()`: Saves/updates carrier defaults
   - `deleteCarrierDefaults()`: Deletes carrier defaults
   - Type: `CarrierDefaults` interface

6. **`dnd-copilot-next/lib/data/data-management-actions.ts`**
   - `exportOrgData()`: Exports all organization data as JSON
   - `importOrgData()`: Imports containers from JSON
   - `clearOrgData()`: Deletes all containers and history
   - `seedDemoData()`: Inserts 3 demo containers

### Auth/Context

7. **`dnd-copilot-next/lib/auth/useAuth.ts`**
   - `useAuth()` hook: Provides authentication context
   - `AuthProvider`: Context provider component
   - Manages Supabase session and profile state

8. **`dnd-copilot-next/lib/auth/serverAuthContext.ts`**
   - `getServerAuthContext()`: Gets authenticated user, profile, organization for server actions
   - `getServerOrgContext()`: Gets organization row in addition to auth context

### Utilities

9. **`dnd-copilot-next/lib/tierUtils.ts`**
   - Tier manipulation utilities used by tier editors
   - `addTierStep()`, `editTierStep()`, `deleteTierStep()`
   - `validateTierConfiguration()`, `getTierSummary()`
   - Type: `Tier` interface

10. **`dnd-copilot-next/lib/utils/logger.ts`**
    - Logging utility used throughout for debugging

### UI Components

11. **`dnd-copilot-next/components/ui/card.tsx`**
    - Card component for sections

12. **`dnd-copilot-next/components/ui/input.tsx`**
    - Input component for form fields

13. **`dnd-copilot-next/components/ui/button.tsx`**
    - Button component

14. **`dnd-copilot-next/components/ui/switch.tsx`**
    - Switch/toggle component for weekend charging

15. **`dnd-copilot-next/components/ui/alert-dialog.tsx`**
    - AlertDialog component for confirmations and modals

16. **`dnd-copilot-next/components/ui/LoadingState.tsx`**
    - Loading spinner component

### Routing/Middleware

17. **`dnd-copilot-next/middleware.ts`**
    - Next.js middleware for route protection
    - Protects `/dashboard/*` routes

18. **`dnd-copilot-next/lib/supabase/middleware.ts`**
    - Supabase client creation for middleware

19. **`dnd-copilot-next/lib/supabase/server.ts`**
    - Supabase server client creation

20. **`dnd-copilot-next/lib/supabase/client.ts`**
    - Supabase browser client creation

### Types

21. **`dnd-copilot-next/types/database.ts`**
    - TypeScript types for Supabase database schema
    - Includes `profiles`, `carrier_defaults` table types

---

## Summary

The Settings page is a **Client Component** at `/dashboard/settings` that allows authenticated users to:

1. **Configure fee defaults** (demurrage/detention rates, free days, weekend charging, alerts)
2. **Manage carrier defaults** (tiered rate presets per carrier, organization-scoped)
3. **Manage organization data** (export, import, seed demo data, clear all data)

All operations are **organization-scoped** and require authentication. Settings are stored per-user in `profiles.settings` JSONB, while carrier defaults are organization-wide in the `carrier_defaults` table. The page uses local React state for UI state management and calls server actions for all data mutations. Cache revalidation ensures other pages see updated data after mutations.

