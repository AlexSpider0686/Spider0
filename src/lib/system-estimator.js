import { SYSTEM_DRIVER_CONFIG } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeCeil(value, min = 0) {
  return Math.max(Math.ceil(toNumber(value, 0)), min);
}

function buildZoneDemand(zoneContexts, systemType, densityMap) {
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
    const qty =
      areaUnits *
      baseDensity *
      toNumber(rule.saturationCoefficient, 1) *
      toNumber(rule.securityIntensityCoefficient, 1) *
      toNumber(rule.engineeringDensityCoefficient, 1) *
      floorFactor;

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
      derivedPrimaryUnits: normalized,
    });
  }

  return { zonePrimaryUnits, total, drivers };
}

function estimateAps(context) {
  const { driver, zoneDemand } = context;
  const detectors = safeCeil(zoneDemand.total, 1);
  const loops = safeCeil(detectors / Math.max(driver.detectorsPerLoop, 1), 1);
  const panels = safeCeil(loops / Math.max(driver.loopsPerPanel, 1), 1);
  const notification = safeCeil(detectors * toNumber(driver.notificationPerPrimary, 0.15), 1);
  const powerUnits = safeCeil(detectors * toNumber(driver.powerPerPrimary, 0.005), 1);
  const integrationPoints = safeCeil(
    context.mandatoryZoneCount * toNumber(driver.integrationPointsPerZone, 0.2),
    1
  );

  const designHours =
    detectors * driver.designHours.primary +
    (panels + powerUnits) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: detectors,
    markerUnits: detectors,
    primaryUnitKey: "detectors",
    primaryUnitLabel: "Извещатель",
    controllerUnits: panels + powerUnits,
    activeElements: detectors + notification + panels + powerUnits,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "detector", label: "Пожарные извещатели", qty: detectors, priceShare: 0.46 },
      { key: "module", label: "ППКП и модули", qty: panels, priceShare: 0.28 },
      { key: "notification", label: "Оповещатели и табло", qty: notification, priceShare: 0.16 },
      { key: "power", label: "Питание и АКБ", qty: powerUnits, priceShare: 0.1 },
    ],
    secondary: {
      loops,
      panels,
      notification,
      powerUnits,
    },
  };
}

function estimateSoue(context) {
  const { driver, zoneDemand, zoneContexts } = context;
  const peopleFactor = 1 + zoneContexts.reduce((sum, zone) => sum + zone.occupancyDensity, 0) / Math.max(zoneContexts.length, 1) * 1.8;
  const speakers = safeCeil(zoneDemand.total * peopleFactor, 1);
  const amplifiers = safeCeil(speakers * toNumber(driver.amplifiersPerPrimary, 1 / 36), 1);
  const alarmZones = Math.max(context.mandatoryZoneCount, 1);
  const controllers = safeCeil(amplifiers * toNumber(driver.controllersPerAmplifier, 0.25) + alarmZones / 6, 1);
  const integrationPoints = safeCeil(alarmZones * toNumber(driver.integrationPointsPerZone, 0.2), 1);

  const designHours =
    speakers * driver.designHours.primary +
    (amplifiers + controllers) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: speakers,
    markerUnits: speakers,
    primaryUnitKey: "speakers",
    primaryUnitLabel: "Оповещатель",
    controllerUnits: amplifiers + controllers,
    activeElements: speakers + amplifiers + controllers,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "speaker", label: "Оповещатели", qty: speakers, priceShare: 0.43 },
      { key: "amp", label: "Усилители", qty: amplifiers, priceShare: 0.27 },
      { key: "line", label: "Линейные модули", qty: alarmZones * 2, priceShare: 0.18 },
      { key: "cabinet", label: "Шкафы и БП", qty: safeCeil((amplifiers + controllers) / 3, 1), priceShare: 0.12 },
    ],
    secondary: {
      alarmZones,
      amplifiers,
      controllers,
    },
  };
}

