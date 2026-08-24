import { createMovement, createTransfer, currentInventory, inventoryMetrics, parseCsv, productStock, stockMap, toCsv, uid } from "./core.js";

const DB_NAME = "InfoBridgeIndiaInventory";
const DB_VERSION = 1;
const STORES = ["settings", "warehouses", "products", "movements", "counts"];
const BUSINESS_TYPES = ["Retail", "Wholesale", "Distributor", "Garments / Fashion", "Grocery / FMCG", "Electronics", "Hardware", "Pharmacy", "Restaurant / Hotel", "Manufacturing", "Construction", "E-commerce", "Import / Export", "Multi-warehouse", "Other / Custom"];
const TEMPLATE_FIELDS = {
  "Garments / Fashion": ["brand", "category", "size", "color", "variant"],
  "Grocery / FMCG": ["brand", "category", "batch", "manufacturingDate", "expiry", "unit"],
  Electronics: ["brand", "model", "serial", "imei", "warranty"],
  Pharmacy: ["genericBrand", "batch", "expiry", "unit"],
  "Restaurant / Hotel": ["category", "unit", "expiry"],
  Construction: ["category", "unit", "project"],
  "Import / Export": ["countryOfOrigin", "currency", "unit"],
};
const DEFAULT_FIELDS = ["sku", "name", "category", "brand", "description", "unit", "purchasePrice", "sellingPrice", "openingStock", "reorderLevel", "supplier", "warehouseId", "location", "barcode", "notes"];
const FIELD_LABELS = {
  sku: "SKU", name: "Product Name", category: "Category", brand: "Brand", description: "Description", unit: "Unit", purchasePrice: "Purchase Price", sellingPrice: "Selling Price", openingStock: "Opening Stock", reorderLevel: "Reorder Level", supplier: "Supplier", warehouseId: "Warehouse", location: "Location / Bin", barcode: "Barcode", notes: "Notes", size: "Size", color: "Color", variant: "Variant", batch: "Batch Number", manufacturingDate: "Manufacturing Date", expiry: "Expiry Date", model: "Model", serial: "Serial Number", imei: "IMEI", warranty: "Warranty", genericBrand: "Generic / Brand", project: "Site / Project", countryOfOrigin: "Country of Origin", currency: "Currency",
};

let db;
let state = { settings: null, warehouses: [], products: [], movements: [], counts: [], view: "dashboard", query: "", productFilter: "all", productSort: "name", report: "current-stock" };
let searchTimer;
const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => STORES.forEach((store) => { if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "id" }); });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(store, mode = "readonly") { return db.transaction(store, mode).objectStore(store); }
function all(store) { return new Promise((resolve, reject) => { const request = tx(store).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function put(store, value) { return new Promise((resolve, reject) => { const request = tx(store, "readwrite").put(value); request.onsuccess = () => resolve(value); request.onerror = () => reject(request.error); }); }
function remove(store, id) { return new Promise((resolve, reject) => { const request = tx(store, "readwrite").delete(id); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }
function clear(store) { return new Promise((resolve, reject) => { const request = tx(store, "readwrite").clear(); request.onsuccess = resolve; request.onerror = () => reject(request.error); }); }

async function reload() {
  const [settings, warehouses, products, movements, counts] = await Promise.all(STORES.map(all));
  state.settings = settings.find((s) => s.id === "app") || null;
  state.warehouses = warehouses;
  state.products = products;
  state.movements = movements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  state.counts = counts;
}

function money(value) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0)); }
function dateTime(value) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
function product(id) { return state.products.find((p) => p.id === id); }
function warehouse(id) { return state.warehouses.find((w) => w.id === id); }
function toast(message, tone = "success") { const el = document.createElement("div"); el.className = `toast ${tone}`; el.textContent = message; document.querySelector("#toast-region").append(el); setTimeout(() => el.remove(), 3500); }
function download(name, content, type = "text/csv") { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([content], { type })); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 500); }

