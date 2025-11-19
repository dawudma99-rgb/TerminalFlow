# TerminalFlow Application Architecture & Code Report

**Generated:** 2025-01-27  
**Application:** TerminalFlow (formerly D&D Copilot)  
**Version:** 0.1.0  
**Framework:** Next.js 14 (App Router)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Application Architecture](#application-architecture)
4. [Database Schema](#database-schema)
5. [Authentication & Security](#authentication--security)
6. [Core Features & Business Logic](#core-features--business-logic)
7. [State Management](#state-management)
8. [Data Flow](#data-flow)
9. [Key Components](#key-components)
10. [API Routes](#api-routes)
11. [File Structure](#file-structure)
12. [Development Workflow](#development-workflow)

---

## Executive Summary

**TerminalFlow** is a container management and tracking system designed for freight forwarders and logistics companies. It helps organizations track shipping containers, monitor demurrage and detention fees, manage multiple container lists, and receive automated alerts for critical events.

### Key Capabilities

- **Container Management**: Create, edit, and track shipping containers with detailed metadata
- **Fee Calculation**: Automatic calculation of demurrage and detention fees using tiered or flat rates
- **Multi-List Organization**: Organize containers into multiple lists (similar to Excel tabs)
- **Real-time Alerts**: Automated alerts for overdue containers, demurrage/detention events
- **Email Notifications**: Critical alerts sent via email to all organization users
- **CSV/Excel Import**: Bulk import containers from spreadsheets
- **Analytics Dashboard**: Cost analysis, port performance, and risk assessment
- **Activity History**: Complete audit trail of container changes

### Target Users

- Freight forwarders
- Logistics coordinators
- Container tracking teams
- Operations managers

---

## Technology Stack

### Frontend Framework
- **Next.js 14.2.5** (App Router)
- **React 18.3.1**
- **TypeScript 5**

### UI Components
- **Radix UI** (headless components)
  - Dialog, Dropdown Menu, Select, Tooltip, Alert Dialog, etc.
- **Tailwind CSS 4** (styling)
- **Framer Motion** (animations)
- **Lucide React** (icons)
- **Sonner** (toast notifications)

### Backend & Database
- **Supabase** (PostgreSQL database + Auth)
  - `@supabase/supabase-js` 2.81.1
  - `@supabase/ssr` 0.7.0
- **Row Level Security (RLS)** for multi-tenant isolation

### State Management
- **SWR 2.3.6** (data fetching, caching, revalidation)
- **React Context API** (ListsProvider, ThemeProvider)

### Data Processing
- **PapaParse 5.4.1** (CSV parsing)
- **XLSX 0.18.5** (Excel file parsing)

### Email
- **Resend 6.5.0** (email delivery)

### Utilities
- **Zod 4.1.12** (validation)
- **use-debounce 10.0.6** (debounced inputs)
- **clsx** + **tailwind-merge** (conditional styling)

### Development Tools
- **ESLint** (linting)
- **TypeScript** (type checking)

---

## Application Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Pages      │  │  Components  │  │  API Routes  │  │
│  │  (Server)    │  │  (Client)     │  │  (Server)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                  │                  │          │
│         └──────────────────┼──────────────────┘          │
│                            │                             │
│  ┌─────────────────────────┼──────────────────────────┐  │
│  │         Server Actions (lib/data/*)                │  │
│  └─────────────────────────┼──────────────────────────┘  │
│                            │                             │
│  ┌─────────────────────────┼──────────────────────────┐  │
│  │    Supabase Client (lib/supabase/server.ts)        │  │
│  └─────────────────────────┼──────────────────────────┘  │
│                            │                             │
└────────────────────────────┼─────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Supabase      │
                    │  (PostgreSQL +  │
                    │   Auth + RLS)   │
                    └─────────────────┘
```

### Architecture Patterns

1. **Server-First Architecture**
   - Server Components by default
   - Client Components only when needed (interactivity, hooks)
   - Server Actions for all data mutations

2. **Multi-Tenant Isolation**
   - Organization-scoped data via `organization_id`
   - Row Level Security (RLS) at database level
   - Middleware-based authentication

3. **Stale-While-Revalidate (SWR)**
   - Background data refresh every 60 seconds
   - Optimistic UI updates
   - Request deduplication

4. **Computed Fields Pattern**
   - Derived fields (status, fees) computed on-read
   - Never stored in database
   - Always reflects current date/time

---

## Database Schema

### Core Tables

#### `organizations`
- `id` (UUID, PK)
- `name` (TEXT)
- `created_at` (TIMESTAMP)

**Purpose:** Top-level tenant isolation. All data is scoped to an organization.

---

#### `profiles`
- `id` (UUID, PK, FK → auth.users)
- `organization_id` (UUID, FK → organizations)
- `email` (TEXT)
- `role` (TEXT)
- `current_list_id` (UUID, FK → container_lists, nullable)
- `settings` (JSONB)
- `created_at`, `updated_at` (TIMESTAMP)

**Purpose:** Links Supabase Auth users to organizations. Stores user preferences and active list selection.

---

#### `container_lists`
- `id` (UUID, PK)
- `organization_id` (UUID, FK → organizations)
- `name` (TEXT)
- `created_at`, `updated_at` (TIMESTAMP)

**Purpose:** Multi-list organization. Users can create multiple lists to organize containers (e.g., "Asia Imports", "Europe Exports").

---

#### `containers`
- `id` (UUID, PK)
- `organization_id` (UUID, FK → organizations)
- `list_id` (UUID, FK → container_lists, nullable)
- `container_no` (TEXT, required)
- `bl_number` (TEXT, nullable)
- `pol`, `pod` (TEXT, nullable) - Port of Loading, Port of Discharge
- `port` (TEXT, nullable)
- `arrival_date` (TIMESTAMP, nullable)
- `free_days` (INTEGER, default: 7)
- `demurrage_fee_if_late` (NUMERIC, nullable)
- `demurrage_tiers` (JSONB, nullable) - Tiered rate structure
- `detention_fee_rate` (NUMERIC, nullable)
- `detention_tiers` (JSONB, nullable)
- `detention_free_days` (INTEGER, default: 7)
- `gate_out_date` (TIMESTAMP, nullable)
- `empty_return_date` (TIMESTAMP, nullable)
- `carrier` (TEXT, nullable)
- `container_size` (TEXT, nullable)
- `assigned_to` (TEXT, nullable)
- `milestone` (TEXT, nullable) - "In Transit", "At Port", "In Demurrage", "Gate Out", "Returned Empty", "Closed"
- `notes` (TEXT, nullable)
- `is_closed` (BOOLEAN, default: false)
- `has_detention` (BOOLEAN, default: false)
- `version` (INTEGER, default: 1)
- `created_at`, `updated_at` (TIMESTAMP)

**Purpose:** Main container records. Stores all user-entered data. Derived fields (status, fees) are computed on-read.

---

#### `alerts`
- `id` (UUID, PK)
- `organization_id` (UUID, FK → organizations)
- `container_id` (UUID, FK → containers)
- `list_id` (UUID, FK → container_lists, nullable)
- `event_type` (TEXT) - "became_warning", "became_overdue", "demurrage_started", "detention_started", "container_closed"
- `severity` (TEXT) - "info", "warning", "critical"
- `title` (TEXT)
- `message` (TEXT, nullable)
- `metadata` (JSONB, nullable) - Additional context
- `created_by_user_id` (UUID, FK → profiles, nullable)
- `created_at` (TIMESTAMP)
- `seen_at` (TIMESTAMP, nullable)

**Purpose:** Internal alert system. Created automatically when container state changes. Emails sent for critical events.

---

#### `container_history`
- `id` (UUID, PK)
- `container_id` (UUID, FK → containers, CASCADE DELETE)
- `organization_id` (UUID, FK → organizations)
- `user_id` (UUID, FK → auth.users, nullable)
- `event_type` (TEXT) - "created", "updated", "deleted"
- `summary` (TEXT, nullable)
- `details` (JSONB, nullable) - Before/after values
- `created_at` (TIMESTAMP)

**Purpose:** Audit trail of all container changes. Used for activity log and analytics.

---

#### `carrier_defaults`
- `id` (UUID, PK)
- `organization_id` (UUID, FK → organizations)
- `carrier_name` (TEXT)
- `defaults` (JSONB) - Contains `demurrage_tiers` and `detention_tiers`
- `updated_at` (TIMESTAMP)

**Purpose:** Per-carrier default fee structures. Users can save tiered rates for specific carriers.

---

### Relationships

```
organizations (1) ──< (many) profiles
organizations (1) ──< (many) container_lists
organizations (1) ──< (many) containers
organizations (1) ──< (many) alerts
organizations (1) ──< (many) container_history
organizations (1) ──< (many) carrier_defaults

container_lists (1) ──< (many) containers
containers (1) ──< (many) alerts
containers (1) ──< (many) container_history

profiles (1) ──< (many) alerts (created_by_user_id)
profiles (1) ──> (1) container_lists (current_list_id)
```

---

## Authentication & Security

### Authentication Flow

1. **User Login** (`/login` page)
   - User enters email and password
   - Server action `signIn()` calls `supabase.auth.signInWithPassword()`
   - Supabase validates credentials and creates JWT session
   - Session tokens stored in HttpOnly cookies

2. **Middleware Protection** (`middleware.ts`)
   - Runs on every request to `/dashboard/*` routes
   - Creates Supabase client from request cookies
   - Calls `supabase.auth.getSession()` to refresh session
   - Updates cookies with fresh tokens
   - Redirects unauthenticated users to `/login`

3. **Server Actions**
   - All data operations use `createClient()` from `lib/supabase/server.ts`
   - Client reads JWT from cookies automatically
   - Validates user via `supabase.auth.getUser()`
   - Fetches user's profile to get `organization_id`
   - All queries filtered by `organization_id`

4. **Client-Side Auth** (`lib/auth/useAuth.ts`)
   - React hook that monitors auth state
   - Listens to `supabase.auth.onAuthStateChange()` events
   - Provides `user`, `profile`, `loading`, `refreshProfile()` to components
   - Automatically loads profile on mount

### Security Features

#### 1. Row Level Security (RLS)
- All database tables have RLS enabled
- Policies filter data by `organization_id`
- Users can only access data from their organization
- Enforced at database level (cannot be bypassed)

**Example Policy:**
```sql
CREATE POLICY "Users can only access containers from their organization"
ON containers FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
```

#### 2. Route Protection
- Middleware protects `/dashboard/*` routes
- Unauthenticated users redirected to `/login`
- Session refreshed on every request

#### 3. Input Validation
- TypeScript types for all database operations
- Server actions validate user and organization
- Empty strings normalized to `null`
- Date parsing with multiple format support

#### 4. Cookie Security
- HttpOnly cookies for JWT tokens
- Secure cookies in production
- SameSite protection
- Automatic token refresh via middleware

#### 5. Error Handling
- Global error handler provider (`ErrorHandlerProvider`)
- Error boundaries for React components
- Graceful error messages (no stack traces in production)
- Logging via `lib/utils/logger`

---

## Core Features & Business Logic

### 1. Container Management

#### Container Creation
**File:** `lib/data/containers-actions.ts` → `insertContainer()`

**Process:**
1. User fills form (container number, dates, fees, etc.)
2. Client validates input
3. Server action `insertContainer()` called
4. Gets `organization_id` from authenticated user's profile
5. Gets `list_id` from user's active list (via `ensureMainListForCurrentOrg()`)
6. Normalizes empty strings to `null`
7. Resolves milestone (auto-corrects if invalid)
8. Inserts into `containers` table
9. Revalidates Next.js cache
10. Returns new container record

**Fields Written:**
- All user-entered fields (container_no, arrival_date, free_days, etc.)
- Auto-set: `organization_id`, `list_id`
- Auto-resolved: `milestone` (if invalid)

**No Alerts Created:** New containers don't trigger alerts (only updates do).

---

#### Container Updates
**File:** `lib/data/containers-actions.ts` → `updateContainer()`

**Process:**
1. User edits container via form
2. Server action `updateContainer()` called
3. Fetches previous container state (for alert detection)
4. Normalizes and validates input
5. Updates container in database
6. Calls `createAlertsForContainerChange()` to detect state changes
7. Creates alerts if conditions met
8. Sends emails for critical alerts
9. Revalidates cache

**Alert Detection:**
- Compares previous vs new container state
- Computes derived fields for both states
- Detects transitions (Safe → Warning, !Overdue → Overdue, etc.)
- Creates alert records in `alerts` table

---

#### Container Deletion
**File:** `lib/data/containers-actions.ts` → `deleteContainer()`

**Process:**
1. User confirms deletion
2. Server action deletes container record
3. Database CASCADE deletes related records (history, alerts)
4. Revalidates cache

---

### 2. Derived Fields Computation

**File:** `lib/utils/containers.ts` → `computeDerivedFields()`

**When It Runs:**
- Every time containers are fetched (via `fetchContainers()`)
- Applied to each container row after database query
- Never stored in database - computed on-read

**Computed Fields:**

1. **`days_left`** (number | null)
   - Formula: `(arrival_date + free_days) - today`
   - Positive = days remaining
   - Negative = days overdue
   - `null` if `arrival_date` missing

2. **`status`** ('Safe' | 'Warning' | 'Overdue' | 'Closed')
   - `Closed` if `is_closed === true`
   - `Safe` if `days_left > 2` or `days_left === null`
   - `Warning` if `0 < days_left <= 2`
   - `Overdue` if `days_left < 0`

3. **`demurrage_fees`** (number)
   - Only calculated if `days_left < 0`
   - Uses tiered rates if `demurrage_tiers` exists
   - Otherwise: `daysOverdue * demurrage_fee_if_late`

4. **`detention_fees`** (number)
   - Only calculated if `has_detention === true` and `gate_out_date` exists
   - LFD = `gate_out_date + detention_free_days`
   - Chargeable days = `max(0, (empty_return_date || today) - LFD)`
   - Uses tiered rates if `detention_tiers` exists

5. **`lfd_date`** (string | null)
   - Last Free Day for detention
   - Formula: `gate_out_date + detention_free_days`

6. **`detention_chargeable_days`** (number | null)
   - Days beyond LFD that detention is charged

7. **`detention_status`** ('Safe' | 'Warning' | 'Overdue' | null)
   - Based on `detention_chargeable_days`

**Key Point:** These fields change automatically as time passes. No user action needed - they're recalculated every time containers are displayed.

---

### 3. Fee Calculation

**File:** `lib/tierUtils.ts` → `calculateTieredFees()`

**Tiered Rate Structure:**
```typescript
[
  { from_day: 1, to_day: 7, rate: 100 },    // Days 1-7: £100/day
  { from_day: 8, to_day: 14, rate: 200 },   // Days 8-14: £200/day
  { from_day: 15, to_day: null, rate: 300 } // Days 15+: £300/day
]
```

**Calculation Logic:**
1. Sort tiers by `from_day`
2. For each tier that applies to the overdue days:
   - Calculate days in tier range
   - Multiply by tier rate
   - Add to total
3. Return sum of all applicable tier fees

**Fallback:** If no tiers configured, uses flat rate: `daysOverdue * flatRate`

---

### 4. Milestone Resolution

**File:** `lib/utils/milestones.ts` → `resolveMilestone()`

**Valid Milestones:**
- "In Transit"
- "At Port"
- "In Demurrage"
- "Gate Out"
- "Returned Empty"
- "Closed"

**Resolution Order:**
1. User's milestone input (if valid canonical value)
2. Legacy value mapping (e.g., "Delivered" → "Returned Empty")
3. Context-driven fallback:
   - If `empty_return_date` exists → "Returned Empty"
   - Else if `gate_out_date` exists → "Gate Out"
4. Default: "At Port"

**When It Runs:**
- On container creation (`insertContainer()`)
- On container update (`updateContainer()`)
- Only if user's milestone input is invalid/missing

---

### 5. Alert System

**File:** `lib/data/alerts-logic.ts` → `createAlertsForContainerChange()`

**Alert Types:**

1. **`became_warning`** (severity: 'warning')
   - Condition: `previous status = 'Safe' (or null) AND new status = 'Warning'`
   - Triggered when container approaches free time limit

2. **`became_overdue`** (severity: 'critical')
   - Condition: `previous status != 'Overdue' AND new status = 'Overdue'`
   - Triggered when container passes free time

3. **`demurrage_started`** (severity: 'critical')
   - Condition: `previous days_left >= 0 AND new days_left < 0`
   - Triggered when demurrage charges begin

4. **`detention_started`** (severity: 'critical')
   - Condition: `previous detention_chargeable_days <= 0 AND new detention_chargeable_days > 0`
   - Triggered when detention charges begin

5. **`container_closed`** (severity: 'info')
   - Condition: `previous is_closed = false AND new is_closed = true`
   - Triggered when user marks container as closed

**Alert Creation Process:**
1. Called from `updateContainer()` after successful update
2. Computes derived fields for previous and new container
3. Checks each condition
4. Builds alert array
5. Inserts alerts into `alerts` table
6. Sends emails for critical alerts (see Email section)

**Important:** Alerts are only created when users update containers. No scheduled checks - system is event-driven.

---

### 6. Email Notifications

**File:** `lib/email/sendAlertEmail.ts` + `lib/data/alerts-logic.ts`

**Email Helper:** `sendAlertEmail()`
- Uses Resend SDK
- FROM: `process.env.EMAIL_FROM` or `alerts@terminalflow.app`
- Format: "TerminalFlow Alerts <email>"
- Plain text emails (mobile-friendly)

**When Emails Are Sent:**
- Only for 3 critical alert types:
  - `became_overdue`
  - `demurrage_started`
  - `detention_started`
- NOT sent for: `became_warning`, `container_closed`

**Recipients:**
- All users in the same organization
- Only users with non-null email addresses
- Fetched from `profiles` table

**Email Content:**
- Subject: Based on alert type (e.g., "Container is now overdue – {containerNo}")
- Body: Plain text with container info and link
- Link: `https://terminalflow.app/dashboard/alerts`

**Process:**
1. Alert created in `createAlertsForContainerChange()`
2. Filters alerts to email-worthy events
3. Fetches all organization users' emails
4. Builds email subject and body
5. Sends to all recipients (non-blocking)
6. Logs failures but doesn't break container update

---

### 7. Multi-List Management

**Files:** `lib/data/lists-actions.ts`, `lib/data/useLists.ts`, `components/providers/ListsProvider.tsx`

**Features:**
- Create multiple lists per organization
- Switch active list (persisted in `profiles.current_list_id`)
- Delete lists (with cascade handling)
- Auto-create "Main List" for new organizations

**List Bootstrap:**
- `ensureMainListForCurrentOrg()` ensures every org has at least one list
- Creates "Main List" if none exist
- Sets `current_list_id` to valid list
- Runs on app load and before container creation

**Container Filtering:**
- Containers filtered by `list_id` when active list is set
- If `activeListId === null`, shows all containers for org
- Containers always assigned to a list (never `null` after bootstrap)

---

### 8. CSV/Excel Import

**Files:** `lib/data/import-commit.ts`, `components/import/ImportDialog.tsx`

**Process:**
1. User uploads CSV/Excel file
2. File parsed (PapaParse for CSV, XLSX for Excel)
3. Headers auto-mapped to container fields
4. User can adjust mappings
5. Dry-run validation (checks required fields)
6. Preview shows parsed data
7. Commit inserts containers in batches (500 at a time)
8. All containers assigned to user's active list

**Supported Fields:**
- All container fields (container_no, arrival_date, free_days, etc.)
- Flexible date formats (ISO, DD/MM/YYYY, etc.)
- Empty strings normalized to `null`

---

### 9. Analytics & Reporting

**Files:** `lib/analytics/analytics-utils.ts`, `app/dashboard/analytics/page.tsx`

**Features:**
- Cost of inaction calculations
- Status distribution charts
- Port performance analysis
- Top containers at risk
- Activity log with pagination

**Calculations:**
- Total potential fees if containers remain overdue
- Status breakdown (Safe, Warning, Overdue, Closed)
- Port-level statistics
- Risk assessment (containers approaching deadlines)

---

## State Management

### SWR (Stale-While-Revalidate)

**Used For:**
- Container data (`useContainers` hook)
- Lists data (`useLists` hook)
- Alerts data (via API route)

**Configuration:**
- Refresh interval: 60 seconds
- Revalidate on focus: false
- Keep previous data: true (prevents flicker)
- Request deduplication: automatic

**Cache Keys:**
- Containers: `['containers', listId]`
- Lists: `['lists', organizationId]`
- Alerts: `['alerts']`

**Example:**
```typescript
const { data, error, isLoading, mutate } = useSWR(
  ['containers', listId],
  fetcher,
  {
    revalidateOnFocus: false,
    refreshInterval: 60000,
    keepPreviousData: true,
  }
)
```

---

### React Context

**ListsProvider** (`components/providers/ListsProvider.tsx`)
- Provides lists, activeListId, setActiveList, createList, deleteList
- Wraps entire app in `app/layout.tsx`
- Uses `useLists()` hook internally

**ThemeProvider** (`components/theme-provider.tsx`)
- Manages light/dark theme
- Persists theme preference

**ErrorHandlerProvider** (`components/ErrorHandlerProvider.tsx`)
- Global error handling
- Toast notifications for errors

---

### Local State

**React Hooks:**
- `useState` for form inputs, dialogs, filters
- `useEffect` for side effects, subscriptions
- `useCallback` for memoized functions
- `useMemo` for computed values

**Example:**
```typescript
const [searchQuery, setSearchQuery] = useState('')
const [statusFilter, setStatusFilter] = useState('all')
const filteredContainers = useMemo(() => {
  return containers.filter(c => {
    // ... filter logic
  })
}, [containers, searchQuery, statusFilter])
```

---

## Data Flow

### Container Creation Flow

```
User fills form
    ↓
Client validation
    ↓
insertContainer() server action
    ↓
Get organization_id from profile
    ↓
Get list_id from active list (ensureMainListForCurrentOrg)
    ↓
Normalize fields (empty strings → null)
    ↓
Resolve milestone
    ↓
Insert into containers table
    ↓
Revalidate Next.js cache
    ↓
SWR cache invalidated
    ↓
UI updates automatically
```

---

### Container Update Flow

```
User edits container
    ↓
updateContainer() server action
    ↓
Fetch previous container state
    ↓
Normalize and validate input
    ↓
Update container in database
    ↓
createAlertsForContainerChange()
    ↓
Compute derived fields (old + new)
    ↓
Detect state transitions
    ↓
Create alert records
    ↓
Send emails (if critical alerts)
    ↓
Revalidate cache
    ↓
UI updates
```

---

### Data Fetching Flow

```
Component mounts
    ↓
useContainers(listId) hook
    ↓
SWR fetcher function
    ↓
fetchContainers() server action
    ↓
Get organization_id from profile
    ↓
Query Supabase (filtered by list_id)
    ↓
Apply computeDerivedFields() to each container
    ↓
Return containers with computed fields
    ↓
SWR caches result
    ↓
Component renders
    ↓
Background refresh every 60 seconds
```

---

## Key Components

### Layout Components

#### `AppLayout` (`components/layout/AppLayout.tsx`)
- Main application shell
- Sidebar + Topbar + Main content area
- Wraps all dashboard pages

#### `Sidebar` (`components/layout/Sidebar.tsx`)
- Navigation menu
- Links to Dashboard, Containers, Analytics, History, Settings
- Shows TerminalFlow logo

#### `Topbar` (`components/layout/Topbar.tsx`)
- User email display
- Theme toggle
- Alerts bell (unread count + dropdown)
- Logout button

---

### Container Components

#### `ContainerTable` (`app/dashboard/containers/components/ContainerTable.tsx`)
- Main table displaying containers
- Sortable columns
- Inline editing
- Status badges
- Action buttons (edit, delete, toggle closed)

#### `AddContainerForm` (`components/forms/AddContainerForm.tsx`)
- Large form for creating containers
- All container fields
- Tiered fee configuration
- Validation

#### `EditContainerDialog` (`app/dashboard/containers/page.tsx`)
- Modal dialog for editing containers
- Pre-filled with current values
- Updates via `updateContainer()` server action

---

### Alert Components

#### `AlertsBell` (`components/alerts/AlertsBell.tsx`)
- Bell icon with unread badge
- Dropdown menu with recent alerts
- Real-time updates via `useRealtimeAlerts()` hook
- Pulse animation on new alerts
- "View all alerts" link

#### `AlertsPage` (`app/dashboard/alerts/page.tsx`)
- Full page listing all alerts
- Table format with severity badges
- Filtering and sorting

---

### List Components

#### `ListTabs` (`components/lists/ListTabs.tsx`)
- Tab-style list switcher
- Shows all lists as tabs
- Active list highlighted
- "+" button to create new list
- Delete button (hover) for non-active lists

#### `ListSwitcher` (`components/lists/ListSwitcher.tsx`)
- Pill-style list switcher
- Similar to ListTabs but different visual style

---

### UI Components (shadcn/ui)

Located in `components/ui/`:
- `Button`, `Card`, `Dialog`, `Input`, `Select`
- `Badge`, `Skeleton`, `LoadingState`, `EmptyState`
- `DropdownMenu`, `Tooltip`, `AlertDialog`
- All built on Radix UI primitives

---

## API Routes

### `/api/alerts` (GET)
**File:** `app/api/alerts/route.ts`

**Purpose:** Fetch alerts for client-side components

**Returns:**
```json
[
  {
    "id": "...",
    "title": "...",
    "event_type": "...",
    "severity": "...",
    "container_no": "...",
    "list_name": "...",
    "created_at": "2025-01-27T...",
    "metadata": {...}
  }
]
```

---

### `/api/email/send-alert` (POST)
**File:** `app/api/email/send-alert/route.ts`

**Purpose:** Send alert email (currently unused - emails sent directly from server actions)

**Body:**
```json
{
  "alertTitle": "...",
  "alertMessage": "...",
  "containerNo": "...",
  "recipientEmail": "..."
}
```

---

### `/dashboard/containers/export` (GET)
**File:** `app/dashboard/containers/export/route.ts`

**Purpose:** Export containers to CSV

**Query Params:**
- `status` - Filter by status (optional)

**Returns:** CSV file download

---

### Import Routes (`/dashboard/containers/import-test/*`)
**Files:** `app/dashboard/containers/import-test/parse/route.ts`, `dry-run/route.ts`, `commit/route.ts`

**Purpose:** CSV/Excel import pipeline
- `parse` - Parse file and return preview
- `dry-run` - Validate without committing
- `commit` - Insert containers into database

---

## File Structure

```
dnd-copilot-next/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── alerts/route.ts
│   │   └── email/send-alert/route.ts
│   ├── dashboard/                # Protected dashboard pages
│   │   ├── page.tsx              # Main dashboard
│   │   ├── containers/           # Container management
│   │   │   ├── page.tsx
│   │   │   ├── components/       # Container-specific components
│   │   │   └── export/route.ts
│   │   ├── alerts/page.tsx       # Alerts page
│   │   ├── analytics/page.tsx    # Analytics dashboard
│   │   ├── history/page.tsx      # Activity log
│   │   └── settings/page.tsx     # Settings
│   ├── login/page.tsx            # Login page
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home (redirects to /dashboard)
│   └── error-boundary.tsx        # Global error boundary
│
├── components/                    # React components
│   ├── alerts/                   # Alert components
│   ├── analytics/                # Analytics components
│   ├── forms/                    # Form components
│   ├── import/                   # Import dialog
│   ├── layout/                   # Layout components
│   ├── lists/                    # List management
│   ├── providers/                # Context providers
│   └── ui/                       # Reusable UI components
│
├── lib/                          # Core business logic
│   ├── analytics/                # Analytics calculations
│   ├── auth/                     # Authentication
│   │   ├── actions.ts            # Server actions (signIn, signOut)
│   │   └── useAuth.ts            # Client hook
│   ├── config/                   # Configuration
│   ├── data/                     # Data layer (Supabase operations)
│   │   ├── alerts-actions.ts    # Alert CRUD
│   │   ├── alerts-logic.ts      # Alert creation logic
│   │   ├── containers-actions.ts # Container CRUD
│   │   ├── lists-actions.ts      # List CRUD
│   │   ├── import-commit.ts     # CSV import
│   │   ├── useContainers.ts     # Container hook
│   │   └── useLists.ts          # Lists hook
│   ├── email/                    # Email sending
│   │   └── sendAlertEmail.ts    # Resend helper
│   ├── hooks/                    # Custom hooks
│   │   └── useRealtimeAlerts.ts # Real-time alert subscription
│   ├── import/                   # Import utilities
│   ├── supabase/                 # Supabase clients
│   │   ├── server.ts            # Server client
│   │   ├── client.ts            # Browser client
│   │   └── middleware.ts        # Middleware client
│   ├── utils/                    # Utility functions
│   │   ├── containers.ts        # Derived fields computation
│   │   ├── milestones.ts        # Milestone resolution
│   │   └── logger.ts            # Logging utility
│   └── tierUtils.ts             # Tiered fee calculations
│
├── types/                        # TypeScript types
│   └── database.ts              # Supabase-generated types
│
├── middleware.ts                 # Next.js middleware (auth)
├── package.json                  # Dependencies
└── tsconfig.json                 # TypeScript config
```

---

## Development Workflow

### Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
RESEND_API_KEY=your_resend_key
EMAIL_FROM=alerts@terminalflow.app
```

### Key Development Patterns

1. **Server Actions First**
   - All data mutations use server actions (`'use server'`)
   - Client components call server actions, not Supabase directly

2. **Type Safety**
   - All database operations use generated types from `types/database.ts`
   - No `any` types in business logic

3. **Error Handling**
   - Server actions throw errors (caught by error boundaries)
   - Client components show toast notifications
   - Errors logged via `lib/utils/logger`

4. **Caching Strategy**
   - Server actions use `cache()` for request deduplication
   - `revalidatePath()` after mutations
   - SWR for client-side caching

5. **Component Organization**
   - Server Components by default
   - Client Components only when needed (hooks, interactivity)
   - Shared UI components in `components/ui/`

---

## Summary

**TerminalFlow** is a modern, full-stack container management application built with Next.js 14 and Supabase. It follows server-first architecture principles, uses computed fields for real-time calculations, and implements a robust multi-tenant security model via Row Level Security.

**Key Strengths:**
- Type-safe throughout (TypeScript + generated Supabase types)
- Secure multi-tenant architecture (RLS + organization scoping)
- Real-time derived fields (status, fees computed on-read)
- Event-driven alerts (no scheduled jobs needed)
- Modern React patterns (Server Components, Server Actions, SWR)
- Comprehensive error handling and logging

**Architecture Highlights:**
- No background jobs or cron tasks
- All updates are user-initiated
- Derived fields computed on-read (never stored)
- Alerts created only on container updates
- Email notifications for critical events only

The application is production-ready and follows Next.js and React best practices throughout.

