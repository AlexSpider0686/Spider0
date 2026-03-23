import { toNumber } from "./estimate";

export const COEFFICIENT_LIMITS = {
  cableCoef: [0.9, 1.3],
  equipmentCoef: [0.9, 1.25],
  laborCoef: [0.9, 1.4],
  complexityCoef: [1.0, 1.35],
};

export function validateCoefficient(key, value) {
  const [min, max] = COEFFICIENT_LIMITS[key] || [-Infinity, Infinity];
  const numericValue = toNumber(value);
  return {
    key,
    min,
    max,
    value: numericValue,
    isValid: numericValue >= min && numericValue <= max,
    warning: numericValue < min || numericValue > max ? `Вне диапазона ${min}–${max}` : "",
  };
}

export function validateBudgetCoefficients(budget) {
  return Object.keys(COEFFICIENT_LIMITS).map((key) => validateCoefficient(key, budget[key]));
}
