import { calculateTotals } from "./estimate";
import { calculateSystemWithBreakdown } from "./systemCalculators/index.js";

export function calculateEstimateEngine(systems, zones, budget, objectData) {
  const systemsDetailed = systems.map((system) => calculateSystemWithBreakdown(system, zones, budget, objectData));
  const totals = calculateTotals(systemsDetailed);
  return {
    systemsDetailed,
    totals,
  };
}

export function buildHowCalculated(systemResult) {
  if (!systemResult?.breakdown) return [];
  const equipmentLines = systemResult.breakdown.equipment.map(
    (item) => `${item.label}: ${Math.round(item.cost).toLocaleString("ru-RU")} ₽`
  );
  const formulaLines = (systemResult.formulaRows || []).map(
    (item) => `${item.label}: x${Number(item.value || 0).toFixed(2)}`
  );
  return [...systemResult.explanation, ...formulaLines, ...equipmentLines];
}
