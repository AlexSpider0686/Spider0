import { SYSTEM_DRIVER_CONFIG } from "../config/costModelConfig";
import { toNumber } from "./estimate";
import { repairUtf8Cp1251Mojibake } from "./textEncoding";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeCeil(value, min = 0) {
  return Math.max(Math.ceil(toNumber(value, 0)), min);
}

function sanitizeText(value) {
  return repairUtf8Cp1251Mojibake(String(value ?? ""));
}

function sanitizeResourceRows(rows = []) {
  return rows.map((row) => ({
    ...row,
    label: sanitizeText(row?.label),
  }));
}

function normalizeManagementMode(mode) {
  return mode === "server" ? "server" : mode === "arm" ? "arm" : null;
}

function applyNormativeAdjustments(raw, normative = {}) {
  if (!normative || typeof normative !== "object") return raw;

  const next = {
    ...raw,
    resourceRows: Array.isArray(raw.resourceRows) ? raw.resourceRows.map((row) => ({ ...row })) : [],
    secondary: { ...(raw.secondary || {}) },
  };

  const reserveFactor = Math.max(toNumber(normative.minPrimaryReserveFactor, 1), 1);
  if (reserveFactor > 1) {
    next.primaryUnits = safeCeil(Math.max(toNumber(next.primaryUnits, 0), 0) * reserveFactor, Math.max(toNumber(next.primaryUnits, 0), 1));
    next.markerUnits = Math.max(next.primaryUnits, safeCeil(toNumber(next.markerUnits, next.primaryUnits), 1));
  }

  if (toNumber(normative.minAccessPoints, 0) > 0) {
    const minAccessPoints = safeCeil(normative.minAccessPoints, 1);
    next.primaryUnits = Math.max(toNumber(next.primaryUnits, 0), minAccessPoints);
    next.markerUnits = Math.max(toNumber(next.markerUnits, next.primaryUnits), minAccessPoints);
  }

  const minControllerReserve = Math.max(toNumber(normative.minControllerReserve, 0), 0);
  if (minControllerReserve > 0) {
    next.controllerUnits = Math.max(safeCeil(toNumber(next.controllerUnits, 0), 0), safeCeil(minControllerReserve, 0));
  }

  const currentMode = normalizeManagementMode(next.secondary?.managementPlan?.deploymentMode);
  const requiredMode = normalizeManagementMode(normative.minManagementMode);
  if (requiredMode && currentMode && currentMode !== requiredMode) {
    const managementPlan = { ...(next.secondary?.managementPlan || {}) };
    if (requiredMode === "server") {
      managementPlan.serverCount = Math.max(toNumber(managementPlan.serverCount, 0), 1);
      managementPlan.armCount = Math.max(toNumber(managementPlan.armCount, 0), 1);
      managementPlan.deploymentMode = "server";
      next.secondary.servers = Math.max(toNumber(next.secondary.servers, 0), toNumber(managementPlan.serverCount, 0));
      next.secondary.arms = Math.max(toNumber(next.secondary.arms, 0), toNumber(managementPlan.armCount, 0));
    } else {
      managementPlan.armCount = Math.max(toNumber(managementPlan.armCount, 0), 1);
      managementPlan.deploymentMode = "arm";
      next.secondary.arms = Math.max(toNumber(next.secondary.arms, 0), toNumber(managementPlan.armCount, 0));
    }
    managementPlan.reason = sanitizeText(
      `${managementPlan.reason || ""} Нормативный слой удержал архитектуру управления в режиме ${
        requiredMode === "server" ? "выделенного сервера" : "АРМ"
      }.`
    ).trim();
    next.secondary.managementPlan = managementPlan;
  }

  next.resourceRows = next.resourceRows.map((row) => {
    const rowKey = String(row?.key || "");
    const qty = Math.max(toNumber(row?.qty, 0), 0);
    if (["reader", "detector", "camera", "sensor", "speaker"].includes(rowKey) && reserveFactor > 1) {
      return { ...row, qty: Math.max(safeCeil(qty * reserveFactor, qty), qty) };
    }
    if (["controller", "module", "panel", "gateway", "server"].includes(rowKey) && minControllerReserve > 0) {
      return { ...row, qty: Math.max(qty, minControllerReserve) };
    }
    return row;
  });

  const designFactor = Math.max(toNumber(normative.designFactor, 1), 1);
  if (designFactor > 1) {
    next.designHoursBase = Math.max(toNumber(next.designHoursBase, 0), 0) * designFactor;
  }

  return next;
}

