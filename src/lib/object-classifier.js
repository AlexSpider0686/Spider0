import { getObjectProfile } from "../config/costModelConfig";
import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function classifyObject(normalizedObject, activeSystemTypes = []) {
  const profile = getObjectProfile(normalizedObject.objectType);
  const floors = Math.max(toNumber(normalizedObject.aboveGroundFloors, 1), 1);
  const undergroundFloors = Math.max(toNumber(normalizedObject.undergroundFloors, 0), 0);
  const totalFloors = floors + undergroundFloors;
  const totalAreaM2 = Math.max(toNumber(normalizedObject.totalAreaM2, 0), 0);
  const protectedAreaM2 = Math.max(toNumber(normalizedObject.protectedAreaM2, totalAreaM2), 0);
  const activeSystemsCount = Math.max(activeSystemTypes.length, 1);

  const architectureComplexityIndex = clamp(
    profile.architectureBase + (floors - 1) * 0.018 + undergroundFloors * 0.03 + (totalAreaM2 > 40000 ? 0.06 : 0),
    0.85,
    1.9
  );
  const engineeringSaturationIndex = clamp(
    profile.engineeringDensity + Math.max(activeSystemsCount - 1, 0) * 0.028 + (protectedAreaM2 / Math.max(totalAreaM2, 1)) * 0.04,
    0.75,
    2.0
  );
  const distributedArchitecture = totalFloors >= 6 || totalAreaM2 >= 25000;
  const integrationDemandIndex = clamp(
    1 + Math.max(activeSystemsCount - 2, 0) * 0.11 + (distributedArchitecture ? 0.12 : 0),
    1,
    2.2
  );
  const designComplexityIndex = clamp(
    1 + (architectureComplexityIndex - 1) * 0.55 + (engineeringSaturationIndex - 1) * 0.45,
    0.9,
    2.2
  );

  return {
    objectType: normalizedObject.objectType,
    profileCode: profile.profileCode,
    totalAreaM2,
    protectedAreaM2,
    aboveGroundFloors: floors,
    undergroundFloors,
    totalFloors,
    activeSystemsCount,
    architectureComplexityIndex,
    engineeringSaturationIndex,
    routeComplexityIndex: profile.routeComplexity,
    securityIntensityIndex: profile.securityIntensity,
    integrationDemandIndex,
    designComplexityIndex,
    distributedArchitecture,
    systemBias: profile.systemBias || {},
  };
}
