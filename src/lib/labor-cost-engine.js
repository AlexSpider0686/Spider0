import { LABOR_MARKET_GUARDRAILS, LABOR_UNIT_RATES } from "../config/costModelConfig";
import { toNumber } from "./estimate";
import { buildLaborMarketNeuralCheck } from "./labor-market-neural-check";

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

function calcDesignCharges(baseValue, budget) {
  const durationFactor = clamp(toNumber(budget.designDurationFactor, 1), 0.75, 1.8);
  const overhead = baseValue * pct(budget.overheadPercent) * 0.52 * durationFactor;
  const payrollTaxes = baseValue * pct(budget.payrollTaxesPercent);
  const adminBase = baseValue + overhead + payrollTaxes;
  const admin = adminBase * pct(budget.adminPercent) * 0.34;
  const profitability = baseValue * pct(budget.profitabilityPercent) * 0.48;

  return {
    overhead,
    payrollTaxes,
    utilization: 0,
    ppe: 0,
    admin,
    profitability,
    total: overhead + admin + payrollTaxes + profitability,
  };
}

function calculateWorkTotals(baseValue, conditionFactor, exploitedFactor, regionalFactor, budget) {
  const workAfterConditions = baseValue * conditionFactor * exploitedFactor;
  const workChargesBeforeRegion = calcCharges(workAfterConditions, budget);
  const workTotalBeforeRegion = workAfterConditions + workChargesBeforeRegion.total;
  const workTotal = workTotalBeforeRegion * regionalFactor;

  return {
    workAfterConditions,
    workChargesBeforeRegion,
    workTotalBeforeRegion,
    workTotal,
  };
}

function estimateExecutionSchedule(executionHours) {
  const hours = Math.max(toNumber(executionHours, 0), 0);
  const crewSize = clamp(Math.ceil(hours / 180), 2, 18);
  const executionDays = Math.max(1, Math.ceil(hours / Math.max(crewSize * 8, 1)));
  const executionMonths = Math.max(1, Math.ceil(executionDays / 22));

  return { crewSize, executionDays, executionMonths };
}

