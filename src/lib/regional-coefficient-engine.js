import { getRegionCoef } from "../config/regionsConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resolveRegionalCoefficient({ regionSubject, regionCoef }) {
  const dictionaryValue = getRegionCoef(regionSubject);
  const incomingValue = toNumber(regionCoef, dictionaryValue);
  const value = clamp(incomingValue || dictionaryValue || 1, 1, 1.8);

  return {
    key: "regionalCoefficient",
    label: "Региональный коэффициент",
    regionSubject,
    value,
    dictionaryValue,
    appliesToLaborOnly: true,
  };
}
