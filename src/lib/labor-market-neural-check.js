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

function runTinyNetwork(features, bias) {
  const hiddenA = relu(features.overrideGap * 1.1 + features.cableDensity * 0.68 + features.conditionSpread * 0.52 - 0.96);
  const hiddenB = relu(features.controllerDensity * 1.04 + features.knsShare * 0.82 + features.regionSpread * 0.66 - 0.88);
  const hiddenC = relu(features.projectMode * 0.78 + features.markerPressure * 0.84 + features.marketGap * 1.24 - 0.84);
  return sigmoid(hiddenA * 1.08 + hiddenB * 0.94 + hiddenC * 1.22 + bias);
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
}) {
  const guardrail = getGuardrail(systemType);
  const safeMarkerUnits = Math.max(toNumber(markerUnits, 0), 1);
  const safeComputedBase = Math.max(toNumber(computedWorkBase, 0), 1);
  const safeWorkBaseCandidate = Math.max(toNumber(workBaseCandidate, 0), 1);
  const safeProjectBase = Math.max(toNumber(projectWorkBase, safeWorkBaseCandidate), 1);
  const safeMarketFloor = Math.max(toNumber(marketFloorBase, 0), 1);

  const targetBase = Math.max((safeComputedBase + safeMarketFloor) / 2, safeComputedBase);
  const candidateToTargetRatio = safeWorkBaseCandidate / targetBase;
  const underestimationRisk = sigmoid((1 - candidateToTargetRatio) * 5.2);
  const overestimationRisk = sigmoid((candidateToTargetRatio - 1.12) * 4.8);
  const imbalanceRisk = Math.max(underestimationRisk, overestimationRisk);

  const features = {
    overrideGap: normalizeFeature(safeComputedBase / safeProjectBase, 1.18),
    cableDensity: normalizeFeature(cableLengthM, primaryUnits || safeMarkerUnits || 1, 18),
    controllerDensity: normalizeFeature(controllerUnits, safeMarkerUnits, 0.08),
    knsShare: normalizeFeature(knsLengthM, cableLengthM || 1, 0.7),
    conditionSpread: normalizeFeature(conditionFactor * exploitedFactor, 1.14),
    regionSpread: normalizeFeature(regionalFactor, 1.06),
    projectMode: projectMode ? 1 : 0,
    markerPressure: normalizeFeature(targetBase, safeMarkerUnits, guardrail.minFinalPerMarker / 2.2),
    marketGap: normalizeFeature(safeMarketFloor, safeWorkBaseCandidate, 1),
  };

  const networkSignal = runTinyNetwork(features, guardrail.riskBias || 0.15);
  const conservativeBalanceBase = Math.max(targetBase, safeWorkBaseCandidate);
  const balancedCorrection =
    underestimationRisk >= overestimationRisk
      ? clamp(1 + Math.max(networkSignal, underestimationRisk) * toNumber(guardrail.maxRiskUplift, 0.14), 1, 1.32)
      : clamp(1 - overestimationRisk * 0.08, 0.88, 1);
  const balancedBase = conservativeBalanceBase * balancedCorrection;
  const neuralFloorBase = Math.max(safeComputedBase, Math.min(Math.max(balancedBase, safeMarketFloor), safeWorkBaseCandidate * 1.32));

  return {
    targetBase,
    underestimationRisk,
    overestimationRisk,
    imbalanceRisk,
    balanceDirection: underestimationRisk >= overestimationRisk ? "raise" : "lower",
    balancedCorrection,
    neuralUpliftMultiplier: balancedCorrection,
    neuralFloorBase,
    features,
  };
}
