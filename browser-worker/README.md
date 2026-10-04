# Screen View: isolated browser worker

## Architecture and hosting audit

The existing site is a custom Node-generated static HTML/CSS/JS application. `build.js` renders `src/pages` with `src/components` and `src/data/nav.js`, copies explicitly selected runtime assets, and normally synchronizes `dist` into the tracked repository-root GitHub Pages snapshot. `serve.js` is only a development static server. `CNAME` points to `infobridgeindia.online`; the build and existing connection audit explicitly identify GitHub Pages. No persistent application server, WebSocket host, or Chromium deployment existed. The nested `Infobridgeindia website` directory and deployment worktree are separate copies and were not modified.

Authentication is Supabase (`src/supabase/client.js`), with company-owner/member permissions in the existing company services and Supabase SQL. Screen View reuses the current Supabase access token. No authentication/schema migration or changes to company permissions are required. Existing Supabase project settings and real admin credentials were not changed or tested.

| Hosting question | Finding |
|---|---|
| Current hosting | GitHub Pages, detected from repository deployment configuration; live account settings not inspected |
| Can run remote Chromium there? | No |
| Can host persistent WebSockets there? | No |
| Recommended deployment | Keep static site; add a dedicated Linux VM/container service at `browser.infobridgeindia.online` |

The main website provides `/screen-view/` and `/screen-view/admin/`. A separate Node 24 worker owns sessions, checks Supabase authentication, launches a separate sandboxed Chromium process and isolated nonpersistent context per joined session, sends frames, and applies input. A private outbound HTTP/CONNECT proxy resolves destinations and connects only to validated public addresses. Docker puts the worker on an internal network with no direct internet route; only the proxy can reach outside. Caddy provides HTTPS/WSS. No external site is embedded in an iframe, and no debugging port is opened.

The browser worker is the authorization authority for Screen View; static hosting cannot securely create sessions itself. Its admin HTTP API accepts the existing Supabase bearer token, verifies it against `/auth/v1/user`, then checks the returned user UUID against `SCREEN_VIEW_ADMIN_IDS`. This explicit feature allowlist prevents every company owner from automatically becoming a Screen View administrator. The same admin can access only sessions they created. No service-role key is needed.

## Streaming, controls and lifecycle

Chromium CDP `Page.startScreencast` produces JPEG frames (quality 65), acknowledged with `Page.screencastFrameAck`. The worker fans binary JPEG frames out to both clients over authorized WebSockets. It holds only the latest frame in memory and skips frames for clients with over 512 KiB queued. This is event-driven compressed viewport streaming, not repeated PNG screenshots. It has higher bandwidth and less efficient motion than WebRTC video; it is an interactive MVP with no audio.

Participant commands support tap/click, wheel/touch scrolling, text, navigation keys, address/search, history, refresh, Home, viewport resize, and switching between up to five remote tabs/popups. The mobile keyboard strip sends text to the currently selected remote field; it clears local text after sending and handles composition input. Admin controls are absent in the UI and all control messages from admins are rejected server-side. Admins can still end their session. Native file pickers, uploads, clipboard synchronization, audio/video, browser extensions, WebAuthn/passkeys and drag selection are not provided. JavaScript dialogs are dismissed in this MVP.

Session join codes contain 72 cryptographically random bits, displayed as `XXXXXX-XXXXXX-XXXXXX` (hex). This deliberately uses a longer code than the six-digit example. It is single-use and never a database sequence. Joining atomically consumes it and issues a 256-bit participant bearer token. Only its hash is stored on the worker; the client keeps the token in tab-scoped `sessionStorage` for reload/reconnect. Treat the join code as confidential and share it directly with the intended participant.

WebSockets authenticate with a 20-second, single-use ticket in the first message, never a URL query token. One participant connection and up to three admin viewers can attach. Admin connections renew authorization every 60 seconds through the HTTP API. Browser controls count as activity; passive viewing and dashboard polling do not extend the 10-minute idle limit. Absolute expiry is 60 minutes from creation. Ending, idle expiry, browser failure, or worker shutdown revokes tokens/tickets, disconnects viewers, clears the in-memory frame, and closes the context/process. State is not durable; a worker restart ends every session. No cookies or passwords are saved permanently.

## Security boundary

