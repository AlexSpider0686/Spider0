export const ZONE_TYPES = [
  { value: "office", label: "Офис", rateProfile: "office" },
  { value: "parking", label: "Паркинг", rateProfile: "parking" },
  { value: "lobby", label: "Холлы / входные группы", rateProfile: "public" },
  { value: "technical", label: "Технические помещения", rateProfile: "technical" },
  { value: "corridor", label: "Коридоры / МОП", rateProfile: "public" },
  { value: "retail", label: "Торговые зоны", rateProfile: "public" },
  { value: "warehouse", label: "Складские зоны", rateProfile: "technical" },
  { value: "food", label: "Ресторан / общепит", rateProfile: "public" },
  { value: "production", label: "Производственные помещения", rateProfile: "technical" },
  { value: "perimeter", label: "Уличный периметр", rateProfile: "parking" },
];

export const ZONE_CALC_PROFILES = {
  office: { densityCoef: 1, cableCoef: 1, laborCoef: 1 },
  parking: { densityCoef: 0.82, cableCoef: 0.9, laborCoef: 0.92 },
  lobby: { densityCoef: 1.2, cableCoef: 1.08, laborCoef: 1.12 },
  technical: { densityCoef: 0.9, cableCoef: 0.95, laborCoef: 1.06 },
  corridor: { densityCoef: 1.08, cableCoef: 1.12, laborCoef: 1.04 },
  retail: { densityCoef: 1.18, cableCoef: 1.1, laborCoef: 1.1 },
  warehouse: { densityCoef: 0.75, cableCoef: 0.84, laborCoef: 0.9 },
  food: { densityCoef: 1.15, cableCoef: 1.05, laborCoef: 1.16 },
  production: { densityCoef: 0.95, cableCoef: 1.02, laborCoef: 1.18 },
  perimeter: { densityCoef: 0.68, cableCoef: 1.25, laborCoef: 1.2 },
};

export const ZONE_PRESETS = {
  business_center: {
    label: "Бизнес-центр",
    distribution: { office: 55, corridor: 15, lobby: 10, technical: 8, parking: 12 },
  },
  office_building: {
    label: "Офисное здание",
    distribution: { office: 62, corridor: 14, lobby: 8, technical: 6, parking: 10 },
  },
  residential_complex: {
    label: "Жилой комплекс",
    distribution: { lobby: 18, corridor: 20, parking: 22, perimeter: 12, technical: 10, retail: 18 },
  },
  warehouse: {
    label: "Склад",
    distribution: { warehouse: 65, office: 10, technical: 10, perimeter: 10, corridor: 5 },
  },
  parking: {
    label: "Паркинг",
    distribution: { parking: 78, technical: 10, corridor: 6, perimeter: 6 },
  },
  mixed_use: {
    label: "Mixed-use",
    distribution: { office: 30, retail: 20, lobby: 12, corridor: 12, parking: 12, food: 8, technical: 6 },
  },
};

export function getZoneMeta(type) {
  return ZONE_TYPES.find((zone) => zone.value === type) || ZONE_TYPES[0];
}

export function getZoneRateProfile(type) {
  return getZoneMeta(type).rateProfile || "office";
}

export function getZoneCalcProfile(type) {
  return ZONE_CALC_PROFILES[type] || ZONE_CALC_PROFILES.office;
}