function buildBaseZoneCount({
  driver,
  zoneContexts = [],
  objectClassification = {},
  mandatoryZoneCount = 0,
  floorDistributedZoneCount = 0,
  weightedZoneCount = 0,
}) {
  const areaCapacityBase = Math.max(toNumber(driver.zoneAreaCapacityM2, 1800), 320);
  const floorsPerZone = Math.max(toNumber(driver.zoneFloorsPerZone, 1.6), 1);
  const architectureFactor = clamp(1 + (toNumber(objectClassification.architectureComplexityIndex, 1) - 1) * 0.18, 0.88, 1.28);
  const securityFactor = clamp(1 + (toNumber(objectClassification.securityIntensityIndex, 1) - 1) * 0.15, 0.9, 1.24);
  const distributedFactor = objectClassification?.distributedArchitecture ? 1.08 : 1;

  const areaDrivenZoneCount = zoneContexts.reduce((sum, zone) => {
    if (!zone?.systemRule?.mandatory) return sum;

    const zoneArea = Math.max(toNumber(zone.areaM2, 0), 0);
    const zoneFloors = Math.max(toNumber(zone.floors, 1), 1);
    const routeFactor = clamp(toNumber(zone.systemRule?.routeComplexityCoefficient, 1), 0.8, 1.7);
    const installationFactor = clamp(toNumber(zone.systemRule?.installationComplexityCoefficient, 1), 0.8, 1.7);
    const densityFactor = clamp(toNumber(zone.systemRule?.engineeringDensityCoefficient, 1) * toNumber(zone.densityCoefficient, 1), 0.75, 1.9);
    const effectiveCapacity = areaCapacityBase / Math.max(routeFactor * installationFactor * densityFactor * architectureFactor * securityFactor, 0.35);
    const areaSegments = safeCeil(zoneArea / Math.max(effectiveCapacity, 180), 1);
    const verticalSegments = safeCeil(zoneFloors / floorsPerZone, 1);
    const distributedReserve = zoneFloors > 1 ? safeCeil((zoneFloors - 1) * 0.4 * distributedFactor, 0) : 0;

    return sum + areaSegments + verticalSegments - 1 + distributedReserve;
  }, 0);

  return Math.max(mandatoryZoneCount, floorDistributedZoneCount, Math.round(weightedZoneCount), areaDrivenZoneCount, 1);
}

function buildSurveyRefinedZoneCount({
  baseZoneCount,
  surveyRefinement = {},
  floorDistributedZoneCount = 0,
}) {
  const recognizedZoneCount = Math.max(toNumber(surveyRefinement.recognizedZoneCount, 0), 0);
  if (recognizedZoneCount <= 0) {
    return {
      recognizedZoneCount: 0,
      surveyAdjustedZoneCount: baseZoneCount,
      surveyConfidence: 0,
      surveyInfluenceWeight: 0,
      surveyClamped: false,
    };
  }

  const acceptedPlans = Math.max(toNumber(surveyRefinement.acceptedPlans, 0), 0);
  const expectedFloors = Math.max(toNumber(surveyRefinement.expectedFloors, floorDistributedZoneCount || 0), 0);
  const coverage = expectedFloors > 0 ? acceptedPlans / expectedFloors : acceptedPlans > 0 ? 0.55 : 0.35;
  const surveyConfidence = clamp(0.35 + coverage * 0.45 + (acceptedPlans > 1 ? 0.08 : 0), 0.35, 0.92);
  const weightBase = clamp(toNumber(surveyRefinement.weight, 0.58), 0.25, 0.85);
  const surveyInfluenceWeight = clamp(weightBase * surveyConfidence, 0.18, 0.82);
  const driftLimit = clamp(toNumber(surveyRefinement.maxDrift, 0.45), 0.15, 0.8);
  const blended = baseZoneCount + (recognizedZoneCount - baseZoneCount) * surveyInfluenceWeight;
  const minAllowed = Math.max(1, Math.round(baseZoneCount * (1 - driftLimit)));
  const maxAllowed = Math.max(minAllowed, Math.round(baseZoneCount * (1 + driftLimit)));
  const rounded = Math.max(Math.round(blended), 1);
  const surveyAdjustedZoneCount = clamp(rounded, minAllowed, maxAllowed);

  return {
    recognizedZoneCount,
    surveyAdjustedZoneCount,
    surveyConfidence,
    surveyInfluenceWeight,
    surveyClamped: surveyAdjustedZoneCount !== rounded,
  };
}