- Exact-origin CORS and WebSocket checks, bearer-based authorization, JSON-only mutations, owner checks on every session API. Cross-origin cookies are not used, reducing CSRF exposure.
- Production rejects non-HTTPS requests; the supplied private deployment trusts forwarded headers only from the gateway path. Never expose port 8090 or 8091 publicly or put the worker on an internet-enabled network.
- URL scheme/port/credential checks plus public-IP allowlisting at the egress proxy. Localhost, private/link-local/metadata/reserved/multicast IPv4/IPv6 and mapped-address forms are blocked. All DNS answers must be public, and the proxy connects to the checked literal IP to prevent rebinding. Redirects and subresources also traverse the proxy.
- Chromium loopback proxy bypass and QUIC are disabled; WebRTC non-proxied UDP is disabled. The production internal network is essential defense in depth, not an optional replacement for validation.
- Non-root Chromium sandbox, official Playwright seccomp profile, read-only container filesystem, temporary in-memory filesystem, resource limits, and four sessions by default. No CDP TCP listener.
- Rate limits for API, joins, creation, tickets, upgrades and input; bounded payloads, queued commands, pages and client frame backlog; WebSocket heartbeat cleanup.
- Feature-specific CSP, no analytics/ads on Screen View pages, no HTML injection from remote data, no device capture/camera/mic/clipboard APIs. DOM text is inserted with `textContent`.
- Audit events contain timestamp, opaque session ID, event, and navigation hostname only. No full URLs, input text, cookies, passwords, OTPs, or tokens. Docker rotates stdout audit logs at 3 × 10 MB. Do not enable Playwright debug tracing, HTTP body logging, or WebSocket payload logging in production.

**Downloads are Phase 2** and blocked with `acceptDownloads:false`; an attempted download receives an explanatory notice. There is no temporary download API that might accidentally expose files. A later implementation needs quotas, sanitized names, authenticated short-lived links, non-executable attachment responses, and cleanup.

## Local run (PowerShell)

From the repository root:

```powershell
node scripts/build-screen-view.mjs
node serve.js 4173
```

The feature-only builder updates Screen View assets in both snapshots and inserts homepage menu links without replacing unrelated pages. `node build.js --verify` builds the entire website into `tmp/screen-view-build` without touching deployment snapshots. The ordinary `node build.js` still performs the existing full rebuild/synchronization; review existing snapshot edits before using it.

In another terminal:

```powershell
cd browser-worker
npm.cmd ci
npx.cmd playwright install chromium
Copy-Item .env.example .env
# Edit .env with the existing Supabase project URL, publishable key,
# and the UUID of your authorized existing Supabase admin account.
npm.cmd start
```

Use `http://localhost:4173` (not `127.0.0.1`, unless you also update origins and the public config). Sign in using the website's existing login, open `/screen-view/admin/`, create a session, and share its code. Open `/screen-view/` in another browser/context and join. The local worker binds to loopback and starts a loopback proxy automatically. Local development does not provide the production container network boundary.

### Environment variables

| Variable | Required/use |
|---|---|
| `SUPABASE_URL` | Existing HTTPS Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Existing public/publishable key; never a service-role key |
| `SCREEN_VIEW_ADMIN_IDS` | Comma-separated authorized Supabase Auth user UUIDs, no spaces |
| `ALLOWED_ORIGINS` | Exact comma-separated website origins; local default `http://localhost:4173`; production HTTPS origins |
| `PORT` | Worker port, default 8090 |
| `MAX_SESSIONS` | Default 4; provision RAM/CPU before raising |
| `NODE_ENV` | `production` enables HTTPS/isolation startup checks |
| `EGRESS_PROXY` | Production private proxy URL; Compose supplies `http://egress:8091` |
| `EGRESS_ISOLATED` | `true` only with the supplied network isolation or equivalent enforced policy |
| `BROWSER_DOMAIN` | Caddy hostname, default `browser.infobridgeindia.online` |
| `PROXY_HOST`, `PROXY_PORT` | Proxy listen configuration; Compose supplies these |

Frontend public configuration is `public/screen-view-config.js`, copied to both snapshots. It contains only the worker URL. Run the feature builder after editing it. Localhost selects the local worker; the production default is `https://browser.infobridgeindia.online`.

## Production deployment

1. Provision a dedicated Linux host with Docker Compose, unprivileged user namespaces/Chromium sandbox support, and sufficient memory (start with at least 4 GB available for worker plus host overhead). Do not deploy on shared/static/serverless hosting.
2. Point the browser subdomain DNS at that host. Permit public TCP 80/443 only; do not expose worker, egress, or debugging ports.
3. Copy the `browser-worker` directory, populate `.env`, and replace `ALLOWED_ORIGINS` with the exact HTTPS website origins.
4. Run `docker compose up --build -d`. Caddy requests TLS certificates automatically. Keep the private network, seccomp profile, non-root user and resource limits. Do not use `--no-sandbox` to work around host incompatibility.
5. Deploy the feature's static assets/homepage changes through the existing website release process. Verify real Supabase admin login, expiry, server egress blocking, WSS reconnect, and seller sites from the deployment region before inviting participants.

