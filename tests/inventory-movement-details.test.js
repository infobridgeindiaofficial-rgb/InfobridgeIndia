import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMovement, createTransfer } from "../src/inventory/core.js";

const productId="PRD-1",fromWarehouseId="WH-A",toWarehouseId="WH-B";

test("saved movement notes remain available for Movement Details",()=>{
  const movement=createMovement({type:"purchase-receipt",productId,warehouseId:fromWarehouseId,quantity:5,unitCost:125,reference:"PO-10",reason:"Purchase receipt",notes:"Keep cartons dry"},[],{});
  assert.equal(movement.notes,"Keep cartons dry");
  assert.equal(movement.reference,"PO-10");
  assert.equal(movement.reason,"Purchase receipt");
  assert.equal(movement.balanceAfter,5);
  const source=readFileSync(new URL("../src/inventory/app.js",import.meta.url),"utf8");
  assert.match(source,/Movement Details/);
  assert.match(source,/m\.notes\|\|"No notes added\."/);
  assert.match(source,/data-view-movement-button/);
});

test("transfer Movement Details can resolve both warehouses without changing the linked pair",()=>{
  const pair=createTransfer({productId,fromWarehouseId,toWarehouseId,quantity:2,notes:"Urgent branch replenishment"},[
    createMovement({type:"opening",productId,warehouseId:fromWarehouseId,quantity:10},[],{})
  ],{});
  assert.equal(pair[0].type,"transfer-out");
  assert.equal(pair[1].type,"transfer-in");
  assert.equal(pair[0].linkedId,pair[1].id);
  assert.equal(pair[1].linkedId,pair[0].id);
  assert.equal(pair[0].notes,"Urgent branch replenishment");
  assert.equal(pair[1].notes,"Urgent branch replenishment");
});
