export const IN_TYPES = new Set(["opening", "stock-in", "purchase-receipt", "customer-return", "transfer-in", "adjustment-in", "count-in"]);
export const OUT_TYPES = new Set(["stock-out", "supplier-return", "damage", "transfer-out", "adjustment-out", "count-out"]);

export function uid(prefix = "ID") {
  const random = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${random.toUpperCase()}`;
}

export function movementSign(type) {
  if (IN_TYPES.has(type)) return 1;
  if (OUT_TYPES.has(type)) return -1;
  throw new Error(`Unknown movement type: ${type}`);
}

export function stockMap(movements) {
  const balances = new Map();
  [...movements].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((movement) => {
    const key = `${movement.productId}::${movement.warehouseId}`;
    balances.set(key, (balances.get(key) || 0) + movementSign(movement.type) * Number(movement.quantity));
  });
  return balances;
}

export function productStock(productId, movements, warehouseId = null) {
  return movements.filter((m) => m.productId === productId && (!warehouseId || m.warehouseId === warehouseId))
    .reduce((sum, m) => sum + movementSign(m.type) * Number(m.quantity), 0);
}

export function validateMovement({ type, productId, warehouseId, quantity }, movements, settings = {}) {
  if (!type || !productId || !warehouseId) throw new Error("Movement type, product and warehouse are required.");
  if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) throw new Error("Quantity must be greater than zero.");
  if (movementSign(type) < 0 && !settings.negativeStock) {
    const available = productStock(productId, movements, warehouseId);
    if (Number(quantity) > available) throw new Error(`Only ${available} units are available in this warehouse.`);
  }
  return true;
}

export function createMovement(input, movements, settings = {}) {
  validateMovement(input, movements, settings);
  const createdAt = input.createdAt || new Date().toISOString();
  const previous = productStock(input.productId, movements, input.warehouseId);
  const quantity = Number(input.quantity);
  return {
    id: input.id || uid("MOV"), transactionId: input.transactionId || uid("TXN"),
    type: input.type, productId: input.productId, warehouseId: input.warehouseId,
    quantity, quantityIn: movementSign(input.type) > 0 ? quantity : 0,
    quantityOut: movementSign(input.type) < 0 ? quantity : 0,
    balanceAfter: previous + movementSign(input.type) * quantity,
    unitCost: Number(input.unitCost || 0), reference: input.reference || "",
    reason: input.reason || "", notes: input.notes || "", batch: input.batch || "",
    expiry: input.expiry || "", serial: input.serial || "", linkedId: input.linkedId || "",
    createdAt, updatedAt: createdAt,
  };
}

export function createTransfer(input, movements, settings = {}) {
  if (input.fromWarehouseId === input.toWarehouseId) throw new Error("Source and destination warehouses must be different.");
  const transactionId = uid("TRF");
  const out = createMovement({ ...input, type: "transfer-out", warehouseId: input.fromWarehouseId, transactionId }, movements, settings);
  const incomingHistory = [...movements, out];
  const inside = createMovement({ ...input, type: "transfer-in", warehouseId: input.toWarehouseId, transactionId }, incomingHistory, settings);
  out.linkedId = inside.id;
  inside.linkedId = out.id;
  return [out, inside];
}

export function currentInventory(products, movements) {
  return products.map((product) => {
    const quantity = productStock(product.id, movements);
    const averageCost = Number(product.purchasePrice || 0);
    return { ...product, quantity, averageCost, stockValue: quantity * averageCost };
  });
}

export function inventoryMetrics(products, warehouses, movements, today = new Date().toISOString().slice(0, 10)) {
  const inventory = currentInventory(products.filter((p) => p.active !== false), movements);
  const todayMoves = movements.filter((m) => m.createdAt.slice(0, 10) === today);
  return {
    totalProducts: inventory.length,
    stockValue: inventory.reduce((sum, p) => sum + p.stockValue, 0),
    lowStock: inventory.filter((p) => p.quantity > 0 && p.quantity <= Number(p.reorderLevel || 0)).length,
    outOfStock: inventory.filter((p) => p.quantity <= 0).length,
    stockInToday: todayMoves.reduce((sum, m) => sum + Number(m.quantityIn || 0), 0),
    stockOutToday: todayMoves.reduce((sum, m) => sum + Number(m.quantityOut || 0), 0),
    damaged: movements.filter((m) => m.type === "damage").reduce((sum, m) => sum + Number(m.quantity), 0),
    warehouses: warehouses.filter((w) => w.active !== false).length,
  };
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

export function parseCsv(text) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some((v) => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((v) => v.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}
