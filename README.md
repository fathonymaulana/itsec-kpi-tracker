<div align="center">

# ITSEC KPI Tracker

**The internal performance dashboard ITSEC Asia uses to track, verify, and report on IT security KPIs — replacing a shared spreadsheet with a real, role-aware system.**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

</div>

---

## What this is

ITSEC KPI Tracker is a purpose-built internal tool for one workflow: departments enter their monthly KPI actuals, Corporate Planning reviews and verifies them, and the Board gets a real-time picture of how the whole organization is performing — without anyone touching a shared Excel file again.

It's opinionated about the parts that usually go wrong with spreadsheet-based reporting:

- **Frequency-aware status** — a KPI reported quarterly isn't compared against a monthly slice of its target. Status is computed against a target prorated by how far the current reporting period has elapsed, not a naive month-by-month check.
- **An audit trail, not tribal knowledge** — every submission carries a data source link/note, every verification is recorded with who and when, and locked (already-submitted) months can only be reopened through an explicit modify-request/approval flow.
- **Per-person accounts, not shared department PINs** — every user signs in as themselves, with their own PIN, avatar, and audit trail. Changing a PIN goes through Corporate Planning approval; the old PIN keeps working until then, so nobody gets locked out mid-change.

## Who uses it

The app has two roles, and Corporate Planning's role covers three distinct areas of the product:

| Role | Can do |
|---|---|
| **Department Head** | Enter monthly actuals for their own department's KPIs, attach data sources, submit a month for review, request to modify a submitted month, view their own department's dashboard/history |
| **Corporate Planning** | Everything above, plus: verify or flag every department's submissions, approve/reject modify requests, view the org-wide Board dashboard, and manage user accounts (create/deactivate users, approve PIN change requests, force-reset a PIN) |

## Feature highlights

- **Role-scoped dashboards** — a department's own trend view, and an org-wide Board view with per-department breakdowns, both with month/quarter/year-range comparisons
- **Calculated sub-metrics** — KPIs can define a formula sub-metric (e.g. a ratio) computed automatically from the raw sub-metrics a department enters, instead of being entered by hand
- **Data verification workflow** — Corporate Planning verifies or flags each submitted value, with an optional note; flagged/unverified items are visually distinct everywhere they appear
- **Modify-request flow for locked months** — once a month is submitted it's locked; a department head can request to reopen it with a reason, which Corporate Planning approves or rejects
- **Full user management** — Corporate Planning can create/deactivate accounts, force-reset a PIN, and review/approve/reject self-service PIN change requests, all from a dedicated admin console
- **Light/dark mode** — a real second theme (not an afterthought), including chart colors, status badges, and every overlay surface
- **Responsive down to mobile** — every table has a genuine card layout on small screens, not just horizontal scroll
- **Polished motion** — GSAP-driven dialog/drawer transitions and Framer Motion panel animations throughout, tuned rather than left at defaults

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 14](https://nextjs.org/) (App Router), [TypeScript](https://www.typescriptlang.org/) |
| Database & Auth | [Supabase](https://supabase.com/) (Postgres, Row Level Security, Storage for avatars) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) v3, [shadcn/ui](https://ui.shadcn.com/) on [Base UI](https://base-ui.com/) primitives |
| Charts | [Recharts](https://recharts.org/) |
| Motion | [GSAP](https://gsap.com/) + [@gsap/react](https://www.npmjs.com/package/@gsap/react), [Framer Motion](https://www.framer.com/motion/) |
| Icons | [Solar Icons](https://www.npmjs.com/package/@solar-icons/react-perf) |
| Auth | Custom JWT (`jsonwebtoken`), PIN hashing via `bcryptjs` — no third-party auth provider |
| Toasts | [Sonner](https://sonner.emilkowal.ski/) |
| Deployment | [Vercel](https://vercel.com/) |

## Getting started

### Prerequisites

- Node.js 18.18 or later
- A [Supabase](https://supabase.com/) project (free tier is enough for development)

### 1. Clone and install

```bash
git clone https://github.com/fathonymaulana/itsec-kpi-tracker.git
cd itsec-kpi-tracker
npm install
```

### 2. Set up the database

Run [`supabase/schema.sql`](./supabase/schema.sql) against your Supabase project — either paste it into the SQL Editor in the Supabase dashboard, or via the CLI:

```bash
supabase db push --db-url "postgresql://..."
```

This creates every table, enum, and Row Level Security policy the app needs.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — **service role key**, never exposed to the client |
| `JWT_SECRET` | Generate your own: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 4. Seed initial users

```bash
npm run seed
```

This reads `scripts/seed-pins.json` (copy `scripts/seed-pins.example.json` first) to create department accounts and their initial PINs.

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the sign-in page.

## Project structure

```
app/
├── api/               # Route handlers — auth, actuals, verifications, modify-requests, admin
├── dept/              # Department Head: data entry + department dashboard
├── admin/             # Corporate Planning: data review & verification console
├── board/             # Corporate Planning: org-wide Board dashboard
├── super-admin/       # Corporate Planning: user management & PIN request approval
├── profile/           # Every role: avatar, display name, PIN change request
├── login/             # Sign-in
└── (privacy|cookies)/ # Static policy pages

components/
├── ui/                # shadcn primitives (Button, Dialog, Table, Tabs, ...)
├── kpi/               # KpiCard, MonthGrid, date pickers, data source/modify-request modals
└── layout/            # Nav, animated panels, mobile drawer, page skeletons

lib/                   # Auth (client + server), KPI status/frequency logic, Supabase clients
supabase/schema.sql    # Full database schema (tables, enums, RLS policies)
scripts/seed.mjs       # Seeds initial department accounts from seed-pins.json
```

## Deployment

The app is built to deploy to [Vercel](https://vercel.com/) with zero extra configuration — connect the repository, set the same three environment variables in the Vercel project settings, and deploy. `next build` is a standard Next.js App Router build; no custom server or edge runtime is required.

## Contributing

This is an internal tool for ITSEC Asia, but the code is open under the MIT license if it's useful as a reference for your own KPI/reporting workflow. Issues and pull requests are welcome.

## License

[MIT](./LICENSE) © 2026 Fathony Maulana