function icon(name) {
  const paths = { dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>', products: '<path d="M4 7l8-4 8 4-8 4-8-4zM4 7v10l8 4 8-4V7M12 11v10"/>', warehouse: '<path d="M3 9l9-6 9 6v12H3V9zM7 13h10M7 17h10"/>', movement: '<path d="M4 7h14M15 4l3 3-3 3M20 17H6M9 14l-3 3 3 3"/>', reports: '<path d="M4 20V4M4 20h16M8 16v4M12 11v9M16 7v13M20 3v17"/>', import: '<path d="M12 3v12M8 11l4 4 4-4M4 20h16"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a8 8 0 00-1.7-1L14.6 3h-4l-.4 3.1a8 8 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a8 8 0 001.7 1l.4 3.1h4l.4-3.1a8 8 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>' };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.products}</svg>`;
}

function setupScreen() {
  return `<main class="setup-shell"><section class="setup-card"><img src="./infobridgeindia-logo.png" alt="InfoBridgeIndia" class="setup-logo"/><span class="eyebrow">Inventory & Warehouse setup</span><h1>Build inventory around your business</h1><p>Select a business type and InfoBridgeIndia will enable the fields that matter. You can adjust them later.</p><form id="setup-form"><div class="business-grid">${BUSINESS_TYPES.map((type) => `<label class="business-option"><input type="radio" name="businessType" value="${type}" required/><span>${type}</span></label>`).join("")}</div><div id="custom-fields-wrap" hidden><label>Custom fields <span class="hint">Comma separated</span></label><input class="input" name="customFields" placeholder="Grade, Pack Size, Material"/></div><div class="setup-actions"><button type="button" class="btn secondary" data-demo>Load demo inventory</button><button class="btn primary" type="submit">Create inventory</button></div></form></section></main>`;
}

const nav = [
  ["dashboard", "dashboard", "Dashboard"], ["products", "products", "Product Master"], ["warehouses", "warehouse", "Warehouses"], ["movements", "movement", "Stock Movements"], ["reports", "reports", "Reports"], ["import", "import", "Import / Export"], ["settings", "settings", "Settings & Privacy"],
];

function shell(content) {
  return `<div class="app-shell"><aside class="sidebar" id="sidebar"><a class="sidebar-brand" href="#dashboard"><img src="./infobridgeindia-logo.png" alt="InfoBridgeIndia"/></a><div class="workspace-label"><strong>Inventory & Warehouse</strong><span>${escapeHtml(state.settings.businessType)}</span></div><nav>${nav.map(([view, ic, label]) => `<button class="nav-link ${state.view === view ? "active" : ""}" data-view="${view}">${icon(ic)}<span>${label}</span></button>`).join("")}</nav><div class="local-note">Local-first database<br/><span>Last saved automatically</span></div></aside><div class="main"><header class="topbar"><button class="icon-button mobile-menu" data-menu aria-label="Open menu">${icon("menu")}</button><div class="global-search">${icon("search")}<input id="global-search" value="${escapeHtml(state.query)}" placeholder="Search product, SKU, barcode, supplier, batch…"/></div><div class="top-actions"><button class="btn secondary compact" data-action="stock-in">Stock In</button><button class="btn primary compact" data-action="add-product">${icon("plus")} Add Product</button></div></header><div class="content">${content}</div><nav class="mobile-nav">${nav.slice(0, 5).map(([view, ic, label]) => `<button class="${state.view === view ? "active" : ""}" data-view="${view}">${icon(ic)}<span>${label}</span></button>`).join("")}</nav></div></div>`;
}

function pageHead(title, subtitle, actions = "") { return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions">${actions}</div></div>`; }
function empty(title, message, action = "") { return `<div class="empty"><div class="empty-icon">${icon("products")}</div><h3>${title}</h3><p>${message}</p>${action}</div>`; }
function metric(label, value, tone = "") { return `<div class="metric ${tone}"><span>${label}</span><strong>${value}</strong></div>`; }

function dashboardView() {
  const metrics = inventoryMetrics(state.products, state.warehouses, state.movements);
  const recent = state.movements.slice(0, 8);
  return `${pageHead("Inventory dashboard", "Live totals calculated from your locally stored stock movements.", `<button class="btn secondary" data-demo>Reset demo data</button>`)}<div class="metrics">${metric("Total Products", metrics.totalProducts)}${metric("Current Stock Value", money(metrics.stockValue))}${metric("Low Stock Items", metrics.lowStock, metrics.lowStock ? "warn" : "")}${metric("Out of Stock", metrics.outOfStock, metrics.outOfStock ? "danger" : "")}${metric("Stock In Today", metrics.stockInToday)}${metric("Stock Out Today", metrics.stockOutToday)}${metric("Damage / Wastage", metrics.damaged)}${metric("Warehouses", metrics.warehouses)}</div><div class="quick-card"><div><h2>Daily actions</h2><p>Every quantity change creates a movement record.</p></div><div class="quick-actions">${[["add-product","Add Product"],["stock-in","Stock In"],["stock-out","Stock Out"],["transfer","Transfer"],["adjustment","Adjustment"],["return","Return"],["damage","Damage / Wastage"],["stock-count","Stock Count"]].map(([a,l])=>`<button class="action-chip" data-action="${a}">${l}</button>`).join("")}</div></div><section class="panel"><div class="panel-head"><h2>Recent stock movements</h2><button class="text-button" data-view="movements">View ledger</button></div>${recent.length ? movementTable(recent) : empty("No stock movement yet", "Add a product with opening stock or record Stock In to begin.")}</section>`;
}

function filteredProducts() {
  const inventory = currentInventory(state.products, state.movements);
  const q = state.query.toLowerCase();
  return inventory.filter((p) => p.active !== false && (!q || [p.name,p.sku,p.barcode,p.brand,p.category,p.supplier,p.batch,p.serial].some(v=>String(v||"").toLowerCase().includes(q))) && (state.productFilter === "all" || (state.productFilter === "low" && p.quantity > 0 && p.quantity <= Number(p.reorderLevel||0)) || (state.productFilter === "out" && p.quantity <= 0))).sort((a,b)=>state.productSort==="stock"?a.quantity-b.quantity:state.productSort==="value"?b.stockValue-a.stockValue:String(a[state.productSort]||"").localeCompare(String(b[state.productSort]||"")));
}

function productTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th class="num">Current Stock</th><th class="num">Avg. Cost</th><th class="num">Stock Value</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((p)=>`<tr><td><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.brand||p.description||"")}</small></td><td class="mono">${escapeHtml(p.sku)}</td><td>${escapeHtml(p.category||"—")}</td><td class="num"><strong>${p.quantity}</strong> ${escapeHtml(p.unit||"unit")}</td><td class="num">${money(p.averageCost)}</td><td class="num">${money(p.stockValue)}</td><td>${p.quantity<=0?'<span class="badge danger">Out</span>':p.quantity<=Number(p.reorderLevel||0)?'<span class="badge warn">Low</span>':'<span class="badge success">In stock</span>'}</td><td><button class="more" data-view-product="${p.id}">View</button><button class="more" data-edit-product="${p.id}">Edit</button></td></tr>`).join("")}</tbody></table></div>`;
}

function productsView() {
  const rows=filteredProducts();
  return `${pageHead("Product Master", "Search, maintain and export your complete inventory catalogue.", `<button class="btn secondary" data-export="products">Export</button><button class="btn primary" data-action="add-product">${icon("plus")} Add Product</button>`)}<div class="filterbar"><button class="filter ${state.productFilter==='all'?'active':''}" data-product-filter="all">All</button><button class="filter ${state.productFilter==='low'?'active':''}" data-product-filter="low">Low stock</button><button class="filter ${state.productFilter==='out'?'active':''}" data-product-filter="out">Out of stock</button><select class="filter sort-select" id="product-sort"><option value="name" ${state.productSort==='name'?'selected':''}>Sort: Name</option><option value="sku" ${state.productSort==='sku'?'selected':''}>Sort: SKU</option><option value="stock" ${state.productSort==='stock'?'selected':''}>Sort: Lowest stock</option><option value="value" ${state.productSort==='value'?'selected':''}>Sort: Highest value</option></select></div><section class="panel">${rows.length?productTable(rows):empty("No matching products", "Add your first product or clear the current search.", '<button class="btn primary" data-action="add-product">Add Product</button>')}</section>`;
}

function warehouseView() {
  const balances=stockMap(state.movements);
  return `${pageHead("Warehouses", "Manage locations and see stock held in each warehouse.", `<button class="btn primary" data-action="add-warehouse">${icon("plus")} Add Warehouse</button>`)}<div class="warehouse-grid">${state.warehouses.map((w)=>{const qty=[...balances].filter(([k])=>k.endsWith(`::${w.id}`)).reduce((s,[,v])=>s+v,0);return `<article class="warehouse-card"><div class="warehouse-code">${escapeHtml(w.code)}</div><h2>${escapeHtml(w.name)}</h2><p>${escapeHtml(w.address||"No address added")}</p><dl><div><dt>Stock units</dt><dd>${qty}</dd></div><div><dt>Status</dt><dd>${w.active!==false?"Active":"Inactive"}</dd></div></dl><button class="text-button" data-edit-warehouse="${w.id}">Edit warehouse</button></article>`}).join("")}</div>`;
}

function movementTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Date / Transaction</th><th>Product</th><th>Type</th><th>Warehouse</th><th class="num">In</th><th class="num">Out</th><th class="num">Balance After</th><th>Reference</th></tr></thead><tbody>${rows.map((m)=>`<tr><td><strong>${dateTime(m.createdAt)}</strong><small class="mono">${escapeHtml(m.transactionId)}</small></td><td>${escapeHtml(product(m.productId)?.name||"Unknown product")}</td><td><span class="badge neutral">${escapeHtml(m.type.replaceAll("-"," "))}</span></td><td>${escapeHtml(warehouse(m.warehouseId)?.name||"Unknown")}</td><td class="num in">${m.quantityIn||"—"}</td><td class="num out">${m.quantityOut||"—"}</td><td class="num"><strong>${m.balanceAfter}</strong></td><td>${escapeHtml(m.reference||m.reason||"—")}</td></tr>`).join("")}</tbody></table></div>`;
}

