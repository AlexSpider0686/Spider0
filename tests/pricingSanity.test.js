import test from "node:test";
import assert from "node:assert/strict";
import { VENDOR_EQUIPMENT } from "../src/config/vendorConfig.js";
import { EQUIPMENT_CATALOG } from "../src/config/equipmentCatalog.js";

test("APS Bolid panel fallback stays in realistic market range", () => {
  const apsConfig = VENDOR_EQUIPMENT.aps["Болид"];
  assert.ok(apsConfig, "Bolid APS config is missing");
  assert.equal(apsConfig.panel.basePrices[4], 4277);
  assert.ok(apsConfig.panel.basePrices[4] < 10000, "4-loop APS panel fallback is still too high");
});

test("APS equipment catalog panel fallback no longer uses inflated base price", () => {
  const panelRow = EQUIPMENT_CATALOG.aps.find((item) => item.key === "panel");
  assert.ok(panelRow, "APS panel catalog row is missing");
  assert.equal(panelRow.fallbackUnitPrice, 4277);
  assert.ok(panelRow.fallbackUnitPrice < 10000, "APS panel catalog fallback is still too high");
});