function buildZoneDemand(zoneContexts, densityMap, objectClassification = {}) {
  const zonePrimaryUnits = {};
  const drivers = [];
  let total = 0;

  for (const zone of zoneContexts) {
    const rule = zone.systemRule || {};
    if (!rule.mandatory) {
      zonePrimaryUnits[zone.id] = 0;
      continue;
    }

    const baseDensity = toNumber(densityMap[zone.zoneType], toNumber(densityMap.office, 0));
    const areaUnits = zone.areaM2 / 1000;
    const floorFactor = 1 + Math.max(zone.floors - 1, 0) * 0.04;
    const zoneDensityFactor = clamp(toNumber(zone.densityCoefficient, 1), 0.55, 1.85);
    const architectureFactor = clamp(1 + (toNumber(objectClassification.architectureComplexityIndex, 1) - 1) * 0.4, 0.9, 1.35);
    const engineeringFactor = clamp(1 + (toNumber(objectClassification.engineeringSaturationIndex, 1) - 1) * 0.45, 0.9, 1.45);
    const securityFactor = clamp(1 + (toNumber(objectClassification.securityIntensityIndex, 1) - 1) * 0.35, 0.9, 1.4);
    const distributedFactor = objectClassification.distributedArchitecture ? 1.06 : 1;
    const qty =
      areaUnits *
      baseDensity *
      toNumber(rule.saturationCoefficient, 1) *
      toNumber(rule.securityIntensityCoefficient, 1) *
      toNumber(rule.engineeringDensityCoefficient, 1) *
      zoneDensityFactor *
      floorFactor *
      architectureFactor *
      engineeringFactor *
      securityFactor *
      distributedFactor;

    const normalized = Math.max(qty, 0);
    zonePrimaryUnits[zone.id] = normalized;
    total += normalized;

    drivers.push({
      zoneId: zone.id,
      zoneName: zone.zoneName,
      zoneType: zone.zoneType,
      areaM2: zone.areaM2,
      floors: zone.floors,
      baseDensity,
      saturationCoefficient: rule.saturationCoefficient,
      engineeringDensityCoefficient: rule.engineeringDensityCoefficient,
      securityIntensityCoefficient: rule.securityIntensityCoefficient,
      installationComplexityCoefficient: rule.installationComplexityCoefficient,
      routeComplexityCoefficient: rule.routeComplexityCoefficient,
      zoneDensityFactor,
      architectureFactor,
      engineeringFactor,
      securityFactor,
      distributedFactor,
      derivedPrimaryUnits: normalized,
    });
  }

  return { zonePrimaryUnits, total, drivers };
}

function sumMandatoryZoneFloors(zoneContexts = []) {
  return zoneContexts.reduce((sum, zone) => {
    if (!zone?.systemRule?.mandatory) return sum;
    return sum + Math.max(toNumber(zone?.floors, 1), 1);
  }, 0);
}

function buildManagementPlan({
  systemType,
  objectClassification = {},
  primaryUnits = 0,
  controllerUnits = 0,
  integrationPoints = 0,
  baseServerLoad = 0,
  operatorLoad = 0,
  distributedZoneLoad = 0,
  activeSystemTypes = [],
}) {
  const totalAreaM2 = Math.max(toNumber(objectClassification.totalAreaM2, 0), 0);
  const totalFloors = Math.max(toNumber(objectClassification.totalFloors, 0), 0);
  const integrationDemand = Math.max(toNumber(objectClassification.integrationDemandIndex, 1), 1);
  const objectType = String(objectClassification.objectType || "");
  const distributedArchitecture = Boolean(objectClassification.distributedArchitecture);
  const publicCriticalObject = ["public", "transport", "production", "energy"].includes(objectType);
  const lifeSafetySystem = ["aps", "soue"].includes(systemType);
  const integrationHeavySystem = ["ssoi", "sot", "skud"].includes(systemType);
  const legislationDriven = lifeSafetySystem || (publicCriticalObject && integrationHeavySystem);
  const mustUseDedicatedServer =
    legislationDriven ||
    distributedArchitecture ||
    totalAreaM2 >= 12000 ||
    totalFloors >= 4 ||
    integrationPoints >= 10 ||
    activeSystemTypes.length >= 4;
  const mayUseArmOnly =
    !mustUseDedicatedServer &&
    totalAreaM2 <= 3200 &&
    totalFloors <= 2 &&
    primaryUnits <= 180 &&
    controllerUnits <= 18 &&
    integrationPoints <= 6;

  const normalizedServerLoad =
    Math.max(
      toNumber(baseServerLoad, 0),
      primaryUnits / 260,
      controllerUnits / 18,
      integrationPoints / 10,
      distributedZoneLoad / 14
    ) * integrationDemand;
  const normalizedOperatorLoad = Math.max(toNumber(operatorLoad, 0), integrationPoints / 14, controllerUnits / 24, primaryUnits / 420);

  const serverCount = mayUseArmOnly ? 0 : Math.max(safeCeil(normalizedServerLoad, mustUseDedicatedServer ? 1 : 0), 0);
  const armCount = Math.max(safeCeil(normalizedOperatorLoad, mayUseArmOnly ? 1 : 0), serverCount > 0 ? 1 : 0);
  const deploymentMode = serverCount > 0 ? "server" : "arm";
  const modelTier =
    normalizedServerLoad >= 2.4 || integrationPoints >= 24
      ? "enterprise"
      : normalizedServerLoad >= 1.35 || totalAreaM2 >= 18000
        ? "rack"
        : mayUseArmOnly
          ? "compact"
          : "standard";
  const reason = serverCount > 0
    ? "Выделенный сервер требуется по масштабу объекта, нагрузке системы и условиям непрерывного управления."
    : "Допускается АРМ вместо сервера: объект локальный, без распределенной архитектуры и без обязательной серверной инфраструктуры.";

  return {
    serverCount,
    armCount,
    deploymentMode,
    modelTier,
    reason,
    normalizedServerLoad: Number(normalizedServerLoad.toFixed(2)),
    normalizedOperatorLoad: Number(normalizedOperatorLoad.toFixed(2)),
  };
}

