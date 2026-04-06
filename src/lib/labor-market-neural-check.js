import { LABOR_MARKET_GUARDRAILS } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function relu(value) {
  return Math.max(value, 0);
}

function getGuardrail(systemType) {
  return LABOR_MARKET_GUARDRAILS[systemType] || LABOR_MARKET_GUARDRAILS.sot;
}

function normalizeFeature(value, divisor, min = 0, max = 3) {
  return clamp(toNumber(value, 0) / Math.max(divisor, 0.0001), min, max);
}

function runBalanceNetwork(features, bias) {
  const hiddenA = relu(features.overrideGap * 1.18 + features.cableDensity * 0.64 + features.conditionSpread * 0.48 - 0.92);
  const hiddenB = relu(features.controllerDensity * 1.06 + features.knsShare * 0.76 + features.serverLoad * 0.88 - 0.86);
  const hiddenC = relu(features.projectMode * 0.7 + features.markerPressure * 0.82 + features.marketGap * 1.16 - 0.8);
  const hiddenD = relu(features.integrationPressure * 1.02 + features.architecturePressure * 0.92 + features.quoteDeviation * 1.08 - 0.94);
  return sigmoid(hiddenA * 0.96 + hiddenB * 1.02 + hiddenC * 1.14 + hiddenD * 1.18 + bias);
}

export function buildLaborMarketNeuralCheck({
  systemType,
  workBaseCandidate,
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
  projectMode = false,
  marketFloorBase,
  integrationPoints = 0,
  managementServerCount = 0,
  armCount = 0,
}) {
  const guardrail = getGuardrail(systemType);
  const safeMarkerUnits = Math.max(toNumber(markerUnits, 0), 1);
  const safeComputedBase = Math.max(toNumber(computedWorkBase, 0), 1);
  const safeWorkBaseCandidate = Math.max(toNumber(workBaseCandidate, 0), 1);
  const safeProjectBase = Math.max(toNumber(projectWorkBase, safeWorkBaseCandidate), 1);
  const safeMarketFloor = Math.max(toNumber(marketFloorBase, 0), 1);
  const managementLoad = Math.max(toNumber(managementServerCount, 0), 0) + Math.max(toNumber(armCount, 0), 0) * 0.45;
  const dynamicComplexityBase =
    safeComputedBase *
    clamp(
      1 +
        normalizeFeature(controllerUnits + integrationPoints * 1.4, safeMarkerUnits, 0.2, 1.4) * 0.06 +
        normalizeFeature(managementLoad, safeMarkerUnits, 0.03, 1.2) * 0.08,
      1,
      1.18
    );
  const targetBase = Math.max((safeComputedBase + safeMarketFloor + dynamicComplexityBase) / 3, safeComputedBase);
  const candidateToTargetRatio = safeWorkBaseCandidate / targetBase;
  const quoteDeviation = Math.abs(candidateToTargetRatio - 1);
  const underestimationRisk = sigmoid((1 - candidateToTargetRatio) * 5.6 + normalizeFeature(managementLoad, safeMarkerUnits, 0.04, 1.2) * 0.5);
  const overestimationRisk = sigmoid((candidateToTargetRatio - 1.08) * 5.1 + normalizeFeature(quoteDeviation, 1, 0, 1.6) * 0.22);
  const imbalanceRisk = Math.max(underestimationRisk, overestimationRisk);

  const features = {
    overrideGap: normalizeFeature(safeComputedBase / safeProjectBase, 1.16),
    cableDensity: normalizeFeature(cableLengthM, primaryUnits || safeMarkerUnits || 1, 18),
    controllerDensity: normalizeFeature(controllerUnits, safeMarkerUnits, 0.08),
    knsShare: normalizeFeature(knsLengthM, cableLengthM || 1, 0.7),
    conditionSpread: normalizeFeature(conditionFactor * exploitedFactor, 1.14),
    regionSpread: normalizeFeature(regionalFactor, 1.06),
    projectMode: projectMode ? 1 : 0,
    markerPressure: normalizeFeature(targetBase, safeMarkerUnits, guardrail.minFinalPerMarker / 2.1),
    marketGap: normalizeFeature(safeMarketFloor, safeWorkBaseCandidate, 1),
    serverLoad: normalizeFeature(managementLoad, safeMarkerUnits, 0.04),
    integrationPressure: normalizeFeature(integrationPoints, safeMarkerUnits, 0.08),
    architecturePressure: normalizeFeature(controllerUnits + integrationPoints * 1.6, safeMarkerUnits, 0.22),
    quoteDeviation: normalizeFeature(quoteDeviation, 1, 0, 1.8),
  };

  const networkSignal = runBalanceNetwork(features, guardrail.riskBias || 0.15);
  const conservativeBalanceBase = Math.max(targetBase, safeWorkBaseCandidate);
  const balancedCorrection =
    underestimationRisk >= overestimationRisk
      ? clamp(1 + Math.max(networkSignal, underestimationRisk) * toNumber(guardrail.maxRiskUplift, 0.14), 1, 1.38)
      : clamp(1 - Math.max(networkSignal * 0.12, overestimationRisk * 0.16), 0.82, 1);
  const balancedBase = conservativeBalanceBase * balancedCorrection;
  const neuralFloorBase = Math.max(safeComputedBase, Math.min(Math.max(balancedBase, safeMarketFloor), safeWorkBaseCandidate * 1.38));
  const recommendation =
    underestimationRisk >= overestimationRisk
      ? "Усильте трудовую базу или коэффициенты сложных условий: нагрузка объекта выше текущей сметы."
      : "Проверьте завышенные коэффициенты и объемы: смета выше типового диапазона для объекта.";

  return {
    targetBase,
    underestimationRisk,
    overestimationRisk,
    imbalanceRisk,
    balanceDirection: underestimationRisk >= overestimationRisk ? "raise" : "lower",
    balancedCorrection,
    neuralUpliftMultiplier: balancedCorrection,
    neuralFloorBase,
    recommendation,
    features,
  };
}
