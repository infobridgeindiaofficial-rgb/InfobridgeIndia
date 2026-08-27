-- ============================================================================
-- REVIEW BEFORE RUNNING. DO NOT RUN AUTOMATICALLY. DO NOT RUN AS PART OF ANY
-- SCRIPT OR CI STEP. This file is NOT applied by the application and was NOT
-- run against any database as part of implementing the new appointment flow.
-- ============================================================================
--
-- Purpose: once you have manually applied supabase/company-member-appointments.sql
-- and live-tested the new Appoint Member / email-linking flow end to end, run this
-- file yourself (in the Supabase SQL Editor) to retire the OLD token-based
-- invitation objects that the new flow replaces:
--   - the first-Company-Admin bootstrap invitation table + its 5 RPCs
--     (supabase/company-admin-invitations.sql)
--   - the Company Member invitation table + its 4 token RPCs
--     (supabase/company-member-invitations.sql; company_member_directory and
--      company_role_directory are NOT dropped here -- they were already
--      redefined by company-member-appointments.sql)
--
-- What this file explicitly does NOT touch (do not add drops for these):
--   - public.company_members (still the live membership table)
--   - public.companies, public.workspace_records
--   - private.is_company_owner(), private.active_company_member()
--   - the two RLS policies granting non-owner members read/write access
--     ("owners or members read company", "owners or admins manage workspace records")
--   - private.is_company_admin() (kept for the legacy-admin backward-compat
--     clause in private.can_manage_company_members)
--   - any HR, payroll, attendance, Sales, Purchases, Inventory or Finance data
--
-- Run each numbered section only after you are satisfied the appointment flow
-- is working correctly for real users. Sections are independent; you may run
-- them in any order, or skip a section if you want to keep that piece longer.

-- ---- 1. Drop the audit triggers tied specifically to the two invitation tables ----
-- (the audit log table itself, and the trigger on company_members permission
--  changes, are untouched)
drop trigger if exists audit_company_member_invitation on private.company_member_invitations;
drop function if exists private.audit_member_invitation_change();
drop trigger if exists audit_company_admin_invitation on private.company_admin_invitations;
drop function if exists private.audit_company_admin_invitation_change();

-- ---- 2. Drop the Company Member invitation RPCs (superseded by appoint_company_member /
-- ---- link_pending_company_member in company-member-appointments.sql) ----
drop function if exists public.create_company_member_invitation(uuid,text,text,text,text,text);
drop function if exists public.resend_company_member_invitation(uuid,uuid);
drop function if exists public.cancel_company_member_invitation(uuid,uuid);
drop function if exists public.accept_company_member_invitation(text);

-- ---- 3. Drop the Company Member invitation table itself ----
drop table if exists private.company_member_invitations;

-- ---- 4. Drop the first-Company-Admin bootstrap invitation RPCs ----
drop function if exists public.company_admin_status(uuid);
drop function if exists public.create_company_admin_invitation(uuid,text,text,text);
drop function if exists public.resend_company_admin_invitation(uuid);
drop function if exists public.revoke_company_admin_invitation(uuid);
drop function if exists public.accept_company_admin_invitation(text);

-- ---- 5. Drop the Company Admin invitation table itself ----
drop table if exists private.company_admin_invitations;

notify pgrst,'reload schema';
