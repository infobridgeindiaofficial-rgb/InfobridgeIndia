# PROJECT CONNECTION AUDIT

Audit date: 2026-08-28  
Baseline: `master` at `c73bd338df1bed878da7b60ac429181a29d5e9e4` (`origin/main`)  
Initial Git state: clean  
Safety result: nothing deleted, moved, committed, pushed, or deployed.

## Executive finding

The project has three connected website layers:

1. Canonical source modules and assets under `src/` and `public/`.
2. Rebuildable output under `dist/`, created by `build.js` and served by `serve.js`.
3. A tracked root-level static snapshot (`*.html` plus route/asset directories) consistent with a GitHub Pages deployment layout and retained in commit history.

The root snapshot must not be treated as unused merely because `build.js` writes to `dist/`. It is tracked, includes `CNAME`, and deployment commits in history explicitly synchronize/publish the site. The hidden backup/deploy directories also contain `.git` pointer files referencing worktree metadata outside this repository path. Moving them could damage recovery or deployment procedures.

No non-empty file or folder met the requested strong standard for VERIFIED UNUSED / DISCONNECTED. Therefore `_offline_review/` was not created and nothing was isolated.

## Top-level connection classification

| Path | Category | Connected? | Why / references | Safe to isolate? |
|---|---|---:|---|---:|
| `.git/` | Development / tooling | INDIRECT | Repository history, baseline, branches, deployment evidence | NO |
| `.gitignore` | Development / tooling | INDIRECT | Excludes dependencies, builds, local worktrees, environment files, logs | NO |
| `.claude/` | Development / tooling | INDIRECT | Ignored local development metadata; purpose not fully audited | NEEDS REVIEW |
| `.backup-git-worktree/` | Backup / old worktree | INDIRECT | Full historical project copy with `.git` pointer to another repository's worktree metadata | NO |
| `.deploy-worktree/` | Backup / deployment worktree | INDIRECT | Full deployment-oriented copy with `.git` pointer to another repository's worktree metadata | NO |
| `node_modules/` | Generated / rebuildable dependency tree | INDIRECT | `build.js` copies Supabase, jsPDF, and pdf-lib browser bundles from installed packages | NO (rebuildable, but currently required to build) |
| `dist/` | Generated / rebuildable | YES | Direct output of `npm run build`; direct input to `serve.js`; 147 generated HTML routes | NO (do not isolate during this audit) |
| `src/` | LIVE / ACTIVE | YES | Canonical components, pages, client scripts, styles, services, and workspace code imported/copied by `build.js` | NO |
| `public/` | LIVE / ACTIVE | YES | Recursively copied into `dist/`; logo, hero, showcase images, Supabase config | NO |
| `tests/` | Development / testing | INDIRECT | `npm test` runs all `tests/*.test.js`; protects auth, modules, persistence, tools, and build wiring | NO |
| `scripts/` | LIVE snapshot + development helpers | INDIRECT | Root deployment snapshot contains runtime scripts; two `test-*.mjs` helpers are development utilities | NO |
| `reference-files/` | Development / test fixtures / provenance | INDIRECT | Tests directly load GST ZIP, sample shipping-label PDF, and DOCX; source comments document old-site provenance | NO |
| `supabase/` | LIVE backend/deployment configuration | INDIRECT | SQL migrations/schema, workspace clients, security functions; tests validate migration and isolation behavior | NO |
| `build.js` | LIVE build entry | YES | Imports page renderers, writes 147 routes, copies every runtime asset family and vendor library | NO |
| `serve.js` | Development / preview tooling | INDIRECT | Serves only `dist/`; package `preview` and `serve` scripts invoke it | NO |
| `package.json`, `package-lock.json` | Development / build tooling | INDIRECT | Define build/test/preview commands and required npm packages | NO |
| `README.md` | Development documentation | INDIRECT | Documents architecture and build/preview workflow | NO |
| `CNAME` | Deployment configuration | YES | Custom-domain marker in tracked root deployment snapshot | NO |
| Root `*.html` | LIVE deployment snapshot | YES | Tracked static routes; commit history contains deployment synchronization/publishing commits | NO |
| Root `infobridgeindia-*.png` | LIVE deployment assets | YES | Referenced branding/hero assets and present in `public/`/`dist/` | NO |
| Root `supabase-config.js` | LIVE deployment config | YES | Browser Supabase endpoint/client configuration in root snapshot | NO |
| `app/`, `gst/`, `hr/`, `products/` | LIVE route snapshot | YES | Root static route trees corresponding to generated marketing/app routes | NO |
| `app-showcase/` | LIVE deployment assets | YES | Image set duplicated from `public/app-showcase/` for root deployment; all ten files match `dist` | NO |
| `auth/`, `company/`, `country/`, `export/`, `security/` | LIVE runtime snapshot | YES | Browser authentication, company, localization, workbook export, and security modules | NO |
| `administration-workspace/`, `approvals-workspace/`, `banking-workspace/`, `finance-workspace/`, `gst-workspace/`, `purchases-workspace/`, `reports-workspace/`, `sales-workspace/` | LIVE runtime snapshot | YES | Browser module code copied from canonical `src/*` families into corresponding build destinations | NO |
| `inventory/`, `hr-payroll/` | LIVE runtime + route snapshot | YES | Active standalone workspaces; generated routes `/inventory/index.html` and `/hr-payroll/index.html` | NO |
| `gst-calculator/`, `gst-interest-calculator/`, `gst-invoice-generator/`, `gst-late-fee-calculator/`, `marketplace-profit-calculator/` | LIVE free-tool snapshot | YES | Explicit route generation and recursive asset copies in `build.js` | NO |
| `pdf-to-word/`, `word-to-pdf/`, `jpg-to-pdf/`, `merge-pdf/`, `split-pdf/` | LIVE free-tool snapshot | YES | Explicit route generation, runtime assets, tests, and vendor PDF dependencies | NO |
| `quotation-generator/`, `shipping-label-4in1/` | LIVE free-tool snapshot | YES | Explicit routes/assets; dedicated functional tests and reference fixtures | NO |
| `styles/` | LIVE deployment snapshot | YES | CSS required by marketing pages, tools, projects/documents, and workspace chrome | NO |
| `vendor/` | LIVE deployment snapshot | YES | Browser bundles for Supabase, jsPDF, and pdf-lib | NO |
| `icons/` | Uncertain empty directory | NO files | Empty on disk; no tracked content to move | NEEDS REVIEW |