function movementsView() {
  const q=state.query.toLowerCase(); const rows=state.movements.filter(m=>!q||[m.type,m.reference,m.reason,m.transactionId,product(m.productId)?.name,warehouse(m.warehouseId)?.name,m.batch,m.serial].some(v=>String(v||"").toLowerCase().includes(q)));
  return `${pageHead("Stock Movement Ledger", "An immutable history of every quantity change and linked transfer.", `<button class="btn secondary" data-export="movements">Export ledger</button><button class="btn primary" data-action="stock-in">Stock In</button>`)}<div class="quick-actions ledger-actions">${[["stock-out","Stock Out"],["purchase","Purchase Receipt"],["transfer","Transfer"],["adjustment","Adjustment"],["return","Return"],["damage","Damage / Wastage"],["stock-count","Stock Count"]].map(([a,l])=>`<button class="action-chip" data-action="${a}">${l}</button>`).join("")}</div><section class="panel">${rows.length?movementTable(rows):empty("No movements recorded", "Movement history will appear here and will not be silently deleted.")}</section>`;
}

const REPORTS = ["current-stock","stock-summary","stock-movement","low-stock","out-of-stock","stock-valuation","warehouse-stock","product-wise-stock","category-wise-stock","damaged-wastage","returns","batch-report","expiry-report","serial-number-report","transfer-report"];
function reportRows(type) {
  const inv=currentInventory(state.products.filter(p=>p.active!==false),state.movements);
  if(type==="low-stock") return inv.filter(p=>p.quantity>0&&p.quantity<=Number(p.reorderLevel||0));
  if(type==="out-of-stock") return inv.filter(p=>p.quantity<=0);
  if(type==="damaged-wastage") return state.movements.filter(m=>m.type==="damage");
  if(type==="returns") return state.movements.filter(m=>m.type.includes("return"));
  if(type==="transfer-report") return state.movements.filter(m=>m.type.includes("transfer"));
  if(type==="stock-movement") return state.movements;
  if(type==="batch-report") return state.movements.filter(m=>m.batch);
  if(type==="expiry-report") return state.movements.filter(m=>m.expiry);
  if(type==="serial-number-report") return state.movements.filter(m=>m.serial);
  return inv;
}
function reportsView() {
  const rows=reportRows(state.report); const movementReport=["stock-movement","damaged-wastage","returns","batch-report","expiry-report","serial-number-report","transfer-report"].includes(state.report);
  return `${pageHead("Inventory Reports", "Reports are calculated from your current local product and movement data.", `<button class="btn secondary" data-export="report">Export report</button>`)}<div class="report-tabs">${REPORTS.map(r=>`<button class="${state.report===r?'active':''}" data-report="${r}">${r.replaceAll("-"," ")}</button>`).join("")}</div><section class="panel">${rows.length?(movementReport?movementTable(rows):productTable(rows)):empty("No report data", "There are no matching records for this report yet.")}</section>`;
}

