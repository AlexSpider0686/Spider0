import test from "node:test";
import assert from "node:assert/strict";
import { calculateSystem } from "../src/lib/estimate.js";
import { calculateSystemWithBreakdown } from "../src/lib/systemCalculators/index.js";
import { estimateSystemQuantities } from "../src/lib/system-estimator.js";
import { repairUtf8Cp1251Mojibake } from "../src/lib/textEncoding.js";
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

test("customVendorIndex affects equipment cost and concrete model names", () => {
  const { zones, baseBudget, objectData } = createFixture();
  const baseSystem = {
    ...DEFAULT_SYSTEM(1, "aps"),
    vendor: "Болид",
    baseVendor: "Базовый",
    selectedEquipmentParams: {
      detectorKind: "дымовой",
      panelLoops: 4,
    },
  };

  const base = calculateSystemWithBreakdown(baseSystem, zones, baseBudget, objectData);
  const indexed = calculateSystemWithBreakdown(
    {
      ...baseSystem,
      customVendorIndex: 1.3,
    },
    zones,
    baseBudget,
    objectData
  );

  assert.ok(indexed.equipmentCost > base.equipmentCost);
  assert.match(base.bom[0]?.name || "", /ДИП|С2000|Болид/u);
});

test("zone distribution changes equipment density and cost", () => {
  const { baseBudget, objectData } = createFixture();
  const system = {
    ...DEFAULT_SYSTEM(1, "soue"),
    vendor: "Болид",
    baseVendor: "Базовый",
    selectedEquipmentParams: {
      speakerKind: "настенный",
      amplifierChannels: 4,
    },
  };

  const officeHeavy = [
    DEFAULT_ZONE(1, "Офисы", "office", 7000, 5),
    DEFAULT_ZONE(2, "Техпомещения", "technical", 3000, 2),
  ];
  const publicHeavy = [
    DEFAULT_ZONE(1, "Лобби", "lobby", 3000, 5),
    DEFAULT_ZONE(2, "Коридоры", "corridor", 4000, 5),
    DEFAULT_ZONE(3, "Ритейл", "retail", 3000, 3),
  ];

  const officeResult = calculateSystemWithBreakdown(system, officeHeavy, baseBudget, { ...objectData, totalArea: 10000 });
  const publicResult = calculateSystemWithBreakdown(system, publicHeavy, baseBudget, { ...objectData, totalArea: 10000 });

  assert.notEqual(publicResult.units, officeResult.units);
  assert.notEqual(publicResult.equipmentCost, officeResult.equipmentCost);
  assert.notEqual(publicResult.total, officeResult.total);
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

test("repairUtf8Cp1251Mojibake restores CP1251 mojibake to readable UTF-8", () => {
  const mojibake =
    "\u0420\u045f\u0420\u045f\u0420\u0459\u0420\u045b\u0420\u045f|\u0420\u00a0\u0421\u0453\u0420\u00b1\u0420\u00b5\u0420\u00b6|\u0420\u201d\u0421\u2039\u0420\u0458\u0420\u0455\u0420\u0406\u0420\u0455\u0420\u2116";
  const expected = "\u041f\u041f\u041a\u041e\u041f|\u0420\u0443\u0431\u0435\u0436|\u0414\u044b\u043c\u043e\u0432\u043e\u0439";

  assert.equal(repairUtf8Cp1251Mojibake(mojibake), expected);
});
