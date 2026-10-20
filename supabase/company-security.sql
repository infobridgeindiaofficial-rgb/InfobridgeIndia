-- Phase 2.5: company security foundation. Review and apply through the normal migration process.
-- Secrets and hashes live outside the exposed public schema. No existing company rows are rewritten.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.company_security (
  company_id uuid primary key references public.companies(id) on delete cascade,
  master_key_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  configured_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);

create table if not exists private.department_reset_keys (
  company_id uuid not null references public.companies(id) on delete cascade,
  module_id text not null,
  reset_key_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  configured_at timestamptz not null default now(),
  changed_at timestamptz not null default now(),
  primary key (company_id, module_id),
  constraint department_reset_module_check check (module_id in ('hr_payroll','sales_crm','purchases','inventory','finance','banking','projects'))
);

create table if not exists private.company_security_audit (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  module_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function private.is_company_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public, private
as $$ select exists(select 1 from public.companies where id=p_company_id and owner_id=auth.uid()) $$;

create or replace function private.valid_key(p_key text, p_min integer default 12)
returns boolean language sql immutable
as $$ select length(coalesce(p_key,'')) between p_min and 256 $$;

create or replace function private.audit_security(p_company_id uuid,p_action text,p_module text default null,p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = pg_catalog, public, private
as $$ insert into private.company_security_audit(company_id,actor_id,action,module_id,metadata) values(p_company_id,auth.uid(),p_action,p_module,coalesce(p_metadata,'{}'::jsonb)) $$;

create or replace function private.check_master_key(p_company_id uuid,p_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare s private.company_security; ok boolean;
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into s from private.company_security where company_id=p_company_id for update;
  if not found then return false; end if;
  if s.locked_until is not null and s.locked_until>now() then raise exception 'Security verification temporarily locked'; end if;
  ok := s.master_key_hash=extensions.crypt(coalesce(p_key,''),s.master_key_hash);
  if ok then update private.company_security set failed_attempts=0,locked_until=null where company_id=p_company_id;
  else update private.company_security set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now()+interval '15 minutes' else null end where company_id=p_company_id; end if;
  return ok;
end $$;

create or replace function public.company_security_status(p_company_id uuid)
returns table(master_configured boolean, department_modules text[]) language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  return query select exists(select 1 from private.company_security where company_id=p_company_id),coalesce((select array_agg(module_id order by module_id) from private.department_reset_keys where company_id=p_company_id),array[]::text[]);
end $$;

create or replace function public.configure_company_master_key(p_company_id uuid,p_new_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if exists(select 1 from private.company_security where company_id=p_company_id) then raise exception 'Master Key is already configured'; end if;
  if not private.valid_key(p_new_key,12) then raise exception 'Master Key must contain 12 to 256 characters'; end if;
  insert into private.company_security(company_id,master_key_hash) values(p_company_id,extensions.crypt(p_new_key,extensions.gen_salt('bf',12)));
  perform private.audit_security(p_company_id,'master_key_configured'); return true;
end $$;

create or replace function public.verify_company_master_key(p_company_id uuid,p_master_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin return private.check_master_key(p_company_id,p_master_key); end $$;

create or replace function public.change_company_master_key(p_company_id uuid,p_current_key text,p_new_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.check_master_key(p_company_id,p_current_key) then raise exception 'Master Key verification failed'; end if;
  if not private.valid_key(p_new_key,12) then raise exception 'Master Key must contain 12 to 256 characters'; end if;
  update private.company_security set master_key_hash=extensions.crypt(p_new_key,extensions.gen_salt('bf',12)),failed_attempts=0,locked_until=null,changed_at=now() where company_id=p_company_id;
  perform private.audit_security(p_company_id,'master_key_changed'); return true;
end $$;

create or replace function public.set_department_reset_key(p_company_id uuid,p_module_id text,p_master_key text,p_new_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare existed boolean;
begin
  if p_module_id not in ('hr_payroll','sales_crm','purchases','inventory','finance','banking','projects') then raise exception 'Unsupported reset module'; end if;
  if not private.check_master_key(p_company_id,p_master_key) then raise exception 'Master Key verification failed'; end if;
  if not private.valid_key(p_new_key,10) then raise exception 'Department Reset Key must contain 10 to 256 characters'; end if;
  existed:=exists(select 1 from private.department_reset_keys where company_id=p_company_id and module_id=p_module_id);
  insert into private.department_reset_keys(company_id,module_id,reset_key_hash) values(p_company_id,p_module_id,extensions.crypt(p_new_key,extensions.gen_salt('bf',12)))
  on conflict(company_id,module_id) do update set reset_key_hash=excluded.reset_key_hash,failed_attempts=0,locked_until=null,changed_at=now();
  perform private.audit_security(p_company_id,case when existed then 'department_reset_key_changed' else 'department_reset_key_configured' end,p_module_id); return true;
end $$;

create or replace function public.revoke_department_reset_key(p_company_id uuid,p_module_id text,p_master_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.check_master_key(p_company_id,p_master_key) then raise exception 'Master Key verification failed'; end if;
  delete from private.department_reset_keys where company_id=p_company_id and module_id=p_module_id;
  perform private.audit_security(p_company_id,'department_reset_key_revoked',p_module_id); return true;
end $$;

create or replace function private.check_department_key(p_company_id uuid,p_module_id text,p_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare s private.department_reset_keys; ok boolean;
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select * into s from private.department_reset_keys where company_id=p_company_id and module_id=p_module_id for update;
  if not found then return false; end if;
  if s.locked_until is not null and s.locked_until>now() then raise exception 'Security verification temporarily locked'; end if;
  ok:=s.reset_key_hash=extensions.crypt(coalesce(p_key,''),s.reset_key_hash);
  if ok then update private.department_reset_keys set failed_attempts=0,locked_until=null where company_id=p_company_id and module_id=p_module_id;
  else update private.department_reset_keys set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now()+interval '15 minutes' else null end where company_id=p_company_id and module_id=p_module_id; end if;
  return ok;
end $$;

create or replace function public.execute_department_reset(p_company_id uuid,p_module_id text,p_reset_key text,p_confirmation text)
returns integer language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare removed integer;
begin
  if p_module_id<>'hr_payroll' then raise exception 'Reset execution is not implemented for this module'; end if;
  if p_confirmation<>'RESET EMPLOYEES' then raise exception 'Explicit confirmation is required'; end if;
  if not private.check_department_key(p_company_id,p_module_id,p_reset_key) then raise exception 'Department Reset Key verification failed'; end if;
  delete from public.workspace_records where company_id=p_company_id and owner_id=auth.uid() and module='hr-payroll' and collection in ('employees','attendance','attendanceImports','attendanceMappings','attendanceCorrections','leaveBalances','leaveTransactions','payrollRuns','payrollAdjustments','payslips');
  get diagnostics removed=row_count;
  perform private.audit_security(p_company_id,'department_reset_executed',p_module_id,jsonb_build_object('rows_removed',removed)); return removed;
end $$;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on function public.company_security_status(uuid),public.configure_company_master_key(uuid,text),public.verify_company_master_key(uuid,text),public.change_company_master_key(uuid,text,text),public.set_department_reset_key(uuid,text,text,text),public.revoke_department_reset_key(uuid,text,text),public.execute_department_reset(uuid,text,text,text) from public,anon;
grant execute on function public.company_security_status(uuid),public.configure_company_master_key(uuid,text),public.verify_company_master_key(uuid,text),public.change_company_master_key(uuid,text,text),public.set_department_reset_key(uuid,text,text,text),public.revoke_department_reset_key(uuid,text,text),public.execute_department_reset(uuid,text,text,text) to authenticated;