function importView() {
  return `${pageHead("Import, Export & Templates", "Move bulk inventory safely with validation and an explicit preview step.")}<div class="two-col"><section class="panel padded"><span class="eyebrow">CSV template</span><h2>Business-specific product template</h2><p>Download columns adapted to ${escapeHtml(state.settings.businessType)} and fill them in Excel or any spreadsheet tool.</p><button class="btn secondary" data-download-template>Download Inventory Template</button></section><section class="panel padded"><span class="eyebrow">Bulk import</span><h2>Preview and validate products</h2><p>Duplicate SKUs and missing required fields are blocked before confirmation.</p><label class="file-button btn primary">Choose CSV file<input id="csv-import" type="file" accept=".csv,text/csv" hidden/></label></section></div><section class="panel padded export-panel"><h2>Export inventory data</h2><div class="quick-actions">${[["products","Product Master"],["current-stock","Current Stock"],["movements","Stock Movement"],["warehouse-stock","Warehouse Stock"],["low-stock","Low Stock"],["valuation","Stock Valuation"],["batch-expiry","Batch / Expiry"],["damage","Damage / Wastage"]].map(([key,label])=>`<button class="action-chip" data-export="${key}">${label}</button>`).join("")}</div></section>`;
}

function settingsView() {
  return `${pageHead("Settings & Privacy", "Control inventory behaviour, backups and local data.")}<div class="two-col"><section class="panel padded"><h2>Inventory settings</h2><label class="toggle"><input type="checkbox" id="negative-stock" ${state.settings.negativeStock?'checked':''}/><span>Allow negative stock</span></label><p class="hint">When disabled, outbound movements are blocked if stock is insufficient.</p><label class="toggle"><input type="checkbox" id="advanced-features" ${state.settings.advancedFeatures?'checked':''}/><span>Show advanced batch, serial, bins and valuation fields</span></label><button class="btn primary" data-save-settings>Save settings</button></section><section class="panel padded"><h2>Local-first privacy</h2><p>Inventory data is stored in this browser for this version. InfoBridgeIndia does not require these inventory records to be stored on its central server.</p><p>You should download regular backups. Optional user-controlled Google Drive backup may be added later. This version does not claim database encryption.</p></section></div><section class="panel padded"><h2>Backup & restore</h2><div class="quick-actions"><button class="btn secondary" data-backup>Full Inventory Backup</button><label class="file-button btn secondary">Restore Backup<input id="restore-file" type="file" accept="application/json,.json" hidden/></label><button class="btn danger-button" data-reset>Reset all local data</button></div></section>`;
}

function render() {
  if(!state.settings){app.className="";app.innerHTML=setupScreen();bind();return}
  const views={dashboard:dashboardView,products:productsView,warehouses:warehouseView,movements:movementsView,reports:reportsView,import:importView,settings:settingsView};
  app.className=""; app.innerHTML=shell((views[state.view]||dashboardView)()); bind();
}

function openModal(title, body, submitLabel, onSubmit, wide=false) {
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true"><header><h2>${title}</h2><button class="icon-button" data-close-modal aria-label="Close">${icon("close")}</button></header><form id="modal-form"><div class="modal-body">${body}</div><footer><button class="btn secondary" type="button" data-close-modal>Cancel</button><button class="btn primary" type="submit">${submitLabel}</button></footer></form></section></div>`;
  modalRoot.querySelectorAll("[data-close-modal]").forEach(b=>b.addEventListener("click",()=>modalRoot.innerHTML=""));
  modalRoot.querySelector("#modal-form").addEventListener("submit",async(e)=>{e.preventDefault();try{await onSubmit(new FormData(e.currentTarget));modalRoot.innerHTML="";await reload();render()}catch(error){toast(error.message,"error")}});
}
function selectProducts() { return state.products.filter(p=>p.active!==false).map(p=>`<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.sku)})</option>`).join(""); }
function selectWarehouses() { return state.warehouses.filter(w=>w.active!==false).map(w=>`<option value="${w.id}">${escapeHtml(w.name)}</option>`).join(""); }
function field(name,label,type="text",value="",required=false,extra="") { return `<label>${label}<input class="input" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required?'required':''} ${extra}/></label>`; }