function estimateAps(context) {
  const { driver, zoneDemand, zoneContexts, objectClassification } = context;
  const detectors = safeCeil(
    zoneDemand.total * clamp(1 + context.effectiveZoneCount / Math.max(context.mandatoryZoneCount * 18, 18), 1.02, 1.14),
    1
  );
  const areaDrivenZksps = safeCeil(
    zoneContexts.reduce((sum, zone) => {
      if (!zone?.systemRule?.mandatory) return sum;
      const areaDivider = zone.zoneType === "parking" ? 5200 : zone.zoneType === "public" ? 3600 : 4200;
      const floorPenalty = 1 + Math.max(toNumber(zone.floors, 1) - 1, 0) * 0.12;
      return sum + zone.areaM2 / areaDivider + floorPenalty * 0.35;
    }, 0),
    1
  );
  const distributedArchitectureReserve = objectClassification?.distributedArchitecture ? safeCeil(context.floorDistributedZoneCount * 1.15, 1) : 0;
  const zkspsCount = Math.max(
    context.effectiveZoneCount,
    context.floorDistributedZoneCount,
    areaDrivenZksps,
    distributedArchitectureReserve,
    context.recognizedZoneCount,
    1
  );
  const loopReserveFactor = objectClassification?.distributedArchitecture ? 1.18 : 1.08;
  const loops = Math.max(
    safeCeil((detectors / Math.max(driver.detectorsPerLoop, 1)) * loopReserveFactor, 1),
    safeCeil(zkspsCount / 10, 1)
  );
  const panels = Math.max(safeCeil(loops / Math.max(toNumber(driver.loopsPerPanel, 1) * 0.82, 1), 1), safeCeil(zkspsCount / 18, 1));
  const notification = Math.max(
    safeCeil(detectors * toNumber(driver.notificationPerPrimary, 0.15), 1),
    safeCeil(zkspsCount * 0.75, 1)
  );
  const powerUnits = safeCeil(detectors * toNumber(driver.powerPerPrimary, 0.005), 1);
  const integrationPoints = safeCeil(zkspsCount * toNumber(driver.integrationPointsPerZone, 0.2), 1);
  const managementPlan = buildManagementPlan({
    systemType: "aps",
    objectClassification,
    primaryUnits: detectors,
    controllerUnits: panels + powerUnits,
    integrationPoints,
    baseServerLoad: Math.max(panels / 2, zkspsCount / 18),
    operatorLoad: Math.max(zkspsCount / 26, panels / 5),
    distributedZoneLoad: zkspsCount,
    activeSystemTypes: context.activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    detectors * driver.designHours.primary +
    (panels + powerUnits + servers + arms) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: detectors,
    markerUnits: detectors,
    primaryUnitKey: "detectors",
    primaryUnitLabel: "Извещатель",
    controllerUnits: panels + powerUnits + servers + arms,
    activeElements: detectors + notification + panels + powerUnits + servers + arms,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "detector", label: "Пожарные извещатели", qty: detectors, priceShare: 0.46 },
      { key: "module", label: "ППКП и модули", qty: panels, priceShare: 0.26 },
      { key: "notification", label: "Оповещатели и табло", qty: notification, priceShare: 0.16 },
      { key: "power", label: "Питание и АКБ", qty: powerUnits, priceShare: 0.08 },
      { key: "server", label: "Сервер / АРМ АПС", qty: servers, priceShare: 0.04 },
    ],
    secondary: {
      zksps: zkspsCount,
      areaDrivenZksps,
      loops,
      panels,
      notification,
      servers,
      arms,
      powerUnits,
      managementPlan,
    },
  };
}

