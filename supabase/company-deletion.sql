-- InfoBridgeIndia v2.0
-- Permanent Company Deletion
--
-- Owner-only, Master-Key-gated, single-statement cascade deletion.
-- Apply after migration.sql and company-security.sql (uses private.check_master_key,
-- which already enforces private.is_company_owner). Safe to rerun.
--
-- Every company-scoped table in this schema already declares
-- "company_id ... references public.companies(id) on delete cascade":
--   public.workspace_records            (all business data: Sales, Purchases,
--                                         Inventory, Finance, HR & Payroll, Projects,
--                                         Documents, Approvals, Banking, Reports,
--                                         Administration, GST/tax settings -- every
--                                         module that persists through workspace_records)
--   public.company_members              (memberships, department/role assignments,
--                                         individual permissions)
--   private.company_member_appointments (pending/linked/revoked appointments)
--   private.company_member_invitations  (legacy invitation records, if applied)
--   private.company_admin_invitations   (legacy invitation records, if applied)
--   private.company_security            (Master Key record)
--   private.department_reset_keys       (department reset keys)
--   private.company_security_audit      (security audit trail)
--   public.company_audit_log            (general audit trail)
--
-- Deleting the single public.companies row therefore removes every piece of
-- company-owned data, membership, and security record in ONE atomic statement.
-- If anything blocks it, Postgres rolls back the entire operation and the company
-- is left completely unchanged -- there is no manual per-table deletion to get out
-- of order or partially fail.
--
-- This does NOT touch auth.users. companies.owner_id and company_members.user_id
-- both reference auth.users (cascade flows FROM auth.users TO these tables, never
-- the reverse), so no login account -- owner or member -- is ever deleted here. A
-- member's OTHER company memberships are untouched, since every row above is
-- scoped by this exact company_id only.
--
-- No Supabase Storage usage exists anywhere in this codebase (confirmed: no
-- supabase.storage calls in src/) -- the company logo and all other "file-like"
-- values are stored inline as text/JSON (e.g. companies.logo, workspace_records.data),
-- so there is no separate object-storage cleanup required.
--
-- Known, inherent limitation: company_audit_log and company_security_audit rows for
-- this company are cascade-deleted along with everything else. This schema has no
-- company-independent audit store, so no audit trail of "this company was deleted"
-- can survive the deletion itself. This is consistent with the existing design
-- (every audit table is scoped to a company via cascade) and is not something this
-- change alters or attempts to work around.

create or replace function public.delete_company(
  p_company_id uuid,
  p_master_key text,
  p_confirm_name text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_company public.companies;
begin

  if auth.uid() is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_company from public.companies where id = p_company_id;
  if not found then
    raise exception 'Company not found';
  end if;

  -- Owner check is re-verified here AND again in the final delete's WHERE clause --
  -- never trust a company_id or owner status supplied only by the browser.
  if v_company.owner_id <> auth.uid() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if trim(coalesce(p_confirm_name, '')) <> v_company.name then
    raise exception 'Company name confirmation does not match';
  end if;

  -- Reuses the existing Master Key verification exactly as every other destructive
  -- Company Security operation does (rate-limited, owner-checked internally too).
  if not private.check_master_key(p_company_id, p_master_key) then
    raise exception 'Master Key verification failed';
  end if;

  delete from public.companies
  where id = p_company_id
    and owner_id = auth.uid();

  if not found then
    raise exception 'Company not found or already deleted';
  end if;

  return true;

end;
$$;

revoke all on function public.delete_company(uuid, text, text) from public, anon;
grant execute on function public.delete_company(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