function productForm(existing={}) {
  const extra=[...(TEMPLATE_FIELDS[state.settings.businessType]||[]),...(state.settings.customFields||[])].filter(f=>!DEFAULT_FIELDS.includes(f));
  return `<div class="form-grid">${field("name","Product Name","text",existing.name,true)}${field("sku","SKU","text",existing.sku,true)}${field("category","Category","text",existing.category)}${field("brand","Brand","text",existing.brand)}${field("unit","Unit","text",existing.unit||"unit")}${field("barcode","Barcode","text",existing.barcode)}${field("purchasePrice","Purchase Price","number",existing.purchasePrice||0,true,'step="0.01" min="0"')}${field("sellingPrice","Selling Price","number",existing.sellingPrice||0,false,'step="0.01" min="0"')}${!existing.id?field("openingStock","Opening Stock","number",0,false,'step="0.001" min="0"'):""}${field("reorderLevel","Reorder Level","number",existing.reorderLevel||0,false,'step="0.001" min="0"')}${field("supplier","Supplier","text",existing.supplier)}<label>Warehouse<select class="input" name="warehouseId" required>${selectWarehouses()}</select></label>${field("location","Location / Bin","text",existing.location)}${extra.map(key=>field(`extra_${key}`,FIELD_LABELS[key]||key, key.toLowerCase().includes("date")||key==="expiry"?"date":"text",existing[key])).join("")}</div><label>Description<textarea class="input" name="description">${escapeHtml(existing.description||"")}</textarea></label><label>Notes<textarea class="input" name="notes">${escapeHtml(existing.notes||"")}</textarea></label>${existing.id?'<label class="toggle"><input type="checkbox" name="active" checked/><span>Active product</span></label>':""}`;
}
async function saveProduct(fd, existing=null) {
  const sku=fd.get("sku").trim(); if(state.products.some(p=>p.sku.toLowerCase()===sku.toLowerCase()&&p.id!==existing?.id)) throw new Error("SKU already exists.");
  const now=new Date().toISOString(); const data={...(existing||{}),id:existing?.id||uid("PRD"),name:fd.get("name").trim(),sku,category:fd.get("category"),brand:fd.get("brand"),unit:fd.get("unit")||"unit",barcode:fd.get("barcode"),purchasePrice:Number(fd.get("purchasePrice")),sellingPrice:Number(fd.get("sellingPrice")),reorderLevel:Number(fd.get("reorderLevel")),supplier:fd.get("supplier"),location:fd.get("location"),description:fd.get("description"),notes:fd.get("notes"),active:existing?fd.has("active"):true,createdAt:existing?.createdAt||now,updatedAt:now};
  for(const [key,value] of fd.entries()) if(key.startsWith("extra_")) data[key.slice(6)]=value;
  await put("products",data); const opening=Number(fd.get("openingStock")||0); if(!existing&&opening>0){const movement=createMovement({type:"opening",productId:data.id,warehouseId:fd.get("warehouseId"),quantity:opening,unitCost:data.purchasePrice,reference:"Opening balance"},state.movements,state.settings);await put("movements",movement)} toast(existing?"Product updated.":"Product added.");
}

function movementForm(type) {
  const outbound=["stock-out","supplier-return","damage"].includes(type); const title=type.replaceAll("-"," ");
  const advanced=state.settings.advancedFeatures; const batch=advanced&&["Grocery / FMCG","Pharmacy","Restaurant / Hotel"].includes(state.settings.businessType); const serial=advanced&&state.settings.businessType==="Electronics";
  return `<div class="form-grid"><label>Product<select class="input" name="productId" required>${selectProducts()}</select></label><label>Warehouse<select class="input" name="warehouseId" required>${selectWarehouses()}</select></label>${field("date","Date","date",new Date().toISOString().slice(0,10),true)}${field("quantity","Quantity","number","",true,'step="0.001" min="0.001"')}${!outbound?field("unitCost","Cost","number","0",false,'step="0.01" min="0"'):""}${field("reference","Reference","text")}${batch?field("batch","Batch Number","text")+field("expiry","Expiry Date","date"):""}${serial?field("serial","Serial / IMEI","text"):""}${type==="damage"?`<label>Reason<select class="input" name="reason"><option>Damaged</option><option>Expired</option><option>Wastage</option><option>Lost</option><option>Other</option></select></label>`:field("reason","Reason / Destination","text")}</div><label>Notes<textarea class="input" name="notes"></textarea></label>`;
}
async function saveMovement(type,fd){const movement=createMovement({type,productId:fd.get("productId"),warehouseId:fd.get("warehouseId"),quantity:Number(fd.get("quantity")),unitCost:Number(fd.get("unitCost")||0),reference:fd.get("reference"),batch:fd.get("batch"),expiry:fd.get("expiry"),serial:fd.get("serial"),reason:fd.get("reason"),notes:fd.get("notes"),createdAt:new Date(`${fd.get("date")}T12:00:00`).toISOString()},state.movements,state.settings);await put("movements",movement);toast("Stock movement recorded.")}

