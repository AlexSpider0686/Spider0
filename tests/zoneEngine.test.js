import test from "node:test";
import assert from "node:assert/strict";
import { rebalanceZoneAreasWithLocks, getZonePercentSum } from "../src/lib/zoneEngine.js";

const TOTAL_AREA = 1000;

test("rebalanceZoneAreasWithLocks keeps total share at 100%", () => {
  const zones = [
    { id: 1, area: 500, floors: 1, type: "office" },
    { id: 2, area: 300, floors: 1, type: "parking" },
    { id: 3, area: 200, floors: 1, type: "technical" },
  ];

  const next = rebalanceZoneAreasWithLocks(zones, 1, 60, TOTAL_AREA, []);
  const totalPercent = getZonePercentSum(next, TOTAL_AREA);

  assert.ok(Math.abs(totalPercent - 100) < 0.2);
});

test("rebalanceZoneAreasWithLocks preserves locked zones and rejects changing locked target", () => {
  const zones = [
    { id: 1, area: 500, floors: 1, type: "office" },
    { id: 2, area: 300, floors: 1, type: "parking" },
    { id: 3, area: 200, floors: 1, type: "technical" },
  ];

  const changedLocked = rebalanceZoneAreasWithLocks(zones, 2, 50, TOTAL_AREA, [2]);
  assert.deepEqual(changedLocked, zones);

  const next = rebalanceZoneAreasWithLocks(zones, 1, 55, TOTAL_AREA, [2]);
  const zone2 = next.find((z) => z.id === 2);
  assert.equal(zone2.area, 300);
});
