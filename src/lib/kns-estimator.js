import { KNS_MODEL_DEFAULTS } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function estimateKnsBySystem({ cableModel, routeComplexity = 1 }) {
  const cableLengthM = Math.max(toNumber(cableModel?.cableLengthM, 0), 0);
  const hiddenShare = clamp(toNumber(cableModel?.hiddenCableShare, 0.45), 0.08, 0.92);
  const route = clamp(toNumber(routeComplexity, 1), 0.8, 2.4);

  const trayShare = clamp(KNS_MODEL_DEFAULTS.trayShare + (route - 1) * 0.05, 0.35, 0.82);
  const conduitShare = clamp(KNS_MODEL_DEFAULTS.conduitShare + hiddenShare * 0.16, 0.18, 0.72);

  const trayLengthM = cableLengthM * trayShare;
  const conduitLengthM = cableLengthM * conduitShare * KNS_MODEL_DEFAULTS.hiddenPenaltyFactor;
  const fastenerUnits = cableLengthM * KNS_MODEL_DEFAULTS.fastenerPerMeter;
  const penetrationUnits = Math.max(
    1,
    Math.round(toNumber(cableModel?.riserCableM, 0) * KNS_MODEL_DEFAULTS.penetrationPerRiserMeter)
  );

  const knsLengthM = trayLengthM + conduitLengthM;
  const knsWorkUnits =
    knsLengthM * KNS_MODEL_DEFAULTS.knsUnitPerMeter + fastenerUnits * 0.12 + penetrationUnits * 1.6;
  const knsMaterialsCost = trayLengthM * 95 + conduitLengthM * 88 + fastenerUnits * 6 + penetrationUnits * 240;

  return {
    trayLengthM,
    conduitLengthM,
    fastenerUnits,
    penetrationUnits,
    knsLengthM,
    knsWorkUnits,
    knsMaterialsCost,
  };
}
