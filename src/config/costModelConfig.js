export const BUILDING_STATUS = {
  construction: {
    value: "construction",
    label: "Строящееся здание",
    exploitedBuildingCoefficient: 1.0,
  },
  operational: {
    value: "operational",
    label: "Действующее здание",
    exploitedBuildingCoefficient: 1.2,
  },
};

export const BUILDING_STATUS_OPTIONS = Object.values(BUILDING_STATUS);

export const OBJECT_PROFILE_CATALOG = {
  production: {
    profileCode: "PRODUCTION",
    architectureBase: 1.08,
    engineeringDensity: 1.12,
    routeComplexity: 1.1,
    installationBias: 1.08,
    securityIntensity: 1.12,
    systemBias: { aps: 1.1, soue: 1.05, sots: 1.12, sot: 1.12, ssoi: 1.1, skud: 1.08 },
  },
  warehouse: {
    profileCode: "WAREHOUSE",
    architectureBase: 1.02,
    engineeringDensity: 0.98,
    routeComplexity: 1.04,
    installationBias: 1.0,
    securityIntensity: 0.98,
    systemBias: { aps: 1.05, soue: 0.95, sots: 1.08, sot: 1.0, ssoi: 0.95, skud: 0.92 },
  },
  public: {
    profileCode: "PUBLIC",
    architectureBase: 1.06,
    engineeringDensity: 1.05,
    routeComplexity: 1.06,
    installationBias: 1.06,
    securityIntensity: 1.06,
    systemBias: { aps: 1.1, soue: 1.1, sots: 1.0, sot: 1.08, ssoi: 1.08, skud: 1.05 },
  },
  residential: {
    profileCode: "RESIDENTIAL",
    architectureBase: 1.0,
    engineeringDensity: 0.94,
    routeComplexity: 1.02,
    installationBias: 1.0,
    securityIntensity: 0.94,
    systemBias: { aps: 1.02, soue: 1.0, sots: 0.9, sot: 0.9, ssoi: 0.92, skud: 0.95 },
  },
  transport: {
    profileCode: "TRANSPORT",
    architectureBase: 1.16,
    engineeringDensity: 1.2,
    routeComplexity: 1.18,
    installationBias: 1.14,
    securityIntensity: 1.24,
    systemBias: { aps: 1.18, soue: 1.2, sots: 1.14, sot: 1.22, ssoi: 1.22, skud: 1.14 },
  },
  energy: {
    profileCode: "ENERGY",
    architectureBase: 1.14,
    engineeringDensity: 1.16,
    routeComplexity: 1.14,
    installationBias: 1.12,
    securityIntensity: 1.2,
    systemBias: { aps: 1.15, soue: 1.08, sots: 1.2, sot: 1.14, ssoi: 1.1, skud: 1.06 },
  },
};

export const ZONE_PROFILE_CATALOG = {
  office: {
    label: "Офис",
    occupancyDensity: 0.08,
    hiddenRoutingShare: 0.62,
    routeComplexity: 1.04,
    installationComplexity: 1.04,
  },
  parking: {
    label: "Паркинг",
    occupancyDensity: 0.02,
    hiddenRoutingShare: 0.28,
    routeComplexity: 1.1,
    installationComplexity: 1.06,
  },
  lobby: {
    label: "Холлы / входные группы",
    occupancyDensity: 0.16,
    hiddenRoutingShare: 0.52,
    routeComplexity: 1.08,
    installationComplexity: 1.12,
  },
  technical: {
    label: "Технические помещения",
    occupancyDensity: 0.03,
    hiddenRoutingShare: 0.45,
    routeComplexity: 1.02,
    installationComplexity: 1.1,
  },
  corridor: {
    label: "Коридоры / МОП",
    occupancyDensity: 0.06,
    hiddenRoutingShare: 0.48,
    routeComplexity: 1.08,
    installationComplexity: 1.06,
  },
  retail: {
    label: "Торговые зоны",
    occupancyDensity: 0.13,
    hiddenRoutingShare: 0.56,
    routeComplexity: 1.1,
    installationComplexity: 1.12,
  },
  warehouse: {
    label: "Складские зоны",
    occupancyDensity: 0.025,
    hiddenRoutingShare: 0.24,
    routeComplexity: 1.1,
    installationComplexity: 1.04,
  },
  food: {
    label: "Ресторан / общепит",
    occupancyDensity: 0.18,
    hiddenRoutingShare: 0.54,
    routeComplexity: 1.12,
    installationComplexity: 1.14,
  },
  production: {
    label: "Производственные помещения",
    occupancyDensity: 0.035,
    hiddenRoutingShare: 0.32,
    routeComplexity: 1.14,
    installationComplexity: 1.16,
  },
  perimeter: {
    label: "Уличный периметр",
    occupancyDensity: 0.005,
    hiddenRoutingShare: 0.12,
    routeComplexity: 1.24,
    installationComplexity: 1.18,
  },
};

