import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const port = 4187;
const debugPort = 9237;
const profile = await mkdtemp(join(tmpdir(), "ibi-inventory-test-"));
const downloads = join(profile, "downloads");
await mkdir(downloads);
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const server = spawn(process.execPath, ["serve.js", String(port)], { cwd: root, stdio: "ignore" });
const browser = spawn(edge, ["--headless=new", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-extensions", "about:blank"], { stdio: "ignore" });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function retry(fn, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { try { return await fn(); } catch { await delay(100); } }
  throw new Error("Timed out waiting for browser state.");
}

let socket;
let nextId = 0;
const pending = new Map();
function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, timeout = 10000) {
  return retry(async () => { const value = await evaluate(expression); if (!value) throw new Error("not ready"); return value; }, timeout);
}
async function submitModal(values) {
  await evaluate(`(() => { const form=document.querySelector('#modal-form'); const values=${JSON.stringify(values)}; for(const [name,value] of Object.entries(values)){const field=form.elements[name];if(!field)continue;field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));} form.requestSubmit(); return true; })()`);
  await waitFor(`!document.querySelector('#modal-form')`);
}
async function inventoryData() {
  return evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('InfoBridgeIndiaInventory');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const stores=['settings','products','warehouses','movements','counts'];const t=db.transaction(stores);const result={};let left=stores.length;for(const s of stores){const q=t.objectStore(s).getAll();q.onsuccess=()=>{result[s]=q.result;if(!--left)resolve(result)}}}})`);
}
function warehouseBalance(data, productId, warehouseId) {
  return data.movements.filter((m) => m.productId === productId && m.warehouseId === warehouseId).reduce((sum, m) => sum + Number(m.quantityIn || 0) - Number(m.quantityOut || 0), 0);
}

try {
  await retry(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?http://127.0.0.1:${port}/inventory/index.html`, { method: "PUT" }); if (!response.ok) throw new Error(); return response.json(); });
  const pages = await retry(async () => { const response = await fetch(`http://127.0.0.1:${debugPort}/json`); const list = await response.json(); const page = list.find((item) => item.url.includes("/inventory/index.html")); if (!page) throw new Error(); return page; });
  socket = new WebSocket(pages.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => { const message = JSON.parse(data); if (!message.id) return; const item = pending.get(message.id); if (!item) return; pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); };
  await call("Runtime.enable");
  await waitFor(`document.querySelector('#setup-form select[name="businessType"]')`);
  const setupUx = await evaluate(`({cards:document.querySelectorAll('.business-option').length,demo:document.body.innerText.includes('Load demo inventory'),placeholder:document.querySelector('select[name="businessType"] option').textContent})`);
  if(setupUx.cards||setupUx.demo||setupUx.placeholder!=="Select your business type")throw new Error("First-time setup UX requirements failed.");
  await evaluate(`(() => { const select=document.querySelector('select[name="businessType"]'); select.value='E-commerce'; select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#setup-form').requestSubmit(); return true; })()`);
  await waitFor(`document.body.innerText.includes('Inventory dashboard')`);

  await evaluate(`document.querySelector('[data-action="add-product"]').click()`);
  await waitFor(`document.querySelector('#modal-form')`);
  await submitModal({ name: "Product A", sku: "PROD-A", category: "Testing", unit: "pcs", purchasePrice: "100", sellingPrice: "150", openingStock: "100", reorderLevel: "10", supplier: "Test Supplier" });

  let data=await inventoryData();const productId=data.products[0].id;const sourceId=data.warehouses.find((w)=>w.code==="MAIN").id;
  if(warehouseBalance(data,productId,sourceId)!==100)throw new Error("Opening stock did not create the expected movement balance.");

  await evaluate(`document.querySelector('[data-view="products"]').click()`);
  await waitFor(`document.querySelector('[data-edit-product]')`);
  await evaluate(`document.querySelector('[data-edit-product]').click()`);
  const editSafety=await evaluate(`({opening:!!document.querySelector('#modal-form').elements.openingStock,warehouse:!!document.querySelector('#modal-form').elements.warehouseId,note:document.body.innerText.includes('Stock quantities are not editable here')})`);
  if(editSafety.opening||editSafety.warehouse||!editSafety.note)throw new Error("Edit Product exposes stock history controls.");
  await submitModal({name:"Product A Updated"});

  await evaluate(`document.querySelector('[data-view="dashboard"]').click()`);
  await waitFor(`document.querySelector('[data-action="stock-out"]')`);
  await evaluate(`document.querySelector('[data-action="stock-out"]').click()`);
  await submitModal({ quantity: "93", reference: "LOW-STOCK-TEST" });
  data=await inventoryData();if(warehouseBalance(data,productId,sourceId)!==7)throw new Error("Stock Out 93 calculation failed.");
  await evaluate(`document.querySelector('[data-view="products"]').click()`);await waitFor(`document.querySelector('.badge.warn')`);
  if(!await evaluate(`document.querySelector('.badge.warn')?.textContent==='Low'`))throw new Error("Low Stock status failed at quantity 7 / reorder 10.");

  await evaluate(`document.querySelector('[data-view="dashboard"]').click()`);await waitFor(`document.querySelector('[data-action="stock-out"]')`);await evaluate(`document.querySelector('[data-action="stock-out"]').click()`);await submitModal({quantity:"7",reference:"OUT-OF-STOCK-TEST"});
  data=await inventoryData();if(warehouseBalance(data,productId,sourceId)!==0)throw new Error("Stock Out remaining quantity failed.");
  await evaluate(`document.querySelector('[data-view="products"]').click()`);await waitFor(`document.querySelector('.badge.danger')`);if(!await evaluate(`document.querySelector('.badge.danger')?.textContent==='Out'`))throw new Error("Out of Stock status failed at zero quantity.");

  await evaluate(`document.querySelector('[data-action="stock-in"]').click()`);await waitFor(`document.querySelector('#modal-form')`);await submitModal({quantity:"20",reference:"RESTOCK-TEST"});
  await evaluate(`document.querySelector('[data-view="dashboard"]').click()`);await waitFor(`document.querySelector('[data-action="adjustment"]')`);await evaluate(`document.querySelector('[data-action="adjustment"]').click()`);await waitFor(`document.querySelector('#modal-form').elements.newQuantity`);await submitModal({newQuantity:"15",reason:"Physical verification"});
  data=await inventoryData();if(warehouseBalance(data,productId,sourceId)!==15)throw new Error("Adjust Stock physical quantity workflow failed.");
  const adjustment=data.movements.find((m)=>m.type==="adjustment-out");if(!adjustment||!adjustment.notes.includes("Previous: 20")||!adjustment.notes.includes("New: 15"))throw new Error("Adjustment audit details missing.");

  await evaluate(`document.querySelector('[data-view="warehouses"]').click()`);
  await waitFor(`document.querySelector('[data-action="add-warehouse"]')`);
  await evaluate(`document.querySelector('[data-action="add-warehouse"]').click()`);
  await submitModal({ name: "Transfer Warehouse", code: "TRF", address: "Test Location" });

  await evaluate(`document.querySelector('[data-view="movements"]').click()`);
  await waitFor(`document.querySelector('[data-action="transfer"]')`);
  await evaluate(`document.querySelector('[data-action="transfer"]').click()`);
  await waitFor(`document.querySelector('#modal-form')`);
  await evaluate(`(() => { const form=document.querySelector('#modal-form'); form.elements.toWarehouseId.selectedIndex=1; return true; })()`);
  await submitModal({ quantity: "4", reference: "TRF-TEST" });

  data=await inventoryData();const destinationId=data.warehouses.find((w)=>w.code==="TRF").id;if(warehouseBalance(data,productId,sourceId)!==11||warehouseBalance(data,productId,destinationId)!==4)throw new Error("Warehouse transfer balances failed.");

  const csvCheck = await evaluate(`import('/inventory/core.js').then(({toCsv,parseCsv})=>{const csv=toCsv([{sku:'CSV-1',name:'CSV Product'}],['sku','name']);return parseCsv(csv)[0]})`);
  if (csvCheck.sku !== "CSV-1" || csvCheck.name !== "CSV Product") throw new Error("CSV export/import roundtrip failed.");

  await evaluate(`document.querySelector('[data-view="import"]').click()`);
  await waitFor(`document.querySelector('#csv-import')`);
  if(!await evaluate(`document.body.innerText.includes('Backup & Continue')&&document.body.innerText.includes('Download Full Backup (.json)')&&document.querySelector('[data-restore-file]')`))throw new Error("Backup & Continue controls missing from Import / Export.");
  await call("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads, eventsEnabled: true });
  await evaluate(`document.querySelector('[data-backup]').click()`);
  const backupName=await retry(async()=>{const files=await readdir(downloads);const file=files.find(name=>name.endsWith('.json'));if(!file)throw new Error();return file});
  const backupText=await readFile(join(downloads,backupName),"utf8");

  await evaluate(`document.querySelector('[data-action="stock-in"]').click()`);await waitFor(`document.querySelector('#modal-form')`);await submitModal({quantity:"9",reference:"POST-BACKUP-CHANGE"});
  data=await inventoryData();if(warehouseBalance(data,productId,sourceId)!==20)throw new Error("Post-backup mutation failed.");
  await evaluate(`window.confirm=()=>true;document.querySelector('[data-view="import"]').click()`);await waitFor(`document.querySelector('[data-restore-file]')`);
  await evaluate(`(() => { const input=document.querySelector('[data-restore-file]');const transfer=new DataTransfer();transfer.items.add(new File([${JSON.stringify(backupText)}],'inventory-backup.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  await waitFor(`document.body.innerText.includes('Full backup restored')`);
  data=await inventoryData();if(warehouseBalance(data,productId,sourceId)!==11||warehouseBalance(data,productId,destinationId)!==4)throw new Error("Full JSON restore did not return exact backed-up balances.");
  const movementCountBeforeInvalid=data.movements.length;
  await evaluate(`(() => { const input=document.querySelector('[data-restore-file]');const transfer=new DataTransfer();transfer.items.add(new File(['{"version":1,"settings":[],"warehouses":[],"products":[],"movements":[],"counts":[]}'],'invalid-backup.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  await waitFor(`document.body.innerText.includes('does not contain a valid inventory business setup')`);
  data=await inventoryData();if(data.movements.length!==movementCountBeforeInvalid||warehouseBalance(data,productId,sourceId)!==11)throw new Error("Invalid backup changed local data.");

  await evaluate(`(() => { const input=document.querySelector('#csv-import'); const csv='SKU,Product Name,Category,Unit,Purchase Price,Opening Stock\\nCSV-002,Imported UI Product,Testing,pcs,25,6'; const transfer=new DataTransfer(); transfer.items.add(new File([csv],'inventory-import.csv',{type:'text/csv'})); input.files=transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
  await waitFor(`document.querySelector('#modal-form') && document.body.innerText.includes('CSV-002')`);
  await evaluate(`document.querySelector('#modal-form').requestSubmit()`);
  await waitFor(`!document.querySelector('#modal-form')`);
  const imported = await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('InfoBridgeIndiaInventory');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();q.onsuccess=()=>resolve(q.result.map(p=>p.sku))}})`);
  if (!imported.includes("CSV-002")) throw new Error("CSV UI import failed.");

  await evaluate(`document.querySelector('[data-export="products"]').click()`);
  const downloaded = await retry(async () => { const files=await readdir(downloads); const file=files.find((name)=>name.endsWith('.csv')); if(!file)throw new Error(); return file; });
  if (!downloaded) throw new Error("CSV UI export failed.");

  await call("Page.reload", { ignoreCache: true });
  await waitFor(`document.querySelector('.app-shell')`);
  const persisted = await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('InfoBridgeIndiaInventory');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const q=r.result.transaction('products').objectStore('products').getAll();q.onsuccess=()=>resolve(q.result.map(p=>p.sku))}})`);
  if (!persisted.includes("PROD-A")) throw new Error("IndexedDB persistence after refresh failed.");

  console.log(JSON.stringify({ setupDropdown:"E-commerce",demoHidden:true,product:true,openingStock:100,editStockSafe:true,lowStockAt:7,outOfStockAt:0,adjustedStock:15,transfer:4,sourceBalance:11,destinationBalance:4,jsonBackup:backupName,jsonRestore:true,invalidBackupRejectedWithoutChanges:true,csvImport:true,csvExport:downloaded,refreshPersistence:true }));
} finally {
  try { socket?.close(); } catch {}
  browser.kill(); server.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true });
}