function estimateSots(context) {
  const { driver, zoneDemand } = context;
  const sensors = safeCeil(zoneDemand.total, 1);
  const boundaries = safeCeil(sensors * toNumber(driver.boundariesPerPrimary, 1 / 20), 1);
  const controllers = safeCeil(boundaries * toNumber(driver.controllerPerBoundary, 0.1), 1);
  const cabinets = safeCeil(controllers * toNumber(driver.cabinetsPerController, 0.25), 1);
  const integrationPoints = safeCeil(context.mandatoryZoneCount * toNumber(driver.integrationPointsPerZone, 0.16), 1);

  const designHours =
    sensors * driver.designHours.primary +
    (controllers + cabinets) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: sensors,
    markerUnits: sensors,
    primaryUnitKey: "sensors",
    primaryUnitLabel: "Охранный датчик",
    controllerUnits: controllers + cabinets,
    activeElements: sensors + controllers + cabinets,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "sensor", label: "Охранные датчики", qty: sensors, priceShare: 0.47 },
      { key: "panel", label: "Контрольные панели", qty: controllers, priceShare: 0.24 },
      { key: "module", label: "Модули расширения", qty: boundaries, priceShare: 0.16 },
      { key: "power", label: "Блоки питания и АКБ", qty: cabinets, priceShare: 0.13 },
    ],
    secondary: {
      boundaries,
      controllers,
      cabinets,
    },
  };
}

function estimateSot(context) {
  const { driver, zoneDemand, zoneContexts } = context;
  const outdoorZoneTypes = driver.outdoorZoneTypes || new Set();
  let camerasOutdoor = 0;
  let camerasIndoor = 0;
  for (const zone of zoneContexts) {
    const qty = toNumber(zoneDemand.zonePrimaryUnits[zone.id], 0);
    if (outdoorZoneTypes.has(zone.zoneType)) camerasOutdoor += qty;
    else camerasIndoor += qty;
  }

  const cameras = safeCeil(camerasIndoor + camerasOutdoor, 1);
  const nvr = safeCeil(cameras / Math.max(toNumber(driver.nvrChannels, 64), 1), 1);
  const servers = safeCeil(cameras * toNumber(driver.serverPerCamera, 1 / 220), cameras > 120 ? 1 : 0);
  const arms = safeCeil(cameras * toNumber(driver.armPerCamera, 1 / 150), 1);
  const switches = safeCeil(cameras / Math.max(toNumber(driver.switchPorts, 24), 1), 1);
  const integrationPoints = safeCeil(
    context.mandatoryZoneCount * toNumber(driver.integrationPointsPerZone, 0.24) + cameras / 180,
    1
  );

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
    },
  };
}

function estimateSsoi(context) {
  const { driver, zoneDemand, objectClassification, activeSystemTypes } = context;
  const baseFromZones = zoneDemand.total;
  const integratedSubsystems = Math.max(
    1,
    (activeSystemTypes || []).filter((item) => item && item !== "ssoi").length
  );
  const integrationPoints = safeCeil(
    toNumber(driver.baseIntegrationPoints, 2) +
      baseFromZones +
      integratedSubsystems * 1.8 +
      context.mandatoryZoneCount * 0.3 +
      (objectClassification.distributedArchitecture ? 2 : 0),
    1
  );

  const servers = safeCeil(integrationPoints * toNumber(driver.serverPerPoint, 1 / 22), 1);
  const arms = safeCeil(integrationPoints * toNumber(driver.armPerPoint, 1 / 26), 1);
  const switches = safeCeil(integrationPoints * toNumber(driver.switchPerPoint, 1 / 20), 1);
  const gateways = safeCeil(integrationPoints * toNumber(driver.gatewayPerPoint, 1 / 7), 1);

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
      servers,
      arms,
      switches,
      gateways,
    },
  };
}

