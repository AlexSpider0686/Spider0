import { ZONE_PRESETS } from "../config/zonesConfig";
import { DEFAULT_ZONE } from "../config/estimateConfig";
import { toNumber } from "./estimate";

export function buildZonesFromPreset(presetKey, totalArea) {
  const preset = ZONE_PRESETS[presetKey];
  if (!preset) return [];
  const safeTotalArea = Math.max(toNumber(totalArea), 0);

  return Object.entries(preset.distribution).map(([type, percent], index) =>
    DEFAULT_ZONE(Date.now() + index, `Зона: ${type}`, type, Math.round(safeTotalArea * (percent / 100)), 1)
  );
}

export function getZonePercentSum(zones, totalArea) {
  const safeTotal = Math.max(toNumber(totalArea), 0);
  if (safeTotal === 0) return 0;
  return zones.reduce((sum, zone) => sum + (toNumber(zone.area) / safeTotal) * 100, 0);
}

export function validateZoneDistribution(zones, totalArea) {
  const sum = getZonePercentSum(zones, totalArea);
  return {
    sum,
    isValid: Math.abs(sum - 100) < 0.2,
  };
}

export function normalizeZoneAreas(zones, totalArea) {
  const safeTotal = Math.max(toNumber(totalArea), 0);
  if (!zones.length || safeTotal <= 0) return zones;
  const currentTotal = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0);
  if (currentTotal <= 0) {
    const equal = Math.floor(safeTotal / zones.length);
    return zones.map((zone, idx) => ({
      ...zone,
      area: idx === zones.length - 1 ? safeTotal - equal * (zones.length - 1) : equal,
    }));
  }

  let remaining = safeTotal;
  return zones.map((zone, idx) => {
    if (idx === zones.length - 1) return { ...zone, area: Math.max(remaining, 0) };
    const normalized = Math.round((Math.max(toNumber(zone.area), 0) / currentTotal) * safeTotal);
    remaining -= normalized;
    return { ...zone, area: Math.max(normalized, 0) };
  });
}

export function rebalanceZoneAreasWithLocks(zones, changedZoneId, nextPercent, totalArea, lockedZoneIds = []) {
  const safeTotal = Math.max(toNumber(totalArea), 0);
  if (!zones.length || safeTotal <= 0) return zones;

  const locked = new Set(lockedZoneIds);
  if (locked.has(changedZoneId)) return zones;
  const changedPercent = Math.min(Math.max(toNumber(nextPercent), 0), 100);

  const zonePercents = zones.map((zone) => ({
    id: zone.id,
    percent: (Math.max(toNumber(zone.area), 0) / safeTotal) * 100,
  }));

  const lockedPercent = zonePercents
    .filter((zone) => zone.id !== changedZoneId && locked.has(zone.id))
    .reduce((sum, zone) => sum + zone.percent, 0);

  const adjustable = zonePercents.filter((zone) => zone.id !== changedZoneId && !locked.has(zone.id));
  const maxChangedPercent = Math.max(0, 100 - lockedPercent);
  const changedPercentEffective = adjustable.length === 0
    ? maxChangedPercent
    : Math.min(changedPercent, maxChangedPercent);
  const available = Math.max(0, 100 - changedPercentEffective - lockedPercent);

  const nextPercents = new Map();
  nextPercents.set(changedZoneId, changedPercentEffective);

  const adjustableTotal = adjustable.reduce((sum, zone) => sum + zone.percent, 0);
  adjustable.forEach((zone) => {
    const next = adjustableTotal > 0 ? (zone.percent / adjustableTotal) * available : available / Math.max(adjustable.length, 1);
    nextPercents.set(zone.id, next);
  });

  zonePercents
    .filter((zone) => locked.has(zone.id) && zone.id !== changedZoneId)
    .forEach((zone) => nextPercents.set(zone.id, zone.percent));

  let remaining = safeTotal;
  const areas = new Map();
  zones.forEach((zone, idx) => {
    if (idx === zones.length - 1) {
      areas.set(zone.id, Math.max(remaining, 0));
      return;
    }
    const area = Math.max(Math.round(((nextPercents.get(zone.id) || 0) / 100) * safeTotal), 0);
    remaining -= area;
    areas.set(zone.id, area);
  });

  return zones.map((zone) => ({ ...zone, area: areas.get(zone.id) || 0 }));
}
