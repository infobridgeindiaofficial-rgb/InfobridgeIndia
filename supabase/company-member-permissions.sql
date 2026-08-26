-- Company-scoped permissions and access revocation for accepted Company Members.
-- Apply after company-admin-invitations.sql and company-member-invitations.sql.
-- Safe to rerun; no company, invitation, HR, or authentication records are deleted.
alter table public.company_members add column if not exists permissions jsonb not null default '{}'::jsonb;

create or replace function public.company_role_directory(p_company_id uuid)
returns table(member_id uuid,user_id uuid,full_name text,email text,"position" text,department_name text,system_role text,status text,permissions jsonb)
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  return query
    select null::uuid,c.owner_id,c.name,coalesce(u.email,''),''::text,''::text,'owner'::text,'active'::text,'{}'::jsonb
      from public.companies c left join auth.users u on u.id=c.owner_id where c.id=p_company_id
    union all
    select m.id,m.user_id,m.full_name,m.email,m.position,coalesce(i.department_name,''),m.system_role,m.status,m.permissions
      from public.company_members m
      left join lateral (
        select invitation.department_name from private.company_member_invitations invitation
        where invitation.company_id=m.company_id and invitation.accepted_by=m.user_id and invitation.status='accepted'
        order by invitation.accepted_at desc nulls last limit 1
      ) i on true
      where m.company_id=p_company_id and m.status='active' and m.system_role in ('company_admin','company_member');
end$$;

create or replace function public.update_company_member_permissions(p_company_id uuid,p_member_id uuid,p_permissions jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_permissions is null or jsonb_typeof(p_permissions)<>'object' then raise exception 'Permissions must be an object'; end if;
  update public.company_members m set permissions=p_permissions,updated_at=now()
    where m.id=p_member_id and m.company_id=p_company_id and m.system_role='company_member' and m.status='active';
  if not found then raise exception 'Active Company Member not found'; end if;
  return true;
end$$;

create or replace function public.remove_company_member_access(p_company_id uuid,p_member_id uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if not private.can_manage_company_members(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  update public.company_members m set status='inactive',updated_at=now()
    where m.id=p_member_id and m.company_id=p_company_id and m.system_role='company_member' and m.status='active';
  if not found then raise exception 'Active Company Member not found'; end if;
  return true;
end$$;

revoke all on function public.company_role_directory(uuid),public.update_company_member_permissions(uuid,uuid,jsonb),public.remove_company_member_access(uuid,uuid) from public,anon;
grant execute on function public.company_role_directory(uuid),public.update_company_member_permissions(uuid,uuid,jsonb),public.remove_company_member_access(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
