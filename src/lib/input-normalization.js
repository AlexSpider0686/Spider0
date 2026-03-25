import { DEFAULT_BUDGET } from "../config/estimateConfig";
import { BUILDING_STATUS, OBJECT_PROFILE_CATALOG } from "../config/costModelConfig";
import { getRegionCoef } from "../config/regionsConfig";
import { ZONE_TYPES } from "../config/zonesConfig";
import { toNumber } from "./estimate";

const ZONE_TYPE_SET = new Set(ZONE_TYPES.map((item) => item.value));

function sanitizeText(value, fallback = "") {
  const safe = String(value ?? "").trim();
  return safe || fallback;
}

function normalizeBudget(inputBudget = {}) {
  return { ...DEFAULT_BUDGET, ...inputBudget };
}

function normalizeObject(objectData = {}) {
  const aboveGroundFloors = Math.max(1, Math.round(toNumber(objectData.floors, objectData.aboveGroundFloors || 1)));
  const undergroundFloors = Math.max(0, Math.round(toNumber(objectData.basementFloors, objectData.undergroundFloors || 0)));
  const totalAreaM2 = Math.max(toNumber(objectData.totalArea, objectData.totalAreaM2), 0);
  const regionSubject = sanitizeText(objectData.regionName || objectData.regionSubject);
  const regionCoef = Math.max(toNumber(objectData.regionCoef, getRegionCoef(regionSubject)), 0.5);
  const buildingStatus = sanitizeText(objectData.buildingStatus);

  return {
    projectName: sanitizeText(objectData.projectName, "Объект"),
    objectType: sanitizeText(objectData.objectType),
    totalAreaM2,
    protectedAreaM2: Math.max(toNumber(objectData.protectedAreaM2, 0), 0),
    aboveGroundFloors,
    undergroundFloors,
    regionSubject,
    regionCoef,
    buildingStatus,
  };
}

function normalizeZones(zones = [], fallbackProtectedArea = 0) {
  const safe = Array.isArray(zones) ? zones : [];
  const normalized = safe.map((zone, index) => ({
    id: zone.id ?? index + 1,
    zoneName: sanitizeText(zone.name || zone.zoneName, `Зона ${index + 1}`),
    zoneType: ZONE_TYPE_SET.has(zone.type) ? zone.type : ZONE_TYPE_SET.has(zone.zoneType) ? zone.zoneType : "office",
    areaM2: Math.max(toNumber(zone.area, zone.areaM2), 0),
    floors: Math.max(1, Math.round(toNumber(zone.floors, 1))),
    sharePercent: Math.max(toNumber(zone.sharePercent, 0), 0),
  }));

  const areaSum = normalized.reduce((sum, zone) => sum + zone.areaM2, 0);
  const protectedAreaM2 = areaSum > 0 ? areaSum : Math.max(toNumber(fallbackProtectedArea, 0), 0);

  const withShares =
    protectedAreaM2 > 0
      ? normalized.map((zone) => ({
          ...zone,
          sharePercent: (zone.areaM2 / protectedAreaM2) * 100,
        }))
      : normalized;

  return {
    zones: withShares,
    protectedAreaM2,
    zoneAreaSumM2: areaSum,
    zoneShareSumPercent: withShares.reduce((sum, zone) => sum + zone.sharePercent, 0),
  };
}

function validateRequired(normalizedObject, normalizedZones) {
  const errors = [];
  const warnings = [];

  if (!normalizedObject.objectType) errors.push("Не выбран тип объекта.");
  if (!OBJECT_PROFILE_CATALOG[normalizedObject.objectType]) errors.push("Тип объекта отсутствует в словаре.");
  if (normalizedObject.totalAreaM2 <= 0) errors.push("Площадь объекта должна быть больше 0.");
  if (!normalizedObject.regionSubject) errors.push("Не выбран субъект РФ.");
  if (!normalizedObject.buildingStatus) errors.push("Не выбран статус здания.");
  if (!BUILDING_STATUS[normalizedObject.buildingStatus]) errors.push("Некорректный статус здания.");
  if (!normalizedZones.length) errors.push("Не заполнены зоны объекта.");

  return { errors, warnings };
}

function validateZonesAgainstObject(normalizedObject, zoneState) {
  const errors = [];
  const warnings = [];

  const protectedAreaM2 = Math.max(zoneState.protectedAreaM2, 0);
  if (protectedAreaM2 <= 0) {
    errors.push("Защищаемая площадь зон должна быть больше 0.");
    return { errors, warnings };
  }

  const declaredProtectedArea = normalizedObject.protectedAreaM2 > 0 ? normalizedObject.protectedAreaM2 : protectedAreaM2;
  const areaMismatch = Math.abs(declaredProtectedArea - protectedAreaM2) / Math.max(protectedAreaM2, 1);
  if (areaMismatch > 0.02) {
    errors.push("Сумма площадей зон должна соответствовать защищаемой площади.");
  }

  const shareDelta = Math.abs(zoneState.zoneShareSumPercent - 100);
  if (shareDelta > 0.5) {
    errors.push("Сумма долей зон должна быть равна 100%.");
  }

  const maxObjectFloors = normalizedObject.aboveGroundFloors + normalizedObject.undergroundFloors;
  zoneState.zones.forEach((zone) => {
    if (zone.floors > maxObjectFloors) {
      errors.push(`Зона "${zone.zoneName}" имеет этажность выше этажности объекта.`);
    }
    if (!ZONE_TYPE_SET.has(zone.zoneType)) {
      errors.push(`Зона "${zone.zoneName}" имеет неизвестный тип зоны.`);
    }
  });

  if (protectedAreaM2 > normalizedObject.totalAreaM2 * 1.1) {
    warnings.push("Сумма площадей зон заметно превышает площадь объекта.");
  }

  return { errors, warnings };
}

export function normalizeEstimateInput({ system, zones, budget, objectData, allSystems = [] }) {
  const normalizedObject = normalizeObject(objectData);
  const zoneState = normalizeZones(zones, normalizedObject.protectedAreaM2 || normalizedObject.totalAreaM2);
  const normalizedBudget = normalizeBudget(budget);

  const requiredValidation = validateRequired(normalizedObject, zoneState.zones);
  const zonesValidation = validateZonesAgainstObject(normalizedObject, zoneState);

  const errors = [...requiredValidation.errors, ...zonesValidation.errors];
  const warnings = [...requiredValidation.warnings, ...zonesValidation.warnings];

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    objectData: {
      ...normalizedObject,
      protectedAreaM2: zoneState.protectedAreaM2,
    },
    zones: zoneState.zones,
    budget: normalizedBudget,
    system,
    activeSystemTypes: (allSystems || []).map((item) => item.type).filter(Boolean),
    meta: {
      zoneAreaSumM2: zoneState.zoneAreaSumM2,
      zoneShareSumPercent: zoneState.zoneShareSumPercent,
    },
  };
}

export function validateEstimateInput(payload) {
  const normalized = normalizeEstimateInput(payload);
  return {
    isValid: normalized.isValid,
    errors: normalized.errors,
    warnings: normalized.warnings,
    protectedAreaM2: normalized.objectData.protectedAreaM2,
    zoneShareSumPercent: normalized.meta.zoneShareSumPercent,
  };
}