## Canonical `src/` dependency groups

| Source group | Build/output connection | Principal dependencies |
|---|---|---|
| `src/pages/marketing/*.js` | Rendered by `build.js` to root marketing/auth/free-tool HTML routes in `dist/` | `src/components`, `src/data/nav.js`, styles, scripts, tool assets |
| `src/pages/app/*.js` | Rendered to `/app/*`, `/inventory/`, and `/hr-payroll/` routes | workspace chrome, module runtime assets, auth gate |
| `src/components/`, `src/data/` | Imported by page renderers and shared layout | navigation, icons, reusable UI/layout |
| `src/styles/` | Recursively copied to `/styles/` | referenced by generated HTML and workspace pages |
| `src/scripts/` | Recursively copied to `/scripts/` | site UI, auth gate/UI, company UI, projects/documents, workspace sidebar |
| `src/auth/`, `src/supabase/` | Copied to `/auth/` and `/supabase/` | Supabase browser vendor and public configuration |
| `src/company/`, `src/security/`, `src/country/`, `src/export/` | Copied to same-named runtime paths | company profile/permissions, security, localization, spreadsheet export |
| `src/administration/`, `src/analytics/`, `src/approvals/`, `src/banking/`, `src/finance/`, `src/gst/`, `src/hr-payroll/`, `src/inventory/`, `src/purchases/`, `src/sales/` | Copied to module workspace destinations | authenticated workspace routes, persistence, cross-module integrations |
| `src/*calculator/`, `src/*pdf/`, `src/quotation-generator/`, `src/shipping-label-4in1/` | Copied to free-tool destinations | corresponding generated tool page and, where applicable, jsPDF/pdf-lib |
| `src/compress-pdf/` | No build reference | Empty directory only; no file exists to classify or move | 

