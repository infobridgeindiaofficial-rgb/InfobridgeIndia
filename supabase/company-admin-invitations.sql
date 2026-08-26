-- First Company Admin bootstrap invitation flow.
-- Apply manually in Supabase SQL Editor after review. Existing company rows are not rewritten.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  position text not null,
  system_role text not null,
  status text not null default 'active',
  invited_by uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_role_check check (system_role in ('company_admin')),
  constraint company_members_status_check check (status in ('active','inactive')),
  unique(company_id,user_id)
);
create unique index if not exists company_one_active_bootstrap_admin
  on public.company_members(company_id) where system_role='company_admin' and status='active';

create table if not exists private.company_admin_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  invited_email text not null,
  invited_name text not null,
  position text not null,
  system_role text not null default 'company_admin',
  token_hash bytea not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_admin_invitation_role_check check (system_role='company_admin'),
  constraint company_admin_invitation_status_check check (status in ('pending','accepted','revoked','expired'))
);
create unique index if not exists company_one_pending_bootstrap_admin_invitation
  on private.company_admin_invitations(company_id) where status='pending';
revoke all on table private.company_admin_invitations from public,anon,authenticated;

create or replace function private.is_company_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$select exists(select 1 from public.companies where id=p_company_id and owner_id=auth.uid())$$;

create or replace function private.active_company_member(p_company_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$select exists(select 1 from public.company_members where company_id=p_company_id and user_id=p_user_id and status='active')$$;

create or replace function public.company_admin_status(p_company_id uuid)
returns table(status text,admin_name text,email text,"position" text,system_role text,expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update private.company_admin_invitations as i set status='expired',updated_at=now() where i.company_id=p_company_id and i.status='pending' and i.expires_at<=now();
  return query
    select 'active'::text,m.full_name,m.email,m.position,m.system_role,null::timestamptz
      from public.company_members m where m.company_id=p_company_id and m.system_role='company_admin' and m.status='active'
    union all
    select 'pending'::text,i.invited_name,i.invited_email,i.position,i.system_role,i.expires_at
      from private.company_admin_invitations i where i.company_id=p_company_id and i.status='pending'
    limit 1;
end$$;

create or replace function public.create_company_admin_invitation(p_company_id uuid,p_name text,p_email text,p_position text default 'Company Administrator')
returns table(invitation_id uuid,invitation_token text,expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex');v_expiry timestamptz:=now()+interval '7 days';v_id uuid;
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'Admin name is required'; end if;
  if lower(trim(coalesce(p_email,'')))!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  if exists(select 1 from public.company_members where company_id=p_company_id and system_role='company_admin' and status='active') then raise exception 'A Company Admin is already active'; end if;
  update private.company_admin_invitations as i set status='expired',updated_at=now() where i.company_id=p_company_id and i.status='pending' and i.expires_at<=now();
  if exists(select 1 from private.company_admin_invitations as i where i.company_id=p_company_id and i.status='pending') then raise exception 'A Company Admin invitation is already pending'; end if;
  insert into private.company_admin_invitations(company_id,owner_id,invited_email,invited_name,position,token_hash,expires_at)
  values(p_company_id,auth.uid(),lower(trim(p_email)),trim(p_name),coalesce(nullif(trim(p_position),''),'Company Administrator'),extensions.digest(v_token,'sha256'),v_expiry)
  returning id into v_id;
  return query select v_id,v_token,v_expiry;
end$$;

create or replace function public.resend_company_admin_invitation(p_company_id uuid)
returns table(invitation_id uuid,invitation_token text,invited_email text,expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex');v_expiry timestamptz:=now()+interval '7 days';v private.company_admin_invitations;
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select i.* into v from private.company_admin_invitations as i where i.company_id=p_company_id and i.status='pending' for update;
  if not found then raise exception 'No pending Company Admin invitation'; end if;
  update private.company_admin_invitations as i set token_hash=extensions.digest(v_token,'sha256'),expires_at=v_expiry,updated_at=now() where i.id=v.id;
  return query select v.id,v_token,v.invited_email,v_expiry;
end$$;

create or replace function public.revoke_company_admin_invitation(p_company_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update private.company_admin_invitations as i set status='revoked',revoked_at=now(),updated_at=now() where i.company_id=p_company_id and i.status='pending';
  if not found then raise exception 'No pending Company Admin invitation'; end if;
  return true;
end$$;

create or replace function public.accept_company_admin_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v private.company_admin_invitations;v_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select i.* into v from private.company_admin_invitations as i where i.token_hash=extensions.digest(coalesce(p_token,''),'sha256') for update;
  if not found then raise exception 'Invitation is invalid'; end if;
  if v.status<>'pending' then raise exception 'Invitation is no longer available'; end if;
  if v.expires_at<=now() then update private.company_admin_invitations as i set status='expired',updated_at=now() where i.id=v.id;raise exception 'Invitation has expired'; end if;
  if v.invited_email<>v_email then raise exception 'Sign in with the invited email address' using errcode='42501'; end if;
  if exists(select 1 from public.company_members where company_id=v.company_id and system_role='company_admin' and status='active') then raise exception 'A Company Admin is already active'; end if;
  insert into public.company_members(company_id,user_id,email,full_name,position,system_role,status,invited_by)
  values(v.company_id,auth.uid(),v.invited_email,v.invited_name,v.position,'company_admin','active',v.owner_id)
  on conflict(company_id,user_id) do update set email=excluded.email,full_name=excluded.full_name,position=excluded.position,system_role='company_admin',status='active',updated_at=now();
  update private.company_admin_invitations as i set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now() where i.id=v.id;
  return v.company_id;
end$$;

alter table public.company_members enable row level security;
drop policy if exists "members read their company membership" on public.company_members;
create policy "members read their company membership" on public.company_members for select to authenticated using(user_id=auth.uid() or private.is_company_owner(company_id));
drop policy if exists "owners or members read company" on public.companies;
create policy "owners or members read company" on public.companies for select to authenticated using(owner_id=auth.uid() or private.active_company_member(id));
drop policy if exists "owners or admins manage workspace records" on public.workspace_records;
create policy "owners or admins manage workspace records" on public.workspace_records for all to authenticated
using(owner_id=(select c.owner_id from public.companies c where c.id=company_id) and (private.is_company_owner(company_id) or private.active_company_member(company_id)))
with check(owner_id=(select c.owner_id from public.companies c where c.id=company_id) and (private.is_company_owner(company_id) or private.active_company_member(company_id)));

revoke all on function public.company_admin_status(uuid),public.create_company_admin_invitation(uuid,text,text,text),public.resend_company_admin_invitation(uuid),public.revoke_company_admin_invitation(uuid),public.accept_company_admin_invitation(text) from public,anon;
grant execute on function public.company_admin_status(uuid),public.create_company_admin_invitation(uuid,text,text,text),public.resend_company_admin_invitation(uuid),public.revoke_company_admin_invitation(uuid),public.accept_company_admin_invitation(text) to authenticated;
grant select on public.company_members to authenticated;
notify pgrst,'reload schema';
