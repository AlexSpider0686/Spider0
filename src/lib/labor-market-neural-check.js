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
  const hiddenA = relu(features.overrideGap * 1.35 + features.cableDensity * 0.72 + features.conditionSpread * 0.64 - 1.05);
  const hiddenB = relu(features.controllerDensity * 1.12 + features.knsShare * 0.84 + features.regionSpread * 0.78 - 0.92);
  const hiddenC = relu(features.projectMode * 0.94 + features.markerPressure * 0.66 + features.marketGap * 1.18 - 0.88);
  return sigmoid(hiddenA * 1.12 + hiddenB * 0.96 + hiddenC * 1.28 + bias);
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
  const safeProjectBase = Math.max(toNumber(projectWorkBase, safeWorkBaseCandidate), 0);
  const safeMarketFloor = Math.max(toNumber(marketFloorBase, 0), 0);

  const features = {
    overrideGap: normalizeFeature(safeComputedBase / Math.max(safeProjectBase || safeComputedBase, 1), 1.18),
    cableDensity: normalizeFeature(cableLengthM, primaryUnits || safeMarkerUnits || 1, 18),
    controllerDensity: normalizeFeature(controllerUnits, safeMarkerUnits, 0.08),
    knsShare: normalizeFeature(knsLengthM, cableLengthM || 1, 0.7),
    conditionSpread: normalizeFeature(conditionFactor * exploitedFactor, 1.14),
    regionSpread: normalizeFeature(regionalFactor, 1.06),
    projectMode: projectMode ? 1 : 0,
    markerPressure: normalizeFeature(safeWorkBaseCandidate, safeMarkerUnits, guardrail.minFinalPerMarker / 2.2),
    marketGap: safeMarketFloor > 0 ? normalizeFeature(safeMarketFloor, safeWorkBaseCandidate, 1) : 0,
  };

  const underestimationRisk = runTinyNetwork(features, guardrail.riskBias || 0.15);
  const neuralUpliftMultiplier = clamp(1 + underestimationRisk * toNumber(guardrail.maxRiskUplift, 0.14), 1, 1.32);
  const neuralFloorBase = safeWorkBaseCandidate * neuralUpliftMultiplier;

  return {
    underestimationRisk,
    neuralUpliftMultiplier,
    neuralFloorBase,
    features,
  };
}
