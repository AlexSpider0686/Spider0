import test from "node:test";
import assert from "node:assert/strict";
import { VENDOR_EQUIPMENT } from "../src/config/vendorConfig.js";
import { EQUIPMENT_CATALOG } from "../src/config/equipmentCatalog.js";

test("APS Bolid panel fallback uses Sirius-level pricing instead of loop-controller pricing", () => {
  const apsConfig = VENDOR_EQUIPMENT.aps["Болид"];
  assert.ok(apsConfig, "Bolid APS config is missing");
  assert.equal(apsConfig.panel.basePrices[4], 36160);
  assert.ok(apsConfig.panel.basePrices[4] >= 30000, "Bolid APS panel fallback should reflect the Sirius main panel");
});

test("APS equipment catalog panel fallback matches the main fire panel class", () => {
  const panelRow = EQUIPMENT_CATALOG.aps.find((item) => item.key === "panel");
  assert.ok(panelRow, "APS panel catalog row is missing");
  assert.equal(panelRow.fallbackUnitPrice, 36160);
  assert.ok(panelRow.fallbackUnitPrice >= 30000, "APS panel catalog fallback should match the main fire panel class");
});
