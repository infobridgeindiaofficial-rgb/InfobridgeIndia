# Windows laptop deployment through Cloudflare Tunnel

This deployment reuses the production worker and egress services from `compose.yaml` in Linux containers. Native Windows development mode is not a substitute for production network isolation. No service publishes any host ports. Supabase authorization, admin UUID allowlisting, single-use tickets, participant-only controls, expiry and cleanup are unchanged.

Prerequisites: a working Linux Docker engine on this laptop, a Cloudflare account with the domain active, and the existing authorized admin UUID. The free default uses Ubuntu 24.04 in WSL 2 with Docker Engine and Compose; Docker Desktop is optional if already installed. WSL installation may require Windows administrator authorization and a reboot. The laptop must be awake and its container engine running to serve sessions.

## Account configuration

Use Cloudflare's Free zone plan. For a permanent hostname, add `infobridgeindia.online` to Cloudflare and preserve all existing DNS records before changing nameservers at the registrar. Do not redirect the website to this laptop. Keep the existing GitHub Pages apex/www records DNS-only when migrating; retain mail and verification records. The currently authoritative nameservers are not Cloudflare's. A standalone CNAME at the existing DNS provider is insufficient for Cloudflare's free full-zone setup.

In Cloudflare's tunnel dashboard create a remotely managed Cloudflared tunnel named `infobridge-screen-view-laptop`. Save only its connector token, as a single line, in local `.env.tunnel-token` alongside this file. It is ignored by Git and excluded from the image build. Do not put the token into command-line arguments, public configuration, screenshots or shared logs.

Add a published application route:

- Hostname: `browser.infobridgeindia.online`
- Service type: HTTP
- Service URL: `gateway:80` (the container gateway, not Windows localhost)

Ensure the browser hostname redirects HTTP to HTTPS at the Cloudflare edge. Preserve WebSocket support. Do not apply a Cloudflare Access login page to these API routes without an intentional compatible authentication integration: the existing frontend uses Supabase and participant bearer tokens, not Access service tokens.

## Local credentials and startup

Copy `.env.production.example` to `.env`. Set the Supabase URL and publishable key to the existing frontend project, and `SCREEN_VIEW_ADMIN_IDS` to the explicitly authorized existing Auth user UUID. Keep `ALLOWED_ORIGINS=https://infobridgeindia.online` and `BROWSER_DOMAIN=browser.infobridgeindia.online`. Never use the service-role key. Protect both local credential files with Windows user-only access; the installer/operator must check ACLs before starting.

```powershell
# From this directory, with Docker Engine enabled in Ubuntu-24.04 WSL:
.\Start-Laptop.ps1 -KeepAlive
# Register optional current-user logon startup after the first successful test:
.\Start-Laptop.ps1 -RegisterLogonTask
```

In the WSL distribution enable systemd and `docker.service` at boot. The script starts WSL by invoking Docker and waits for the engine. If using an existing Docker Desktop instead, enable its “Start Docker Desktop when you sign in” setting. The logon task starts this stack; each container has `restart: unless-stopped`. This restores worker/tunnel processes after crashes but intentionally does not preserve active sessions after a worker restart. No administrator-level task, public firewall rule, router port forwarding or writable host mount is introduced. Sleep/power settings are not changed automatically.

The WSL logon task retains a foreground `sleep infinity` process after startup because systemd services alone do not keep WSL alive. Keep the manual `-KeepAlive` invocation open until the logon task is running. The task has no execution time limit and retries failures.

`-RegisterLogonTask -RegisterOnly` can prepare the current-user logon task before account authorization. Starting the stack still fails closed until both credential files and the real admin UUID are configured.

The seccomp profile permits Chromium's namespace-local `chroot` even when all host capabilities are dropped. The original capability-conditional rule denied this call and killed Chromium's sandbox zygote. Kernel capability checks remain active: no host `SYS_CHROOT`, `SYS_ADMIN`, privileged mode or sandbox-disabling browser flag is granted.

## Verification

Run `docker compose -f compose.laptop.yaml ps` and inspect worker/gateway/tunnel startup logs. The worker healthcheck expects an unauthenticated 401 from `/api/sessions` with the exact production CORS origin. It does not bypass authentication. There is no `/health` endpoint. Cloudflare public ingress is not available until the tunnel account token, published route and domain activation are complete.

Follow the API, CORS and real admin/participant WSS acceptance flow in `PRODUCTION.md`. Confirm the public API returns 401 with the allowed Origin, rejects untrusted origins, then test a real allowlisted admin, generated session code, participant join, Chromium launch/control, admin view-only streaming, reconnect, expiry and teardown. Do not declare production fixed based on configuration parsing or the static page loading.

References: https://developers.cloudflare.com/tunnel/ and https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/ (WebSocket support).

## Laptop preparation verified on 4 October 2026

WSL 2, Ubuntu 24.04, free Docker Engine/Compose and build tooling were installed on this laptop. The Docker systemd service is enabled. The production worker image and official Caddy/cloudflared images were downloaded/built. A current-user logon task was registered, with startup retries and WSL keepalive; it fails closed until account credentials are complete.

All seven existing Screen View tests passed inside a non-root, read-only, no-internet container with all capabilities dropped and the corrected seccomp profile. This exercised real Chromium, participant controls, admin view-only streaming, ticket/ownership enforcement, origin rejection and cleanup. The 134-page frontend verification build passed. Compose and Caddy validation passed.

A temporary private stack (no tunnel or published ports, with a non-user validation UUID only) verified the production-origin API 401/CORS response, untrusted-origin denial, Caddy WebSocket upgrade and unauthenticated-socket rejection. Its worker, egress and gateway were stopped after testing. The local real-project environment file is user-only and keeps the admin UUID empty; no validation identity was saved to it. Public HTTPS/WSS and real Supabase admin/participant acceptance remain pending Cloudflare account/domain authorization, the connector token and the real authorized admin UUID.