function estimateSoue(context) {
  const { driver, zoneDemand, zoneContexts, objectClassification } = context;
  const peopleFactor = 1 + zoneContexts.reduce((sum, zone) => sum + zone.occupancyDensity, 0) / Math.max(zoneContexts.length, 1) * 1.8;
  const speakers = safeCeil(zoneDemand.total * peopleFactor, 1);
  const alarmZones = Math.max(context.effectiveZoneCount, context.floorDistributedZoneCount, 1);
  const amplifiers = Math.max(safeCeil(speakers * toNumber(driver.amplifiersPerPrimary, 1 / 36), 1), safeCeil(alarmZones / 4, 1));
  const controllers = safeCeil(amplifiers * toNumber(driver.controllersPerAmplifier, 0.25) + alarmZones / 5, 1);
  const integrationPoints = safeCeil(alarmZones * toNumber(driver.integrationPointsPerZone, 0.2), 1);
  const managementPlan = buildManagementPlan({
    systemType: "soue",
    objectClassification,
    primaryUnits: speakers,
    controllerUnits: amplifiers + controllers,
    integrationPoints,
    baseServerLoad: Math.max(amplifiers / 3, alarmZones / 14),
    operatorLoad: Math.max(alarmZones / 18, amplifiers / 6),
    distributedZoneLoad: alarmZones,
    activeSystemTypes: context.activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    speakers * driver.designHours.primary +
    (amplifiers + controllers + servers + arms) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: speakers,
    markerUnits: speakers,
    primaryUnitKey: "speakers",
    primaryUnitLabel: "Оповещатель",
    controllerUnits: amplifiers + controllers + servers + arms,
    activeElements: speakers + amplifiers + controllers + servers + arms,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "speaker", label: "Оповещатели", qty: speakers, priceShare: 0.41 },
      { key: "amp", label: "Усилители", qty: amplifiers, priceShare: 0.25 },
      { key: "line", label: "Линейные модули", qty: alarmZones * 2, priceShare: 0.18 },
      { key: "cabinet", label: "Шкафы и БП", qty: safeCeil((amplifiers + controllers) / 3, 1), priceShare: 0.12 },
      { key: "server", label: "Сервер / АРМ СОУЭ", qty: servers, priceShare: 0.04 },
    ],
    secondary: {
      alarmZones,
      amplifiers,
      controllers,
      servers,
      arms,
      managementPlan,
    },
  };
}

function estimateSots(context) {
  const { driver, zoneDemand, objectClassification } = context;
  const sensors = safeCeil(zoneDemand.total, 1);
  const boundaries = Math.max(
    safeCeil(sensors * toNumber(driver.boundariesPerPrimary, 1 / 20) * 1.15, 1),
    safeCeil(Math.max(context.effectiveZoneCount, context.floorDistributedZoneCount), 1)
  );
  const controllers = Math.max(
    safeCeil(boundaries * toNumber(driver.controllerPerBoundary, 0.1), 1),
    safeCeil(sensors / 48, 1),
    safeCeil(context.effectiveZoneCount / 4, 1)
  );
  const cabinets = safeCeil(controllers * toNumber(driver.cabinetsPerController, 0.25), 1);
  const integrationPoints = safeCeil(Math.max(context.effectiveZoneCount, context.floorDistributedZoneCount) * toNumber(driver.integrationPointsPerZone, 0.16), 1);
  const managementPlan = buildManagementPlan({
    systemType: "sots",
    objectClassification,
    primaryUnits: sensors,
    controllerUnits: controllers + cabinets,
    integrationPoints,
    baseServerLoad: Math.max(boundaries / 24, controllers / 2),
    operatorLoad: Math.max(boundaries / 28, controllers / 5),
    distributedZoneLoad: Math.max(context.effectiveZoneCount, context.floorDistributedZoneCount),
    activeSystemTypes: context.activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    sensors * driver.designHours.primary +
    (controllers + cabinets + servers + arms) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: sensors,
    markerUnits: sensors,
    primaryUnitKey: "sensors",
    primaryUnitLabel: "Охранный датчик",
    controllerUnits: controllers + cabinets + servers + arms,
    activeElements: sensors + controllers + cabinets + servers + arms,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "sensor", label: "Охранные датчики", qty: sensors, priceShare: 0.45 },
      { key: "panel", label: "Контрольные панели", qty: controllers, priceShare: 0.22 },
      { key: "module", label: "Модули расширения", qty: boundaries, priceShare: 0.16 },
      { key: "power", label: "Блоки питания и АКБ", qty: cabinets, priceShare: 0.13 },
      { key: "server", label: "Сервер / АРМ СОТС", qty: servers, priceShare: 0.04 },
    ],
    secondary: {
      boundaries,
      controllers,
      cabinets,
      servers,
      arms,
      managementPlan,
    },
  };
}

