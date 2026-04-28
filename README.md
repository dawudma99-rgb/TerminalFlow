# TerminalFlow

**Demurrage & detention tracking for freight operations.**

TerminalFlow gives logistics teams a single place to monitor every container's free-time status, surface cost exposure before charges accumulate, and keep clients informed — all in real time.

---

## Overview

Demurrage and detention charges are one of the largest hidden costs in shipping. Most teams manage them in spreadsheets, miss deadlines, and pay avoidable fees. TerminalFlow replaces that workflow with a purpose-built operations platform.

- Track every container's arrival date, free days, and milestone status
- Get warnings before free time expires, and see which containers are already overdue
- Calculate projected cost exposure across your entire fleet
- Generate client update emails and alert histories automatically
- Import from CSV/Excel, export for reporting

---

## Features

### Container Control Room
The core workspace. A filterable, searchable table of all active containers with real-time status indicators (Safe / Warning / Overdue), infinite scroll for large fleets, and bulk actions for mass updates or deletions.

- Filter by status, owner, or free-text search across container number, carrier, POL/POD
- Toggle between demurrage view, detention view, or both simultaneously
- Import containers from CSV or Excel with a dry-run preview before committing
- Export filtered results to CSV for reporting or handoff

### Operational Dashboard
A command-centre overview that updates every 50 seconds and reacts to real-time alert events.

- **6 KPI cards** — Projected 7-day cost, Total Active, Overdue, At Risk Soon, Detention Running, New Today
- **Critical Issues panel** — top overdue and detention containers, sorted by urgency and total fees
- **At Risk Soon panel** — warning-status containers sorted by days remaining
- **Today's Activity feed** — live alert history for the current day
- **List Overview** — container health breakdown per client list

### Analytics
Server-rendered analytics page with no client loading states.

- Status distribution chart (Safe / Warning / Overdue / Closed)
- Overdue trend over time (Recharts line chart)
- Port performance table — throughput and risk score per POD
- Client & list analytics — container distribution and average free days per list
- Detention exposure summary
- Top 20 at-risk containers ranked by urgency

### Carrier Fee Templates
Define tiered or flat-rate demurrage and detention fee schedules per carrier (Maersk, MSC, CMA CGM, etc.). Templates auto-fill when creating or editing containers, so fee calculations are always accurate.

- Supports tiered pricing (e.g. £50/day days 1–5, £100/day days 6–10)
- Separate demurrage and detention configurations per carrier
- Flat-rate fallback when tiers aren't needed

### Alerts & Client Updates
- Automated alert triggers when containers enter Warning or Overdue status
- Alert history with full audit trail
- Client update emails generated and sent via Resend, with a full email history view

### Lists
Organize containers into named lists (by client, trade lane, vessel, etc.). The dashboard and analytics respect the active list context, making it easy to manage large multi-client operations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database & Auth | Supabase (Postgres + Row-Level Security) |
| Realtime | Supabase Realtime (alert subscriptions) |
| Styling | Tailwind CSS v4 + shadcn/ui + Radix UI |
| Data Fetching | SWR (client), Next.js server components (SSR) |
| Charts | Recharts |
| Animations | Framer Motion |
| Email | Resend |
| File Parsing | PapaParse (CSV), SheetJS (Excel) |
| Validation | Zod |
| Error Monitoring | Sentry (client, server, and edge runtimes) |
| Testing | Node.js built-in test runner + jsdom |

---

## Architecture

```
app/
├── dashboard/
│   ├── page.tsx                  # Server component — SSR dashboard data
│   ├── DashboardContent.tsx      # Client component — SWR refresh + realtime
│   ├── containers/               # Container Control Room
│   │   ├── page.tsx              # Main containers page
│   │   └── components/           # Table, filters, bulk actions, import/export
│   ├── analytics/page.tsx        # Fully server-rendered analytics
│   ├── alerts/                   # Alert management + history
│   ├── client-updates/           # Client email generation + history
│   └── settings/page.tsx         # Carrier templates + alert config
├── api/
│   ├── alerts/                   # Alert trigger endpoint
│   └── email/send-alert/         # Resend email dispatch
lib/
├── data/                         # Server actions (containers, lists, alerts, settings)
├── analytics.ts                  # Pure functions for all KPI calculations
├── auth/                         # Supabase auth hooks
├── hooks/                        # useRealtimeAlerts, useInfiniteScroll
└── utils/                        # Date helpers, milestones, tier calculations
components/
├── analytics/                    # Chart and table components
├── dashboard/                    # KPI cards, activity feed, list overview
├── import/                       # Import dialog with dry-run preview
└── ui/                           # Shared design system (shadcn/ui base)
```

Key patterns:
- **Server components for initial data** — dashboard and analytics pages fetch on the server, so there's no loading flicker on first paint
- **SWR with `fallbackData`** — client-side refreshes hydrate from server props, keeping the UI stable
- **Org-scoped RLS** — all Supabase queries are filtered by `organization_id` at the database level; no cross-tenant data leakage is possible at the application layer
- **Debounced realtime** — alert subscriptions trigger a SWR revalidation with an 8-second cooldown to avoid request storms

---

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- A Resend account (for email alerts)

### Installation

```bash
git clone https://github.com/dawudma99-rgb/terminalflow.git
cd terminalflow
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_DSN=your_sentry_dsn
```

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other Commands

```bash
npm run build       # Production build
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm test            # Run tests
```

---

## License

Private repository. All rights reserved.
