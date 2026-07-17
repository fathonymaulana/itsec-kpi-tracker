-- ITSEC KPI Tracker — Postgres schema (Supabase)
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db execute -f supabase/schema.sql`).
-- All access goes through the server-side service-role client (see lib/supabase-server.ts) — never the
-- anon key from the browser — so RLS is enabled with no public/anon policies: a default-deny posture.

create extension if not exists "pgcrypto";

create type verification_status as enum ('pending', 'verified', 'flagged');
-- 'board' and 'super_admin' are retired values kept only because Postgres can't drop enum members
-- in place — both the standalone Board role and the standalone Super Admin role were merged into
-- corp_planning (which now covers the executive dashboard, data verification, and user management);
-- application code no longer issues or accepts either value.
create type user_role as enum ('dept_head', 'corp_planning', 'board', 'super_admin');

create table departments (
  id text primary key,
  name text not null
);

-- Per-person accounts. Replaces the old shared department/role PIN login: every person gets their
-- own name, avatar, and PIN, and multiple people can belong to the same department.
create table users (
  id bigint generated always as identity primary key,
  name text not null,
  avatar_url text,
  pin_hash text not null,
  role user_role not null,
  dept_id text references departments(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on users (dept_id);

-- Self-service PIN changes don't take effect immediately — they sit here until a corp_planning
-- user approves or rejects them; the old PIN keeps working in the meantime (see
-- app/api/users/me/pin-request and app/api/super-admin/pin-requests).
create table pin_change_requests (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  new_pin_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by bigint references users(id),
  review_note text
);
create index on pin_change_requests (status) where status = 'pending';

create table kpis (
  id bigint generated always as identity primary key,
  dept_id text not null references departments(id) on delete cascade,
  kpi_name text not null,
  target_text text,
  numeric_target numeric,
  direction integer default 1,
  frequency text
);

create table sub_metrics (
  id bigint generated always as identity primary key,
  kpi_id bigint not null references kpis(id) on delete cascade,
  name text not null,
  is_calc boolean not null default false,
  formula_key text,
  calc_input_positions text,
  unit text default '',
  display_order integer,
  -- This sub-metric's own target/direction, exactly as defined in the source spreadsheet (per-row, not
  -- per-KPI). NULL means it's a pure feeder input with no individually tracked target — the UI shows no
  -- status badge for it. direction=0 is a valid, meaningful value ("review manually"), distinct from NULL
  -- ("not tracked") — always treat them separately, never coalesce 0 into NULL.
  numeric_target numeric,
  direction integer
);

create table actuals (
  id bigint generated always as identity primary key,
  sub_metric_id bigint not null references sub_metrics(id) on delete cascade,
  year integer not null default 2026,
  month integer not null,
  value numeric,
  data_source_url text,
  data_source_note text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  unique (sub_metric_id, year, month)
);

create table verifications (
  id bigint generated always as identity primary key,
  kpi_id bigint not null references kpis(id) on delete cascade,
  dept_id text not null references departments(id) on delete cascade,
  year integer not null,
  month integer not null,
  verified_by text default 'corp_planning',
  verified_at timestamptz not null default now(),
  status verification_status not null default 'pending',
  note text,
  unique (kpi_id, dept_id, year, month)
);

create table anomalies (
  id bigint generated always as identity primary key,
  sub_metric_id bigint not null references sub_metrics(id) on delete cascade,
  year integer not null,
  month integer not null,
  anomaly_type text,
  description text,
  detected_at timestamptz not null default now(),
  dismissed boolean not null default false,
  resolved_note text
);

create table submissions (
  id bigint generated always as identity primary key,
  dept_id text not null references departments(id) on delete cascade,
  year integer not null,
  month integer not null,
  submitted_at timestamptz not null default now(),
  unique (dept_id, year, month)
);

-- A dept_head can't edit a KPI once its month is submitted (locked). To fix a mistake after the
-- fact, they file a modify_request explaining why; approving it deletes the submissions row for
-- that dept/year/month (see app/api/modify-requests/[id]), which unlocks the whole month again.
create table modify_requests (
  id bigint generated always as identity primary key,
  kpi_id bigint not null references kpis(id) on delete cascade,
  dept_id text not null references departments(id) on delete cascade,
  year integer not null,
  month integer not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by bigint not null references users(id),
  requested_at timestamptz not null default now(),
  reviewed_by bigint references users(id),
  reviewed_at timestamptz,
  review_note text
);

create index on kpis (dept_id);
create index on sub_metrics (kpi_id);
create index on actuals (sub_metric_id, year, month);
create index on verifications (dept_id, year, month);
create index on anomalies (sub_metric_id, year, month) where not dismissed;
create index on submissions (dept_id, year, month);
create index on modify_requests (dept_id, year, month);
create index on modify_requests (status);

alter table departments enable row level security;
alter table users enable row level security;
alter table pin_change_requests enable row level security;
alter table kpis enable row level security;
alter table sub_metrics enable row level security;
alter table actuals enable row level security;
alter table verifications enable row level security;
alter table anomalies enable row level security;
alter table submissions enable row level security;
alter table modify_requests enable row level security;
-- No policies are defined: with RLS enabled and zero policies, every table denies all access to the
-- anon/authenticated roles. The service-role key used by lib/supabase-server.ts bypasses RLS entirely,
-- which is how the app's own auth layer (app/api/**, JWT-gated) stays the single source of truth.

-- Public-read Storage bucket for profile avatars. Writes only ever go through the service-role-backed
-- /api/users/me/avatar route (never a direct client upload), so no Storage RLS policies are needed.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
