import { LABOR_UNIT_RATES } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return Math.max(toNumber(value, 0), 0) / 100;
}

function calcCharges(baseValue, budget) {
  const overhead = baseValue * pct(budget.overheadPercent);
  const payrollTaxes = baseValue * pct(budget.payrollTaxesPercent);
  const utilization = baseValue * pct(budget.utilizationPercent);
  const ppe = baseValue * pct(budget.ppePercent);
  const adminBase = baseValue + overhead + payrollTaxes + utilization + ppe;
  const admin = adminBase * pct(budget.adminPercent);

  return {
    overhead,
    payrollTaxes,
    utilization,
    ppe,
    admin,
    total: overhead + payrollTaxes + utilization + ppe + admin,
  };
}

function estimateExecutionSchedule(executionHours) {
  const hours = Math.max(toNumber(executionHours, 0), 0);
  const crewSize = clamp(Math.ceil(hours / 180), 2, 18);
  const executionDays = Math.max(1, Math.ceil(hours / Math.max(crewSize * 8, 1)));
  const executionMonths = Math.max(1, Math.ceil(executionDays / 22));

  return { crewSize, executionDays, executionMonths };
}

function estimateDesignSchedule(designHours) {
  const hours = Math.max(toNumber(designHours, 0), 0);
  const teamSize = clamp(Math.ceil(hours / 150), 1, 6);
  const designMonths = Math.max(1, Math.ceil(hours / Math.max(teamSize * 150, 1)));

  return { teamSize, designMonths };
}

export function calculateLaborCost({
  systemType,
  quantities,
  cableModel,
  knsModel,
  budget,
  coefficientLayer,
  designHours,
  designComplexityFactor = 1,
  workBaseOverride = null,
  executionHoursOverride = null,
  designHoursOverride = null,
}) {
  const rates = LABOR_UNIT_RATES[systemType] || LABOR_UNIT_RATES.sot;
  const primaryUnits = Math.max(toNumber(quantities?.primaryUnits, 0), 0);
  const controllerUnits = Math.max(toNumber(quantities?.controllerUnits, 0), 0);
  const activeElements = Math.max(toNumber(quantities?.activeElements, primaryUnits + controllerUnits), 0);
  const integrationPoints = Math.max(toNumber(quantities?.integrationPoints, 0), 0);
  const cableLengthM = Math.max(toNumber(cableModel?.cableLengthM, 0), 0);
  const knsLengthM = Math.max(toNumber(knsModel?.knsLengthM, 0), 0);
  const knsWorkUnits = Math.max(toNumber(knsModel?.knsWorkUnits, 0), 0);

  const smrBase =
    primaryUnits * toNumber(rates.mountPrimary, 0) +
    controllerUnits * toNumber(rates.controllerMount, 0) +
    cableLengthM * toNumber(rates.cablePerMeter, 0);
  const pnrBase = primaryUnits * toNumber(rates.pnrPrimary, 0) + activeElements * toNumber(rates.pnrActiveElement, 0);
  const integrationBase = integrationPoints * toNumber(rates.integrationPoint, 0);
  const knsBase = knsLengthM * toNumber(rates.knsPerMeter, 0) + knsWorkUnits * toNumber(rates.knsPerMeter, 0) * 0.22;
  const computedWorkBase = smrBase + pnrBase + integrationBase + knsBase;
  const workBase =
    workBaseOverride === null || workBaseOverride === undefined || workBaseOverride === ""
      ? Math.max(computedWorkBase, 0)
      : Math.max(toNumber(workBaseOverride, computedWorkBase), 0);

  const conditionFactor = Math.max(toNumber(coefficientLayer.conditionLaborFactor, 1), 0.5);
  const exploitedFactor = Math.max(toNumber(coefficientLayer.exploitedBuildingCoefficient, 1), 0.5);
  const regionalFactor = Math.max(toNumber(coefficientLayer.regionalCoefficient, 1), 0.5);
  const workAfterConditions = workBase * conditionFactor * exploitedFactor;
  const workChargesBeforeRegion = calcCharges(workAfterConditions, budget);
  const workTotalBeforeRegion = workAfterConditions + workChargesBeforeRegion.total;
  const workTotal = workTotalBeforeRegion * regionalFactor;

  const safeDesignHours =
    designHoursOverride === null || designHoursOverride === undefined || designHoursOverride === ""
      ? Math.max(toNumber(designHours, 0), 0)
      : Math.max(toNumber(designHoursOverride, designHours), 0);
  const designRate = toNumber(rates.designHour, 2100);
  const designConditionFactor = 1 + (conditionFactor - 1) * 0.35;
  const designBase = safeDesignHours * designRate * Math.max(toNumber(designComplexityFactor, 1), 0.8);
  const designAfterConditions = designBase * designConditionFactor * exploitedFactor;
  const designChargesBeforeRegion = calcCharges(designAfterConditions, budget);
  const designTotalBeforeRegion = designAfterConditions + designChargesBeforeRegion.total;
  const designTotal = designTotalBeforeRegion * regionalFactor;

  const computedExecutionHours =
    primaryUnits * 0.3 + controllerUnits * 0.65 + cableLengthM * 0.015 + integrationPoints * 0.55 + knsWorkUnits * 0.1;
  const safeExecutionHours =
    executionHoursOverride === null || executionHoursOverride === undefined || executionHoursOverride === ""
      ? Math.max(computedExecutionHours, 0)
      : Math.max(toNumber(executionHoursOverride, computedExecutionHours), 0);
  const workSchedule = estimateExecutionSchedule(safeExecutionHours);
  const designSchedule = estimateDesignSchedule(safeDesignHours);

  const markerUnits = Math.max(toNumber(quantities?.markerUnits, primaryUnits), 1);
  const markerCostPerUnit = workTotal / markerUnits;

  return {
    workBase,
    workAfterConditions,
    workChargesBeforeRegion,
    workTotalBeforeRegion,
    workTotal,
    unitRates: {
      mountPrimary: toNumber(rates.mountPrimary, 0),
      pnrPrimary: toNumber(rates.pnrPrimary, 0),
      controllerMount: toNumber(rates.controllerMount, 0),
      pnrActiveElement: toNumber(rates.pnrActiveElement, 0),
      cablePerMeter: toNumber(rates.cablePerMeter, 0),
      knsPerMeter: toNumber(rates.knsPerMeter, 0),
      integrationPoint: toNumber(rates.integrationPoint, 0),
      designHour: toNumber(rates.designHour, 0),
    },
    workBreakdown: {
      smrBase,
      pnrBase,
      integrationBase,
      knsBase,
      computedWorkBase,
      primaryUnits,
      controllerUnits,
      activeElements,
      integrationPoints,
      cableLengthM,
      knsLengthM,
      knsWorkUnits,
      conditionFactor,
      exploitedFactor,
      regionalFactor,
    },
    designHours: safeDesignHours,
    designBase,
    designAfterConditions,
    designChargesBeforeRegion,
    designTotalBeforeRegion,
    designTotal,
    markerUnits,
    markerCostPerUnit,
    executionHours: safeExecutionHours,
    ...workSchedule,
    ...designSchedule,
  };
}
