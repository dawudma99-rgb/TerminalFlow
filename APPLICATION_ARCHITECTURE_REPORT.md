# TerminalFlow Application Architecture & Code Report

**Generated:** 2025-01-27 (Updated)  
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
7. [Error Monitoring & Observability (Sentry)](#7-error-monitoring--observability-sentry)
8. [State Management](#state-management)
9. [Data Flow](#data-flow)
10. [Key Components](#key-components)
11. [API Routes](#api-routes)
12. [File Structure](#file-structure)
13. [Development Workflow](#development-workflow)

---

## Executive Summary

**TerminalFlow** is a container management and tracking system designed for freight forwarders and logistics companies. It helps organizations track shipping containers, monitor demurrage and detention fees, manage multiple container lists, and receive automated alerts for critical events.

### Key Capabilities

- **Container Management**: Create, edit, and track shipping containers with detailed metadata
- **Fee Calculation**: Automatic calculation of demurrage and detention fees using tiered or flat rates
- **Multi-List Organization**: Organize containers into multiple lists (similar to Excel tabs)
- **Real-time Alerts**: Automated alerts for overdue containers, demurrage/detention events
- **Daily Digest Emails**: Manual generation of daily digest drafts grouped by client list, with approval workflow before sending
- **CSV/Excel Import**: Bulk import containers from spreadsheets
- **Analytics Dashboard**: Cost analysis, port performance, and risk assessment
- **Activity History**: Complete audit trail of container changes
- **Public Landing Page**: Marketing site with feature showcase and pricing information
- **Overdue Alert Backfill**: Automatic detection and alert creation for overdue/warning containers
- **Email History**: View and manage sent email drafts
- **User Profile Management**: Profile settings and preferences

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

### Error Monitoring & Observability
- **Sentry 10.28.0** (`@sentry/nextjs`)
  - Client, server, and edge runtime support
  - Automatic error tracking and performance monitoring
  - Integrated with logger utility

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
- `event_type` (TEXT) - "became_warning", "became_overdue", "detention_started", "container_closed"
- `severity` (TEXT) - "info", "warning", "critical"
- `title` (TEXT)
- `message` (TEXT, nullable)
- `metadata` (JSONB, nullable) - Additional context (container_no, port, days_left, etc.)
- `created_by_user_id` (UUID, FK → profiles, nullable)
- `created_at` (TIMESTAMP)
- `seen_at` (TIMESTAMP, nullable)

**Purpose:** Internal alert system. Created automatically when container state changes. Used for dashboard display, daily digest generation, and analytics. **Note:** Alerts do NOT automatically create email drafts or send emails.

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

#### `email_drafts`
- `id` (UUID, PK)
- `organization_id` (UUID, FK → organizations)
- `container_id` (UUID, FK → containers, nullable) - NULL for daily digest drafts
- `event_type` (TEXT) - Currently only `'daily_digest'` (legacy per-container types removed)
- `status` (TEXT) - `'pending'`, `'sent'`, or `'skipped'`
- `to_email` (TEXT, nullable) - Recipient email (user-entered)
- `subject` (TEXT) - Email subject line
- `body_text` (TEXT) - Email body content
- `metadata` (JSONB, nullable) - Contains `list_id`, `list_name` for digest drafts
- `generated_at` (TIMESTAMP) - When draft was created
- `sent_at` (TIMESTAMP, nullable) - When email was sent
- `skipped_at` (TIMESTAMP, nullable) - When draft was skipped/rejected
- `created_by_user_id` (UUID, FK → profiles, nullable)
- `approved_by_user_id` (UUID, FK → profiles, nullable) - Required before sending
- `last_error` (TEXT, nullable) - Last send error message

**Purpose:** Email draft queue for client emails. All client emails go through a draft → approval → send workflow. Daily digest drafts are created manually and grouped by list.

---

### Relationships

```
organizations (1) ──< (many) profiles
organizations (1) ──< (many) container_lists
organizations (1) ──< (many) containers
organizations (1) ──< (many) alerts
organizations (1) ──< (many) container_history
organizations (1) ──< (many) carrier_defaults
organizations (1) ──< (many) email_drafts

container_lists (1) ──< (many) containers
container_lists (1) ──< (many) alerts (via list_id)
containers (1) ──< (many) alerts
containers (1) ──< (many) container_history
containers (1) ──< (many) email_drafts (nullable - NULL for digest drafts)

profiles (1) ──< (many) alerts (created_by_user_id)
profiles (1) ──< (many) email_drafts (created_by_user_id, approved_by_user_id)
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

**Alert Backfill System:**

**File:** `lib/data/overdue-sweep.ts`

The dashboard automatically runs backfill functions on page load to ensure alerts exist for containers that became overdue or entered warning status without manual updates:

- **`backfillOverdueAlertsForCurrentOrg()`**: Creates alerts for containers that are overdue but don't have alerts
- **`backfillWarningAlertsForCurrentOrg()`**: Creates alerts for containers in warning status without alerts
- Runs automatically when dashboard page loads (non-blocking)
- Ensures all overdue/warning containers have corresponding alerts for visibility

**Important:** Primary alert creation happens when users update containers (event-driven). Backfill ensures historical containers have alerts even if they became overdue before the alert system was active.

---

### 6. Email Notifications & Daily Digest System

**Files:** 
- `lib/email/sendAlertEmail.ts` - Email sending via Resend
- `lib/data/email-drafts-actions.ts` - Draft management and sending
- `lib/email/dailyDigestFormatter.ts` - Daily digest content generation
- `lib/data/alerts-logic.ts` - Alert creation (no longer creates email drafts)

### Email Service: `sendAlertEmail()`

**File:** `lib/email/sendAlertEmail.ts`

**Implementation:**
- Uses Resend SDK (v6.5.0) - server-only function (`'use server'`)
- FROM: `process.env.EMAIL_FROM` or defaults to `alerts@terminalflow.app`
- Format: "TerminalFlow Alerts <email>" (customizable via `fromName` parameter)
- Supports plain text and optional HTML email bodies
- Supports `replyTo` address for client replies
- Returns: `{ success: boolean, error?: string }`
- Non-blocking error handling (errors logged, not thrown)

**Parameters:**
```typescript
{
  to: string | string[]  // Single or multiple recipients
  subject: string
  text: string           // Plain text body (required)
  html?: string          // Optional HTML body
  replyTo?: string       // Optional reply-to address
  fromName?: string      // Optional custom from name
}
```

**Error Handling:**
- Checks for `RESEND_API_KEY` environment variable
- Logs errors via `logger.error()` (which sends to Sentry)
- Returns error status without throwing exceptions
- Development mode logs successful sends for debugging

### Email Draft System

The app uses a **draft-based approval workflow** for all client emails:

1. **Draft Creation:** Daily digest drafts are created manually via "Generate daily digests" button
2. **Draft Storage:** All drafts stored in `email_drafts` table with `status = 'pending'`
3. **User Review:** Forwarders review, edit subject/body, and enter recipient email
4. **Approval:** Forwarders mark drafts as ready (`approved_by_user_id` set)
5. **Sending:** Forwarders send approved drafts via "Send now" button

### Daily Digest System

**How It Works:**
- **Manual Trigger:** User clicks "Generate daily digests" button on `/dashboard/client-updates`
- **Function:** `createDailyDigestDraftsForToday()` in `lib/data/email-drafts-actions.ts`
- **Time Windows:** Supports `'all'`, `'last_24_hours'`, or `'last_3_days'` (via `DigestTimeWindow` type)
- **Process:**
  1. Fetches all lists for current organization
  2. For each list, fetches alerts based on selected time window using `fetchAlertsForListToday()`
  3. Fetches containers associated with those alerts
  4. Computes derived fields for each container (status, fees, detention info)
  5. Groups containers into buckets:
     - **Overdue:** Containers with `status = 'Overdue'`
     - **Warning:** Containers with `status = 'Warning'`
     - **Detention:** Containers with `detention_chargeable_days > 0`
     - **Closed:** Containers with `is_closed = true`
  6. Builds digest content via `buildDailyDigestForList()` formatter
  7. Creates one `email_drafts` row per list with:
     - `event_type = 'daily_digest'`
     - `container_id = null` (list-level, not container-specific)
     - `status = 'pending'`
     - `to_email = null` (user must enter)
     - `metadata` contains `list_id`, `list_name`, and alert summary
  8. Skips lists with no alerts or if digest already exists today

**Digest Content Formatting:**

**File:** `lib/email/dailyDigestFormatter.ts` - `buildDailyDigestForList()`

**Output:**
- **Subject:** Auto-generated based on container counts (e.g., "Daily Digest: 5 Overdue, 3 Warning")
- **Body Text:** Plain text format with:
  - Summary counts for each bucket
  - Detailed list of containers in each category
  - Container numbers, ports, days left, fees
  - Links to dashboard alerts page
- **Body HTML:** HTML version with same content (for rich email clients)

**Draft Fields:**
- `organization_id` - Tenant isolation
- `container_id` - NULL for digest drafts (list-level)
- `event_type` - `'daily_digest'` (only active event type)
- `status` - `'pending'`, `'sent'`, or `'skipped'`
- `to_email` - Recipient email (user-entered, nullable)
- `subject` - Auto-generated digest subject
- `body_text` - Auto-generated digest body (plain text)
- `metadata` - JSONB with list info and alert summary
- `approved_by_user_id` - User who approved (required before sending)
- `generated_at` - Timestamp when draft was created
- `sent_at` - Timestamp when email was sent (nullable)
- `last_error` - Last send error message (nullable)

**Sending Process:**
1. User edits draft (enters `to_email`, can modify subject/body)
2. User approves draft (sets `approved_by_user_id`)
3. User clicks "Send now" → calls `sendClientEmailForDraft()`
4. Validates: draft is pending, approved, and has recipient email
5. Calls `sendAlertEmail()` via Resend with:
   - `to`: Draft's `to_email`
   - `subject`: Draft's `subject`
   - `text`: Draft's `body_text`
   - `html`: Optional HTML version (if available)
   - `replyTo`: Can be configured per organization
6. On success: Updates `status = 'sent'`, sets `sent_at`
7. On failure: Updates `last_error`, keeps status as 'pending' for retry

### Alert Creation (No Email Drafts)

**File:** `lib/data/alerts-logic.ts` - `createAlertsForContainerChange()`

**Alert Types Created:**
- `became_warning` - Free time running low (severity: 'warning')
- `became_overdue` - Demurrage started (severity: 'critical')
- `detention_started` - Detention accruing (severity: 'critical')
- `container_closed` - Container completed (severity: 'info')

**Important:** Alerts are **still created** for all event types, but **NO email drafts are automatically created**. Alerts are used for:
- UI dashboard display
- Daily digest generation
- Analytics and reporting

**Legacy System Removed:**
- The previous per-container email draft system has been removed
- No automatic draft creation on container state changes
- All client emails now go through the daily digest system

---

### 7. Error Monitoring & Observability (Sentry)

**Files:**
- `sentry.client.config.ts` - Client-side Sentry initialization
- `sentry.server.config.ts` - Server-side Sentry initialization
- `sentry.edge.config.ts` - Edge runtime (middleware) Sentry initialization
- `lib/config/sentry-env.ts` - Centralized Sentry environment configuration
- `instrumentation.ts` - Next.js instrumentation hook
- `lib/utils/logger.ts` - Logger utility with Sentry integration
- `app/error-boundary.tsx` - Global error boundary with Sentry (unhandled rejections/window errors)
- `app/dashboard/error.tsx` - Route-level error boundary
- `next.config.js` - Sentry build configuration

### Sentry Configuration

**SDK Version:** `@sentry/nextjs@^10.28.0`

**Runtime Support:**
- ✅ **Client (Browser):** `sentry.client.config.ts`
- ✅ **Server (Node.js):** `sentry.server.config.ts`
- ✅ **Edge (Middleware):** `sentry.edge.config.ts`

**Environment Variables:**
- `SENTRY_DSN` - DSN for server/edge runtimes
- `NEXT_PUBLIC_SENTRY_DSN` - DSN for browser/client runtime
- `SENTRY_ENVIRONMENT` - Optional environment name (defaults to `NODE_ENV`)

**Configuration Details:**

**Client Runtime (`sentry.client.config.ts`):**
- DSN sourced from `lib/config/sentry-env.ts` → `NEXT_PUBLIC_SENTRY_DSN`
- Environment-aware sampling:
  - Production: 10% of transactions (`tracesSampleRate: 0.1`)
  - Non-production: 100% of transactions (`tracesSampleRate: 1.0`)
- `sendDefaultPii: false` - Privacy-friendly (no automatic PII collection)
- `enableLogs: true` - Logs sent to Sentry

**Server Runtime (`sentry.server.config.ts`):**
- DSN sourced from `lib/config/sentry-env.ts` → `SENTRY_DSN`
- Same sampling strategy as client
- `sendDefaultPii: false` - Privacy-friendly
- `enableLogs: true` - Logs sent to Sentry

**Edge Runtime (`sentry.edge.config.ts`):**
- DSN sourced from `lib/config/sentry-env.ts` → `SENTRY_DSN`
- Same sampling strategy as client/server
- `sendDefaultPii: false` - Privacy-friendly
- `enableLogs: true` - Logs sent to Sentry

**Build Configuration (`next.config.js`):**
- Wrapped with `withSentryConfig()` from `@sentry/nextjs`
- Organization: `terminalflow`
- Project: `javascript-nextjs`
- Silent mode enabled (reduces build output noise)
- Source maps automatically uploaded during build

**Content Security Policy:**
- Sentry domains added to CSP `connect-src`:
  - `https://*.sentry.io`
  - `https://*.ingest.sentry.io`
  - `https://*.ingest.de.sentry.io`

### Logger Integration

**File:** `lib/utils/logger.ts`

**Sentry Integration:**
- Error-level logs automatically sent to Sentry via `Sentry.captureException()`
- Extracts Error objects from context automatically
- Adds tags: `{ loggerLevel: 'error' }`
- Includes extra context (non-error data) in Sentry events
- Smart error extraction:
  - Checks context for Error objects
  - Checks payload.context for Error objects
  - Looks for common error property names (`error`, `err`, `reason`)
  - Creates Error from message if no Error object found

**Logger Methods:**
- `logger.log()` - Development only
- `logger.info()` - Development only
- `logger.debug()` - Development only
- `logger.warn()` - Development only
- `logger.error()` - Always logs + sends to Sentry
- `logger.time()` / `logger.timeEnd()` - Performance timing (dev only)

**Usage Pattern:**
```typescript
import { logger } from '@/lib/utils/logger'

// Error logging (automatically sent to Sentry)
logger.error('Failed to fetch containers', { 
  containerId, 
  error: err 
})

// Debug logging (development only)
logger.debug('Container fetched', { containerId })
```

### Error Boundaries

**Global Error Boundary (`app/error-boundary.tsx`):**
- Catches unhandled promise rejections
- Catches window errors
- Filters noise errors (Fast Refresh, ChunkLoadError, ResizeObserver, etc.)
- Sends filtered errors to Sentry with tags:
  - `{ source: 'unhandled-rejection' }` for promise rejections
  - `{ source: 'window-error' }` for window errors
- Shows user-friendly toast notifications
- Prevents default browser error logging spam

**Route Error Boundary (`app/dashboard/error.tsx`):**
- Catches errors in dashboard routes
- Uses `Sentry.captureException()` directly
- Provides retry mechanism for users

### Environment Configuration

**File:** `lib/config/sentry-env.ts`

**Features:**
- Centralized DSN and environment configuration
- Production warnings if DSNs are missing (does not throw)
- Falls back to `NODE_ENV` if `SENTRY_ENVIRONMENT` not set
- Clear error messages for missing configuration

**Next.js Instrumentation (`instrumentation.ts`):**
- Automatically loads server config when `NEXT_RUNTIME === "nodejs"`
- Automatically loads edge config when `NEXT_RUNTIME === "edge"`
- Client config loaded automatically by Sentry SDK

### Sentry Features Enabled

1. **Error Tracking:**
   - Automatic exception capture
   - Manual capture via `Sentry.captureException()`
   - Logger integration for error-level logs

2. **Performance Monitoring:**
   - Transaction sampling (10% in production, 100% in dev)
   - Automatic instrumentation of Next.js routes
   - Custom transaction tracking support

3. **Logs:**
   - `enableLogs: true` in all configs
   - Logs sent alongside errors and transactions

4. **Privacy:**
   - `sendDefaultPii: false` - No automatic PII collection
   - User identification must be explicit if needed

### Best Practices

- ✅ All three runtimes configured consistently
- ✅ Environment-aware sampling (cost control)
- ✅ Privacy-friendly defaults (no PII)
- ✅ Centralized configuration via `sentry-env.ts`
- ✅ Logger integration for automatic error reporting
- ✅ Error boundaries catch and report errors
- ✅ CSP configured for Sentry domains
- ✅ Build-time source map upload configured

## 8. Multi-List Management

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

### 9. CSV/Excel Import

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

### 10. Analytics & Reporting

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

### 11. Public Pages

#### Landing Page (`app/page.tsx`)
- **Public marketing site** (no authentication required)
- Hero section with value proposition
- Feature showcase with screenshots
- Problem/solution sections
- Call-to-action buttons
- Redirects authenticated users to `/dashboard`

#### Pricing Page (`app/pricing/page.tsx`)
- **Public pricing information**
- Early Access and Team plan details
- Feature comparison
- Contact information for sales inquiries

---

### 12. Additional Data Management Features

#### Carrier Defaults (`lib/data/carrier-actions.ts`)
- Save default fee structures per carrier
- Auto-populate container forms with carrier defaults
- Manage carrier-specific tiered rates

#### Data Export/Import (`lib/data/data-management-actions.ts`)
- Export all organization data (JSON backup format)
- Import organization data from backup (containers only)
- Clear organization data (containers and history, with confirmation dialog)

#### User & Organization Management
- **User Actions** (`lib/data/user-actions.ts`): Profile management, organization lookup
- **Organization Actions** (`lib/data/organization-actions.ts`): Organization information
- **Settings Actions** (`lib/data/settings-actions.ts`): User and organization settings

#### History & Export
- **History Actions** (`lib/data/history-actions.ts`): Activity log management, clear history
- **Export Actions** (`lib/data/export-actions.ts`): CSV export with filtering

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

#### `PublicShell` (`components/layout/PublicShell.tsx`)
- Layout wrapper for public pages (landing, pricing)
- Includes PublicHeader and PublicFooter
- No authentication required

#### `PublicHeader` (`components/layout/PublicHeader.tsx`)
- TerminalFlow logo
- Navigation links
- Login/Get Started CTA

#### `PublicFooter` (`components/layout/PublicFooter.tsx`)
- Footer content for public pages
- Links and company information

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

### `/api/debug/overdue-candidates` (GET)
**File:** `app/api/debug/overdue-candidates/route.ts`

**Purpose:** Debug endpoint to view containers that would trigger overdue alerts

**Returns:** List of overdue candidates with container details

---

### `/api/debug/backfill-overdue-alerts` (POST)
**File:** `app/api/debug/backfill-overdue-alerts/route.ts`

**Purpose:** Debug endpoint to manually trigger overdue alert backfill

**Returns:** Summary of alerts created

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
│   │   ├── client-updates/        # Email draft management
│   │   │   └── page.tsx          # Client Updates page
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
│   │   ├── AppLayout.tsx         # Dashboard layout
│   │   ├── PublicShell.tsx       # Public page layout
│   │   ├── PublicHeader.tsx      # Public header
│   │   ├── PublicFooter.tsx     # Public footer
│   │   ├── Sidebar.tsx          # Dashboard sidebar
│   │   └── Topbar.tsx           # Dashboard topbar
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
│   │   ├── env.ts               # Environment variables
│   │   └── sentry-env.ts        # Sentry configuration
│   ├── constants/                # Application constants
│   │   ├── containers.ts        # Container-related constants
│   │   └── nav.ts               # Navigation constants
│   ├── csv/                      # CSV utilities
│   │   └── containers-serializer.ts # Container CSV serialization
│   ├── data/                     # Data layer (Supabase operations)
│   │   ├── alerts-actions.ts    # Alert CRUD
│   │   ├── alerts-logic.ts      # Alert creation logic
│   │   ├── carrier-actions.ts   # Carrier defaults management
│   │   ├── containers-actions.ts # Container CRUD
│   │   ├── data-management-actions.ts # Data export/import/clear
│   │   ├── email-drafts-actions.ts # Email draft management
│   │   ├── export-actions.ts    # CSV export functionality
│   │   ├── history-actions.ts   # Activity history
│   │   ├── lists-actions.ts      # List CRUD
│   │   ├── organization-actions.ts # Organization management
│   │   ├── overdue-sweep.ts     # Alert backfill for overdue/warning
│   │   ├── settings-actions.ts  # User/organization settings
│   │   ├── user-actions.ts      # User profile management
│   │   ├── import-commit.ts     # CSV import
│   │   ├── migrateLegacyMilestones.ts # Legacy data migration
│   │   ├── useContainers.ts     # Container hook
│   │   └── useLists.ts          # Lists hook
│   ├── email/                    # Email sending & formatting
│   │   ├── clientEmailFormatter.ts # Email event types
│   │   ├── dailyDigestFormatter.ts # Daily digest content builder
│   │   └── sendAlertEmail.ts    # Resend helper
│   ├── hooks/                    # Custom hooks
│   │   ├── useClientSearchParams.ts # URL search params hook
│   │   └── useRealtimeAlerts.ts # Real-time alert subscription
│   ├── import/                   # Import utilities
│   │   ├── error-report.ts      # Import error reporting
│   │   ├── fields.ts            # Field definitions
│   │   ├── header-map.ts        # Header mapping
│   │   ├── parser.ts            # File parsing
│   │   └── validate.ts          # Validation logic
│   ├── rate-limit/              # Rate limiting
│   │   └── simpleLimiter.ts    # Simple rate limiter
│   ├── types/                    # Type definitions
│   │   └── containers.ts        # Container types
│   ├── supabase/                 # Supabase clients
│   │   ├── server.ts            # Server client
│   │   ├── client.ts            # Browser client
│   │   └── middleware.ts        # Middleware client
│   ├── utils/                    # Utility functions
│   │   ├── containers.ts        # Derived fields computation
│   │   ├── date-range.ts        # UTC date range helpers
│   │   ├── download-csv.ts      # CSV download helper
│   │   ├── download.ts          # File download utilities
│   │   ├── error-handler.ts     # Error handling utilities
│   │   ├── milestones.ts        # Milestone resolution
│   │   ├── logger.ts            # Logging utility
│   │   └── navigation.ts        # Navigation helpers
│   ├── utils.ts                 # General utilities
│   └── tierUtils.ts             # Tiered fee calculations
│
├── types/                        # TypeScript types
│   └── database.ts              # Supabase-generated types
│
├── middleware.ts                 # Next.js middleware (auth)
├── instrumentation.ts            # Next.js instrumentation (Sentry)
├── sentry.client.config.ts      # Sentry client config
├── sentry.server.config.ts      # Sentry server config
├── sentry.edge.config.ts        # Sentry edge config
├── next.config.js               # Next.js configuration
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── public/                       # Static assets
    └── images/                   # Marketing images
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
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Email (Resend)
RESEND_API_KEY=your_resend_key
EMAIL_FROM=alerts@terminalflow.app

# Sentry Error Monitoring
SENTRY_DSN=your_sentry_dsn_for_server_edge
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn_for_client
SENTRY_ENVIRONMENT=production  # Optional, defaults to NODE_ENV

# Sentry Build (CI/CD only)
SENTRY_AUTH_TOKEN=your_sentry_auth_token  # For source map uploads
SENTRY_ORG=terminalflow
SENTRY_PROJECT=javascript-nextjs
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
- Enterprise-grade error monitoring (Sentry integration)
- Production-ready email system (Resend with draft approval workflow)

**Architecture Highlights:**
- No background jobs or cron tasks
- All updates are user-initiated
- Derived fields computed on-read (never stored)
- Alerts created only on container updates
- Email notifications via manual daily digest generation
- Error monitoring via Sentry (client, server, edge)
- Privacy-friendly defaults (no automatic PII collection)

**Monitoring & Observability:**
- Sentry error tracking across all runtimes
- Centralized logger with automatic Sentry integration
- Error boundaries catch and report unhandled errors
- Performance monitoring with environment-aware sampling
- Source maps uploaded for better error debugging

**Email System:**
- Resend API for reliable email delivery
- Draft-based approval workflow for all client emails
- Daily digest system with time window support
- Support for plain text and HTML emails
- Reply-to address support for client communication

The application is production-ready and follows Next.js and React best practices throughout.

