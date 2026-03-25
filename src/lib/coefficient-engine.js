import { WORK_CONDITION_COEFFICIENTS } from "../config/costModelConfig";
import { toNumber } from "./estimate";
import { getExploitedBuildingCoefficient } from "./exploited-building-coefficient-engine";
import { resolveRegionalCoefficient } from "./regional-coefficient-engine";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildConditionRows(budget = {}, buildingStatus) {
  return WORK_CONDITION_COEFFICIENTS.map((item) => {
    const inputValue = toNumber(budget[item.key], 1);
    // Защита от двойного учета: при действующем объекте explicit-coef operatingFacility не суммируем с auto 1.2.
    const normalizedValue =
      buildingStatus === "operational" && item.key === "operatingFacilityCoef"
        ? 1
        : clamp(inputValue, 0.7, item.max || 2);

    return {
      key: item.key,
      label: item.label,
      inputValue,
      value: normalizedValue,
      wasSuppressed: normalizedValue !== inputValue,
    };
  });
}

function aggregateConditionFactor(rows = []) {
  if (!rows.length) return { rawProduct: 1, factor: 1, dampening: 1, activeCount: 0 };
  const rawProduct = rows.reduce((acc, row) => acc * Math.max(toNumber(row.value, 1), 0.001), 1);
  const activeCount = rows.filter((row) => toNumber(row.value, 1) > 1.001).length;

  // Демпфирование убирает искусственное завышение при множественных коэффициентах.
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
