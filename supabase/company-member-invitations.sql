-- Normal Company Member invitations managed by an active Company Admin.
-- Apply after company-admin-invitations.sql. Safe to rerun; existing records are preserved.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

alter table public.company_members drop constraint if exists company_members_role_check;
alter table public.company_members add constraint company_members_role_check
  check (system_role in ('company_admin','company_member'));

create table if not exists private.company_member_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  invited_email text not null,
  invited_name text not null,
  first_name text,
  last_name text,
  position text not null,
  department_id text,
  department_name text,
  system_role text not null default 'company_member',
  token_hash bytea not null unique,
  status text not null default 'pending',
  created_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_member_invitation_role_check check (system_role='company_member'),
  constraint company_member_invitation_status_check check (status in ('pending','accepted','cancelled','expired'))
);
alter table private.company_member_invitations add column if not exists first_name text;
alter table private.company_member_invitations add column if not exists last_name text;
alter table private.company_member_invitations add column if not exists department_id text;
alter table private.company_member_invitations add column if not exists department_name text;
update private.company_member_invitations i set first_name=coalesce(i.first_name,nullif(split_part(i.invited_name,' ',1),'')),last_name=coalesce(i.last_name,nullif(trim(substr(i.invited_name,length(split_part(i.invited_name,' ',1))+1)),'')) where i.first_name is null or i.last_name is null;
create unique index if not exists company_one_pending_member_invitation_per_email
  on private.company_member_invitations(company_id,lower(invited_email)) where status='pending';
revoke all on table private.company_member_invitations from public,anon,authenticated;

create or replace function private.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$select exists(select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=auth.uid() and m.system_role='company_admin' and m.status='active')$$;