function estimateSot(context) {
  const { driver, zoneDemand, zoneContexts } = context;
  const outdoorZoneTypes = driver.outdoorZoneTypes || new Set();
  let camerasOutdoor = 0;
  let camerasIndoor = 0;
  let highCeilingReserve = 0;
  let corridorCoverageReserve = 0;

  for (const zone of zoneContexts) {
    const qty = toNumber(zoneDemand.zonePrimaryUnits[zone.id], 0);
    const ceilingHeight = Math.max(toNumber(zone.ceilingHeight, 3.2), 0);
    const zoneArea = Math.max(toNumber(zone.areaM2, 0), 0);
    const corridorFactor = zone.zoneType === "corridor" ? zoneArea / 900 : 0;
    if (outdoorZoneTypes.has(zone.zoneType)) camerasOutdoor += qty;
    else camerasIndoor += qty;
    highCeilingReserve += ceilingHeight >= 5 ? qty * 0.14 : ceilingHeight >= 3.8 ? qty * 0.06 : 0;
    corridorCoverageReserve += corridorFactor;
  }

  const cameras = safeCeil(camerasIndoor + camerasOutdoor + highCeilingReserve + corridorCoverageReserve, 1);
  const nvr = safeCeil(cameras / Math.max(toNumber(driver.nvrChannels, 64), 1), 1);
  const switches = safeCeil(cameras / Math.max(toNumber(driver.switchPorts, 24), 1), 1);
  const integrationPoints = safeCeil(context.mandatoryZoneCount * toNumber(driver.integrationPointsPerZone, 0.24) + cameras / 180, 1);
  const managementPlan = buildManagementPlan({
    systemType: "sot",
    objectClassification: context.objectClassification,
    primaryUnits: cameras,
    controllerUnits: nvr + switches,
    integrationPoints,
    baseServerLoad: Math.max(cameras * toNumber(driver.serverPerCamera, 1 / 220), cameras > 120 ? 1 : 0),
    operatorLoad: Math.max(cameras * toNumber(driver.armPerCamera, 1 / 150), 1),
    distributedZoneLoad: context.floorDistributedZoneCount,
    activeSystemTypes: context.activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    cameras * driver.designHours.primary +
    (nvr + servers + switches + arms) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: cameras,
    markerUnits: cameras,
    primaryUnitKey: "cameras",
    primaryUnitLabel: "Камера",
    controllerUnits: nvr + servers + switches + arms,
    activeElements: cameras + nvr + servers + switches + arms,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "camera", label: "Камеры", qty: cameras, priceShare: 0.54 },
      { key: "recorder", label: "Регистраторы / серверы", qty: nvr + servers, priceShare: 0.2 },
      { key: "switch", label: "PoE-коммутаторы", qty: switches, priceShare: 0.16 },
      { key: "ups", label: "ИБП и шкафы", qty: arms, priceShare: 0.1 },
    ],
    secondary: {
      camerasIndoor: safeCeil(camerasIndoor, 0),
      camerasOutdoor: safeCeil(camerasOutdoor, 0),
      nvr,
      servers,
      arms,
      switches,
      managementPlan,
    },
  };
}

function estimateSsoi(context) {
  const { driver, zoneDemand, objectClassification, activeSystemTypes } = context;
  const baseFromZones = zoneDemand.total;
  const integratedSubsystems = Math.max(1, (activeSystemTypes || []).filter((item) => item && item !== "ssoi").length);
  const distributedZoneLoad = Math.max(context.mandatoryZoneCount, context.floorDistributedZoneCount, 1);
  const floorPressure = Math.max(toNumber(objectClassification.aboveGroundFloors, 0) + toNumber(objectClassification.undergroundFloors, 0), 1);
  const integrationPoints = safeCeil(
    toNumber(driver.baseIntegrationPoints, 2) +
      baseFromZones * 1.1 +
      integratedSubsystems * 2.1 +
      distributedZoneLoad * 0.55 +
      floorPressure * 0.28 +
      (objectClassification.distributedArchitecture ? 2 : 0),
    1
  );

  const switches = safeCeil(integrationPoints * toNumber(driver.switchPerPoint, 1 / 20) + floorPressure / 8, 1);
  const gateways = safeCeil(integrationPoints * toNumber(driver.gatewayPerPoint, 1 / 7), 1);
  const managementPlan = buildManagementPlan({
    systemType: "ssoi",
    objectClassification,
    primaryUnits: integrationPoints,
    controllerUnits: gateways + switches,
    integrationPoints,
    baseServerLoad: Math.max(integrationPoints * toNumber(driver.serverPerPoint, 1 / 22), distributedZoneLoad / 14, floorPressure / 10),
    operatorLoad: Math.max(integrationPoints * toNumber(driver.armPerPoint, 1 / 26) + integratedSubsystems / 4, 1),
    distributedZoneLoad,
    activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    integrationPoints * driver.designHours.primary +
    (servers + arms + switches + gateways) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: integrationPoints,
    markerUnits: integrationPoints,
    primaryUnitKey: "integrationPoints",
    primaryUnitLabel: "Точка интеграции",
    controllerUnits: servers + arms + switches + gateways,
    activeElements: integrationPoints + servers + arms + switches + gateways,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "server", label: "Серверы и core-узлы", qty: servers, priceShare: 0.48 },
      { key: "gateway", label: "Интеграционные шлюзы", qty: gateways, priceShare: 0.26 },
      { key: "operator", label: "АРМ операторов", qty: arms, priceShare: 0.18 },
      { key: "network", label: "Сетевое ядро", qty: switches, priceShare: 0.08 },
    ],
    secondary: {
      integratedSubsystems,
      distributedZoneLoad,
      servers,
      arms,
      switches,
      gateways,
      managementPlan,
    },
  };
}

