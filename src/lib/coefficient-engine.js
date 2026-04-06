import { WORK_CONDITION_COEFFICIENTS } from "../config/costModelConfig";
import { toNumber } from "./estimate";
import { getExploitedBuildingCoefficient } from "./exploited-building-coefficient-engine";
import { resolveRegionalCoefficient } from "./regional-coefficient-engine";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveAppliedFactor(inputValue, sharePercent) {
  const normalizedShare = clamp(toNumber(sharePercent, 100), 0, 100) / 100;
  return 1 + (inputValue - 1) * normalizedShare;
}

function buildConditionRows(budget = {}, buildingStatus) {
  return WORK_CONDITION_COEFFICIENTS.map((item) => {
    const inputValue = toNumber(budget[item.key], 1);
    const sharePercent = item.shareKey ? clamp(toNumber(budget[item.shareKey], 100), 0, 100) : 100;

    // Do not double count the operational building factor when the automatic layer is already active.
    const directValue =
      buildingStatus === "operational" && item.key === "operatingFacilityCoef"
        ? 1
        : clamp(inputValue, 0.7, item.max || 2);

    const normalizedValue = item.shareKey ? resolveAppliedFactor(directValue, sharePercent) : directValue;

    return {
      key: item.key,
      label: item.label,
      inputValue,
      directValue,
      value: normalizedValue,
      shareKey: item.shareKey || null,
      sharePercent,
      wasSuppressed: normalizedValue !== inputValue,
    };
  });
}

function aggregateConditionFactor(rows = []) {
  if (!rows.length) return { rawProduct: 1, factor: 1, dampening: 1, activeCount: 0 };
  const rawProduct = rows.reduce((acc, row) => acc * Math.max(toNumber(row.value, 1), 0.001), 1);
  const activeCount = rows.filter((row) => toNumber(row.value, 1) > 1.001).length;

  // Dampening prevents an unrealistic runaway total when several factors are stacked together.
  const dampening = activeCount <= 1 ? 1 : clamp(1 - (activeCount - 1) * 0.08, 0.62, 1);
  const factor = 1 + (rawProduct - 1) * dampening;

  return {
    rawProduct,
    factor: clamp(factor, 0.75, 3.2),
    dampening,
    activeCount,
  };
}

export function buildCoefficientLayer({ budget, buildingStatus, regionSubject, regionCoef }) {
  const conditionRows = buildConditionRows(budget, buildingStatus);
  const conditions = aggregateConditionFactor(conditionRows);
  const exploited = getExploitedBuildingCoefficient(buildingStatus);
  const regional = resolveRegionalCoefficient({ regionSubject, regionCoef });

  return {
    conditionRows,
    conditionLaborFactor: conditions.factor,
    conditionLaborFactorRaw: conditions.rawProduct,
    conditionDampening: conditions.dampening,
    activeConditionCount: conditions.activeCount,
    exploitedBuildingCoefficient: exploited.value,
    regionalCoefficient: regional.value,
    exploited,
    regional,
  };
}
