import test from "node:test";
import assert from "node:assert/strict";
import { calculateSystem } from "../src/lib/estimate.js";
import { calculateSystemWithBreakdown } from "../src/lib/systemCalculators/index.js";
import { estimateSystemQuantities } from "../src/lib/system-estimator.js";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE } from "../src/config/estimateConfig.js";

function createFixture() {
  const zones = [DEFAULT_ZONE(1, "Офис", "office", 5000, 5), DEFAULT_ZONE(2, "Паркинг", "parking", 2000, 2)];
  const baseBudget = { ...DEFAULT_BUDGET };
  const system = { ...DEFAULT_SYSTEM(1, "sot"), vendor: "Базовый", baseVendor: "Базовый" };
  const objectData = {
    regionName: "Москва",
    regionCoef: 1.2,
    objectType: "public",
    buildingStatus: "operational",
    totalArea: 7000,
    floors: 5,
    basementFloors: 1,
  };
  return { zones, baseBudget, system, objectData };
}

test("calculateSystem responds to work-condition coefficients", () => {
  const { zones, baseBudget, system, objectData } = createFixture();

  const base = calculateSystem(system, zones, baseBudget, objectData);
  const harder = calculateSystem(
    system,
    zones,
    {
      ...baseBudget,
      heightCoef: 1.1,
      constrainedCoef: 1.15,
      operatingFacilityCoef: 1.05,
      nightWorkCoef: 1.2,
      routingCoef: 1.08,
      finishCoef: 1.04,
    },
    objectData
  );

  assert.ok(harder.laborBase > base.laborBase);
  assert.ok((harder.trace?.conditionLaborFactor || 1) > 1);
});

test("calculateSystemWithBreakdown returns resource rows and positive totals", () => {
  const { zones, baseBudget, system, objectData } = createFixture();
  const detailed = calculateSystemWithBreakdown(system, zones, baseBudget, objectData);

  assert.ok(Array.isArray(detailed.breakdown?.resources));
  assert.ok(detailed.breakdown.resources.length > 0);
  assert.ok(detailed.total > 0);
  assert.ok(detailed.materialsBase > 0);
  assert.ok(detailed.formulaRows.some((row) => row.key === "conditionLaborFactor"));
  assert.ok((detailed.trace.regionCoef || detailed.trace.regionalCoefficient || 1) >= 1);
});

test("estimateSystemQuantities scales APS zone counts with mandatory floors", () => {
  const zoneContexts = [
    {
      id: "office-main",
      zoneName: "Office",
      zoneType: "office",
      areaM2: 1800,
      floors: 5,
      occupancyDensity: 1,
      systemRule: {
        mandatory: true,
        saturationCoefficient: 1,
        securityIntensityCoefficient: 1,
        engineeringDensityCoefficient: 1,
        installationComplexityCoefficient: 1,
        routeComplexityCoefficient: 1,
      },
    },
  ];

  const quantities = estimateSystemQuantities({
    systemType: "aps",
    zoneContexts,
    objectClassification: {
      aboveGroundFloors: 5,
      undergroundFloors: 0,
      distributedArchitecture: false,
    },
    activeSystemTypes: ["aps", "soue"],
    recognizedZoneCount: 1,
  });

  assert.equal(quantities.mandatoryZoneCount, 1);
  assert.equal(quantities.floorDistributedZoneCount, 5);
  assert.equal(quantities.effectiveZoneCount, 5);
  assert.ok((quantities.secondary?.zksps || 0) >= 5);
  assert.ok((quantities.secondary?.servers || 0) >= 1);
});

test("estimateSystemQuantities increases SSOI load for vertically distributed zones", () => {
  const makeZone = (floors) => [
    {
      id: `zone-${floors}`,
      zoneName: "Core",
      zoneType: "office",
      areaM2: 2400,
      floors,
      occupancyDensity: 1,
      systemRule: {
        mandatory: true,
        saturationCoefficient: 1,
        securityIntensityCoefficient: 1,
        engineeringDensityCoefficient: 1,
        installationComplexityCoefficient: 1,
        routeComplexityCoefficient: 1,
      },
    },
  ];

  const base = estimateSystemQuantities({
    systemType: "ssoi",
    zoneContexts: makeZone(1),
    objectClassification: {
      aboveGroundFloors: 1,
      undergroundFloors: 0,
      distributedArchitecture: false,
    },
    activeSystemTypes: ["ssoi", "aps", "skud"],
    recognizedZoneCount: 1,
  });

  const vertical = estimateSystemQuantities({
    systemType: "ssoi",
    zoneContexts: makeZone(6),
    objectClassification: {
      aboveGroundFloors: 6,
      undergroundFloors: 0,
      distributedArchitecture: true,
    },
    activeSystemTypes: ["ssoi", "aps", "skud"],
    recognizedZoneCount: 1,
  });

  assert.ok(vertical.floorDistributedZoneCount > base.floorDistributedZoneCount);
  assert.ok(vertical.integrationPoints > base.integrationPoints);
  assert.ok((vertical.secondary?.servers || 0) >= (base.secondary?.servers || 0));
  assert.ok((vertical.secondary?.distributedZoneLoad || 0) > (base.secondary?.distributedZoneLoad || 0));
});