function estimateSkud(context) {
  const { driver, zoneDemand, zoneContexts, objectClassification } = context;
  const lobbyAreaM2 = zoneContexts
    .filter((zone) => zone.zoneType === "lobby")
    .reduce((sum, zone) => sum + zone.areaM2, 0);
  const parkingAreaM2 = zoneContexts
    .filter((zone) => zone.zoneType === "parking")
    .reduce((sum, zone) => sum + zone.areaM2, 0);

  const floorBoost = objectClassification.aboveGroundFloors * 0.42 + objectClassification.undergroundFloors * 0.2;
  const lobbyBoost = lobbyAreaM2 / 1300;
  const parkingBoost = parkingAreaM2 / 2800;
  const basePoints = zoneDemand.total + floorBoost + lobbyBoost + parkingBoost;
  const accessPoints = safeCeil(basePoints, 1);

  const readers = safeCeil(accessPoints * toNumber(driver.readersPerPoint, 2), 1);
  const controllers = safeCeil(accessPoints * toNumber(driver.controllerPerPoint, 0.5), 1);
  const turnstiles = safeCeil((lobbyAreaM2 / 1200) * toNumber(driver.turnstilePerLobbyPoint, 1 / 3), 0);
  const cabinets = safeCeil((controllers + turnstiles) / 4, 1);
  const integrationPoints = safeCeil(
    context.mandatoryZoneCount * toNumber(driver.integrationPointsPerZone, 0.2) + accessPoints / 16,
    1
  );

  const designHours =
    accessPoints * driver.designHours.primary +
    (controllers + turnstiles + cabinets) * driver.designHours.controller +
    integrationPoints * driver.designHours.integrationPoint;

  return {
    primaryUnits: accessPoints,
    markerUnits: accessPoints,
    primaryUnitKey: "accessPoints",
    primaryUnitLabel: "Точка прохода",
    controllerUnits: controllers + turnstiles + cabinets,
    activeElements: accessPoints + readers + controllers + turnstiles + cabinets,
    integrationPoints,
    designHoursBase: designHours,
    resourceRows: [
      { key: "reader", label: "Считыватели", qty: readers, priceShare: 0.4 },
      { key: "controller", label: "Контроллеры доступа", qty: controllers, priceShare: 0.28 },
      { key: "lock", label: "Замки/турникеты", qty: turnstiles || accessPoints, priceShare: 0.2 },
      { key: "cabinet", label: "Шкафы и БП", qty: cabinets, priceShare: 0.12 },
    ],
    secondary: {
      readers,
      controllers,
      turnstiles,
      cabinets,
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
}) {
  const driver = SYSTEM_DRIVER_CONFIG[systemType] || SYSTEM_DRIVER_CONFIG.sot;
  const zoneDemand = buildZoneDemand(zoneContexts, systemType, driver.densityPer1000 || {});
  const mandatoryZoneCount = zoneContexts.filter((zone) => zone.systemRule?.mandatory).length;

  const estimator = SYSTEM_ESTIMATORS[systemType] || SYSTEM_ESTIMATORS.sot;
  const raw = estimator({
    driver,
    zoneContexts,
    zoneDemand,
    objectClassification,
    mandatoryZoneCount,
    activeSystemTypes,
  });

  const routeComplexityAverage =
    zoneContexts.length > 0
      ? zoneContexts.reduce((sum, zone) => sum + toNumber(zone.systemRule?.routeComplexityCoefficient, 1), 0) / zoneContexts.length
      : 1;

  return {
    systemType,
    markerLabel: driver.markerLabel,
    primaryUnitKey: raw.primaryUnitKey || driver.primaryUnitKey,
    primaryUnitLabel: raw.primaryUnitLabel || "Единица",
    primaryUnits: Math.max(toNumber(raw.primaryUnits, 0), 0),
    markerUnits: Math.max(toNumber(raw.markerUnits, raw.primaryUnits), 1),
    controllerUnits: Math.max(toNumber(raw.controllerUnits, 0), 0),
    activeElements: Math.max(toNumber(raw.activeElements, raw.primaryUnits), 0),
    integrationPoints: Math.max(toNumber(raw.integrationPoints, 0), 0),
    designHoursBase: Math.max(toNumber(raw.designHoursBase, 0), 0),
    zonePrimaryUnits: zoneDemand.zonePrimaryUnits,
    zoneDrivers: zoneDemand.drivers,
    routeComplexityAverage: clamp(routeComplexityAverage, 0.7, 2.8),
    resourceRows: raw.resourceRows || [],
    secondary: raw.secondary || {},
  };
}
