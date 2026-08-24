# Supabase setup for InfoBridgeIndia

1. Create or select a Supabase project.
2. Open **SQL Editor**, paste `migration.sql`, and run it once.
3. In **Project Settings → API**, copy the project URL and publishable key (legacy projects may label it the `anon` key).
4. Put those two public values in `public/supabase-config.js`. Never use a `service_role` or secret key in browser code.
5. In **Authentication → URL Configuration**, set the production Site URL and add these redirect URLs:
   - `https://infobridgeindia.online/login.html`
   - `https://infobridgeindia.online/reset-password.html`
6. In **Authentication → Providers → Google**, enable Google and enter the OAuth client ID and secret in the Supabase dashboard. Add the Supabase callback URL shown there to the Google Cloud OAuth client.
7. Decide whether email confirmation is required in **Authentication → Providers → Email**. When enabled, new users must confirm their email before the first session is created.

RLS in `migration.sql` is mandatory. It scopes both company rows and every workspace record to `auth.uid()` and rejects anonymous access.

## Production authentication email branding

The sender identity for signup confirmations, password recovery, invitations, magic links, and email-change messages is controlled by Supabase Custom SMTP. It must not be set in browser JavaScript.

Recommended provider: **Resend**

1. Create a Resend account and add `infobridgeindia.online` under **Domains**.
2. In the DNS provider for `infobridgeindia.online`, add every SPF and DKIM record displayed by Resend. These record names and verification values are generated for the Resend account and must be copied exactly; do not invent them. Wait until Resend reports the domain as verified. DMARC is also recommended after SPF and DKIM pass.
3. Create a Resend API key restricted to sending access. Store it only in Resend/Supabase secret settings, never in this repository or frontend code.
4. Use `noreply@infobridgeindia.online` as the transactional sender address. A receiving mailbox is optional for a no-reply address, but the domain must be verified in Resend.
5. In **Supabase Dashboard → Authentication → Emails → SMTP Settings**, enable Custom SMTP and enter:
   - Sender name: `InfoBridgeIndia`
   - Sender email: `noreply@infobridgeindia.online`
   - Host: `smtp.resend.com`
   - Port: `465` (implicit TLS; use `587` if the environment requires STARTTLS)
   - Username: `resend`
   - Password: the Resend API key created in step 3
6. Save the settings and send real signup-confirmation and password-recovery tests to an external mailbox. Confirm the visible From identity is `InfoBridgeIndia <noreply@infobridgeindia.online>` and inspect the received headers for SPF and DKIM pass results.
7. Review **Authentication → Rate Limits** before production traffic. Custom SMTP does not remove Supabase Auth's configured email rate limits.

Resend may display an SPF TXT record plus an MX record for its return-path subdomain and one or more DKIM records. Use the exact records shown in the Resend Domains screen because selectors and targets are account/domain specific. If `infobridgeindia.online` already has an SPF record, do not publish a second SPF TXT record at the same hostname; merge authorized senders according to the DNS provider and Resend guidance.
