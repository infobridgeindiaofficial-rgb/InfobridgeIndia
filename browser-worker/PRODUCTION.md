# Screen View production connection and deployment

## Verified diagnosis — 4 October 2026

- The live `/screen-view/admin/` returns HTTP 200 with `Server: GitHub.com`.
- The live `/screen-view-config.js` selects `https://browser.infobridgeindia.online` outside localhost. The URL is correct for the intended architecture.
- `www.infobridgeindia.online` redirects (301) to the apex domain. Allow only `https://infobridgeindia.online` unless this behavior is deliberately changed.
- `browser.infobridgeindia.online` returns NXDOMAIN using the system resolver and Cloudflare's 1.1.1.1 resolver. A request to `/api/sessions` fails with curl exit 6, before TLS, HTTP, CORS, authentication or WebSocket negotiation.
- The apex resolves to GitHub Pages IPs. Its authoritative nameservers are `artemis.dns-parking.com` and `hermes.dns-parking.com`.
- The deployed CSP permits HTTPS and WSS. The production worker URL introduces no mixed content. Do not loosen CSP or CORS to fix DNS.
- The supplied Compose stack routes Caddy to `worker:8090`. Production Node binds `0.0.0.0:8090`; the egress proxy binds `0.0.0.0:8091`. Neither port is published. Caddy publishes TCP 80/443 and handles WebSocket upgrades through the same reverse proxy.
- The worker requires an exact Origin, verifies Supabase tokens through `/auth/v1/user` via the egress proxy, and requires an explicit `SCREEN_VIEW_ADMIN_IDS` allowlist. Missing settings prevent startup. No service-role key is needed.

**Confirmed blocker: the public worker DNS record is absent.** Source code and Docker files do not establish that a worker has been deployed. No backend host address, SSH access, infrastructure account, populated server environment or real admin login was provided. An existing worker deployment, its firewall, TLS, runtime environment and Supabase settings therefore remain unverified. GitHub Pages cannot run this service.

## Minimum infrastructure actions

1. Use an existing dedicated Linux Docker host if one exists; otherwise provision a Linux VPS with Docker Compose, Chromium sandbox/user namespace support, at least 4 GB available for the worker plus host overhead, and sufficient CPU (the worker limit is two CPUs). Shared/static hosting is insufficient.
2. In the DNS panel serving the nameservers above, create an **A** record: name `browser`, value **the VPS public IPv4 address**, TTL 300 or the panel default. Do not point it at GitHub Pages IPs. Add AAAA only if IPv6 is actually configured and reachable on this host. Leave the apex and www website records alone.
3. In the VPS/cloud firewall, allow inbound TCP 80 and 443. Restrict SSH to your administration IP. Do not publish 8090, 8091 or Chromium debugging ports. Permit outbound DNS and public HTTP/HTTPS for Caddy and the egress container.
4. Deploy the `browser-worker/` directory from repository `main` to the host. Retain `seccomp_profile.json`, `Caddyfile`, `compose.yaml` and `.dockerignore`. If TCP 80/443 are already occupied, use a dedicated host or deliberately integrate the existing proxy; do not blindly start another public proxy.

Run on that Linux host, inside `browser-worker/`:

```sh
cp .env.production.example .env
chmod 600 .env
# Edit .env before starting:
# SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must match the website's project.
# SCREEN_VIEW_ADMIN_IDS must contain the existing admin's Supabase Auth user UUID.
# Keep ALLOWED_ORIGINS=https://infobridgeindia.online.
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 worker gateway egress
```

Never commit `.env`, use a Supabase service-role key, add wildcard CORS, remove network isolation, expose the proxy or disable Chromium sandboxing. Caddy obtains and renews its certificate after DNS points here and TCP 80/443 are reachable. Docker/Compose and Linux sandbox behavior must be checked on the real host; they were not executed in this Windows workspace.

## Verify before declaring the incident resolved

There is **no `/health` endpoint**. Use the real API with the production Origin. These probes intentionally contain no credentials:

```sh
curl -i https://browser.infobridgeindia.online/api/sessions \
  -H 'Origin: https://infobridgeindia.online'
# Expected: HTTP 401, JSON "Sign in required", and
# Access-Control-Allow-Origin: https://infobridgeindia.online.

curl -i -X OPTIONS https://browser.infobridgeindia.online/api/sessions \
  -H 'Origin: https://infobridgeindia.online' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
# Expected: HTTP 204, exact Access-Control-Allow-Origin, and allowed headers.

curl -i https://browser.infobridgeindia.online/api/sessions \
  -H 'Origin: https://untrusted.example'
# Expected: HTTP 403, no Access-Control-Allow-Origin.
```

Then sign in through the existing website using an allowlisted admin account. Open `/screen-view/admin/`, create a session and obtain its code. In a separate browser/context open `/screen-view/` and join. Confirm Chromium starts, participant click/type/scroll/navigation work, and the admin sees the same frames without writable controls. In browser developer tools check `/stream` uses `wss://browser.infobridgeindia.online/stream`, returns status 101, and exchanges an authorized `ready` message and frames. An unauthenticated WebSocket upgrade alone does not prove session authorization works; tickets are single-use, expire after 20 seconds, and travel in the first message rather than the URL.

End the session and confirm both clients disconnect and the remote browser closes. Test reconnect and unauthorized origins/accounts as well. An admin API 403 after DNS/TLS work requires checking the matching Supabase project, login token and admin UUID; it is a different failure from DNS. A join 503 requires inspecting worker startup/sandbox/resource logs. Do not record tokens, passwords, full environment output or WebSocket payloads in shared logs.

Acceptance remains pending until this complete production flow passes. A successful static page load or a repository push does not resolve the incident.

## Repository validation for this deployment handoff

The audited runtime files match `origin/main`. No frontend, worker logic or unrelated tools were changed. `node build.js --verify` passed (134 pages) without overwriting existing deployment snapshots. The source, root, dist and verification-build public configs all select the exact production worker URL.

All seven existing Screen View tests passed outside the Windows sandbox, including real Chromium with two clients, participant controls, admin view-only enforcement, session authentication/ownership, ticket replay rejection, origin denial and cleanup. The sandboxed attempt failed with an internal Playwright assertion; the unrestricted rerun passed without code changes. Supabase verification is injected in these tests, so real production account authentication remains unverified.

The existing website suite passed 938 of 940 tests; two pre-existing Sales dashboard month/credit-note calculations failed before these documentation-only changes. They were left untouched. Actual Docker build, Linux container startup, public TLS/WSS and end-to-end production acceptance still require the worker host.
