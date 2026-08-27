-- ============================================================
-- InfoBridgeIndia v2.0
-- COMPANY MEMBER PERMISSIONS
-- Current token-less Company Member Appointment architecture
--
-- Purpose:
-- - Individual active member permissions
-- - Permission updates
-- - Member access removal
--
-- Does NOT depend on retired invitation tables.
-- Safe to rerun.
-- ============================================================

create schema if not exists private;


-- ============================================================
-- 1. ENSURE PERMISSIONS COLUMN EXISTS
-- ============================================================

alter table public.company_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;


-- ============================================================
-- 2. COMPANY ROLE DIRECTORY
--
-- IMPORTANT:
-- Drop first because PostgreSQL cannot CREATE OR REPLACE
-- a function when its RETURNS TABLE structure has changed.
--
-- Current architecture reads department information directly
-- from public.company_members.
-- No old invitation table dependency.
-- ============================================================

drop function if exists public.company_role_directory(uuid);


create function public.company_role_directory(
  p_company_id uuid
)
returns table(
  member_id uuid,
  user_id uuid,
  full_name text,
  email text,
  "position" text,
  department_name text,
  is_department_head boolean,
  system_role text,
  status text,
  permissions jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin

  if not private.can_manage_company_members(p_company_id) then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;

  return query

    -- Company Owner
    select
      null::uuid as member_id,
      c.owner_id as user_id,
      c.name::text as full_name,
      coalesce(u.email, '')::text as email,
      ''::text as "position",
      ''::text as department_name,
      false as is_department_head,
      'owner'::text as system_role,
      'active'::text as status,
      '{}'::jsonb as permissions

    from public.companies c

    left join auth.users u
      on u.id = c.owner_id

    where c.id = p_company_id


    union all


    -- Active Company Members
    select
      m.id as member_id,
      m.user_id,
      m.full_name,
      m.email,
      m.position,
      coalesce(m.department_name, '')::text,
      coalesce(m.is_department_head, false),
      m.system_role,
      m.status,
      coalesce(m.permissions, '{}'::jsonb)

    from public.company_members m

    where m.company_id = p_company_id
      and m.status = 'active'
      and m.system_role in (
        'company_admin',
        'company_member'
      );

end;
$$;


-- ============================================================
-- 3. UPDATE INDIVIDUAL COMPANY MEMBER PERMISSIONS
--
-- This is the actual "access key" RPC used by:
--
-- Administration
-- -> Roles & Permissions
-- -> Company Member Access
-- -> Edit Permissions
--
-- Checked permission   = ON
-- Unchecked permission = OFF
--
-- Updates ONLY the selected active company_member.
-- ============================================================

create or replace function public.update_company_member_permissions(
  p_company_id uuid,
  p_member_id uuid,
  p_permissions jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin

  if not private.can_manage_company_members(p_company_id) then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;


  if p_permissions is null
     or jsonb_typeof(p_permissions) <> 'object'
  then
    raise exception 'Permissions must be an object';
  end if;


  update public.company_members m

  set
    permissions = p_permissions,
    updated_at = now()

  where m.id = p_member_id
    and m.company_id = p_company_id
    and m.system_role = 'company_member'
    and m.status = 'active';


  if not found then
    raise exception 'Active Company Member not found';
  end if;


  return true;

end;
$$;


-- ============================================================
-- 4. REMOVE COMPANY MEMBER ACCESS
--
-- Soft removal only.
-- Does NOT delete the member or historical business data.
-- ============================================================

create or replace function public.remove_company_member_access(
  p_company_id uuid,
  p_member_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin

  if not private.can_manage_company_members(p_company_id) then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;


  update public.company_members m

  set
    status = 'inactive',
    updated_at = now()

  where m.id = p_member_id
    and m.company_id = p_company_id
    and m.system_role = 'company_member'
    and m.status = 'active';


  if not found then
    raise exception 'Active Company Member not found';
  end if;


  return true;

end;
$$;


-- ============================================================
-- 5. RPC SECURITY
-- ============================================================

revoke all
on function public.company_role_directory(uuid)
from public, anon;


revoke all
on function public.update_company_member_permissions(
  uuid,
  uuid,
  jsonb
)
from public, anon;


revoke all
on function public.remove_company_member_access(
  uuid,
  uuid
)
from public, anon;


grant execute
on function public.company_role_directory(uuid)
to authenticated;


grant execute
on function public.update_company_member_permissions(
  uuid,
  uuid,
  jsonb
)
to authenticated;


grant execute
on function public.remove_company_member_access(
  uuid,
  uuid
)
to authenticated;


-- ============================================================
-- 6. RELOAD SUPABASE POSTGREST SCHEMA CACHE
-- ============================================================

notify pgrst, 'reload schema';