Docker/Compose are not available in the development environment, so the Linux container deployment and real TLS/DNS provisioning were **not executed**. Supplied deployment configuration is reviewable, but production acceptance remains required. No production site, DNS, Supabase settings or infrastructure was changed. Server-side websites see the worker's public IP/location, not the participant's India IP.

## Test results — 2026-10-04

Build: `node build.js --verify` passed, 134 pages. Dependencies: npm production audit found zero known vulnerabilities at installation time. Worker suite: **6/6 tests passed**, including real Chromium with two independent client contexts, participant tap/click/type/scroll, URL/history/refresh, admin synchronized frames, UI and server view-only checks, reload/reconnect, teardown, private-address denial, ticket replay denial, expiry/rate limits and startup/teardown races.

The integration test replaces Supabase verification only through dependency injection in the test process; it does not install a production test-login bypass. **Real Supabase admin login has not been tested**, because no authorized account credentials were supplied. The runtime verifier calls the existing project's Auth endpoint and checks the explicit UUID allowlist.

Responsive Chromium emulation passed at **390, 430, 768, 1024 and 1440 px**, including touch-enabled taps, with no horizontal document overflow or page JavaScript errors. Screenshots were inspected. Physical iPhone/iPad and Safari/WebKit testing remains unverified; software-keyboard, IME and background/suspend behavior need real-device acceptance.

Live Google homepage returned HTTP 200. Typing a search submitted successfully, but Google then displayed: “Our systems have detected unusual traffic from your computer network.” Search results therefore did **not** pass in this environment. No challenge bypass was attempted.

Meesho Seller returned **HTTP 403, `Access Denied`**: `You don't have permission to access "http://supplier.meesho.com/" on this server.` Reference `18.f79e1002.1791102826.243698af`. It has **not** been shown to work. No login/OTP/CAPTCHA automation was attempted. Amazon and Flipkart shortcuts are included, but their sign-in and seller workflows have not been tested.

The broader existing website suite returned **933/938 passed**. Failures cover root/dist mismatch, missing GST links in existing generated pages, source-to-snapshot reproducibility, and two Sales dashboard month calculations. The Screen View navigation source change also makes a full source-to-old-snapshot comparison differ. Unrelated deployment snapshots and business logic were deliberately preserved; the isolated full build and new feature tests pass. Full output: `tmp/screen-view-existing-tests.tap`.

Run tests from the worker directory after the verify build:

```powershell
npm.cmd test
node check-sites.js
```

The second command is a separate optional live-site probe; site availability/challenges can change. Evidence is under `tmp/screen-view-evidence/`. Test screenshots contain a synthetic form and no real seller credentials.

## Changed files and remaining work

Created: `browser-worker/{server.js,browser.js,auth.js,network.js,proxy.js,check-sites.js,package.json,package-lock.json,Dockerfile,compose.yaml,Caddyfile,seccomp_profile.json,.dockerignore,.env.example,README.md}`, its two test files, `src/screen-view/{page.js,client.js,styles.css}`, `public/screen-view-config.js`, `scripts/build-screen-view.mjs`, generated `screen-view/{index.html,admin/index.html,client.js,styles.css}` and `screen-view-config.js` in root and `dist`.

Modified: `build.js` (feature routes/assets and safe verify mode), `src/data/nav.js` (participant menu and admin sidebar links), `.gitignore` (local install cache/env exclusion), and root/dist `index.html` (two narrowly inserted desktop/mobile links; all prior edits preserved). Root package dependencies, existing Supabase auth and unrelated source files were not changed.

Before production: provision the worker, configure real admin UUIDs/origins, test real Supabase and physical iOS devices, and assess seller-site acceptance from that server. Phase 2: secure downloads, richer native dialogs/selection/keyboard UX, optional explicitly authorized admin control, WebRTC/video optimization, and multi-worker capacity coordination. Persistent seller cookies remain out of scope unless separately requested.

Implementation references: [CDP screencast API](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-startScreencast), [Playwright Docker/sandbox guidance](https://playwright.dev/docs/docker), [Supabase server authentication guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client). The bundled seccomp profile is from [Playwright v1.63.0](https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json).
