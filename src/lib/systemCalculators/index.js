import { SYSTEM_TYPES } from "../../config/estimateConfig";
import { getSystemRules } from "../../config/systemsConfig";
import { calculateSystem, toNumber } from "../estimate";
import { estimateCableBySystem } from "../cable-estimator";
import { buildCoefficientLayer } from "../coefficient-engine";
import { buildSystemExplainability } from "../explainability-engine";
import { normalizeEstimateInput } from "../input-normalization";
import { estimateKnsBySystem } from "../kns-estimator";
import { calculateLaborCost } from "../labor-cost-engine";
import { classifyObject } from "../object-classifier";
import { estimateSystemQuantities } from "../system-estimator";
import { classifyZonesForSystem } from "../zone-classifier";
import { calculateDesignSurveyAdjustment, hasProjectForSystem } from "../designSurveyEngine";

function getSystemName(systemType) {
  return SYSTEM_TYPES.find((item) => item.code === systemType)?.name || systemType;
}

function sum(list, selector) {
  return (list || []).reduce((acc, item) => acc + selector(item), 0);
}

function buildInvalidResult(system, objectData, errors = [], warnings = []) {
  const regionCoef = Math.max(toNumber(objectData?.regionCoef, 1), 0.5);
  return {
    systemType: system.type,
    systemName: getSystemName(system.type),
    vendor: system.vendor,
    cable: 0,
    knsLength: 0,
    trayLength: 0,
    conduitLength: 0,
    fastenerUnits: 0,
    penetrationUnits: 0,
    units: 0,
    equipCost: 0,
    equipmentCost: 0,
    cableMaterials: 0,
    trayAndFasteners: 0,
    materialCost: 0,
    materialsBase: 0,
    laborBase: 0,
    workBase: 0,
    workCharges: 0,
    workTotal: 0,
    executionHours: 0,
    executionTeamSize: 0,
    executionDurationDays: 0,
    executionDurationMonths: 0,
    designHours: 0,
    designBase: 0,
    designCharges: 0,
    designTotal: 0,
    designDurationMonths: 0,
    designTeamSize: 0,
    overhead: 0,
    ppe: 0,
    payrollTaxes: 0,
    utilization: 0,
    admin: 0,
    designOverhead: 0,
    designPpe: 0,
    designPayrollTaxes: 0,
    designUtilization: 0,
    designAdmin: 0,
    profit: 0,
    vat: 0,
    total: 0,
    unitWorkMarker: {
      key: "invalid",
      label: "Маркер недоступен",
      qty: 0,
      costPerUnit: 0,
    },
    equipmentData: {
      sourceMode: "invalid-input",
      details: [],
      keyEquipment: [],
      marketEntries: [],
      unitPrice: 0,
      selectionKey: "invalid",
    },
    bom: [],
    formulaRows: [
      {
        key: "validation",
        label: "Проверка исходных данных",
        value: 0,
        useCase: "Финальный расчет не выполнен из-за ошибок валидации входных данных.",
      },
    ],
    coefficientInsights: [],
    breakdown: {
      equipment: [],
      works: { smr: 0, pnr: 0, design: 0, integration: 0, kns: 0 },
      materials: { cable: 0, trayAndFasteners: 0, resourceMaterials: 0 },
      resources: [],
    },
    explanation: [
      "Финальный расчет не выполнен.",
      ...errors.map((item) => `Ошибка: ${item}`),
      ...warnings.map((item) => `Предупреждение: ${item}`),
    ],
    trace: {
      regionCoef,
      validationErrors: errors,
      validationWarnings: warnings,
    },
  };
}

function buildEquipmentBreakdown(systemType, equipmentCost) {
  const rules = getSystemRules(systemType);
  return (rules?.equipmentMix || []).map((item) => ({
    key: item.key,
    label: item.label,
    cost: equipmentCost * toNumber(item.share, 0),
  }));
}

function buildFallbackBom(systemType, resourceRows, equipmentCost) {
  if (!resourceRows.length) return [];
  const qtySum = sum(resourceRows, (item) => Math.max(toNumber(item.qty, 0), 0));
  return resourceRows.map((row, index) => {
    const qty = Math.max(toNumber(row.qty, 0), 1);
    const weight = qtySum > 0 ? qty / qtySum : 1 / resourceRows.length;
    const total = equipmentCost * weight;
    return {
      code: `${systemType.toUpperCase()}-${index + 1}`,
      name: row.label,
      qty,
      unitPrice: total / qty,
      total,
    };
  });
}