## Route and build dependency map

```text
package.json "build"
  -> build.js
     -> src/components/layout.js + src/data/nav.js
     -> src/pages/marketing/*
        -> dist/index.html, marketing pages, products/*, GST/HR pages,
           company pages, login/signup/reset, and all free-tool pages
     -> src/pages/app/*
        -> dist/app/*, dist/inventory/index.html, dist/hr-payroll/index.html
     -> src/styles + src/scripts
        -> dist/styles + dist/scripts
     -> src/auth + src/supabase + src/company + src/security + src/country
        -> browser auth, company setup/profile/security, localization, persistence
     -> src module/tool asset families
        -> dist/*-workspace, dist/inventory, dist/hr-payroll, dist/free-tool assets
     -> node_modules/@supabase/supabase-js, jspdf, pdf-lib
        -> dist/vendor/*.js
     -> public/*
        -> dist branding images, app-showcase images, supabase-config.js

package.json "preview" / "serve"
  -> serve.js
     -> dist/* on localhost

package.json "test"
  -> tests/*.test.js
     -> src modules + build wiring + Supabase SQL + reference-files fixtures
```

## Classification summary

### A. ACTIVE / LIVE-CONNECTED

`src/`, `public/`, `build.js`, the root deployment snapshot and its route/assets directories, `CNAME`, Supabase/auth/company/security code, every business workspace, all marketing pages, and all free tools.

### B. INDIRECT BUT REQUIRED

`package.json`, `package-lock.json`, `node_modules/` (build-time vendor inputs), `serve.js`, `supabase/` SQL/configuration, `reference-files/` test fixtures/provenance, `tests/`, and Git metadata/history.

### C. GENERATED / REBUILDABLE

`dist/` and `node_modules/`. `dist/` is regenerated by `npm run build`; `node_modules/` is recreated by package installation. Both remain in place.

### D. DEVELOPMENT / TEST

`tests/`, test helpers in `scripts/`, `reference-files/`, `README.md`, package files, `.git/`, `.gitignore`, and local development metadata.

### E. VERIFIED UNUSED MOVED

None. No file met all disconnection and verification criteria.

### F. BACKUP / DUPLICATE MOVED

None. The hidden backup/deploy worktrees were deliberately not moved because their `.git` pointers and operational purpose make isolation unsafe.

### G. UNTOUCHED / NEEDS REVIEW

- `.backup-git-worktree/` and `.deploy-worktree/`: clearly copies, but coupled to external worktree metadata and potentially operational.
- `.claude/`: ignored development metadata, not a website input.
- Empty `icons/` and `src/compress-pdf/` directories: no file content exists to isolate.
- Root deployment snapshot: content overlaps generated output but is tracked and deployment-relevant.

## Verification results

- `npm test`: **FAIL (baseline)** — 840 tests total, 838 passed, 2 failed. Both failures are in `tests/sales-reports.test.js` and concern Sales report date filtering. No project files had been changed or moved before this run.
- `npm run build`: **PASS** — built 147 pages into `dist/`.
- Local server: **PASS at HTTP/reference level** on `http://localhost:4174` (4173 was already occupied). All 147 HTML routes returned HTTP 200; all 211 discovered local `src`/`href` references returned HTTP 200. Major auth, company, Finance, Sales, Purchases, Inventory, HR, Projects, Reports, GST, Administration, and free-tool routes returned HTTP 200.
- Browser visual/console verification: **NOT AVAILABLE** — no in-app or connected browser was available in this session. HTTP route and asset checks do not substitute for visual/authenticated interaction or console inspection.
- Supabase/auth: no changes; targeted Git diff was empty.
- Git after build: clean before adding this requested report. The build reproduced tracked `dist/` with no content diff.

## Isolation decision

`_offline_review/` was not created because the instruction makes its creation conditional on finding proven-unused or clearly obsolete files. Creating an empty review tree and changing ignore/build configuration would add noise without isolating anything. The current explicit build already copies only named `src` folders plus `public`, so a future root `_offline_review/` would not enter `dist/` unless `build.js` were intentionally changed.
