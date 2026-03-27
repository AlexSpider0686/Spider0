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
    label: "Офисная зона",
    distribution: { office: 62, corridor: 14, lobby: 8, technical: 6, parking: 10 },
  },
  residential_complex: {
    label: "Жилая зона",
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
    label: "Смешанная зона",
    distribution: { office: 30, retail: 20, lobby: 12, corridor: 12, parking: 12, food: 8, technical: 6 },
  },
};

export const ZONE_PRESET_DETAILS = {
  business_center: {
    description:
      "Подходит для классического делового объекта, где основную площадь занимают офисы, а остальные зоны поддерживают трафик сотрудников и посетителей.",
    impact:
      "Обычно дает сбалансированный расчет: среднюю плотность оборудования, заметную долю трасс по коридорам и входным группам и умеренные трудозатраты на монтаж.",
  },
  office_building: {
    description:
      "Используйте для офисного здания с меньшей долей общественных и коммерческих пространств, чем у бизнес-центра.",
    impact:
      "Смета обычно смещается в сторону типовых офисных решений: выше повторяемость помещений, меньше сложных общественных зон и более предсказуемый объем работ.",
  },
  residential_complex: {
    description:
      "Нужен для жилых комплексов, где больше доля входных групп, общих коридоров, паркинга и сопутствующей инфраструктуры.",
    impact:
      "Чаще увеличивает протяженность линий и число распределенных точек по МОП, входным группам и парковке, что может поднять кабельную часть и монтаж.",
  },
  warehouse: {
    description:
      "Оптимален для складских объектов, где основная площадь отводится под хранение, а офисные и технические помещения занимают меньшую часть.",
    impact:
      "Обычно снижает плотность оборудования на квадратный метр, но может сохранять заметную длину трасс из-за больших площадей и распределенных участков хранения.",
  },
  parking: {
    description:
      "Применяйте для отдельно стоящего или доминирующего по площади паркинга с минимальным набором сопутствующих зон.",
    impact:
      "Сдвигает расчет в сторону более редкой плотности устройств, но с учетом специфики паркинга и периметра может увеличивать требования к трассам и отдельным узлам.",
  },
  mixed_use: {
    description:
      "Выбирайте для многофункционального объекта, где в одном проекте совмещены офисы, торговля, общие зоны, общепит и паркинг.",
    impact:
      "Обычно дает самый неоднородный расчет: выше вариативность по плотности систем, больше разных сценариев монтажа и более чувствительную к структуре зон итоговую смету.",
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
