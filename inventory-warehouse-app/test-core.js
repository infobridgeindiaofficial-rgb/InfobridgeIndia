import assert from "node:assert/strict";
import { createMovement, createTransfer, currentInventory, inventoryMetrics, parseCsv, productStock, toCsv } from "./core.js";

const settings = { negativeStock: false };
const product = { id: "P1", sku: "SKU-1", name: "Test Product", purchasePrice: 10, reorderLevel: 5, active: true };
const warehouses = [{ id: "W1", active: true }, { id: "W2", active: true }];
const moves = [];
function add(input) { const movement = createMovement({ productId: "P1", warehouseId: "W1", ...input }, moves, settings); moves.push(movement); return movement; }

add({ type: "opening", quantity: 10 });
add({ type: "stock-in", quantity: 5 });
assert.equal(productStock("P1", moves, "W1"), 15, "stock in increases stock");
add({ type: "stock-out", quantity: 3 });
assert.equal(productStock("P1", moves, "W1"), 12, "stock out decreases stock");

const transfer = createTransfer({ productId: "P1", quantity: 4, fromWarehouseId: "W1", toWarehouseId: "W2" }, moves, settings);
moves.push(...transfer);
assert.equal(productStock("P1", moves, "W1"), 8, "transfer reduces source");
assert.equal(productStock("P1", moves, "W2"), 4, "transfer increases destination");
assert.equal(transfer[0].linkedId, transfer[1].id, "transfer movements are linked");

add({ type: "damage", quantity: 2 });
assert.equal(productStock("P1", moves, "W1"), 6, "damage reduces available stock");
add({ type: "customer-return", quantity: 2 });
assert.equal(productStock("P1", moves, "W1"), 8, "customer return increases stock");
add({ type: "supplier-return", quantity: 1 });
assert.equal(productStock("P1", moves, "W1"), 7, "supplier return decreases stock");
add({ type: "count-out", quantity: 2 });
assert.equal(productStock("P1", moves, "W1"), 5, "stock count adjustment posts difference");
assert.throws(() => add({ type: "stock-out", quantity: 100 }), /available/, "negative stock is blocked");

const inventory = currentInventory([product], moves);
assert.equal(inventory[0].quantity, 9, "total product stock spans warehouses");
assert.equal(inventory[0].stockValue, 90, "average-cost valuation is calculated");
const metrics = inventoryMetrics([product], warehouses, moves);
assert.equal(metrics.totalProducts, 1);
assert.equal(metrics.warehouses, 2);

const csv = toCsv([{ sku: "A,1", name: 'Quoted "item"' }], ["sku", "name"]);
const parsed = parseCsv(csv);
assert.equal(parsed[0].sku, "A,1");
assert.equal(parsed[0].name, 'Quoted "item"');

console.log("Inventory core tests passed: opening, in, out, transfer, damage, returns, count, negative-stock guard, valuation, metrics and CSV.");
