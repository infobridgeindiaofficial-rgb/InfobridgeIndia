-- Immutable, company-scoped Audit Log for Administration and future business modules.
-- Apply after migration.sql, company-admin-invitations.sql, company-member-invitations.sql,
-- and company-member-permissions.sql. Safe to rerun; existing workspace audit rows are untouched.
create schema if not exists private;

create table if not exists public.company_audit_log (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  actor_name text not null,
  actor_email text not null default '',
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  entity_name text,
  reason text,
  changes jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint company_audit_changes_array check (jsonb_typeof(changes)='array'),
  constraint company_audit_metadata_object check (jsonb_typeof(metadata)='object')
);
create index if not exists company_audit_log_company_created_idx
  on public.company_audit_log(company_id,created_at desc);

create or replace function private.company_audit_role(p_company_id uuid,p_user_id uuid default auth.uid())
returns text language sql stable security definer set search_path=pg_catalog,public,private
as $$
  select case
    when exists(select 1 from public.companies c where c.id=p_company_id and c.owner_id=p_user_id) then 'Company Owner'
    when exists(select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=p_user_id and m.system_role='company_admin' and m.status='active') then 'Company Admin'
    when exists(select 1 from public.company_members m where m.company_id=p_company_id and m.user_id=p_user_id and m.status='active') then 'Company Member'
    else null end
$$;