create or replace function private.can_manage_company_members(p_company_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$select private.is_company_owner(p_company_id) or private.is_company_admin(p_company_id)$$;

drop function if exists public.company_member_directory(uuid);
create function public.company_member_directory(p_company_id uuid)
returns table(record_id uuid,first_name text,last_name text,full_name text,email text,"position" text,department_id text,department_name text,system_role text,status text,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update private.company_member_invitations as i set status='expired',updated_at=now()
    where i.company_id=p_company_id and i.status='pending' and i.expires_at<=now();
  return query
    select i.id,i.first_name,i.last_name,i.invited_name,i.invited_email,i.position,i.department_id,i.department_name,i.system_role,i.status,i.expires_at,i.created_at
      from private.company_member_invitations i where i.company_id=p_company_id
    order by 12 desc;
end$$;

drop function if exists public.create_company_member_invitation(uuid,text,text,text);
create or replace function public.create_company_member_invitation(p_company_id uuid,p_first_name text,p_last_name text,p_email text,p_position text,p_department_id text)
returns table(invitation_id uuid,invitation_token text,invited_email text,expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex');v_expiry timestamptz:=now()+interval '7 days';v_id uuid;v_email text:=lower(trim(coalesce(p_email,'')));v_department_name text;v_first_name text:=trim(coalesce(p_first_name,''));v_last_name text:=trim(coalesce(p_last_name,''));
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if length(v_first_name)<1 then raise exception 'First Name is required'; end if;
  if length(v_last_name)<1 then raise exception 'Last Name is required'; end if;
  if v_email!~'^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid email address'; end if;
  if length(trim(coalesce(p_position,'')))<2 then raise exception 'Position / Designation is required'; end if;
  select d->>'name' into v_department_name from public.workspace_records wr cross join lateral jsonb_array_elements(coalesce(wr.data->'departments','[]'::jsonb)) d
    where wr.company_id=p_company_id and wr.module='administration' and wr.collection='state' and wr.record_id='infobridgeindia.administration.v2'
      and d->>'id'=p_department_id and d->>'companyId'=p_company_id::text and coalesce((d->>'active')::boolean,true) and coalesce((d->>'retiredSystemDefault')::boolean,false)=false limit 1;
  if v_department_name is null then raise exception 'Select an active department belonging to this company'; end if;
  if exists(select 1 from public.company_members m where m.company_id=p_company_id and lower(m.email)=v_email and m.status='active') then raise exception 'This person is already an active company member'; end if;
  update private.company_member_invitations as i set status='expired',updated_at=now() where i.company_id=p_company_id and i.status='pending' and i.expires_at<=now();
  if exists(select 1 from private.company_member_invitations i where i.company_id=p_company_id and lower(i.invited_email)=v_email and i.status='pending') then raise exception 'A pending invitation already exists for this email'; end if;
  insert into private.company_member_invitations(company_id,invited_email,invited_name,first_name,last_name,position,department_id,department_name,token_hash,created_by,expires_at)
  values(p_company_id,v_email,v_first_name||' '||v_last_name,v_first_name,v_last_name,trim(p_position),p_department_id,v_department_name,extensions.digest(v_token,'sha256'),auth.uid(),v_expiry) returning id into v_id;
  return query select v_id,v_token,v_email,v_expiry;
end$$;

create or replace function public.resend_company_member_invitation(p_company_id uuid,p_invitation_id uuid)
returns table(invitation_id uuid,invitation_token text,invited_email text,expires_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v_token text:=encode(extensions.gen_random_bytes(32),'hex');v_expiry timestamptz:=now()+interval '7 days';v private.company_member_invitations;
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  select i.* into v from private.company_member_invitations i where i.id=p_invitation_id and i.company_id=p_company_id and i.status='pending' for update;
  if not found then raise exception 'Pending invitation not found'; end if;
  update private.company_member_invitations i set token_hash=extensions.digest(v_token,'sha256'),expires_at=v_expiry,updated_at=now() where i.id=v.id;
  return query select v.id,v_token,v.invited_email,v_expiry;
end$$;

create or replace function public.cancel_company_member_invitation(p_company_id uuid,p_invitation_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update private.company_member_invitations i set status='cancelled',cancelled_at=now(),updated_at=now()
    where i.id=p_invitation_id and i.company_id=p_company_id and i.status='pending';
  if not found then raise exception 'Pending invitation not found'; end if;
  return true;
end$$;

create or replace function public.accept_company_member_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare v private.company_member_invitations;v_email text:=lower(coalesce(auth.jwt()->>'email',''));
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select i.* into v from private.company_member_invitations i where i.token_hash=extensions.digest(coalesce(p_token,''),'sha256') for update;
  if not found then raise exception 'Invitation is invalid'; end if;
  if v.status<>'pending' then raise exception 'Invitation is no longer available'; end if;
  if v.expires_at<=now() then update private.company_member_invitations i set status='expired',updated_at=now() where i.id=v.id;raise exception 'Invitation has expired'; end if;
  if v.invited_email<>v_email then raise exception 'Sign in with the invited email address' using errcode='42501'; end if;
  if exists(select 1 from public.company_members m where m.company_id=v.company_id and m.user_id=auth.uid()) then
    update private.company_member_invitations i set status='accepted',accepted_by=auth.uid(),accepted_at=coalesce(i.accepted_at,now()),updated_at=now() where i.id=v.id;
    return v.company_id;
  end if;
  insert into public.company_members(company_id,user_id,email,full_name,position,system_role,status,invited_by)
  values(v.company_id,auth.uid(),v.invited_email,v.invited_name,v.position,'company_member','active',v.created_by);
  update private.company_member_invitations i set status='accepted',accepted_by=auth.uid(),accepted_at=now(),updated_at=now() where i.id=v.id;
  return v.company_id;
end$$;

revoke all on function public.company_member_directory(uuid),public.create_company_member_invitation(uuid,text,text,text,text,text),public.resend_company_member_invitation(uuid,uuid),public.cancel_company_member_invitation(uuid,uuid),public.accept_company_member_invitation(text) from public,anon;
grant execute on function public.company_member_directory(uuid),public.create_company_member_invitation(uuid,text,text,text,text,text),public.resend_company_member_invitation(uuid,uuid),public.cancel_company_member_invitation(uuid,uuid),public.accept_company_member_invitation(text) to authenticated;
notify pgrst,'reload schema';
