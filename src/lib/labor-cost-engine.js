import { LABOR_MARKET_GUARDRAILS, LABOR_UNIT_RATES } from "../config/costModelConfig";
import { toNumber } from "./estimate";
import { buildLaborMarketNeuralCheck } from "./labor-market-neural-check";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return Math.max(toNumber(value, 0), 0) / 100;
}

function round1(value) {
  return Number(toNumber(value, 0).toFixed(1));
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

function splitHeadcount(roles, targetHeadcount) {
  const activeRoles = roles.filter((item) => item.enabled !== false);
  if (!activeRoles.length) return [];

  const safeTarget = Math.max(Math.round(toNumber(targetHeadcount, 0)), 0);
  const minRequired = activeRoles.reduce((total, role) => total + Math.max(Math.round(toNumber(role.minCount, 0)), 0), 0);
  let remaining = Math.max(safeTarget, minRequired) - minRequired;

  const normalized = activeRoles.map((role) => ({
    ...role,
    count: Math.max(Math.round(toNumber(role.minCount, 0)), 0),
    weight: Math.max(toNumber(role.weight, 0), 0),
  }));

  const weightTotal = normalized.reduce((total, role) => total + role.weight, 0) || 1;

  normalized.forEach((role, index) => {
    if (remaining <= 0) return;
    const hardCap = Math.max(Math.round(toNumber(role.maxCount, safeTarget || 1)), role.count);
    const suggested =
      index === normalized.length - 1 ? remaining : Math.max(0, Math.round((remaining * role.weight) / weightTotal));
    const extra = clamp(suggested, 0, Math.max(hardCap - role.count, 0));
    role.count += extra;
    remaining -= extra;
  });

  while (remaining > 0) {
    const nextRole =
      normalized
        .filter((role) => role.count < Math.max(Math.round(toNumber(role.maxCount, safeTarget || 1)), role.count))
        .sort((left, right) => right.weight - left.weight)[0] || null;
    if (!nextRole) break;
    nextRole.count += 1;
    remaining -= 1;
  }

  return normalized.filter((role) => role.count > 0);
}

function buildExecutionStaffingPlan({
  executionHours,
  cableLengthM,
  integrationPoints,
  controllerUnits,
  primaryUnits,
  routeComplexity = 1,
  executionRoleOverrides = {},
}) {
  const hours = Math.max(toNumber(executionHours, 0), 0);
  if (hours <= 0) {
    return {
      recommendedTeamSize: 0,
      teamSize: 0,
      executionDaysExact: 0,
      executionDays: 0,
      executionMonths: 0,
      teamRatio: 0,
      throughputFactor: 0,
      staffingCostFactor: 1,
      weightedCostIndex: 0,
      effectiveDailyCapacity: 0,
      productiveHoursPerPersonDay: 0,
      recommendedRoles: [],
      roles: [],
    };
  }

  const complexityFactor =
    1 +
    Math.max(toNumber(routeComplexity, 1) - 1, 0) * 0.18 +
    Math.min(integrationPoints / 40, 0.2) +
    Math.min(controllerUnits / 60, 0.16) +
    Math.min(cableLengthM / 6000, 0.14);
  const recommendedTeamSize = clamp(Math.ceil((hours / 165) * complexityFactor), 2, 18);

  const roleDefinitions = [
    {
      role: "foreman",
      label: "Прораб",
      minCount: 1,
      maxCount: 2,
      weight: 1.05 + Math.min(integrationPoints / 40, 0.45),
      productivity: 4.6,
      costRate: 1.45,
    },
    {
      role: "leadInstaller",
      label: "Старший монтажник",
      minCount: recommendedTeamSize >= 4 ? 1 : 0,
      maxCount: 2,
      weight: 0.9 + Math.min(primaryUnits / 300, 0.6),
      productivity: 6,
      costRate: 1.22,
    },
    {
      role: "installer",
      label: "Монтажник",
      minCount: 1,
      maxCount: Math.max(recommendedTeamSize, 1),
      weight: 2 + Math.max(toNumber(routeComplexity, 1) - 1, 0) * 1.9,
      productivity: 6.8,
      costRate: 1,
    },
    {
      role: "cableInstaller",
      label: "Кабельщик/трассировщик",
      minCount: recommendedTeamSize >= 5 || cableLengthM > 1800 ? 1 : 0,
      maxCount: Math.max(Math.ceil(recommendedTeamSize / 2), 1),
      weight: 0.8 + Math.min(cableLengthM / 2400, 1.6),
      productivity: 6.5,
      costRate: 1.08,
    },
    {
      role: "commissioning",
      label: "Инженер ПНР",
      minCount: integrationPoints > 0 || controllerUnits > 0 ? 1 : 0,
      maxCount: 3,
      weight: 0.95 + Math.min((integrationPoints + controllerUnits) / 25, 1.5),
      productivity: 5.8,
      costRate: 1.38,
    },
  ];

  const recommendedRoles = splitHeadcount(roleDefinitions, recommendedTeamSize);
  const recommendedRoleMap = new Map(recommendedRoles.map((role) => [role.role, role]));
  const roles = roleDefinitions
    .map((definition) => {
      const recommended = recommendedRoleMap.get(definition.role);
      const rawOverride = executionRoleOverrides?.[definition.role];
      const hasOverride = rawOverride !== null && rawOverride !== undefined && rawOverride !== "" && Number.isFinite(Number(rawOverride));
      const recommendedCount = Math.max(Math.round(toNumber(recommended?.count, definition.minCount)), 0);
      const count = clamp(
        hasOverride ? Math.round(Number(rawOverride)) : recommendedCount,
        0,
        Math.max(Math.round(toNumber(definition.maxCount, recommendedTeamSize || 1)), recommendedCount, 1)
      );

      return {
        role: definition.role,
        label: definition.label,
        count,
        recommendedCount,
        productivity: definition.productivity,
        costRate: definition.costRate,
      };
    })
    .filter((role) => role.count > 0);

  const teamSize = Math.max(roles.reduce((total, role) => total + role.count, 0), 1);
  const recommendedWeightedCost =
    recommendedRoles.reduce((total, role) => total + role.count * toNumber(role.costRate, 1), 0) / Math.max(recommendedTeamSize, 1);
  const weightedCostIndex =
    roles.reduce((total, role) => total + role.count * role.costRate, 0) / Math.max(teamSize, 1) / Math.max(recommendedWeightedCost || 1, 0.001);
  const teamRatio = teamSize / Math.max(recommendedTeamSize, 1);
  const missingLeadPenalty = roles.some((role) => role.role === "leadInstaller") ? 0 : recommendedTeamSize >= 4 ? 0.07 : 0;
  const missingCommissioningPenalty =
    integrationPoints > 0 && !roles.some((role) => role.role === "commissioning") ? 0.12 : 0;
  const throughputFactor = clamp(
    1 -
      Math.max(teamSize - recommendedTeamSize, 0) * 0.02 -
      Math.max(recommendedTeamSize - teamSize, 0) * 0.03 -
      missingLeadPenalty -
      missingCommissioningPenalty,
    0.68,
    1.04
  );
  const effectiveDailyCapacity = Math.max(
    roles.reduce((total, role) => total + role.count * role.productivity, 0) * throughputFactor,
    1
  );
  const executionDaysExact = hours / effectiveDailyCapacity;
  const executionDays = Math.max(1, Math.ceil(executionDaysExact));
  const executionMonths = Math.max(1, Math.ceil(executionDays / 22));
  const productiveHoursPerPersonDay = effectiveDailyCapacity / Math.max(teamSize, 1);
  const staffingCostFactor = clamp(
    weightedCostIndex *
      (0.96 + Math.max(teamSize - 1, 0) * 0.024 + Math.max(teamSize - recommendedTeamSize, 0) * 0.028) *
      (1 + Math.max(1 - throughputFactor, 0) * 0.55),
    0.9,
    1.42
  );

  return {
    recommendedTeamSize,
    teamSize,
    executionDaysExact,
    executionDays,
    executionMonths,
    teamRatio,
    throughputFactor,
    staffingCostFactor,
    weightedCostIndex,
    effectiveDailyCapacity,
    productiveHoursPerPersonDay,
    recommendedRoles: recommendedRoles.map((role) => ({
      role: role.role,
      label: role.label,
      count: role.count,
    })),
    roles: roles.map((role) => ({
      role: role.role,
      label: role.label,
      count: role.count,
      recommendedCount: role.recommendedCount,
    })),
  };
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
  const coordinationFactor = clamp(
    0.92 +
      Math.max(teamSize - 1, 0) * 0.05 +
      Math.max(teamSize - recommendedTeamSize, 0) * 0.045 -
      Math.max(recommendedTeamSize - teamSize, 0) * 0.018,
    0.88,
    1.26
  );
  const throughputFactor =
    teamSize === 1
      ? 0.84
      : clamp(
          1 -
            Math.max(teamSize - 1, 0) * 0.04 -
            Math.max(teamSize - recommendedTeamSize, 0) * 0.018 -
            Math.max(recommendedTeamSize - teamSize, 0) * 0.035,
          0.68,
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
  executionRoleOverrides = null,
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

  const computedExecutionHours =
    primaryUnits * 0.3 + controllerUnits * 0.65 + cableLengthM * 0.015 + integrationPoints * 0.55 + knsWorkUnits * 0.1;
  const safeExecutionHours =
    executionHoursOverride === null || executionHoursOverride === undefined || executionHoursOverride === ""
      ? Math.max(computedExecutionHours, 0)
      : Math.max(toNumber(executionHoursOverride, computedExecutionHours), 0);
  const executionStaffingPlan = buildExecutionStaffingPlan({
    executionHours: safeExecutionHours,
    cableLengthM,
    integrationPoints,
    controllerUnits,
    primaryUnits,
    routeComplexity: coefficientLayer?.conditionLaborFactorRaw || coefficientLayer?.conditionLaborFactor || 1,
    executionRoleOverrides,
  });
  const effectiveWorkBase = workBase * executionStaffingPlan.staffingCostFactor;
  const { workAfterConditions, workChargesBeforeRegion, workTotalBeforeRegion, workTotal } = calculateWorkTotals(
    effectiveWorkBase,
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
  const normalizedDesignRate = designRate * 0.91;
  const staffingCompressionFactor = skipDesignPricing
    ? 1
    : clamp(
        0.96 +
          Math.max(designStaffingPlan.teamSize - 1, 0) * 0.025 +
          Math.max(designStaffingPlan.teamSize - designStaffingPlan.recommendedTeamSize, 0) * 0.03,
        0.94,
        1.18
      );
  const designDurationFactor =
    skipDesignPricing || designStaffingPlan.designMonthsExact <= 0
      ? 1
      : clamp(0.9 + designStaffingPlan.designMonthsExact * 0.07 + designStaffingPlan.teamSize * 0.02, 0.92, 1.24);
  const designBase =
    skipDesignPricing
      ? 0
      : safeDesignHours *
        normalizedDesignRate *
        Math.max(designNormativeComplexity, 0.88) *
        designStaffingPlan.coordinationFactor *
        staffingCompressionFactor;
  const designAfterConditions = designBase;
  const designChargesBeforeRegion = skipDesignPricing
    ? calcDesignCharges(0, budget)
    : calcDesignCharges(designBase, {
        ...budget,
        designDurationFactor,
      });
  const designTotalBeforeRegion = skipDesignPricing ? 0 : designBase + designChargesBeforeRegion.total;
  const designTotal = skipDesignPricing ? 0 : designTotalBeforeRegion * regionalFactor;

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
    effectiveWorkBase,
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
      staffingCostFactor: executionStaffingPlan.staffingCostFactor,
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
    crewSize: executionStaffingPlan.teamSize,
    executionTeamSize: executionStaffingPlan.teamSize,
    executionRecommendedTeamSize: executionStaffingPlan.recommendedTeamSize,
    executionDays: executionStaffingPlan.executionDays,
    executionDaysExact: executionStaffingPlan.executionDaysExact,
    executionMonths: executionStaffingPlan.executionMonths,
    executionTeamRatio: executionStaffingPlan.teamRatio,
    executionThroughputFactor: executionStaffingPlan.throughputFactor,
    executionProductiveHoursPerPersonDay: round1(executionStaffingPlan.productiveHoursPerPersonDay),
    executionDailyCapacity: round1(executionStaffingPlan.effectiveDailyCapacity),
    executionStaffingCostFactor: executionStaffingPlan.staffingCostFactor,
    executionWeightedCostIndex: round1(executionStaffingPlan.weightedCostIndex),
    executionRoles: executionStaffingPlan.roles,
    executionRecommendedRoles: executionStaffingPlan.recommendedRoles,
    ...designSchedule,
  };
}
