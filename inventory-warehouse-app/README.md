# InfoBridgeIndia Inventory & Warehouse

A separate, local-first Inventory & Warehouse application. It does not modify or depend on the main InfoBridgeIndia site.

## Run

Serve this directory (or `dist`) with any static web server. IndexedDB requires a normal browser origin rather than opening the file directly in some browsers.

```powershell
node build.js
npx serve dist
```

No npm dependencies are required to build the application. The app stores products, warehouses, stock movements, stock counts and settings in browser IndexedDB.

## Test

```powershell
node test-core.js
```

Use **Load demo inventory** on first setup to exercise daily workflows. Use Settings → Full Inventory Backup before clearing browser storage or moving to another browser.

## Implemented scope

- Business-specific setup and custom fields
- Product and warehouse maintenance
- Opening balances and movement-ledger stock calculation
- Stock In, Stock Out, Purchase Receipt, linked transfers, returns, damage/wastage, adjustments and confirmed physical counts
- Negative-stock guard
- Dashboard, search, low/out-of-stock status and average-cost valuation
- Movement-backed reports and CSV exports
- Business-specific CSV template, preview, validation and confirmed import
- IndexedDB persistence plus JSON backup/restore
- Optional batch, expiry, serial/IMEI, location and variant fields

External cloud backup, barcode camera scanning, FIFO valuation and the server-side accounting engine are intentionally not claimed or implemented in this local-first foundation.