create or replace function private.can_view_company_audit(p_company_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,private
as $$
  select private.company_audit_role(p_company_id) in ('Company Owner','Company Admin')
    or exists(
      select 1 from public.company_members m
      where m.company_id=p_company_id and m.user_id=auth.uid() and m.status='active'
        and coalesce((m.permissions->'Administration'->>'View Audit')::boolean,false)
    )
$$;

create or replace function private.audit_actor(p_company_id uuid)
returns table(actor_id uuid,actor_name text,actor_email text,actor_role text)
language sql stable security definer set search_path=pg_catalog,public,private
as $$
  select u.id,
    coalesce(nullif(trim(coalesce(m.full_name,u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name','')),''),u.email,'Authenticated user'),
    coalesce(u.email,''),private.company_audit_role(p_company_id,u.id)
  from auth.users u
  left join public.company_members m on m.company_id=p_company_id and m.user_id=u.id and m.status='active'
  where u.id=auth.uid() and private.company_audit_role(p_company_id,u.id) is not null
  limit 1
$$;

create or replace function private.write_company_audit(
  p_company_id uuid,p_action text,p_entity_type text,p_entity_id text default null,
  p_entity_name text default null,p_reason text default null,p_changes jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
) returns bigint language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare a record;v_id bigint;
begin
  select * into a from private.audit_actor(p_company_id);
  if a.actor_id is null then raise exception 'Not authorized' using errcode='42501'; end if;
  insert into public.company_audit_log(company_id,actor_id,actor_name,actor_email,actor_role,action,entity_type,entity_id,entity_name,reason,changes,metadata)
  values(p_company_id,a.actor_id,a.actor_name,a.actor_email,a.actor_role,trim(p_action),trim(p_entity_type),p_entity_id,nullif(trim(coalesce(p_entity_name,'')),''),nullif(trim(coalesce(p_reason,'')),''),coalesce(p_changes,'[]'::jsonb),coalesce(p_metadata,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end$$;
revoke all on function private.write_company_audit(uuid,text,text,text,text,text,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.list_company_audit_log(p_company_id uuid)
returns table(id bigint,company_id uuid,actor_id uuid,actor_name text,actor_email text,actor_role text,action text,entity_type text,entity_id text,entity_name text,reason text,changes jsonb,created_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_view_company_audit(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  return query select a.id,a.company_id,a.actor_id,a.actor_name,a.actor_email,a.actor_role,a.action,a.entity_type,a.entity_id,a.entity_name,a.reason,a.changes,a.created_at
    from public.company_audit_log a where a.company_id=p_company_id order by a.created_at desc,a.id desc;
end$$;

-- Audits successful Administration workspace writes transactionally. Sensitive fields are never copied.
create or replace function private.audit_administration_workspace()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare spec record;n jsonb;o jsonb;v_id text;v_name text;v_action text;v_changes jsonb;
begin
  if new.module<>'administration' or new.collection<>'state' or new.record_id<>'infobridgeindia.administration.v2' then return new; end if;
  for spec in select * from (values
    ('companies','Company','Company'),('branches','Branch','Branch'),('departments','Department','Department'),
    ('financialYears','Financial Year','Financial year'),('documentSequences','Document Numbering','Document numbering')
  ) s(key_name,entity_type,action_prefix) loop
    for n in select value from jsonb_array_elements(coalesce(new.data->spec.key_name,'[]'::jsonb)) loop
      v_id:=n->>'id';select value into o from jsonb_array_elements(coalesce(old.data->spec.key_name,'[]'::jsonb)) where value->>'id'=v_id limit 1;
      if o is null or o is distinct from n then
        v_name:=coalesce(n->>'tradeName',n->>'name',n->>'label',n->>'documentType',v_id);
        v_action:=case when o is null then spec.action_prefix||' created' when coalesce((o->>'active')::boolean,true) and not coalesce((n->>'active')::boolean,true) then spec.action_prefix||' deactivated' when spec.key_name='financialYears' and n->>'status'='Locked' and o->>'status' is distinct from 'Locked' then 'Financial year locked' else spec.action_prefix||' updated' end;
        v_changes:=case when o is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('field','Record','before','Previous values','after','Updated values')) end;
        perform private.write_company_audit(new.company_id,v_action,spec.entity_type,v_id,v_name,null,v_changes,jsonb_build_object('source','administration-workspace'));
      end if;o:=null;
    end loop;
  end loop;
  for n in select value from jsonb_array_elements(coalesce(new.data->'moduleAccess','[]'::jsonb)) loop
    v_id:=n->>'id';select value into o from jsonb_array_elements(coalesce(old.data->'moduleAccess','[]'::jsonb)) where value->>'id'=v_id limit 1;
    if o is not null and o->>'enabled' is distinct from n->>'enabled' then
      perform private.write_company_audit(new.company_id,case when (n->>'enabled')::boolean then 'Module enabled' else 'Module disabled' end,'Module',v_id,n->>'module',null,jsonb_build_array(jsonb_build_object('field','Status','before',case when (o->>'enabled')::boolean then 'Enabled' else 'Disabled' end,'after',case when (n->>'enabled')::boolean then 'Enabled' else 'Disabled' end)),jsonb_build_object('source','administration-workspace'));
    end if;o:=null;
  end loop;
  for n in select value from jsonb_array_elements(coalesce(new.data->'gstSettings','[]'::jsonb)) loop
    v_id:=coalesce(n->>'id',n->>'countryCode');select value into o from jsonb_array_elements(coalesce(old.data->'gstSettings','[]'::jsonb)) where coalesce(value->>'id',value->>'countryCode')=v_id limit 1;
    if o is null or o is distinct from n then
      v_name:=case when n->>'countryCode'='AE' then 'UAE — VAT' else 'India — GST' end;
      perform private.write_company_audit(new.company_id,case when n->>'countryCode'='AE' then 'UAE VAT settings changed' else 'India GST settings changed' end,'Tax Settings',v_id,v_name,null,'[]'::jsonb,jsonb_build_object('source','administration-workspace','country_code',coalesce(n->>'countryCode','IN')));
    end if;o:=null;
  end loop;
  return new;
end$$;
drop trigger if exists audit_administration_workspace on public.workspace_records;
create trigger audit_administration_workspace after update of data on public.workspace_records
for each row execute function private.audit_administration_workspace();

create or replace function private.audit_member_invitation_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_action text;
begin
  v_action:=case when tg_op='INSERT' then 'Member invited'
    when new.status='accepted' and old.status is distinct from 'accepted' then 'Member accepted invitation'
    when new.status='cancelled' and old.status is distinct from 'cancelled' then 'Member invitation cancelled'
    when new.token_hash is distinct from old.token_hash then 'Member invitation resent' else null end;
  if v_action is not null then perform private.write_company_audit(new.company_id,v_action,'Member',new.id::text,new.invited_name,null,'[]'::jsonb,jsonb_build_object('email',new.invited_email));end if;
  return new;
end$$;
drop trigger if exists audit_company_member_invitation on private.company_member_invitations;
create trigger audit_company_member_invitation after insert or update on private.company_member_invitations
for each row execute function private.audit_member_invitation_change();

create or replace function private.audit_company_admin_invitation_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_action text;
begin
  v_action:=case when tg_op='INSERT' then 'Company Admin invited'
    when new.status='accepted' and old.status is distinct from 'accepted' then 'Company Admin accepted invitation'
    when new.status='revoked' and old.status is distinct from 'revoked' then 'Company Admin invitation cancelled'
    when new.token_hash is distinct from old.token_hash then 'Company Admin invitation resent' else null end;
  if v_action is not null then perform private.write_company_audit(new.company_id,v_action,'Member',new.id::text,new.invited_name,null,'[]'::jsonb,jsonb_build_object('email',new.invited_email,'system_role','company_admin'));end if;
  return new;
end$$;
drop trigger if exists audit_company_admin_invitation on private.company_admin_invitations;
create trigger audit_company_admin_invitation after insert or update on private.company_admin_invitations
for each row execute function private.audit_company_admin_invitation_change();

create or replace function private.audit_member_permission_change()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if old.permissions is distinct from new.permissions then
    perform private.write_company_audit(new.company_id,'Member permission changed','Member',new.id::text,new.full_name,null,jsonb_build_array(jsonb_build_object('field','Permissions','before','Previous access','after','Updated access')),jsonb_build_object('member_email',new.email));
  end if;
  if old.system_role is distinct from new.system_role then
    perform private.write_company_audit(new.company_id,'Member role changed','Member',new.id::text,new.full_name,null,jsonb_build_array(jsonb_build_object('field','System Role','before',old.system_role,'after',new.system_role)),jsonb_build_object('member_email',new.email));
  end if;
  return new;
end$$;
drop trigger if exists audit_company_member_permission on public.company_members;
create trigger audit_company_member_permission after update of permissions,system_role on public.company_members
for each row execute function private.audit_member_permission_change();

alter table public.company_audit_log enable row level security;
drop policy if exists "authorized members read company audit" on public.company_audit_log;
create policy "authorized members read company audit" on public.company_audit_log for select to authenticated using(private.can_view_company_audit(company_id));
revoke all on table public.company_audit_log from public,anon,authenticated;
grant select on table public.company_audit_log to authenticated;
revoke all on function public.list_company_audit_log(uuid) from public,anon;
grant execute on function public.list_company_audit_log(uuid) to authenticated;
notify pgrst,'reload schema';
