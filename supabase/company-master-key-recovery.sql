-- InfoBridgeIndia v2.0
-- "Forgot Master Key" recovery
--
-- Apply after company-security.sql (reuses private.is_company_owner,
-- private.valid_key, private.audit_security, private.company_security). Safe to rerun.
--
-- Architecture: this reuses Supabase Auth's OWN existing, already-configured email
-- infrastructure -- the same "Magic Link" / email-OTP mechanism already used elsewhere
-- in this project (see resetPasswordForEmail() in auth-ui.js for the equivalent
-- password-recovery pattern). No new Edge Function, SMTP credentials, API keys, or
-- custom token/email-sending code is introduced. Nothing here can ever read, email,
-- or expose the existing stored Master Key hash.
--
-- Flow:
--   1. Frontend calls request_master_key_recovery() purely to authorize + audit the
--      request, then calls supabase.auth.signInWithOtp({ email: <the owner's own
--      already-authenticated session email> }) -- Supabase itself generates, emails,
--      rate-limits, brute-force-protects and expires the code/link; none of that is
--      reimplemented here.
--   2. The owner opens the emailed link. Supabase's client SDK (detectSessionInUrl,
--      already enabled project-wide) verifies it and refreshes the browser's session.
--      A fresh Supabase-issued JWT records this event in its own `amr` (Authentication
--      Methods Reference) claim -- this IS the "recovery token": short-lived (a fresh
--      email verification, checked here within the last 10 minutes), signed by
--      Supabase (unforgeable), and impossible to produce via a mere background session
--      refresh (amr entries are only added by an actual authentication event).
--   3. Frontend calls reset_master_key_after_recovery(), which re-verifies ownership,
--      requires that recent amr proof, enforces it can only be consumed once, and only
--      then replaces the Master Key hash using the exact same hashing already used by
--      configure_company_master_key / change_company_master_key.

create table if not exists private.company_master_key_recovery_used (
  company_id uuid not null references public.companies(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  otp_issued_at bigint not null,
  used_at timestamptz not null default now(),
  primary key (company_id, owner_id, otp_issued_at)
);

revoke all on table private.company_master_key_recovery_used from public, anon, authenticated;

-- Audit-only: recorded when the owner starts recovery, before any email is sent.
create or replace function public.request_master_key_recovery(p_company_id uuid)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;
  perform private.audit_security(p_company_id,'master_key_recovery_requested');
  return true;
end $$;

create or replace function public.reset_master_key_after_recovery(p_company_id uuid, p_new_key text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare
  v_otp_ts numeric;
begin
  if auth.uid() is null then raise exception 'Not authorized' using errcode='42501'; end if;
  if not private.is_company_owner(p_company_id) then raise exception 'Not authorized' using errcode='42501'; end if;

  -- The one and only "recovery token" check: a fresh (<=10 minute old) email
  -- verification recorded by Supabase itself inside the caller's own signed JWT.
  -- amr entries are added only by an actual sign-in event (magic link / OTP click or
  -- code), never by ordinary background token refresh, so this cannot be satisfied by
  -- simply holding an already-open browser session.
  select max((e->>'timestamp')::numeric) into v_otp_ts
  from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) e
  where e->>'method' in ('otp','magiclink')
    and to_timestamp((e->>'timestamp')::numeric) > now() - interval '10 minutes';

  if v_otp_ts is null then
    raise exception 'Recovery verification has expired or was not completed. Request a new recovery link.';
  end if;

  -- Single-use: the exact verification event (its own timestamp) can only ever be
  -- consumed once, for this owner and this company.
  begin
    insert into private.company_master_key_recovery_used(company_id, owner_id, otp_issued_at)
    values (p_company_id, auth.uid(), v_otp_ts::bigint);
  exception when unique_violation then
    raise exception 'This recovery verification has already been used. Request a new recovery link.';
  end;

  if not private.valid_key(p_new_key,12) then raise exception 'Master Key must contain 12 to 256 characters'; end if;

  -- Same hashing/storage as configure_company_master_key / change_company_master_key --
  -- the existing stored key is replaced, never read back or exposed.
  insert into private.company_security(company_id, master_key_hash)
  values (p_company_id, extensions.crypt(p_new_key, extensions.gen_salt('bf',12)))
  on conflict (company_id) do update
    set master_key_hash = excluded.master_key_hash, failed_attempts = 0, locked_until = null, changed_at = now();

  perform private.audit_security(p_company_id,'master_key_reset_via_recovery');
  return true;
end $$;

revoke all on function public.request_master_key_recovery(uuid), public.reset_master_key_after_recovery(uuid, text) from public, anon;
grant execute on function public.request_master_key_recovery(uuid), public.reset_master_key_after_recovery(uuid, text) to authenticated;

notify pgrst, 'reload schema';