function buildResourceRowsWithLabor(resourceRows, quantities, cableModel) {
  const rows = (resourceRows || []).map((row) => ({ ...row }));
  const totalQty = Math.max(sum(rows, (item) => Math.max(toNumber(item.qty, 0), 0)), 1);
  const totalCable = Math.max(toNumber(cableModel?.cableLengthM, 0), 0);

  return rows.map((row) => {
    const qty = Math.max(toNumber(row.qty, 0), 0);
    const share = qty / totalQty;
    const cable = totalCable * share;
    const mountHours = qty * 0.28;
    const connectHours = qty * 0.14;
    const setupHours = qty * 0.1;
    const pnrHours = qty * 0.08;
    const designHours = qty * 0.04;
    return {
      ...row,
      qty,
      cable,
      materials: cable * 42,
      mountHours,
      connectHours,
      setupHours,
      pnrHours,
      designHours,
    };
  });
}

function resolveApsProjectOverrides(projectSnapshot, quantities, cableModel, knsModel) {
  if (!projectSnapshot?.active) {
    return {
      quantities,
      cableModel,
      knsModel,
      laborOverride: {},
      equipmentOverride: {},
      projectMode: false,
    };
  }

  const metrics = projectSnapshot.metrics || {};
  const labor = projectSnapshot.labor || {};
  const detectorQty = Math.max(toNumber(metrics.detectorsQty, quantities.primaryUnits), 0);
  const panelQty = Math.max(toNumber(metrics.panelQty, 0) + toNumber(metrics.powerQty, 0), 0);
  const notificationQty = Math.max(toNumber(metrics.notificationQty, 0), 0);
  const cableLengthM = Math.max(toNumber(metrics.cableLengthM, cableModel.cableLengthM), 0);
  const integrationPoints = Math.max(toNumber(quantities.integrationPoints, 1), 1);

  const overriddenQuantities = {
    ...quantities,
    primaryUnits: detectorQty,
    markerUnits: detectorQty,
    controllerUnits: panelQty,
    activeElements: detectorQty + panelQty + notificationQty,
    integrationPoints,
    designHoursBase: Math.max(toNumber(labor.designHoursBase, quantities.designHoursBase), quantities.designHoursBase),
    resourceRows: [
      { key: "detector", label: "Пожарные извещатели", qty: detectorQty, priceShare: 0.46 },
      { key: "module", label: "ППКП и модули", qty: Math.max(panelQty, 1), priceShare: 0.28 },
      { key: "notification", label: "Оповещатели и табло", qty: Math.max(notificationQty, 1), priceShare: 0.16 },
      { key: "power", label: "Питание и АКБ", qty: Math.max(toNumber(metrics.powerQty, 1), 1), priceShare: 0.1 },
    ],
    secondary: {
      ...(quantities.secondary || {}),
      panels: panelQty,
      notification: notificationQty,
    },
  };

  const overriddenCable = {
    ...cableModel,
    cableLengthM,
    localCableM: cableLengthM * 0.62,
    trunkCableM: cableLengthM * 0.24,
    riserCableM: cableLengthM * 0.14,
    reserveFactor: 1,
  };

  const overriddenKns = {
    ...knsModel,
    knsLengthM: Math.max(cableLengthM * 0.72, knsModel.knsLengthM),
    knsWorkUnits: Math.max(cableLengthM * 0.66, knsModel.knsWorkUnits),
  };

  return {
    quantities: overriddenQuantities,
    cableModel: overriddenCable,
    knsModel: overriddenKns,
    laborOverride: {
      workBaseOverride: toNumber(labor.baseExecutionCost, null),
      executionHoursOverride: toNumber(labor.executionHoursBase, null),
      designHoursOverride: toNumber(labor.designHoursBase, null),
      crewSizeOverride: toNumber(labor.crewSize, null),
      executionDaysOverride: toNumber(labor.executionDays, null),
      executionMonthsOverride: toNumber(labor.executionMonths, null),
      designTeamSizeOverride: toNumber(labor.designTeamSize, null),
      designMonthsOverride: toNumber(labor.designMonths, null),
    },
    equipmentOverride: {
      equipmentCost: Math.max(toNumber(projectSnapshot.totals?.equipment, 0), 0),
      materialsCost: Math.max(toNumber(projectSnapshot.totals?.materials, 0), 0),
      keyEquipment: projectSnapshot.keyEquipment || [],
      details: projectSnapshot.items || [],
      marketEntries: projectSnapshot.priceEntries || [],
      fileName: projectSnapshot.fileName || "",
    },
    projectMode: true,
  };
}

