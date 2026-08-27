-- InfoBridgeIndia v2.0
-- Token-less Company Member Appointment System
-- Safe additive migration for the current live database.

create schema if not exists private;

-- =========================================================
-- 1. COMPANY MEMBERS - REQUIRED COLUMNS
-- =========================================================

alter table public.company_members
  add column if not exists department_id text;

alter table public.company_members
  add column if not exists department_name text;

alter table public.company_members
  add column if not exists is_department_head boolean not null default false;

-- Required by the new permission-driven member system.
alter table public.company_members
  add column if not exists permissions jsonb not null default '{}'::jsonb;


-- =========================================================
-- 2. PENDING MEMBER APPOINTMENTS
-- =========================================================

create table if not exists private.company_member_appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  appointed_email text not null,
  first_name text not null,
  last_name text not null,
  position text not null,
  department_id text not null,
  department_name text not null,
  is_department_head boolean not null default false,
  status text not null default 'pending',
  linked_member_id uuid references public.company_members(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_member_appointment_status_check
    check (status in ('pending', 'linked', 'revoked'))
);

create unique index if not exists company_one_pending_appointment_per_email
  on private.company_member_appointments (
    company_id,
    lower(appointed_email)
  )
  where status = 'pending';

create index if not exists company_member_appointments_email_idx
  on private.company_member_appointments (
    lower(appointed_email)
  )
  where status = 'pending';

revoke all
on table private.company_member_appointments
from public, anon, authenticated;


-- =========================================================
-- 3. WHO CAN MANAGE MEMBERS
-- =========================================================

