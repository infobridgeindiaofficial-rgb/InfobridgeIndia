-- Run once in the Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  legal_name text not null,
  business_type text not null,
  state text not null,
  gst_registered boolean not null default false,
  gstin text,
  vat_registered boolean not null default false,
  trn text,
  trade_license_number text,
  trade_license_expiry_date date,
  tax_system text,
  tax_number text,
  address text,
  logo text,
  country text not null default 'IN',
  currency text not null default 'INR',
  date_format text not null default 'DD/MM/YYYY',
  financial_year text not null,
  invoice_prefix text not null default 'INV',
  quotation_prefix text not null default 'QUO',
  profile_complete boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_gstin_check check (not gst_registered or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$')
);

alter table public.companies add column if not exists profile_complete boolean not null default true;
alter table public.companies add column if not exists vat_registered boolean not null default false;
alter table public.companies add column if not exists trn text;
alter table public.companies add column if not exists trade_license_number text;
alter table public.companies add column if not exists trade_license_expiry_date date;
alter table public.companies add column if not exists tax_system text;
alter table public.companies add column if not exists tax_number text;

-- Existing rows predate country codes and are India/GST companies.
update public.companies set country = 'IN' where country is null or country in ('India', 'IND', 'IN');
update public.companies set country = 'AE' where country in ('United Arab Emirates', 'UAE');
update public.companies set tax_system = case when country = 'AE' then 'VAT' else 'GST' end where tax_system is null;
update public.companies set tax_number = case when country = 'AE' then trn else gstin end where tax_number is null;
alter table public.companies alter column country set default 'IN';
alter table public.companies drop constraint if exists companies_trn_check;
alter table public.companies add constraint companies_trn_check check (trn is null or trn ~ '^[0-9]{15}$');

-- Supabase/PostgREST may otherwise retain the pre-migration column list briefly.
notify pgrst, 'reload schema';

create table if not exists public.workspace_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module text not null,
  collection text not null,
  record_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, module, collection, record_id)
);

create index if not exists workspace_records_owner_company_idx on public.workspace_records(owner_id, company_id);
alter table public.companies enable row level security;
alter table public.workspace_records enable row level security;

drop policy if exists "owners manage their company" on public.companies;
create policy "owners manage their company" on public.companies for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "owners manage their workspace records" on public.workspace_records;
create policy "owners manage their workspace records" on public.workspace_records for all to authenticated
using (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid()))
);

revoke all on public.companies, public.workspace_records from anon;
grant select, insert, update, delete on public.companies, public.workspace_records to authenticated;