function applyScheduleOverrides(laborModel, override) {
  return {
    ...laborModel,
    crewSize: toNumber(override.crewSizeOverride, laborModel.crewSize),
    executionDays: toNumber(override.executionDaysOverride, laborModel.executionDays),
    executionMonths: toNumber(override.executionMonthsOverride, laborModel.executionMonths),
    teamSize: toNumber(override.designTeamSizeOverride, laborModel.teamSize),
    designMonths: toNumber(override.designMonthsOverride, laborModel.designMonths),
  };
}

function firstSurveyAnswer(answers, key) {
  const value = answers?.[key];
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

function boolSurveyAnswer(answers, key) {
  return answers?.[key] === true;
}

function buildSurveyRoutingAdjustment({ zones, surveyAnswers, cableLengthM, markerCostPerUnit }) {
  const normalizedZones = Array.isArray(zones) ? zones : [];
  const totalArea = Math.max(
    normalizedZones.reduce((sum, zone) => sum + Math.max(toNumber(zone?.area, 0), 0), 0),
    1
  );

  const totals = {
    materialsCost: 0,
    workCost: 0,
    routeLengthM: 0,
    zoneCount: 0,
    trayZones: 0,
    conduitZones: 0,
    boxZones: 0,
    ceilingVoidZones: 0,
    raisedFloorZones: 0,
    labels: [],
  };

  normalizedZones.forEach((zone) => {
    const zoneArea = Math.max(toNumber(zone?.area, 0), 0);
    if (zoneArea <= 0) return;

    const routeMethods = firstSurveyAnswer(surveyAnswers, `zone-${zone.id}-corridor-route-method`);
    const trayRouting = boolSurveyAnswer(surveyAnswers, `zone-${zone.id}-tray-routing-present`) || routeMethods.includes("В лотке");
    const conduitRouting = routeMethods.includes("В гофре/трубе");
    const boxRouting = routeMethods.includes("В коробе");
    const ceilingVoid = boolSurveyAnswer(surveyAnswers, `zone-${zone.id}-ceiling-void-present`) || routeMethods.includes("В запотолочном пространстве");
    const raisedFloor = boolSurveyAnswer(surveyAnswers, `zone-${zone.id}-raised-floor-present`) || routeMethods.includes("Под фальш-полом");

    if (!trayRouting && !conduitRouting && !boxRouting && !ceilingVoid && !raisedFloor) {
      return;
    }

    const areaShare = zoneArea / totalArea;
    const routeLengthM = Math.max(cableLengthM * areaShare * 0.3, zoneArea / 18, 8);
    let zoneMaterials = 0;
    let zoneWorks = 0;
    const zoneLabels = [];

    if (trayRouting) {
      zoneMaterials += routeLengthM * 340 + Math.ceil(routeLengthM / 3) * 55;
      zoneWorks += routeLengthM * 125;
      totals.trayZones += 1;
      zoneLabels.push("лотковые трассы");
    }

    if (conduitRouting) {
      zoneMaterials += routeLengthM * 145;
      zoneWorks += routeLengthM * 85;
      totals.conduitZones += 1;
      zoneLabels.push("гофра/труба");
    }

    if (boxRouting) {
      zoneMaterials += routeLengthM * 230;
      zoneWorks += routeLengthM * 96;
      totals.boxZones += 1;
      zoneLabels.push("короб");
    }

    if (ceilingVoid) {
      zoneMaterials += Math.ceil(zoneArea / 24) * 420;
      zoneWorks += routeLengthM * 48;
      totals.ceilingVoidZones += 1;
      zoneLabels.push("запотолочное пространство");
    }

    if (raisedFloor) {
      zoneMaterials += Math.ceil(zoneArea / 20) * 520;
      zoneWorks += routeLengthM * 52;
      totals.raisedFloorZones += 1;
      zoneLabels.push("фальш-пол");
    }

    const markerFloor = Math.max(toNumber(markerCostPerUnit, 0), 0);
    if (markerFloor > 0) {
      zoneWorks = Math.max(zoneWorks, markerFloor * 0.08);
    }

    totals.materialsCost += zoneMaterials;
    totals.workCost += zoneWorks;
    totals.routeLengthM += routeLengthM;
    totals.zoneCount += 1;
    totals.labels.push(`${zone?.name || "Зона"}: ${zoneLabels.join(", ")}`);
  });

  return {
    ...totals,
    materialsCost: Math.round(totals.materialsCost),
    workCost: Math.round(totals.workCost),
    routeLengthM: Number(totals.routeLengthM.toFixed(1)),
  };
}

export function calculateSystemWithBreakdown(
  system,
  zones,
  budget,
  objectData = {},
  marketSnapshot = null,
  projectSnapshot = null,
  allSystems = [],
  surveyAnswers = {}
) {
  const normalizedInput = normalizeEstimateInput({
    system,
    zones,
    budget,
    objectData,
    allSystems: allSystems.length ? allSystems : [system],
  });

  if (!normalizedInput.isValid) {
    return buildInvalidResult(system, objectData, normalizedInput.errors, normalizedInput.warnings);
  }

  const objectClassification = classifyObject(normalizedInput.objectData, normalizedInput.activeSystemTypes);
  const zoneContexts = classifyZonesForSystem({
    objectType: normalizedInput.objectData.objectType,
    zones: normalizedInput.zones,
    systemType: system.type,
  });

  let quantities = estimateSystemQuantities({
    systemType: system.type,
    zoneContexts,
    objectClassification,
    activeSystemTypes: normalizedInput.activeSystemTypes,
  });

  let cableModel = estimateCableBySystem({
    systemType: system.type,
    zoneContexts,
    objectClassification,
    primaryUnitsByZone: quantities.zonePrimaryUnits,
    controllerUnits: quantities.controllerUnits,
  });

  let knsModel = estimateKnsBySystem({
    cableModel,
    routeComplexity: quantities.routeComplexityAverage,
  });

  let projectOverrides = {
    laborOverride: {},
    equipmentOverride: {},
    projectMode: false,
  };

  if (system.type === "aps") {
    projectOverrides = resolveApsProjectOverrides(projectSnapshot, quantities, cableModel, knsModel);
    quantities = projectOverrides.quantities;
    cableModel = projectOverrides.cableModel;
    knsModel = projectOverrides.knsModel;
  }

  const coefficients = buildCoefficientLayer({
    budget: normalizedInput.budget,
    buildingStatus: normalizedInput.objectData.buildingStatus,
    regionSubject: normalizedInput.objectData.regionSubject,
    regionCoef: normalizedInput.objectData.regionCoef,
  });

  const designAdjustment = calculateDesignSurveyAdjustment({
    system,
    objectData: normalizedInput.objectData,
    zones: normalizedInput.zones,
    surveyAnswers,
    projectSnapshot,
  });
  const projectInPlace = hasProjectForSystem(system, projectSnapshot);

  let laborModel = calculateLaborCost({
    systemType: system.type,
    quantities,
    cableModel,
    knsModel,
    budget: normalizedInput.budget,
    coefficientLayer: coefficients,
    designHours: projectInPlace ? 0 : (quantities.designHoursBase + cableModel.cableLengthM * 0.0038) * designAdjustment.designHoursMultiplier,
    designComplexityFactor: projectInPlace
      ? 1
      : objectClassification.designComplexityIndex * designAdjustment.complexityMultiplier,
    projectMode: projectOverrides.projectMode,
    skipDesignPricing: projectInPlace,
    ...projectOverrides.laborOverride,
  });

  laborModel = applyScheduleOverrides(laborModel, projectOverrides.laborOverride);

  const equipmentBase = calculateSystem(system, zones, budget, objectData, marketSnapshot);
  const regionalCoef = coefficients.regionalCoefficient;
  const equipmentCost =
    projectOverrides.equipmentOverride.equipmentCost > 0
      ? projectOverrides.equipmentOverride.equipmentCost
      : Math.max(toNumber(equipmentBase.equipmentCost, 0), 0);

  const cableMaterials = cableModel.cableLengthM * 92;
  const trayAndFasteners = knsModel.knsMaterialsCost;
  const resourceMaterials = quantities.primaryUnits * 28 + quantities.controllerUnits * 130;
  const surveyRoutingAdjustment = buildSurveyRoutingAdjustment({
    zones: normalizedInput.zones,
    surveyAnswers,
    cableLengthM: cableModel.cableLengthM,
    markerCostPerUnit: laborModel.markerCostPerUnit,
  });
  const computedMaterialsCost = cableMaterials + trayAndFasteners + resourceMaterials;
  const routingMaterialsCost = surveyRoutingAdjustment.materialsCost;
  const materialCost =
    projectOverrides.equipmentOverride.materialsCost > 0
      ? projectOverrides.equipmentOverride.materialsCost
      : computedMaterialsCost + routingMaterialsCost;

  const materialsBase = equipmentCost + materialCost;
  const laborBase = laborModel.workAfterConditions * regionalCoef;
  const routingWorkCost = surveyRoutingAdjustment.workCost;
  const workTotal = laborModel.workTotal + routingWorkCost;
  const workCharges = Math.max(workTotal - laborBase, 0);
  const designBase = projectInPlace ? 0 : laborModel.designAfterConditions * regionalCoef;
  const designTotal = projectInPlace ? 0 : laborModel.designTotal;
  const designCharges = projectInPlace ? 0 : Math.max(designTotal - designBase, 0);

  const directCost = materialsBase + workTotal + designTotal;
  const profit = directCost * (toNumber(normalizedInput.budget.profitabilityPercent, 0) / 100);
  const subtotal = directCost + profit;
  const vat = normalizedInput.budget.taxMode === "osno" ? subtotal * (toNumber(normalizedInput.budget.vatPercent, 0) / 100) : 0;
  const total = subtotal + vat;

  const rules = getSystemRules(system.type);
  const smrWeight = toNumber(rules?.laborSplit?.smr, 0.6);
  const pnrWeight = toNumber(rules?.laborSplit?.pnr, 0.25);
  const splitTotal = Math.max(smrWeight + pnrWeight, 0.001);
  const works = {
    smr: laborBase * (smrWeight / splitTotal) + routingWorkCost,
    pnr: laborBase * (pnrWeight / splitTotal),
    design: designBase,
    integration: quantities.integrationPoints * 0.45 * laborModel.markerCostPerUnit,
    kns: knsModel.knsWorkUnits * 0.12 * laborModel.markerCostPerUnit,
  };

  const equipmentBreakdown = buildEquipmentBreakdown(system.type, equipmentCost);
  const breakdownResources = buildResourceRowsWithLabor(quantities.resourceRows, quantities, cableModel);

  const defaultBom = equipmentBase.equipmentData?.details?.map((item, index) => ({
    code: item.code || `${system.type.toUpperCase()}-DET-${index + 1}`,
    name: item.name,
    qty: Math.max(toNumber(item.qty, 0), 0),
    unitPrice: toNumber(item.unitPrice, 0),
    total: toNumber(item.total, 0),
  }));

  const bom = projectOverrides.projectMode
    ? (projectOverrides.equipmentOverride.details || []).map((item, index) => ({
        code: `APS-PDF-${index + 1}`,
        name: item.model ? `${item.name} (${item.model})` : item.name,
        qty: Math.max(toNumber(item.qty, 0), 0),
        unitPrice: toNumber(item.unitPrice, 0),
        total: toNumber(item.total, 0),
      }))
    : defaultBom?.length
      ? defaultBom
      : buildFallbackBom(system.type, quantities.resourceRows, equipmentCost);

  const keyEquipment =
    projectOverrides.projectMode && projectOverrides.equipmentOverride.keyEquipment?.length
      ? projectOverrides.equipmentOverride.keyEquipment
      : equipmentBase.equipmentData?.keyEquipment || [];

  const equipmentData = {
    ...equipmentBase.equipmentData,
    sourceMode: projectOverrides.projectMode ? "project_pdf" : equipmentBase.equipmentData?.sourceMode || "model",
    selectionKey:
      equipmentBase.equipmentData?.selectionKey ||
      (keyEquipment || [])
        .map((item) => item.code)
        .filter(Boolean)
        .join("+") ||
      "auto",
    unitPrice: equipmentCost / Math.max(quantities.markerUnits, 1),
    details: projectOverrides.projectMode ? projectOverrides.equipmentOverride.details : equipmentBase.equipmentData?.details || [],
    keyEquipment,
    marketEntries:
      projectOverrides.projectMode && projectOverrides.equipmentOverride.marketEntries?.length
        ? projectOverrides.equipmentOverride.marketEntries
        : equipmentBase.equipmentData?.marketEntries || [],
  };

  const systemResult = {
    systemType: system.type,
    systemName: getSystemName(system.type),
    vendor: system.vendor,
    estimateMode: projectOverrides.projectMode ? "project_pdf" : "model",
    projectSpecFileName: projectOverrides.equipmentOverride.fileName || "",
    projectInPlace,
    designSkipped: projectInPlace,
    designStatus: projectInPlace ? "skipped_project_in_place" : "calculated",
    designStatusNote: projectInPlace ? "Стоимость не рассчитывается, проект в наличии." : designAdjustment.note,
    designSurveyDrivers: designAdjustment.drivers,
    designHoursMultiplier: designAdjustment.designHoursMultiplier,
    designComplexityMultiplier: designAdjustment.complexityMultiplier,
    cable: cableModel.cableLengthM,
    knsLength: knsModel.knsLengthM,
    trayLength: knsModel.trayLengthM,
    conduitLength: knsModel.conduitLengthM,
    fastenerUnits: knsModel.fastenerUnits,
    penetrationUnits: knsModel.penetrationUnits,
    units: quantities.primaryUnits,
    equipCost: equipmentCost,
    equipmentCost,
    cableMaterials,
    trayAndFasteners,
    materialCost,
    materialsBase,
    laborBase,
    workBase: laborModel.workBase,
    workCharges,
    workTotal,
    executionHours: laborModel.executionHours + routingWorkCost / 650,
    executionTeamSize: laborModel.crewSize,
    executionDurationDays: laborModel.executionDays,
    executionDurationMonths: laborModel.executionMonths,
    designHours: laborModel.designHours,
    laborDetails: {
      unitRates: laborModel.unitRates,
      workBreakdown: laborModel.workBreakdown,
      workChargesBeforeRegion: laborModel.workChargesBeforeRegion,
      workTotalBeforeRegion: laborModel.workTotalBeforeRegion,
      marketGuard: laborModel.marketGuard,
      neuralCheck: laborModel.neuralCheck,
    },
    designBase,
    designCharges,
    designTotal,
    designDurationMonths: projectInPlace ? 0 : laborModel.designMonths,
    designTeamSize: projectInPlace ? 0 : laborModel.teamSize,
    unitWorkMarker: {
      key: quantities.primaryUnitKey,
      label: quantities.markerLabel || "Стоимость 1 единицы",
      qty: quantities.markerUnits,
      costPerUnit: laborModel.markerCostPerUnit,
    },
    overhead: laborModel.workChargesBeforeRegion.overhead * regionalCoef,
    ppe: laborModel.workChargesBeforeRegion.ppe * regionalCoef,
    payrollTaxes: laborModel.workChargesBeforeRegion.payrollTaxes * regionalCoef,
    utilization: laborModel.workChargesBeforeRegion.utilization * regionalCoef,
    admin: laborModel.workChargesBeforeRegion.admin * regionalCoef,
    designOverhead: projectInPlace ? 0 : laborModel.designChargesBeforeRegion.overhead * regionalCoef,
    designPpe: projectInPlace ? 0 : laborModel.designChargesBeforeRegion.ppe * regionalCoef,
    designPayrollTaxes: projectInPlace ? 0 : laborModel.designChargesBeforeRegion.payrollTaxes * regionalCoef,
    designUtilization: projectInPlace ? 0 : laborModel.designChargesBeforeRegion.utilization * regionalCoef,
    designAdmin: projectInPlace ? 0 : laborModel.designChargesBeforeRegion.admin * regionalCoef,
    profit,
    vat,
    total,
    equipmentData,
    bom,
    breakdown: {
      equipment: equipmentBreakdown,
      works,
      materials: {
        cable: cableMaterials,
        trayAndFasteners,
        resourceMaterials,
        routingSurvey: routingMaterialsCost,
      },
      resources: breakdownResources,
    },
    trace: {
      ...(equipmentBase.trace || {}),
      systemType: system.type,
      regionalCoefficient: coefficients.regionalCoefficient,
      exploitedBuildingCoefficient: coefficients.exploitedBuildingCoefficient,
      conditionLaborFactor: coefficients.conditionLaborFactor,
      conditionLaborFactorRaw: coefficients.conditionLaborFactorRaw,
      conditionDampening: coefficients.conditionDampening,
      cableLengthM: cableModel.cableLengthM,
      knsLengthM: knsModel.knsLengthM,
      trayLengthM: knsModel.trayLengthM,
      conduitLengthM: knsModel.conduitLengthM,
      fastenerUnits: knsModel.fastenerUnits,
      penetrationUnits: knsModel.penetrationUnits,
      surveyRoutingAdjustment,
      validationErrors: normalizedInput.errors,
      validationWarnings: normalizedInput.warnings,
      autoQuantities: {
        primaryUnits: quantities.primaryUnits,
        controllerUnits: quantities.controllerUnits,
        activeElements: quantities.activeElements,
        integrationPoints: quantities.integrationPoints,
      },
      designAdjustment,
    },
  };

  const explainability = buildSystemExplainability({
    systemResult,
    input: normalizedInput,
    objectClassification,
    coefficients,
    quantities,
    cableModel,
    knsModel,
  });

  // Дополняем explainability данными поставщика/рынка.
  const vendorFactor = toNumber(equipmentBase.trace?.vendorFactor, 1);
  const marketSnapshotFactor = toNumber(equipmentBase.trace?.marketSnapshotFactor, 1);
  const vendorRows = [
    {
      key: "vendorFactor",
      label: "Коэфф. вендора",
      value: vendorFactor,
      useCase: "Ценовой и технологический профиль выбранного производителя.",
    },
    {
      key: "marketSnapshotFactor",
      label: "Коэфф. рынка (производитель + Tinko)",
      value: marketSnapshotFactor,
      useCase: "Средняя рыночная цена по результатам опроса источников.",
    },
  ];

  const marketAndAiInsights = [
    {
      key: "laborMarketFloor",
      label: "Рыночный пол СМР+ПНР",
      value: laborModel.marketGuard?.minBaseFactor || 1,
      useCase: "Консервативная нижняя граница базы работ по типу системы и рыночным ориентирам.",
      recommended:
        laborModel.workBase > laborModel.workBreakdown.computedWorkBase
          ? "База работ поднята до безопасного нижнего рыночного диапазона."
          : "База работ уже выше консервативного рыночного минимума.",
    },
    {
      key: "laborNeuralRisk",
      label: "AI-проверка недооценки работ",
      value: laborModel.neuralCheck?.neuralUpliftMultiplier || 1,
      useCase: "Локальный нейросетевой risk scorer оценивает PDF-override, кабельную насыщенность, КНС, плотность узлов и регион.",
      recommended:
        toNumber(laborModel.neuralCheck?.underestimationRisk, 0) > 0.55
          ? "Обнаружен повышенный риск недооценки, применен консервативный uplift."
          : "AI-проверка не выявила критичной недооценки.",
    },
  ];

  return {
    ...systemResult,
    formulaRows: [
      ...vendorRows,
      ...(surveyRoutingAdjustment.zoneCount
        ? [
            {
              key: "surveyRoutingMaterials",
              label: "Надбавка материалов по обследованию трасс",
              value: routingMaterialsCost,
              useCase: `Фото коридоров и ответы по лоткам/фальш-полу/запотолочному пространству добавили материалы на ${routingMaterialsCost} руб.`,
            },
            {
              key: "surveyRoutingWorks",
              label: "Надбавка работ по обследованию трасс",
              value: routingWorkCost,
              useCase: `Уточнённые способы прокладки добавили работы на ${routingWorkCost} руб. по ${surveyRoutingAdjustment.zoneCount} зонам.`,
            },
          ]
        : []),
      ...explainability.formulaRows,
    ],
    coefficientInsights: [
      ...vendorRows.map((item) => ({
        ...item,
        recommended:
          item.value > 1.12
            ? "Повышенный коэффициент оправдан для сложных и интеграционно насыщенных объектов."
            : "Коэффициент в базовом диапазоне.",
      })),
      ...(surveyRoutingAdjustment.zoneCount
        ? [
            {
              key: "surveyRoutingImpact",
              label: "AI-обследование трасс",
              value: surveyRoutingAdjustment.zoneCount,
              useCase: "Фото коридоров и ответы чек-листа уточнили способ прокладки кабельных линий и добавили прямые поправки в смету материалов и СМР.",
              recommended: surveyRoutingAdjustment.labels.slice(0, 3).join("; "),
            },
          ]
        : []),
      ...marketAndAiInsights,
      ...explainability.coefficientInsights,
    ],
    explanation: [
      ...explainability.explanation,
      ...(surveyRoutingAdjustment.zoneCount
        ? [`AI-обследование маршрутов прокладки учтено в смете: материалы +${routingMaterialsCost} руб., работы +${routingWorkCost} руб.`]
        : []),
    ],
  };
}