function estimateSkud(context) {
  const { driver, zoneDemand, zoneContexts, objectClassification } = context;
  const lobbyAreaM2 = zoneContexts.filter((zone) => zone.zoneType === "lobby").reduce((sum, zone) => sum + zone.areaM2, 0);
  const parkingAreaM2 = zoneContexts.filter((zone) => zone.zoneType === "parking").reduce((sum, zone) => sum + zone.areaM2, 0);
  const accessDemandFromZones = zoneContexts.reduce((sum, zone) => {
    const area = Math.max(toNumber(zone.areaM2, 0), 0);
    const floors = Math.max(toNumber(zone.floors, 1), 1);
    const zoneFactor =
      zone.zoneType === "lobby"
        ? area / 520
        : zone.zoneType === "corridor"
          ? area / 1450
          : zone.zoneType === "parking"
            ? area / 1650
            : zone.zoneType === "technical"
              ? area / 2100
              : area / 1550;
    const verticalAccessReserve = floors > 1 ? 0.45 + (floors - 1) * 0.32 : 0;
    return sum + zoneFactor + verticalAccessReserve;
  }, 0);

  const floorBoost = objectClassification.aboveGroundFloors * 0.58 + objectClassification.undergroundFloors * 0.34;
  const lobbyBoost = lobbyAreaM2 / 900;
  const parkingBoost = parkingAreaM2 / 1800;
  const basePoints = Math.max(zoneDemand.total, accessDemandFromZones) + floorBoost + lobbyBoost + parkingBoost;
  const accessPoints = safeCeil(basePoints, 1);

  const readers = safeCeil(accessPoints * toNumber(driver.readersPerPoint, 2), 1);
  const controllerBaseLoad = Math.max(accessPoints * toNumber(driver.controllerPerPoint, 0.5), readers / 3.6);
  const controllers = safeCeil(controllerBaseLoad + lobbyAreaM2 / 3200 + parkingAreaM2 / 5200 + objectClassification.totalFloors / 3.5, 1);
  const turnstiles = safeCeil((lobbyAreaM2 / 1200) * toNumber(driver.turnstilePerLobbyPoint, 1 / 3), 0);
  const cabinets = safeCeil((controllers + turnstiles) / 4, 1);
  const integrationPoints = safeCeil(Math.max(context.mandatoryZoneCount, context.floorDistributedZoneCount) * toNumber(driver.integrationPointsPerZone, 0.2) + accessPoints / 16, 1);
  const managementPlan = buildManagementPlan({
    systemType: "skud",
    objectClassification,
    primaryUnits: accessPoints,
    controllerUnits: controllers + cabinets + turnstiles,
    integrationPoints,
    baseServerLoad: Math.max(controllers / 8, accessPoints / 26, context.floorDistributedZoneCount / 16),
    operatorLoad: Math.max(accessPoints / 18, controllers / 6),
    distributedZoneLoad: context.floorDistributedZoneCount,
    activeSystemTypes: context.activeSystemTypes,
  });
  const servers = managementPlan.serverCount;
  const arms = managementPlan.armCount;

  const designHours =
    accessPoints * driver.designHours.primary +
    (controllers + turnstiles + cabinets + servers + arms) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: accessPoints,
    markerUnits: accessPoints,
    primaryUnitKey: "accessPoints",
    primaryUnitLabel: "Точка прохода",
    controllerUnits: controllers + turnstiles + cabinets + servers + arms,
    activeElements: accessPoints + readers + controllers + turnstiles + cabinets + servers + arms,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "reader", label: "Считыватели", qty: readers, priceShare: 0.38 },
      { key: "controller", label: "Контроллеры доступа", qty: controllers, priceShare: 0.26 },
      { key: "lock", label: "Замки/турникеты", qty: turnstiles || accessPoints, priceShare: 0.2 },
      { key: "cabinet", label: "Шкафы и БП", qty: cabinets, priceShare: 0.12 },
      { key: "server", label: "Сервер / АРМ СКУД", qty: servers, priceShare: 0.04 },
    ],
    secondary: {
      readers,
      controllers,
      turnstiles,
      cabinets,
      servers,
      arms,
      managementPlan,
    },
  };
}

const SYSTEM_ESTIMATORS = {
  aps: estimateAps,
  soue: estimateSoue,
  sots: estimateSots,
  sot: estimateSot,
  ssoi: estimateSsoi,
  skud: estimateSkud,
};