create or replace function private.can_manage_company_members(
  p_company_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select

    private.is_company_owner(p_company_id)

    or exists (
      select 1
      from public.company_members m
      where m.company_id = p_company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.system_role = 'company_admin'
    )

    or exists (
      select 1
      from public.company_members m
      where m.company_id = p_company_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and coalesce(
          (m.permissions -> 'Administration' ->> 'Manage Users')::boolean,
          false
        )
    );
$$;


-- =========================================================
-- 4. APPOINT COMPANY MEMBER
-- =========================================================

create or replace function public.appoint_company_member(
  p_company_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_position text,
  p_department_id text,
  p_is_department_head boolean default false
)
returns table (
  appointment_id uuid,
  appointed_email text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_department_name text;
  v_first_name text := trim(coalesce(p_first_name, ''));
  v_last_name text := trim(coalesce(p_last_name, ''));
  v_id uuid;
begin

  if not private.can_manage_company_members(p_company_id) then
    raise exception 'Not authorized'
      using errcode = '42501';
  end if;

  if length(v_first_name) < 1 then
    raise exception 'First Name is required';
  end if;

  if length(v_last_name) < 1 then
    raise exception 'Last Name is required';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;

  if length(trim(coalesce(p_position, ''))) < 2 then
    raise exception 'Position / Designation is required';
  end if;

  select d ->> 'name'
  into v_department_name
  from public.workspace_records wr
  cross join lateral
    jsonb_array_elements(
      coalesce(wr.data -> 'departments', '[]'::jsonb)
    ) d
  where wr.company_id = p_company_id
    and wr.module = 'administration'
    and wr.collection = 'state'
    and wr.record_id = 'infobridgeindia.administration.v2'
    and d ->> 'id' = p_department_id
    and d ->> 'companyId' = p_company_id::text
    and coalesce((d ->> 'active')::boolean, true)
    and coalesce(
      (d ->> 'retiredSystemDefault')::boolean,
      false
    ) = false
  limit 1;

  if v_department_name is null then
    raise exception
      'Select an active department belonging to this company';
  end if;

  if exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and lower(m.email) = v_email
      and m.status = 'active'
  ) then
    raise exception
      'This person is already an active company member';
  end if;

  if exists (
    select 1
    from private.company_member_appointments a
    where a.company_id = p_company_id
      and lower(a.appointed_email) = v_email
      and a.status = 'pending'
  ) then
    raise exception
      'A pending appointment already exists for this email';
  end if;

  insert into private.company_member_appointments (
    company_id,
    appointed_email,
    first_name,
    last_name,
    position,
    department_id,
    department_name,
    is_department_head,
    created_by
  )
  values (
    p_company_id,
    v_email,
    v_first_name,
    v_last_name,
    trim(p_position),
    p_department_id,
    v_department_name,
    coalesce(p_is_department_head, false),
    auth.uid()
  )
  returning id into v_id;

  return query
  select v_id, v_email;

end;
$$;


-- =========================================================
-- 5. CANCEL PENDING APPOINTMENT
-- =========================================================

create or replace function public.cancel_company_member_appointment(
  p_company_id uuid,
  p_appointment_id uuid
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

  update private.company_member_appointments a
  set
    status = 'revoked',
    updated_at = now()
  where a.id = p_appointment_id
    and a.company_id = p_company_id
    and a.status = 'pending';

  if not found then
    raise exception 'Pending appointment not found';
  end if;

  return true;

end;
$$;


-- =========================================================
-- 6. LINK LOGGED-IN USER TO PENDING APPOINTMENT
-- =========================================================

create or replace function public.link_pending_company_member()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare

  v_email text :=
    lower(coalesce(auth.jwt() ->> 'email', ''));

  v_appt private.company_member_appointments;

  v_permissions jsonb;

  v_count integer := 0;

begin

  if auth.uid() is null or v_email = '' then
    return 0;
  end if;

  for v_appt in

    select *
    from private.company_member_appointments
    where lower(appointed_email) = v_email
      and status = 'pending'
    for update

  loop

    if exists (
      select 1
      from public.company_members m
      where m.company_id = v_appt.company_id
        and m.user_id = auth.uid()
    ) then

      update private.company_member_appointments a
      set
        status = 'linked',
        updated_at = now()
      where a.id = v_appt.id;

      continue;

    end if;


    select coalesce(
      d -> (
        case
          when v_appt.is_department_head
            then 'headPermissions'
          else 'memberPermissions'
        end
      ),
      '{}'::jsonb
    )
    into v_permissions

    from public.workspace_records wr

    cross join lateral
      jsonb_array_elements(
        coalesce(
          wr.data -> 'departmentDefaultAccess',
          '[]'::jsonb
        )
      ) d

    where wr.company_id = v_appt.company_id
      and wr.module = 'administration'
      and wr.collection = 'state'
      and wr.record_id =
        'infobridgeindia.administration.v2'
      and d ->> 'departmentId' =
        v_appt.department_id

    limit 1;


    insert into public.company_members (
      company_id,
      user_id,
      email,
      full_name,
      position,
      system_role,
      status,
      invited_by,
      department_id,
      department_name,
      is_department_head,
      permissions
    )
    values (
      v_appt.company_id,
      auth.uid(),
      v_appt.appointed_email,
      v_appt.first_name || ' ' || v_appt.last_name,
      v_appt.position,
      'company_member',
      'active',
      v_appt.created_by,
      v_appt.department_id,
      v_appt.department_name,
      v_appt.is_department_head,
      coalesce(v_permissions, '{}'::jsonb)
    );


    update private.company_member_appointments a
    set
      status = 'linked',
      updated_at = now()
    where a.id = v_appt.id;


    v_count := v_count + 1;

  end loop;

  return v_count;

end;
$$;


-- =========================================================
-- 7. COMPANY MEMBERS DIRECTORY
-- =========================================================

drop function if exists
  public.company_member_directory(uuid);


create function public.company_member_directory(
  p_company_id uuid
)
returns table (
  record_id uuid,
  first_name text,
  last_name text,
  full_name text,
  email text,
  "position" text,
  department_id text,
  department_name text,
  is_department_head boolean,
  status text,
  created_at timestamptz
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

    select
      m.id,
      split_part(m.full_name, ' ', 1),
      trim(
        substring(
          m.full_name
          from length(split_part(m.full_name, ' ', 1)) + 1
        )
      ),
      m.full_name,
      m.email,
      m.position,
      m.department_id,
      m.department_name,
      m.is_department_head,
      m.status,
      m.created_at

    from public.company_members m

    where m.company_id = p_company_id
      and m.system_role = 'company_member'


    union all


    select
      a.id,
      a.first_name,
      a.last_name,
      a.first_name || ' ' || a.last_name,
      a.appointed_email,
      a.position,
      a.department_id,
      a.department_name,
      a.is_department_head,
      'pending',
      a.created_at

    from private.company_member_appointments a

    where a.company_id = p_company_id
      and a.status = 'pending'

    order by 11 desc;

end;
$$;


-- =========================================================
-- 8. ROLES & PERMISSIONS DIRECTORY
-- =========================================================

drop function if exists
  public.company_role_directory(uuid);


create function public.company_role_directory(
  p_company_id uuid
)
returns table (
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

    select
      null::uuid,
      c.owner_id,
      c.name,
      coalesce(u.email, ''),
      ''::text,
      ''::text,
      false,
      'owner'::text,
      'active'::text,
      '{}'::jsonb

    from public.companies c

    left join auth.users u
      on u.id = c.owner_id

    where c.id = p_company_id


    union all


    select
      m.id,
      m.user_id,
      m.full_name,
      m.email,
      m.position,
      coalesce(m.department_name, ''),
      m.is_department_head,
      m.system_role,
      m.status,
      m.permissions

    from public.company_members m

    where m.company_id = p_company_id
      and m.status = 'active'
      and m.system_role in (
        'company_admin',
        'company_member'
      );

end;
$$;


-- =========================================================
-- 8b. COMPANY MEMBER ACCESS (independent of Protected System Roles)
-- =========================================================
-- Company Member Access must keep rendering even if the Protected System Roles portion of
-- company_role_directory above fails (it joins auth.users for the Owner's pseudo-row, which
-- this query does not need). This reads only public.company_members, so a failure in the
-- Protected System Roles query can never block the Company Member Access list.

create or replace function public.company_member_permission_directory(
  p_company_id uuid
)
returns table (
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

    select
      m.id,
      m.user_id,
      m.full_name,
      m.email,
      m.position,
      coalesce(m.department_name, ''),
      m.is_department_head,
      m.system_role,
      m.status,
      m.permissions

    from public.company_members m

    where m.company_id = p_company_id
      and m.status = 'active'
      and m.system_role = 'company_member'

    order by m.full_name;

end;
$$;


-- =========================================================
-- 9. APPOINTMENT AUDIT
-- =========================================================

create or replace function private.audit_member_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_action text;
begin

  v_action :=
    case

      when tg_op = 'INSERT'
        then 'Member appointed'

      when new.status = 'linked'
        and old.status is distinct from 'linked'
        then 'Member appointment linked to account'

      when new.status = 'revoked'
        and old.status is distinct from 'revoked'
        then 'Member appointment cancelled'

      else null

    end;


  if v_action is not null then

    perform private.write_company_audit(
      new.company_id,
      v_action,
      'Member',
      new.id::text,
      new.first_name || ' ' || new.last_name,
      null,
      '[]'::jsonb,
      jsonb_build_object(
        'email',
        new.appointed_email,
        'department',
        new.department_name,
        'isDepartmentHead',
        new.is_department_head
      )
    );

  end if;

  return new;

end;
$$;


drop trigger if exists
  audit_company_member_appointment
on private.company_member_appointments;


create trigger audit_company_member_appointment

after insert or update
on private.company_member_appointments

for each row

execute function
  private.audit_member_appointment_change();


-- =========================================================
-- 10. RPC SECURITY
-- =========================================================

revoke all on function
  public.appoint_company_member(
    uuid,
    text,
    text,
    text,
    text,
    text,
    boolean
  ),
  public.cancel_company_member_appointment(
    uuid,
    uuid
  ),
  public.link_pending_company_member(),
  public.company_member_directory(uuid),
  public.company_role_directory(uuid),
  public.company_member_permission_directory(uuid)
from public, anon;


grant execute on function
  public.appoint_company_member(
    uuid,
    text,
    text,
    text,
    text,
    text,
    boolean
  ),
  public.cancel_company_member_appointment(
    uuid,
    uuid
  ),
  public.link_pending_company_member(),
  public.company_member_directory(uuid),
  public.company_role_directory(uuid),
  public.company_member_permission_directory(uuid)
to authenticated;


-- =========================================================
-- 11. RELOAD SUPABASE POSTGREST SCHEMA CACHE
-- =========================================================

notify pgrst, 'reload schema';