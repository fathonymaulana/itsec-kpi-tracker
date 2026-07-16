-- ITSEC KPI Tracker — Postgres schema (Supabase)
-- Run once against a fresh Supabase project (SQL Editor, or `supabase db execute -f supabase/schema.sql`).
-- All access goes through the server-side service-role client (see lib/supabase-server.ts) — never the
-- anon key from the browser — so RLS is enabled with no public/anon policies: a default-deny posture.

create extension if not exists "pgcrypto";

create type verification_status as enum ('pending', 'verified', 'flagged');

create table departments (
  id text primary key,
  name text not null,
  pin_hash text not null
);

create table roles (
  role_key text primary key,
  pin_hash text not null,
  display_name text
);

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

create index on kpis (dept_id);
create index on sub_metrics (kpi_id);
create index on actuals (sub_metric_id, year, month);
create index on verifications (dept_id, year, month);
create index on anomalies (sub_metric_id, year, month) where not dismissed;
create index on submissions (dept_id, year, month);

alter table departments enable row level security;
alter table roles enable row level security;
alter table kpis enable row level security;
alter table sub_metrics enable row level security;
alter table actuals enable row level security;
alter table verifications enable row level security;
alter table anomalies enable row level security;
alter table submissions enable row level security;
-- No policies are defined: with RLS enabled and zero policies, every table denies all access to the
-- anon/authenticated roles. The service-role key used by lib/supabase-server.ts bypasses RLS entirely,
-- which is how the app's own auth layer (app/api/**, JWT-gated) stays the single source of truth.