const BASE_ZONE_SYSTEM_MATRIX = {
  office: {
    aps: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.02, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.02 },
    soue: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.02, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.02 },
    sots: { mandatory: true, saturationCoefficient: 0.9, installationComplexityCoefficient: 1.0, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 0.95, routeComplexityCoefficient: 1.0 },
    sot: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.0, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.0 },
    ssoi: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.0, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.0 },
    skud: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.02, engineeringDensityCoefficient: 1.0, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.0 },
  },
  parking: {
    aps: { mandatory: true, saturationCoefficient: 0.78, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 0.9, securityIntensityCoefficient: 0.9, routeComplexityCoefficient: 1.14 },
    soue: { mandatory: true, saturationCoefficient: 0.86, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 0.9, securityIntensityCoefficient: 0.92, routeComplexityCoefficient: 1.12 },
    sots: { mandatory: true, saturationCoefficient: 1.08, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 0.92, securityIntensityCoefficient: 1.06, routeComplexityCoefficient: 1.16 },
    sot: { mandatory: true, saturationCoefficient: 1.2, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 0.92, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.14 },
    ssoi: { mandatory: true, saturationCoefficient: 0.86, installationComplexityCoefficient: 1.04, engineeringDensityCoefficient: 0.94, securityIntensityCoefficient: 0.96, routeComplexityCoefficient: 1.1 },
    skud: { mandatory: true, saturationCoefficient: 0.72, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 0.9, securityIntensityCoefficient: 1.02, routeComplexityCoefficient: 1.1 },
  },
  lobby: {
    aps: { mandatory: true, saturationCoefficient: 1.2, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.08 },
    soue: { mandatory: true, saturationCoefficient: 1.24, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.14, routeComplexityCoefficient: 1.1 },
    sots: { mandatory: true, saturationCoefficient: 1.18, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.08 },
    sot: { mandatory: true, saturationCoefficient: 1.3, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.08 },
    ssoi: { mandatory: true, saturationCoefficient: 1.1, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.06 },
    skud: { mandatory: true, saturationCoefficient: 1.28, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.22, routeComplexityCoefficient: 1.08 },
  },
  technical: {
    aps: { mandatory: true, saturationCoefficient: 0.92, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 0.94, routeComplexityCoefficient: 1.08 },
    soue: { mandatory: true, saturationCoefficient: 0.75, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.04, securityIntensityCoefficient: 0.9, routeComplexityCoefficient: 1.08 },
    sots: { mandatory: true, saturationCoefficient: 1.15, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.1, securityIntensityCoefficient: 1.14, routeComplexityCoefficient: 1.1 },
    sot: { mandatory: true, saturationCoefficient: 0.88, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 0.94, routeComplexityCoefficient: 1.08 },
    ssoi: { mandatory: true, saturationCoefficient: 1.05, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.12, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.08 },
    skud: { mandatory: true, saturationCoefficient: 1.02, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.08 },
  },
  corridor: {
    aps: { mandatory: true, saturationCoefficient: 1.05, installationComplexityCoefficient: 1.06, engineeringDensityCoefficient: 1.04, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.1 },
    soue: { mandatory: true, saturationCoefficient: 1.12, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.04, securityIntensityCoefficient: 1.06, routeComplexityCoefficient: 1.1 },
    sots: { mandatory: true, saturationCoefficient: 1.08, installationComplexityCoefficient: 1.06, engineeringDensityCoefficient: 1.02, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.1 },
    sot: { mandatory: true, saturationCoefficient: 1.05, installationComplexityCoefficient: 1.04, engineeringDensityCoefficient: 1.02, securityIntensityCoefficient: 1.06, routeComplexityCoefficient: 1.08 },
    ssoi: { mandatory: true, saturationCoefficient: 1.02, installationComplexityCoefficient: 1.04, engineeringDensityCoefficient: 1.02, securityIntensityCoefficient: 1.02, routeComplexityCoefficient: 1.08 },
    skud: { mandatory: true, saturationCoefficient: 1.08, installationComplexityCoefficient: 1.06, engineeringDensityCoefficient: 1.02, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.08 },
  },
  retail: {
    aps: { mandatory: true, saturationCoefficient: 1.15, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.14, routeComplexityCoefficient: 1.1 },
    soue: { mandatory: true, saturationCoefficient: 1.2, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.1, securityIntensityCoefficient: 1.16, routeComplexityCoefficient: 1.1 },
    sots: { mandatory: true, saturationCoefficient: 1.1, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.18, routeComplexityCoefficient: 1.08 },
    sot: { mandatory: true, saturationCoefficient: 1.24, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.08 },
    ssoi: { mandatory: true, saturationCoefficient: 1.12, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.06 },
    skud: { mandatory: true, saturationCoefficient: 1.18, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.08 },
  },
  warehouse: {
    aps: { mandatory: true, saturationCoefficient: 0.82, installationComplexityCoefficient: 1.06, engineeringDensityCoefficient: 0.88, securityIntensityCoefficient: 0.9, routeComplexityCoefficient: 1.12 },
    soue: { mandatory: true, saturationCoefficient: 0.7, installationComplexityCoefficient: 1.05, engineeringDensityCoefficient: 0.86, securityIntensityCoefficient: 0.84, routeComplexityCoefficient: 1.1 },
    sots: { mandatory: true, saturationCoefficient: 1.24, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 0.92, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.12 },
    sot: { mandatory: true, saturationCoefficient: 0.94, installationComplexityCoefficient: 1.06, engineeringDensityCoefficient: 0.9, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.1 },
    ssoi: { mandatory: true, saturationCoefficient: 0.85, installationComplexityCoefficient: 1.04, engineeringDensityCoefficient: 0.88, securityIntensityCoefficient: 0.9, routeComplexityCoefficient: 1.08 },
    skud: { mandatory: true, saturationCoefficient: 0.82, installationComplexityCoefficient: 1.04, engineeringDensityCoefficient: 0.88, securityIntensityCoefficient: 0.92, routeComplexityCoefficient: 1.08 },
  },
  food: {
    aps: { mandatory: true, saturationCoefficient: 1.12, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.1 },
    soue: { mandatory: true, saturationCoefficient: 1.18, installationComplexityCoefficient: 1.16, engineeringDensityCoefficient: 1.1, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.1 },
    sots: { mandatory: true, saturationCoefficient: 1.0, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.08 },
    sot: { mandatory: true, saturationCoefficient: 1.1, installationComplexityCoefficient: 1.1, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.08 },
    ssoi: { mandatory: true, saturationCoefficient: 1.06, installationComplexityCoefficient: 1.08, engineeringDensityCoefficient: 1.06, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.06 },
    skud: { mandatory: true, saturationCoefficient: 1.08, installationComplexityCoefficient: 1.12, engineeringDensityCoefficient: 1.08, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.06 },
  },
  production: {
    aps: { mandatory: true, saturationCoefficient: 0.95, installationComplexityCoefficient: 1.2, engineeringDensityCoefficient: 1.14, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.16 },
    soue: { mandatory: true, saturationCoefficient: 0.82, installationComplexityCoefficient: 1.16, engineeringDensityCoefficient: 1.12, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.14 },
    sots: { mandatory: true, saturationCoefficient: 1.26, installationComplexityCoefficient: 1.2, engineeringDensityCoefficient: 1.16, securityIntensityCoefficient: 1.2, routeComplexityCoefficient: 1.18 },
    sot: { mandatory: true, saturationCoefficient: 1.18, installationComplexityCoefficient: 1.18, engineeringDensityCoefficient: 1.14, securityIntensityCoefficient: 1.18, routeComplexityCoefficient: 1.16 },
    ssoi: { mandatory: true, saturationCoefficient: 1.12, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.16, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.14 },
    skud: { mandatory: true, saturationCoefficient: 1.02, installationComplexityCoefficient: 1.14, engineeringDensityCoefficient: 1.12, securityIntensityCoefficient: 1.1, routeComplexityCoefficient: 1.12 },
  },
  perimeter: {
    aps: { mandatory: false, saturationCoefficient: 0.24, installationComplexityCoefficient: 1.2, engineeringDensityCoefficient: 0.86, securityIntensityCoefficient: 1.08, routeComplexityCoefficient: 1.28 },
    soue: { mandatory: false, saturationCoefficient: 0.1, installationComplexityCoefficient: 1.18, engineeringDensityCoefficient: 0.82, securityIntensityCoefficient: 0.8, routeComplexityCoefficient: 1.28 },
    sots: { mandatory: true, saturationCoefficient: 1.44, installationComplexityCoefficient: 1.24, engineeringDensityCoefficient: 0.92, securityIntensityCoefficient: 1.28, routeComplexityCoefficient: 1.3 },
    sot: { mandatory: true, saturationCoefficient: 1.4, installationComplexityCoefficient: 1.2, engineeringDensityCoefficient: 0.94, securityIntensityCoefficient: 1.26, routeComplexityCoefficient: 1.28 },
    ssoi: { mandatory: true, saturationCoefficient: 0.9, installationComplexityCoefficient: 1.16, engineeringDensityCoefficient: 0.9, securityIntensityCoefficient: 1.0, routeComplexityCoefficient: 1.24 },
    skud: { mandatory: false, saturationCoefficient: 0.35, installationComplexityCoefficient: 1.16, engineeringDensityCoefficient: 0.88, securityIntensityCoefficient: 1.05, routeComplexityCoefficient: 1.24 },
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getObjectProfile(objectType) {
  return OBJECT_PROFILE_CATALOG[objectType] || OBJECT_PROFILE_CATALOG.public;
}

export function getZoneProfile(zoneType) {
  return ZONE_PROFILE_CATALOG[zoneType] || ZONE_PROFILE_CATALOG.office;
}

export function getZoneSystemMatrixRule(objectType, zoneType, systemType) {
  const zoneBase =
    BASE_ZONE_SYSTEM_MATRIX[zoneType]?.[systemType] || BASE_ZONE_SYSTEM_MATRIX.office?.[systemType] || BASE_ZONE_SYSTEM_MATRIX.office.sot;
  const objectProfile = getObjectProfile(objectType);
  const systemBias = objectProfile.systemBias?.[systemType] || 1;

  return {
    mandatory: Boolean(zoneBase.mandatory),
    saturationCoefficient: clamp(zoneBase.saturationCoefficient * systemBias, 0, 2.2),
    installationComplexityCoefficient: clamp(
      zoneBase.installationComplexityCoefficient * objectProfile.installationBias,
      0.75,
      2.2
    ),
    engineeringDensityCoefficient: clamp(zoneBase.engineeringDensityCoefficient * objectProfile.engineeringDensity, 0.7, 2.2),
    securityIntensityCoefficient: clamp(zoneBase.securityIntensityCoefficient * objectProfile.securityIntensity, 0.7, 2.2),
    routeComplexityCoefficient: clamp(zoneBase.routeComplexityCoefficient * objectProfile.routeComplexity, 0.7, 2.5),
  };
}

export const SYSTEM_DRIVER_CONFIG = {
  aps: {
    markerLabel: "Монтаж+ПНР 1 извещателя",
    primaryUnitKey: "detectors",
    densityPer1000: {
      office: 24,
      parking: 13,
      lobby: 30,
      technical: 17,
      corridor: 26,
      retail: 28,
      warehouse: 14,
      food: 26,
      production: 18,
      perimeter: 2,
    },
    notificationPerPrimary: 0.18,
    detectorsPerLoop: 32,
    loopsPerPanel: 8,
    powerPerPrimary: 1 / 180,
    integrationPointsPerZone: 0.22,
    designHours: { primary: 0.065, controller: 0.72, integrationPoint: 0.32, cablePerM: 0.0045 },
  },
  soue: {
    markerLabel: "Монтаж+ПНР 1 оповещателя",
    primaryUnitKey: "speakers",
    densityPer1000: {
      office: 7,
      parking: 5,
      lobby: 10,
      technical: 4,
      corridor: 8,
      retail: 9,
      warehouse: 4,
      food: 9,
      production: 5,
      perimeter: 1,
    },
    amplifiersPerPrimary: 1 / 36,
    zonesPerSystemZone: 1,
    controllersPerAmplifier: 1 / 4,
    integrationPointsPerZone: 0.2,
    designHours: { primary: 0.055, controller: 0.52, integrationPoint: 0.3, cablePerM: 0.004 },
  },
  sots: {
    markerLabel: "Монтаж+ПНР 1 охранного датчика",
    primaryUnitKey: "sensors",
    densityPer1000: {
      office: 8,
      parking: 5,
      lobby: 12,
      technical: 7,
      corridor: 9,
      retail: 10,
      warehouse: 8,
      food: 9,
      production: 10,
      perimeter: 4,
    },
    boundariesPerPrimary: 1 / 20,
    controllerPerBoundary: 1 / 10,
    cabinetsPerController: 1 / 4,
    integrationPointsPerZone: 0.16,
    designHours: { primary: 0.048, controller: 0.6, integrationPoint: 0.28, cablePerM: 0.0038 },
  },
  sot: {
    markerLabel: "Монтаж+ПНР 1 камеры",
    primaryUnitKey: "cameras",
    densityPer1000: {
      office: 6.5,
      parking: 4.5,
      lobby: 8.5,
      technical: 4.2,
      corridor: 7,
      retail: 9,
      warehouse: 4.5,
      food: 8,
      production: 7.2,
      perimeter: 5.5,
    },
    outdoorZoneTypes: new Set(["perimeter", "parking"]),
    nvrChannels: 64,
    switchPorts: 24,
    serverPerCamera: 1 / 220,
    armPerCamera: 1 / 150,
    integrationPointsPerZone: 0.24,
    designHours: { primary: 0.06, controller: 0.8, integrationPoint: 0.35, cablePerM: 0.0042 },
  },
  ssoi: {
    markerLabel: "Интеграция 1 элемента",
    primaryUnitKey: "integrationPoints",
    densityPer1000: {
      office: 1.1,
      parking: 0.5,
      lobby: 1.5,
      technical: 1.0,
      corridor: 0.9,
      retail: 1.3,
      warehouse: 0.6,
      food: 1.2,
      production: 1.2,
      perimeter: 0.4,
    },
    serverPerPoint: 1 / 22,
    armPerPoint: 1 / 26,
    switchPerPoint: 1 / 20,
    gatewayPerPoint: 1 / 7,
    baseIntegrationPoints: 2,
    designHours: { primary: 1.15, controller: 1.2, integrationPoint: 0.65, cablePerM: 0.0035 },
  },
  skud: {
    markerLabel: "Монтаж+ПНР 1 точки прохода",
    primaryUnitKey: "accessPoints",
    densityPer1000: {
      office: 1.6,
      parking: 0.6,
      lobby: 2.8,
      technical: 0.8,
      corridor: 1.2,
      retail: 1.8,
      warehouse: 0.9,
      food: 1.4,
      production: 1.2,
      perimeter: 0.5,
    },
    readersPerPoint: 2,
    controllerPerPoint: 1 / 2,
    turnstilePerLobbyPoint: 1 / 3,
    integrationPointsPerZone: 0.2,
    designHours: { primary: 0.11, controller: 0.72, integrationPoint: 0.34, cablePerM: 0.0042 },
  },
};

export const CABLE_MODEL_DEFAULTS = {
  aps: { localPerPrimary: 8.2, trunkPer1000M2: 34, riserPerFloor: 12, reserveFactor: 1.12 },
  soue: { localPerPrimary: 10.1, trunkPer1000M2: 30, riserPerFloor: 10, reserveFactor: 1.1 },
  sots: { localPerPrimary: 14.2, trunkPer1000M2: 26, riserPerFloor: 9, reserveFactor: 1.1 },
  sot: { localPerPrimary: 27.5, trunkPer1000M2: 28, riserPerFloor: 11, reserveFactor: 1.14 },
  ssoi: { localPerPrimary: 13.2, trunkPer1000M2: 24, riserPerFloor: 8, reserveFactor: 1.09 },
  skud: { localPerPrimary: 24.5, trunkPer1000M2: 22, riserPerFloor: 9, reserveFactor: 1.11 },
};

export const KNS_MODEL_DEFAULTS = {
  trayShare: 0.56,
  conduitShare: 0.32,
  hiddenPenaltyFactor: 1.08,
  fastenerPerMeter: 1.6,
  penetrationPerRiserMeter: 0.06,
  knsUnitPerMeter: 1.0,
};

export const LABOR_UNIT_RATES = {
  aps: {
    mountPrimary: 820,
    pnrPrimary: 180,
    controllerMount: 4200,
    pnrActiveElement: 620,
    cablePerMeter: 58,
    knsPerMeter: 95,
    integrationPoint: 2400,
    designHour: 2100,
  },
  soue: {
    mountPrimary: 940,
    pnrPrimary: 210,
    controllerMount: 4800,
    pnrActiveElement: 680,
    cablePerMeter: 62,
    knsPerMeter: 96,
    integrationPoint: 2500,
    designHour: 2100,
  },
  sots: {
    mountPrimary: 780,
    pnrPrimary: 170,
    controllerMount: 3600,
    pnrActiveElement: 540,
    cablePerMeter: 54,
    knsPerMeter: 92,
    integrationPoint: 2200,
    designHour: 2100,
  },
  sot: {
    mountPrimary: 2250,
    pnrPrimary: 520,
    controllerMount: 6500,
    pnrActiveElement: 980,
    cablePerMeter: 66,
    knsPerMeter: 98,
    integrationPoint: 3000,
    designHour: 2100,
  },
  ssoi: {
    mountPrimary: 3100,
    pnrPrimary: 1280,
    controllerMount: 9500,
    pnrActiveElement: 1400,
    cablePerMeter: 49,
    knsPerMeter: 90,
    integrationPoint: 5400,
    designHour: 2300,
  },
  skud: {
    mountPrimary: 2600,
    pnrPrimary: 580,
    controllerMount: 7200,
    pnrActiveElement: 950,
    cablePerMeter: 64,
    knsPerMeter: 95,
    integrationPoint: 2800,
    designHour: 2100,
  },
};

export const WORK_CONDITION_COEFFICIENTS = [
  { key: "heightCoef", label: "Высотные работы", max: 1.35 },
  { key: "constrainedCoef", label: "Стесненные условия", max: 1.35 },
  { key: "operatingFacilityCoef", label: "Ограниченный доступ / режимность", max: 1.3 },
  { key: "nightWorkCoef", label: "Ночные работы", max: 1.4 },
  { key: "routingCoef", label: "Сложность маршрутов", max: 1.3 },
  { key: "finishCoef", label: "Требования к эстетике", max: 1.22 },
];