function buildDesignStaffingPlan(designHours, designTeamOverride = null) {
  const hours = Math.max(toNumber(designHours, 0), 0);
  const designerMonthCapacity = 152;
  const effortMonths = hours / Math.max(designerMonthCapacity, 1);
  const recommendedTeamSize = clamp(Math.ceil(effortMonths), 1, 6);
  const hasExplicitOverride =
    designTeamOverride !== null &&
    designTeamOverride !== undefined &&
    designTeamOverride !== "" &&
    Number.isFinite(Number(designTeamOverride));
  const teamSize = clamp(hasExplicitOverride ? Math.round(Number(designTeamOverride)) : recommendedTeamSize, 1, 8);
  const teamRatio = teamSize / Math.max(recommendedTeamSize, 1);
  const coordinationFactor =
    teamSize === 1
      ? 0.96
      : clamp(
          1 +
            Math.max(teamSize - 1, 0) * 0.055 +
            Math.max(teamSize - recommendedTeamSize, 0) * 0.03 -
            Math.max(recommendedTeamSize - teamSize, 0) * 0.015,
          0.94,
          1.24
        );
  const throughputFactor =
    teamSize === 1
      ? 0.9
      : clamp(
          1 -
            Math.max(teamSize - 1, 0) * 0.045 -
            Math.max(teamSize - recommendedTeamSize, 0) * 0.02 -
            Math.max(recommendedTeamSize - teamSize, 0) * 0.03,
          0.7,
          1
        );
  const effectiveMonthlyCapacity = Math.max(teamSize * designerMonthCapacity * throughputFactor, 68);
  const designMonthsExact = hours / effectiveMonthlyCapacity;
  const designMonths = Math.max(1, Math.ceil(designMonthsExact));

  return {
    recommendedTeamSize,
    teamSize,
    effortMonths,
    designMonthsExact,
    designMonths,
    teamRatio,
    coordinationFactor,
    throughputFactor,
    effectiveMonthlyCapacity,
  };
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
  designTeamOverride = null,
  projectMode = false,
  skipDesignPricing = false,
}) {
  const rates = LABOR_UNIT_RATES[systemType] || LABOR_UNIT_RATES.sot;
  const primaryUnits = Math.max(toNumber(quantities?.primaryUnits, 0), 0);
  const controllerUnits = Math.max(toNumber(quantities?.controllerUnits, 0), 0);
  const activeElements = Math.max(toNumber(quantities?.activeElements, primaryUnits + controllerUnits), 0);
  const integrationPoints = Math.max(toNumber(quantities?.integrationPoints, 0), 0);
  const managementServerCount = Math.max(toNumber(quantities?.secondary?.managementPlan?.serverCount, quantities?.secondary?.servers), 0);
  const armCount = Math.max(toNumber(quantities?.secondary?.managementPlan?.armCount, quantities?.secondary?.arms), 0);
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
  const projectWorkBase =
    workBaseOverride === null || workBaseOverride === undefined || workBaseOverride === ""
      ? Math.max(computedWorkBase, 0)
      : Math.max(toNumber(workBaseOverride, computedWorkBase), computedWorkBase, 0);

  const conditionFactor = Math.max(toNumber(coefficientLayer.conditionLaborFactor, 1), 0.5);
  const exploitedFactor = Math.max(toNumber(coefficientLayer.exploitedBuildingCoefficient, 1), 0.5);
  const regionalFactor = Math.max(toNumber(coefficientLayer.regionalCoefficient, 1), 0.5);
  const baseWorkMetrics = calculateWorkTotals(1, conditionFactor, exploitedFactor, regionalFactor, budget);
  const workTotalMultiplier = Math.max(baseWorkMetrics.workTotal, 0.0001);
  const markerUnits = Math.max(toNumber(quantities?.markerUnits, primaryUnits), 1);
  const marketGuardrail = LABOR_MARKET_GUARDRAILS[systemType] || LABOR_MARKET_GUARDRAILS.sot;
  const marketFloorBaseByRates = computedWorkBase * Math.max(toNumber(marketGuardrail.minBaseFactor, 1), 1);
  const marketFloorTotal =
    markerUnits *
    Math.max(toNumber(marketGuardrail.minFinalPerMarker, 0), 0) *
    Math.max(conditionFactor * exploitedFactor, 1) *
    Math.max(regionalFactor, 1);
  const marketFloorBaseByMarker = marketFloorTotal / workTotalMultiplier;
  const marketFloorBase = Math.max(marketFloorBaseByRates, marketFloorBaseByMarker, computedWorkBase);
  const neuralCheck = buildLaborMarketNeuralCheck({
    systemType,
    workBaseCandidate: projectWorkBase,
    projectWorkBase,
    computedWorkBase,
    markerUnits,
    primaryUnits,
    controllerUnits,
    cableLengthM,
    knsLengthM,
    conditionFactor,
    exploitedFactor,
    regionalFactor,
    projectMode,
    marketFloorBase,
    integrationPoints,
    managementServerCount,
    armCount,
  });
  const workBase = clamp(
    Math.max(neuralCheck.neuralFloorBase, computedWorkBase),
    computedWorkBase,
    Math.max(projectWorkBase, marketFloorBase, computedWorkBase) * 1.32
  );
  const { workAfterConditions, workChargesBeforeRegion, workTotalBeforeRegion, workTotal } = calculateWorkTotals(
    workBase,
    conditionFactor,
    exploitedFactor,
    regionalFactor,
    budget
  );

  const safeDesignHours = skipDesignPricing
    ? 0
    : designHoursOverride === null || designHoursOverride === undefined || designHoursOverride === ""
      ? Math.max(toNumber(designHours, 0), 0)
      : Math.max(toNumber(designHoursOverride, designHours), 0);
  const designRate = toNumber(rates.designHour, 2100);
  const designNormativeComplexity =
    1 +
    Math.max(toNumber(designComplexityFactor, 1) - 1, 0) * 0.62 +
    Math.max(managementServerCount - 1, 0) * 0.035 +
    Math.max(integrationPoints - 4, 0) * 0.008 +
    Math.max(controllerUnits / Math.max(markerUnits, 1) - 0.12, 0) * 0.12;
  const designStaffingPlan = skipDesignPricing ? buildDesignStaffingPlan(0, 0) : buildDesignStaffingPlan(safeDesignHours, designTeamOverride);
  const normalizedDesignRate = designRate * 0.96;
  const designDurationFactor =
    skipDesignPricing || designStaffingPlan.designMonthsExact <= 0
      ? 1
      : clamp(0.88 + designStaffingPlan.designMonthsExact * 0.08 + designStaffingPlan.teamSize * 0.03, 0.9, 1.28);
  const designBase =
    skipDesignPricing
      ? 0
      : safeDesignHours * normalizedDesignRate * Math.max(designNormativeComplexity, 0.88) * designStaffingPlan.coordinationFactor;
  const designAfterConditions = designBase;
  const designChargesBeforeRegion = skipDesignPricing
    ? calcDesignCharges(0, budget)
    : calcDesignCharges(designBase, {
        ...budget,
        designDurationFactor,
      });
  const designTotalBeforeRegion = skipDesignPricing ? 0 : designBase + designChargesBeforeRegion.total;
  const designTotal = skipDesignPricing ? 0 : designTotalBeforeRegion * regionalFactor;

  const computedExecutionHours =
    primaryUnits * 0.3 + controllerUnits * 0.65 + cableLengthM * 0.015 + integrationPoints * 0.55 + knsWorkUnits * 0.1;
  const safeExecutionHours =
    executionHoursOverride === null || executionHoursOverride === undefined || executionHoursOverride === ""
      ? Math.max(computedExecutionHours, 0)
      : Math.max(toNumber(executionHoursOverride, computedExecutionHours), 0);
  const workSchedule = estimateExecutionSchedule(safeExecutionHours);
  const designSchedule = skipDesignPricing
    ? {
        recommendedTeamSize: 0,
        teamSize: 0,
        designMonths: 0,
        teamRatio: 0,
        coordinationFactor: 0,
        throughputFactor: 0,
      }
    : designStaffingPlan;

  const markerCostPerUnit = workTotal / markerUnits;

  return {
    workBase,
    projectWorkBase,
    marketFloorBase,
    workAfterConditions,
    workChargesBeforeRegion,
    workTotalBeforeRegion,
    workTotal,
    chargePercents: {
      overhead: toNumber(budget?.overheadPercent, 0),
      payrollTaxes: toNumber(budget?.payrollTaxesPercent, 0),
      utilization: toNumber(budget?.utilizationPercent, 0),
      ppe: toNumber(budget?.ppePercent, 0),
      admin: toNumber(budget?.adminPercent, 0),
    },
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
      projectWorkBase,
      marketFloorBase,
      primaryUnits,
      controllerUnits,
      activeElements,
      integrationPoints,
      managementServerCount,
      armCount,
      cableLengthM,
      knsLengthM,
      knsWorkUnits,
      conditionFactor,
      exploitedFactor,
      regionalFactor,
    },
    marketGuard: {
      minBaseFactor: toNumber(marketGuardrail.minBaseFactor, 1),
      minFinalPerMarker: toNumber(marketGuardrail.minFinalPerMarker, 0),
      marketFloorBaseByRates,
      marketFloorBaseByMarker,
      marketFloorTotal,
    },
    neuralCheck,
    modelSource: {
      unitRatesConfig: "Внутренняя модель единичных ставок по видам работ: монтаж, ПНР, кабельные линии, КНС, интеграция и проектирование.",
      marketGuardConfig: "Внутренняя модель защитных порогов по трудовой части: минимальная база работ по системе и минимальный итог по маркеру трудоемкости.",
      scheduleCalibration:
        projectMode
          ? "APS PDF: трудоемкость и состав работ калибруются по распознанной проектной спецификации"
          : "Пресейл: трудоемкость и состав работ рассчитываются по модели плотностей, зон и трасс",
    },
    designHours: safeDesignHours,
    designBase,
    designAfterConditions,
    designChargesBeforeRegion,
    designTotalBeforeRegion,
    designTotal,
    designRecommendedTeamSize: designSchedule.recommendedTeamSize,
    designStaffingRatio: designSchedule.teamRatio,
    designCoordinationFactor: designSchedule.coordinationFactor,
    designThroughputFactor: designSchedule.throughputFactor,
    designEffortMonths: designSchedule.effortMonths,
    designDurationFactor,
    designMonthsExact: designSchedule.designMonthsExact,
    designEffectiveMonthlyCapacity: designSchedule.effectiveMonthlyCapacity,
    markerUnits,
    markerCostPerUnit,
    executionHours: safeExecutionHours,
    ...workSchedule,
    ...designSchedule,
  };
}
