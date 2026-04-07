import test from "node:test";
import assert from "node:assert/strict";
import { calculateSystem } from "../src/lib/estimate.js";
import { calculateSystemWithBreakdown } from "../src/lib/systemCalculators/index.js";
import { estimateSystemQuantities } from "../src/lib/system-estimator.js";
import { getConcreteModel } from "../src/lib/equipment.js";
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

test("partial work shares apply height, night and weekend coefficients proportionally", () => {
  const { zones, baseBudget, system, objectData } = createFixture();

  const base = calculateSystem(system, zones, baseBudget, objectData);
  const partial = calculateSystem(
    system,
    zones,
    {
      ...baseBudget,
      heightCoef: 1.2,
      heightWorkSharePercent: 50,
      nightWorkCoef: 1.2,
      nightWorkSharePercent: 25,
      weekendWorkCoef: 1.3,
      weekendWorkSharePercent: 20,
    },
    objectData
  );
  const full = calculateSystem(
    system,
    zones,
    {
      ...baseBudget,
      heightCoef: 1.2,
      heightWorkSharePercent: 100,
      nightWorkCoef: 1.2,
      nightWorkSharePercent: 100,
      weekendWorkCoef: 1.3,
      weekendWorkSharePercent: 100,
    },
    objectData
  );

  assert.ok(partial.laborBase > base.laborBase);
  assert.ok(full.laborBase > partial.laborBase);
  assert.ok((partial.trace?.weekendWorkCoef || 1) > 1);
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
  assert.ok(quantities.baseZoneCount >= 5);
  assert.equal(quantities.effectiveZoneCount, quantities.baseZoneCount);
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

test("survey refinement adjusts zone count but does not replace base object model", () => {
  const zoneContexts = [
    {
      id: "lobby-core",
      zoneName: "Lobby",
      zoneType: "lobby",
      areaM2: 4200,
      floors: 6,
      densityCoefficient: 1.2,
      systemRule: {
        mandatory: true,
        saturationCoefficient: 1.2,
        securityIntensityCoefficient: 1.1,
        engineeringDensityCoefficient: 1.08,
        installationComplexityCoefficient: 1.12,
        routeComplexityCoefficient: 1.08,
      },
    },
  ];

  const sharedObjectClassification = {
    aboveGroundFloors: 6,
    undergroundFloors: 0,
    architectureComplexityIndex: 1.12,
    engineeringSaturationIndex: 1.08,
    securityIntensityIndex: 1.06,
    distributedArchitecture: true,
  };

  const base = estimateSystemQuantities({
    systemType: "aps",
    zoneContexts,
    objectClassification: sharedObjectClassification,
    activeSystemTypes: ["aps", "soue"],
  });

  const refined = estimateSystemQuantities({
    systemType: "aps",
    zoneContexts,
    objectClassification: sharedObjectClassification,
    activeSystemTypes: ["aps", "soue"],
    surveyRefinement: {
      recognizedZoneCount: 30,
      acceptedPlans: 2,
      expectedFloors: 6,
    },
  });

  assert.ok(base.baseZoneCount > 0);
  assert.ok(refined.surveyAdjustedZoneCount > base.baseZoneCount);
  assert.ok(refined.surveyAdjustedZoneCount < 30);
  assert.equal(refined.effectiveZoneCount, refined.surveyAdjustedZoneCount);
});

test("concrete equipment catalog labels are sanitized before display", () => {
  const model = getConcreteModel("sot", "Hikvision", "camera", "внутренние_4");

  assert.equal(model, "DS-2CD2143G2-IU");
});
test("small local SKUD object uses ARM-only management topology", () => {
  const result = estimateSystemQuantities({
    systemType: "skud",
    zoneContexts: [
      {
        id: "lobby",
        zoneType: "lobby",
        zoneName: "Лобби",
        areaM2: 900,
        floors: 1,
        occupancyDensity: 0.15,
        densityCoefficient: 1,
        systemRule: {
          mandatory: true,
          saturationCoefficient: 1,
          securityIntensityCoefficient: 1,
          engineeringDensityCoefficient: 1,
          installationComplexityCoefficient: 1,
          routeComplexityCoefficient: 1,
        },
      },
    ],
    objectClassification: {
      objectType: "residential",
      totalAreaM2: 900,
      totalFloors: 1,
      aboveGroundFloors: 1,
      undergroundFloors: 0,
      architectureComplexityIndex: 1,
      engineeringSaturationIndex: 1,
      securityIntensityIndex: 1,
      integrationDemandIndex: 1,
      distributedArchitecture: false,
    },
    activeSystemTypes: ["skud"],
  });

  assert.equal(result.secondary.managementPlan.deploymentMode, "arm");
  assert.equal(result.secondary.managementPlan.serverCount, 0);
  assert.ok(result.secondary.managementPlan.armCount >= 1);
});

test("large distributed SSOI object requires dedicated management servers", () => {
  const result = estimateSystemQuantities({
    systemType: "ssoi",
    zoneContexts: [
      {
        id: "zone-1",
        zoneType: "office",
        zoneName: "Офис",
        areaM2: 18000,
        floors: 8,
        occupancyDensity: 0.08,
        densityCoefficient: 1.2,
        systemRule: {
          mandatory: true,
          saturationCoefficient: 1.1,
          securityIntensityCoefficient: 1.1,
          engineeringDensityCoefficient: 1.1,
          installationComplexityCoefficient: 1.08,
          routeComplexityCoefficient: 1.08,
        },
      },
    ],
    objectClassification: {
      objectType: "transport",
      totalAreaM2: 18000,
      totalFloors: 8,
      aboveGroundFloors: 8,
      undergroundFloors: 0,
      architectureComplexityIndex: 1.16,
      engineeringSaturationIndex: 1.18,
      securityIntensityIndex: 1.12,
      integrationDemandIndex: 1.4,
      distributedArchitecture: true,
    },
    activeSystemTypes: ["aps", "soue", "sot", "ssoi", "skud"],
  });

  assert.equal(result.secondary.managementPlan.deploymentMode, "server");
  assert.ok(result.secondary.managementPlan.serverCount >= 1);
});

test("public CCTV object does not overprovision management servers", () => {
  const result = estimateSystemQuantities({
    systemType: "sot",
    zoneContexts: [
      {
        id: "zone-1",
        zoneType: "office",
        zoneName: "Офис",
        areaM2: 12000,
        floors: 5,
        occupancyDensity: 0.08,
        densityCoefficient: 1,
        systemRule: {
          mandatory: true,
          saturationCoefficient: 1,
          securityIntensityCoefficient: 1,
          engineeringDensityCoefficient: 1,
          installationComplexityCoefficient: 1,
          routeComplexityCoefficient: 1,
        },
      },
    ],
    objectClassification: {
      objectType: "public",
      totalAreaM2: 12000,
      totalFloors: 5,
      aboveGroundFloors: 5,
      undergroundFloors: 0,
      architectureComplexityIndex: 1,
      engineeringSaturationIndex: 1,
      securityIntensityIndex: 1,
      integrationDemandIndex: 1,
      distributedArchitecture: false,
    },
    activeSystemTypes: ["sot"],
  });

  assert.equal(result.secondary.managementPlan.deploymentMode, "server");
  assert.ok(result.secondary.managementPlan.serverCount <= 2);
});

test("VAT is not applied to design total", () => {
  const { zones, baseBudget, system, objectData } = createFixture();
  const detailed = calculateSystemWithBreakdown(system, zones, baseBudget, objectData);
  const vatBreakdownTotal =
    (detailed.vatBreakdown?.equipment || 0) +
    (detailed.vatBreakdown?.materials || 0) +
    (detailed.vatBreakdown?.works || 0) +
    (detailed.vatBreakdown?.design || 0);

  assert.equal(detailed.vatBreakdown?.design || 0, 0);
  assert.ok(Math.abs(vatBreakdownTotal - (detailed.vat || 0)) < 0.01);
});
