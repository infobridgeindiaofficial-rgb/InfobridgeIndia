-- Authoritative signed-in actor context for Internal Requests.
-- Safe to rerun. Returns only the caller's own company membership.
create or replace function public.internal_request_actor_context(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', c.owner_id,
    'companyId', c.id,
    'displayName', c.name,
    'systemRole', 'owner',
    'isOwner', true,
    'departmentId', null,
    'departmentName', '',
    'permissions', '{}'::jsonb
  ) into result
  from public.companies c
  where c.id = p_company_id and c.owner_id = auth.uid();

  if result is not null then return result; end if;

  select jsonb_build_object(
    'id', m.user_id,
    'companyId', m.company_id,
    'displayName', m.full_name,
    'systemRole', m.system_role,
    'isOwner', false,
    'departmentId', m.department_id,
    'departmentName', coalesce(m.department_name, ''),
    'permissions', coalesce(m.permissions, '{}'::jsonb)
  ) into result
  from public.company_members m
  where m.company_id = p_company_id
    and m.user_id = auth.uid()
    and m.status = 'active';

  if result is null then
    raise exception 'Active company membership not found' using errcode = '42501';
  end if;
  return result;
end;
$$;

revoke all on function public.internal_request_actor_context(uuid) from public, anon;
grant execute on function public.internal_request_actor_context(uuid) to authenticated;
notify pgrst, 'reload schema';