function action(name) {
  if(name==="add-product") return openModal("Add Product",productForm(),"Add Product",fd=>saveProduct(fd),true);
  if(name==="add-warehouse") return warehouseModal();
  if(["stock-in","stock-out","damage"].includes(name)) return openModal(name.replaceAll("-"," ").replace(/\b\w/g,c=>c.toUpperCase()),movementForm(name),"Save Movement",fd=>saveMovement(name,fd),true);
  if(name==="purchase") return openModal("Purchase Receipt",movementForm("purchase-receipt"),"Receive Stock",fd=>saveMovement("purchase-receipt",fd),true);
  if(name==="transfer") return transferModal();
  if(name==="adjustment") return adjustmentModal();
  if(name==="return") return returnModal();
  if(name==="stock-count") return countModal();
}
function warehouseModal(existing={}) { openModal(existing.id?"Edit Warehouse":"Add Warehouse",`<div class="form-grid">${field("name","Warehouse Name","text",existing.name,true)}${field("code","Code","text",existing.code,true)}${field("contact","Contact","text",existing.contact)}${field("address","Address","text",existing.address)}</div><label class="toggle"><input type="checkbox" name="active" ${existing.active!==false?'checked':''}/><span>Active warehouse</span></label>`,existing.id?"Save Warehouse":"Add Warehouse",async fd=>{const duplicate=state.warehouses.some(w=>w.code.toLowerCase()===fd.get("code").toLowerCase()&&w.id!==existing.id);if(duplicate)throw new Error("Warehouse code already exists.");await put("warehouses",{...existing,id:existing.id||uid("WH"),name:fd.get("name"),code:fd.get("code"),contact:fd.get("contact"),address:fd.get("address"),active:fd.has("active"),createdAt:existing.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});toast("Warehouse saved.")}); }
function transferModal(){openModal("Warehouse Transfer",`<div class="form-grid"><label>Product<select class="input" name="productId">${selectProducts()}</select></label>${field("quantity","Quantity","number","",true,'step="0.001" min="0.001"')}<label>From Warehouse<select class="input" name="fromWarehouseId">${selectWarehouses()}</select></label><label>To Warehouse<select class="input" name="toWarehouseId">${selectWarehouses()}</select></label>${field("reference","Reference","text")}</div><label>Notes<textarea class="input" name="notes"></textarea></label>`,"Transfer Stock",async fd=>{const pair=createTransfer({productId:fd.get("productId"),quantity:Number(fd.get("quantity")),fromWarehouseId:fd.get("fromWarehouseId"),toWarehouseId:fd.get("toWarehouseId"),reference:fd.get("reference"),notes:fd.get("notes")},state.movements,state.settings);await Promise.all(pair.map(m=>put("movements",m)));toast("Linked warehouse transfer recorded.")},true)}
function adjustmentModal(){openModal("Stock Adjustment",`<div class="form-grid"><label>Product<select class="input" name="productId" id="adjust-product">${selectProducts()}</select></label><label>Warehouse<select class="input" name="warehouseId" id="adjust-warehouse">${selectWarehouses()}</select></label>${field("quantity","Adjustment Quantity (+ or -)","number","",true,'step="0.001"')}${field("reason","Reason","text","",true)}${field("date","Date","date",new Date().toISOString().slice(0,10),true)}</div><p class="form-note">The previous and new quantities are saved in the audit notes.</p>`,"Post Adjustment",async fd=>{const qty=Number(fd.get("quantity"));if(!qty)throw new Error("Adjustment cannot be zero.");const previous=productStock(fd.get("productId"),state.movements,fd.get("warehouseId"));await saveMovement(qty>0?"adjustment-in":"adjustment-out",new MapFormData(fd,{quantity:Math.abs(qty),notes:`Previous: ${previous}; Adjustment: ${qty}; New: ${previous+qty}`}))},true)}
class MapFormData { constructor(fd,extra){this.fd=fd;this.extra=extra} get(k){return k in this.extra?this.extra[k]:this.fd.get(k)} }
function returnModal(){openModal("Inventory Return",`<label>Return Type<select class="input" name="returnType"><option value="customer-return">Customer Return (stock in)</option><option value="supplier-return">Supplier Return (stock out)</option></select></label>${movementForm("customer-return")}`,"Record Return",fd=>saveMovement(fd.get("returnType"),fd),true)}
function countModal(){openModal("Physical Stock Count",`<div class="form-grid"><label>Product<select class="input" name="productId">${selectProducts()}</select></label><label>Warehouse<select class="input" name="warehouseId">${selectWarehouses()}</select></label>${field("counted","Counted Quantity","number","",true,'step="0.001" min="0"')}${field("reason","Reason","text","Physical stock count",true)}</div><p class="form-note">Nothing posts until you confirm. The system quantity, counted quantity and difference will be retained.</p>`,"Confirm Count & Adjustment",async fd=>{const system=productStock(fd.get("productId"),state.movements,fd.get("warehouseId"));const counted=Number(fd.get("counted"));const difference=counted-system;const record={id:uid("CNT"),productId:fd.get("productId"),warehouseId:fd.get("warehouseId"),systemQuantity:system,countedQuantity:counted,difference,status:"confirmed",createdAt:new Date().toISOString()};await put("counts",record);if(difference!==0){const movement=createMovement({type:difference>0?"count-in":"count-out",productId:record.productId,warehouseId:record.warehouseId,quantity:Math.abs(difference),reference:record.id,reason:fd.get("reason"),notes:`System: ${system}; Counted: ${counted}; Difference: ${difference}`},state.movements,state.settings);await put("movements",movement)}toast("Stock count confirmed.")},true)}