export function estimateSystemQuantities({
  systemType,
  zoneContexts,
  objectClassification,
  activeSystemTypes = [],
  recognizedZoneCount = 0,
  surveyRefinement = null,
  normativeAdjustments = null,
}) {
  const driver = SYSTEM_DRIVER_CONFIG[systemType] || SYSTEM_DRIVER_CONFIG.sot;
  const zoneDemand = buildZoneDemand(zoneContexts, driver.densityPer1000 || {}, objectClassification);
  const mandatoryZoneCount = zoneContexts.filter((zone) => zone.systemRule?.mandatory).length;
  const floorDistributedZoneCount = Math.max(sumMandatoryZoneFloors(zoneContexts), mandatoryZoneCount, 0);
  const weightedZoneCount = zoneContexts.reduce((sum, zone) => {
    if (!zone?.systemRule?.mandatory) return sum;
    const zoneFloors = Math.max(toNumber(zone?.floors, 1), 1);
    return sum + 1 + Math.max(zoneFloors - 1, 0) * 0.65;
  }, 0);
  const baseZoneCount = buildBaseZoneCount({
    driver,
    zoneContexts,
    objectClassification,
    mandatoryZoneCount,
    floorDistributedZoneCount,
    weightedZoneCount,
  });
  const normalizedSurveyRefinement = surveyRefinement || {
    recognizedZoneCount,
    acceptedPlans: 0,
    expectedFloors: floorDistributedZoneCount,
    weight: driver.surveyRefinementWeight,
    maxDrift: driver.surveyMaxDrift,
  };
  const surveyZoneRefinement = buildSurveyRefinedZoneCount({
    baseZoneCount,
    surveyRefinement: {
      ...normalizedSurveyRefinement,
      weight: normalizedSurveyRefinement.weight ?? driver.surveyRefinementWeight,
      maxDrift: normalizedSurveyRefinement.maxDrift ?? driver.surveyMaxDrift,
    },
    floorDistributedZoneCount,
  });
  const effectiveZoneCount = Math.max(baseZoneCount, surveyZoneRefinement.surveyAdjustedZoneCount, 1);

  const estimator = SYSTEM_ESTIMATORS[systemType] || SYSTEM_ESTIMATORS.sot;
  const raw = estimator({
    driver,
    zoneContexts,
    zoneDemand,
    objectClassification,
    mandatoryZoneCount,
    effectiveZoneCount,
    floorDistributedZoneCount,
    recognizedZoneCount: surveyZoneRefinement.recognizedZoneCount,
    activeSystemTypes,
  });
  const adjustedRaw = applyNormativeAdjustments(raw, normativeAdjustments);

  const routeComplexityAverage =
    zoneContexts.length > 0
      ? zoneContexts.reduce((sum, zone) => sum + toNumber(zone.systemRule?.routeComplexityCoefficient, 1) * toNumber(zone.cableCoefficient, 1), 0) / zoneContexts.length
      : 1;

  return {
    systemType,
    markerLabel: sanitizeText(driver.markerLabel),
    primaryUnitKey: adjustedRaw.primaryUnitKey || driver.primaryUnitKey,
    primaryUnitLabel: sanitizeText(raw.primaryUnitLabel || "Единица"),
    primaryUnits: Math.max(toNumber(adjustedRaw.primaryUnits, 0), 0),
    markerUnits: Math.max(toNumber(adjustedRaw.markerUnits, adjustedRaw.primaryUnits), 1),
    controllerUnits: Math.max(toNumber(adjustedRaw.controllerUnits, 0), 0),
    activeElements: Math.max(toNumber(adjustedRaw.activeElements, adjustedRaw.primaryUnits), 0),
    integrationPoints: Math.max(toNumber(adjustedRaw.integrationPoints, 0), 0),
    designHoursBase: Math.max(toNumber(adjustedRaw.designHoursBase, 0), 0),
    mandatoryZoneCount,
    recognizedZoneCount: surveyZoneRefinement.recognizedZoneCount,
    baseZoneCount,
    effectiveZoneCount,
    floorDistributedZoneCount,
    surveyAdjustedZoneCount: surveyZoneRefinement.surveyAdjustedZoneCount,
    surveyConfidence: surveyZoneRefinement.surveyConfidence,
    surveyInfluenceWeight: surveyZoneRefinement.surveyInfluenceWeight,
    surveyClamped: surveyZoneRefinement.surveyClamped,
    zonePrimaryUnits: zoneDemand.zonePrimaryUnits,
    zoneDrivers: zoneDemand.drivers,
    routeComplexityAverage: clamp(routeComplexityAverage, 0.7, 2.8),
    resourceRows: sanitizeResourceRows(adjustedRaw.resourceRows || []),
    secondary: adjustedRaw.secondary || {},
  };
}
