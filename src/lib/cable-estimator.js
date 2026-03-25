import { CABLE_MODEL_DEFAULTS } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function estimateCableBySystem({
  systemType,
  zoneContexts = [],
  objectClassification,
  primaryUnitsByZone = {},
  controllerUnits = 0,
}) {
  const defaults = CABLE_MODEL_DEFAULTS[systemType] || CABLE_MODEL_DEFAULTS.sot;
  const totalFloors = Math.max(toNumber(objectClassification?.totalFloors, 1), 1);
  const protectedAreaM2 = Math.max(toNumber(objectClassification?.protectedAreaM2, 0), 1);

  let localCableM = 0;
  let trunkCableM = 0;
  let riserCableM = 0;
  let hiddenWeightedShare = 0;
  let routeComplexityWeighted = 0;
  let protectedShareWeight = 0;

  for (const zone of zoneContexts) {
    const rule = zone.systemRule || {};
    if (!rule.mandatory) continue;

    const zonePrimary = Math.max(toNumber(primaryUnitsByZone[zone.id], 0), 0);
    const areaFactor = Math.max(zone.areaM2 / protectedAreaM2, 0);
    const routeComplexity = toNumber(rule.routeComplexityCoefficient, 1);
    const engineeringDensity = toNumber(rule.engineeringDensityCoefficient, 1);

    localCableM += zonePrimary * defaults.localPerPrimary * routeComplexity;
    trunkCableM += (zone.areaM2 / 1000) * defaults.trunkPer1000M2 * engineeringDensity;
    riserCableM += Math.max(zone.floors - 1, 0) * defaults.riserPerFloor * routeComplexity;

    hiddenWeightedShare += areaFactor * toNumber(zone.hiddenRoutingShare, 0.4);
    routeComplexityWeighted += areaFactor * routeComplexity;
    protectedShareWeight += areaFactor;
  }

  trunkCableM += Math.max(controllerUnits, 0) * 3.8;
  riserCableM += Math.max(totalFloors - 1, 0) * 2.5;

  const reserveFactor = clamp(
    defaults.reserveFactor * (1 + Math.max(routeComplexityWeighted / Math.max(protectedShareWeight, 1) - 1, 0) * 0.1),
    1,
    1.35
  );
  const cableLengthM = (localCableM + trunkCableM + riserCableM) * reserveFactor;
  const hiddenCableShare = clamp(hiddenWeightedShare / Math.max(protectedShareWeight, 1), 0.08, 0.92);

  return {
    cableLengthM,
    localCableM,
    trunkCableM,
    riserCableM,
    reserveFactor,
    hiddenCableShare,
  };
}