async function createSetup(type,customFields=[],demo=false){await put("settings",{id:"app",businessType:type,customFields,negativeStock:false,advancedFeatures:["Electronics","Pharmacy","Grocery / FMCG","Multi-warehouse"].includes(type),createdAt:new Date().toISOString()});const main={id:uid("WH"),name:"Main Warehouse",code:"MAIN",address:"",contact:"",active:true,createdAt:new Date().toISOString()};await put("warehouses",main);if(demo)await seedDemo(main.id);await reload();render()}
async function seedDemo(warehouseId){const second={id:uid("WH"),name:"Secondary Warehouse",code:"SEC",address:"Industrial Area",contact:"",active:true,createdAt:new Date().toISOString()};await put("warehouses",second);const samples=[{name:"Cotton T-Shirt",sku:"TSH-001",category:"Apparel",brand:"Demo",unit:"pcs",purchasePrice:240,sellingPrice:499,reorderLevel:8},{name:"Packaging Box",sku:"BOX-010",category:"Packaging",brand:"",unit:"pcs",purchasePrice:18,sellingPrice:30,reorderLevel:20},{name:"USB-C Cable",sku:"USB-020",category:"Electronics",brand:"DemoTech",unit:"pcs",purchasePrice:120,sellingPrice:249,reorderLevel:5}];for(const sample of samples){const p={...sample,id:uid("PRD"),active:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await put("products",p);const m=createMovement({type:"opening",productId:p.id,warehouseId,quantity:p.sku==="BOX-010"?12:25,unitCost:p.purchasePrice,reference:"Demo opening stock"},[],{});await put("movements",m)}}

function templateColumns(){const extras=[...(TEMPLATE_FIELDS[state.settings.businessType]||[]),...(state.settings.customFields||[])];return [...new Set([...DEFAULT_FIELDS.filter(f=>f!=="warehouseId"),...extras])].map(f=>FIELD_LABELS[f]||f)}
async function previewCsv(file){const rows=parseCsv(await file.text());const existing=new Set(state.products.map(p=>p.sku.toLowerCase()));const seen=new Set();const validated=rows.map((row,index)=>{const sku=(row.SKU||row.sku||"").trim();const name=(row["Product Name"]||row.Product||row.name||"").trim();const errors=[];if(!sku)errors.push("SKU required");if(!name)errors.push("Product name required");if(sku&&(existing.has(sku.toLowerCase())||seen.has(sku.toLowerCase())))errors.push("Duplicate SKU");seen.add(sku.toLowerCase());return {row,index:index+2,sku,name,errors}});const body=`<div class="import-summary"><strong>${rows.length}</strong> rows · <strong>${validated.filter(v=>v.errors.length).length}</strong> with errors</div><div class="table-wrap"><table><thead><tr><th>Row</th><th>SKU</th><th>Product</th><th>Validation</th></tr></thead><tbody>${validated.map(v=>`<tr><td>${v.index}</td><td>${escapeHtml(v.sku)}</td><td>${escapeHtml(v.name)}</td><td>${v.errors.length?`<span class="error-text">${v.errors.join(", ")}</span>`:'<span class="success-text">Ready</span>'}</td></tr>`).join("")}</tbody></table></div>`;openModal("Preview Product Import",body,"Confirm Import",async()=>{if(validated.some(v=>v.errors.length))throw new Error("Fix validation errors before importing.");const wh=state.warehouses.find(w=>w.active!==false);for(const v of validated){const r=v.row;const now=new Date().toISOString();const p={id:uid("PRD"),sku:v.sku,name:v.name,category:r.Category||"",brand:r.Brand||"",unit:r.Unit||"unit",purchasePrice:Number(r["Purchase Price"]||0),sellingPrice:Number(r["Selling Price"]||0),reorderLevel:Number(r["Reorder Level"]||0),supplier:r.Supplier||"",barcode:r.Barcode||"",active:true,createdAt:now,updatedAt:now};for(const [label,value] of Object.entries(r)){const key=Object.keys(FIELD_LABELS).find(k=>FIELD_LABELS[k]===label);if(key)p[key]=value}await put("products",p);const opening=Number(r["Opening Stock"]||0);if(opening>0){const m=createMovement({type:"opening",productId:p.id,warehouseId:wh.id,quantity:opening,unitCost:p.purchasePrice,reference:"CSV opening balance"},state.movements,state.settings);state.movements.push(m);await put("movements",m)}}toast(`${validated.length} products imported.`)},true)}

function exportData(kind){let rows,columns,name;if(kind==="products"){rows=state.products;columns=["sku","name","category","brand","unit","purchasePrice","sellingPrice","reorderLevel","supplier","barcode"];name="product-master.csv"}else if(kind==="movements"){rows=state.movements.map(m=>({...m,product:product(m.productId)?.name,warehouse:warehouse(m.warehouseId)?.name}));columns=["createdAt","transactionId","product","type","quantityIn","quantityOut","warehouse","reference","balanceAfter","notes"];name="stock-movements.csv"}else{const reportKind=kind==="report"?state.report:kind;rows=reportRows(reportKind);if(rows[0]?.type){rows=rows.map(m=>({...m,product:product(m.productId)?.name,warehouse:warehouse(m.warehouseId)?.name}));columns=["createdAt","transactionId","product","type","quantityIn","quantityOut","warehouse","reference","balanceAfter"]}else{columns=["sku","name","category","quantity","averageCost","stockValue"]}name=`${reportKind}.csv`}download(name,toCsv(rows,columns))}
async function backup(){const data={version:1,exportedAt:new Date().toISOString()};for(const store of STORES)data[store]=await all(store);download(`infobridgeindia-inventory-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),"application/json")}
async function restore(file){const data=JSON.parse(await file.text());if(data.version!==1||!STORES.every(s=>Array.isArray(data[s])))throw new Error("This is not a valid Inventory backup.");for(const store of STORES){await clear(store);for(const item of data[store])await put(store,item)}await reload();render();toast("Backup restored successfully.")}
async function resetAll(){if(!confirm("Delete all local inventory data from this browser? Export a backup first if needed."))return;for(const store of STORES)await clear(store);await reload();render();toast("Local inventory data reset.")}

function bind(){
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{state.view=b.dataset.view;document.querySelector("#sidebar")?.classList.remove("open");render()}));
  document.querySelector("[data-menu]")?.addEventListener("click",()=>document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#global-search")?.addEventListener("input",e=>{state.query=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(state.view!=="products"&&state.view!=="movements")state.view="products";render();const search=document.querySelector("#global-search");search?.focus();search?.setSelectionRange(search.value.length,search.value.length)},220)});
  document.querySelectorAll("[data-action]").forEach(b=>b.addEventListener("click",()=>action(b.dataset.action)));
  document.querySelectorAll("[data-product-filter]").forEach(b=>b.addEventListener("click",()=>{state.productFilter=b.dataset.productFilter;render()}));
  document.querySelector("#product-sort")?.addEventListener("change",e=>{state.productSort=e.target.value;render()});
  document.querySelectorAll("[data-report]").forEach(b=>b.addEventListener("click",()=>{state.report=b.dataset.report;render()}));
  document.querySelectorAll("[data-export]").forEach(b=>b.addEventListener("click",()=>exportData(b.dataset.export)));
  document.querySelectorAll("[data-edit-product]").forEach(b=>b.addEventListener("click",()=>{const p=product(b.dataset.editProduct);openModal("Edit Product",productForm(p),"Save Product",fd=>saveProduct(fd,p),true)}));
  document.querySelectorAll("[data-view-product]").forEach(b=>b.addEventListener("click",()=>{const p=currentInventory([product(b.dataset.viewProduct)],state.movements)[0];const byWarehouse=state.warehouses.map(w=>`<div><span>${escapeHtml(w.name)}</span><strong>${productStock(p.id,state.movements,w.id)} ${escapeHtml(p.unit||"unit")}</strong></div>`).join("");openModal("Product Details",`<div class="product-view"><h3>${escapeHtml(p.name)}</h3><p class="mono">${escapeHtml(p.sku)}</p><dl><div><dt>Category</dt><dd>${escapeHtml(p.category||"—")}</dd></div><div><dt>Supplier</dt><dd>${escapeHtml(p.supplier||"—")}</dd></div><div><dt>Total stock</dt><dd>${p.quantity} ${escapeHtml(p.unit||"unit")}</dd></div><div><dt>Stock value</dt><dd>${money(p.stockValue)}</dd></div></dl><h4>Stock by warehouse</h4><div class="stock-by-warehouse">${byWarehouse}</div></div>`,"Close",async()=>{},true)}));
  document.querySelectorAll("[data-edit-warehouse]").forEach(b=>b.addEventListener("click",()=>warehouseModal(warehouse(b.dataset.editWarehouse))));
  document.querySelector("#setup-form")?.addEventListener("change",e=>{if(e.target.name==="businessType")document.querySelector("#custom-fields-wrap").hidden=e.target.value!=="Other / Custom"});
  document.querySelector("#setup-form")?.addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);createSetup(fd.get("businessType"),(fd.get("customFields")||"").split(",").map(s=>s.trim()).filter(Boolean))});
  document.querySelectorAll("[data-demo]").forEach(b=>b.addEventListener("click",async()=>{for(const store of STORES)await clear(store);await createSetup("Retail",[],true);toast("Demo inventory loaded.")}));
  document.querySelector("[data-download-template]")?.addEventListener("click",()=>download(`${state.settings.businessType.toLowerCase().replace(/[^a-z0-9]+/g,"-")}-inventory-template.csv`,templateColumns().join(",")+"\n"));
  document.querySelector("#csv-import")?.addEventListener("change",e=>e.target.files[0]&&previewCsv(e.target.files[0]).catch(err=>toast(err.message,"error")));
  document.querySelector("[data-backup]")?.addEventListener("click",backup);
  document.querySelector("#restore-file")?.addEventListener("change",e=>e.target.files[0]&&restore(e.target.files[0]).catch(err=>toast(err.message,"error")));
  document.querySelector("[data-reset]")?.addEventListener("click",resetAll);
  document.querySelector("[data-save-settings]")?.addEventListener("click",async()=>{state.settings.negativeStock=document.querySelector("#negative-stock").checked;state.settings.advancedFeatures=document.querySelector("#advanced-features").checked;await put("settings",state.settings);toast("Settings saved.")});
}

try { db=await openDb(); await reload(); render(); } catch(error) { app.innerHTML=`<main class="fatal"><h1>Inventory could not open</h1><p>${escapeHtml(error.message)}</p><p>Please use a modern browser with IndexedDB enabled.</p></main>`; }
