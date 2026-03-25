import { getZoneProfile, getZoneSystemMatrixRule } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function classifyZonesForSystem({ objectType, zones, systemType }) {
  const safeZones = Array.isArray(zones) ? zones : [];
  const protectedAreaM2 = Math.max(
    safeZones.reduce((sum, zone) => sum + Math.max(toNumber(zone.areaM2, zone.area), 0), 0),
    1
  );

  return safeZones.map((zone) => {
    const areaM2 = Math.max(toNumber(zone.areaM2, zone.area), 0);
    const floors = Math.max(toNumber(zone.floors, 1), 1);
    const zoneType = zone.zoneType || zone.type || "office";
    const zoneProfile = getZoneProfile(zoneType);
    const matrixRule = getZoneSystemMatrixRule(objectType, zoneType, systemType);

    const floorComplexityFactor = clamp(1 + (floors - 1) * 0.035, 1, 1.8);
    const effectiveInstallationComplexity = clamp(
      matrixRule.installationComplexityCoefficient * zoneProfile.installationComplexity * floorComplexityFactor,
      0.75,
      2.6
    );
    const effectiveRouteComplexity = clamp(
      matrixRule.routeComplexityCoefficient * zoneProfile.routeComplexity,
      0.7,
      2.8
    );

    return {
      id: zone.id,
      zoneName: zone.zoneName || zone.name || `Зона ${zone.id}`,
      zoneType,
      areaM2,
      floors,
      sharePercent: (areaM2 / protectedAreaM2) * 100,
      occupancyDensity: zoneProfile.occupancyDensity,
      hiddenRoutingShare: zoneProfile.hiddenRoutingShare,
      systemRule: {
        ...matrixRule,
        installationComplexityCoefficient: effectiveInstallationComplexity,
        routeComplexityCoefficient: effectiveRouteComplexity,
      },
    };
  });
}
