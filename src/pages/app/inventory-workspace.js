export function inventoryWorkspacePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="/vendor/supabase.js"></script>
  <script src="/supabase-config.js"></script>
  <script type="module" src="/scripts/auth-gate.js"></script>
  <title>Inventory & Warehouse — InfoBridgeIndia</title>
  <meta name="description" content="InfoBridgeIndia local-first inventory and warehouse workspace." />
  <link rel="icon" type="image/png" href="/infobridgeindia-logo.png" />
  <link rel="stylesheet" href="/inventory/styles.css" />
</head>
<body>
  <div id="app" class="app-loading"><div class="boot-card"><div class="spinner"></div><p>Opening your inventory…</p></div></div>
  <div id="toast-region" class="toast-region" aria-live="polite"></div>
  <div id="modal-root"></div>
  <script type="module" src="/inventory/app.js"></script>
</body>
</html>`;
}
