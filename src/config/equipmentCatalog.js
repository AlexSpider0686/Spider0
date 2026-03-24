export const EQUIPMENT_CATALOG = {
  sot: [
    {
      key: "cameras",
      label: "IP-камеры",
      influenceWeight: 0.45,
      fallbackUnitPrice: 12000,
      sourcePath: "/products/network-cameras",
      searchTerm: "IP камера 4MP",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "2MP, базовая аналитика" },
        standard: { label: "Standard", coef: 1.0, features: "4MP, WDR, IR" },
        premium: { label: "Premium", coef: 1.25, features: "4K, расширенная аналитика" },
      },
    },
    {
      key: "nvr",
      label: "Видеорегистраторы / серверы",
      influenceWeight: 0.25,
      fallbackUnitPrice: 185000,
      sourcePath: "/products/storage-and-control",
      searchTerm: "NVR 32 канала",
      profiles: {
        economy: { label: "Economy", coef: 0.88, features: "до 32 каналов" },
        standard: { label: "Standard", coef: 1.0, features: "до 64 каналов" },
        premium: { label: "Premium", coef: 1.3, features: "HA, аналитика" },
      },
    },
    {
      key: "storage",
      label: "HDD для архива 30 дней",
      influenceWeight: 0.15,
      fallbackUnitPrice: 19800,
      sourcePath: "/products/storage",
      searchTerm: "HDD surveillance 8TB",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "4 ТБ" },
        standard: { label: "Standard", coef: 1.0, features: "8 ТБ" },
        premium: { label: "Premium", coef: 1.2, features: "12-16 ТБ" },
      },
    },
    {
      key: "switch",
      label: "PoE-коммутаторы",
      influenceWeight: 0.15,
      fallbackUnitPrice: 45800,
      sourcePath: "/products/switches",
      searchTerm: "PoE коммутатор 24 порта",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "8-16 портов" },
        standard: { label: "Standard", coef: 1.0, features: "24 порта PoE" },
        premium: { label: "Premium", coef: 1.22, features: "48 портов, L3" },
      },
    },
  ],
  sots: [
    {
      key: "sensors",
      label: "Охранные датчики",
      influenceWeight: 0.42,
      fallbackUnitPrice: 2500,
      sourcePath: "/catalog/security-sensors",
      searchTerm: "охранный датчик ИК",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "ИК" },
        standard: { label: "Standard", coef: 1.0, features: "ИК+СВЧ" },
        premium: { label: "Premium", coef: 1.22, features: "сложные помещения" },
      },
    },
    {
      key: "panels",
      label: "Контрольные панели",
      influenceWeight: 0.36,
      fallbackUnitPrice: 142000,
      sourcePath: "/catalog/control-panels",
      searchTerm: "приемно контрольный прибор охранный",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "2 шлейфа" },
        standard: { label: "Standard", coef: 1.0, features: "4 шлейфа" },
        premium: { label: "Premium", coef: 1.24, features: "8+ шлейфов, резерв" },
      },
    },
    {
      key: "power",
      label: "Блоки питания",
      influenceWeight: 0.22,
      fallbackUnitPrice: 9000,
      sourcePath: "/catalog/power",
      searchTerm: "блок питания охранной сигнализации",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовый резерв" },
        standard: { label: "Standard", coef: 1.0, features: "типовой резерв" },
        premium: { label: "Premium", coef: 1.18, features: "увеличенная автономность" },
      },
    },
  ],
  skud: [
    {
      key: "controllers",
      label: "Контроллеры СКУД",
      influenceWeight: 0.5,
      fallbackUnitPrice: 26500,
      sourcePath: "/products/access-control",
      searchTerm: "контроллер СКУД 2 двери",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "Mifare, базовые сценарии" },
        standard: { label: "Standard", coef: 1.0, features: "Mifare + DESFire" },
        premium: { label: "Premium", coef: 1.28, features: "биометрия/мультифактор" },
      },
    },
    {
      key: "readers",
      label: "Считыватели",
      influenceWeight: 0.3,
      fallbackUnitPrice: 14000,
      sourcePath: "/products/readers",
      searchTerm: "считыватель СКУД Mifare",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "карты" },
        standard: { label: "Standard", coef: 1.0, features: "карты + PIN" },
        premium: { label: "Premium", coef: 1.2, features: "биометрия" },
      },
    },
    {
      key: "locks",
      label: "Замки и исполнительные устройства",
      influenceWeight: 0.2,
      fallbackUnitPrice: 8200,
      sourcePath: "/products/locks",
      searchTerm: "электромагнитный замок",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовые замки" },
        standard: { label: "Standard", coef: 1.0, features: "типовые точки прохода" },
        premium: { label: "Premium", coef: 1.18, features: "усиленная фурнитура" },
      },
    },
  ],
  ssoi: [
    {
      key: "integrationServer",
      label: "Сервер интеграции",
      influenceWeight: 0.4,
      fallbackUnitPrice: 460000,
      sourcePath: "/products/platform",
      searchTerm: "сервер интеграции видеонаблюдения",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "базовое объединение" },
        standard: { label: "Standard", coef: 1.0, features: "типовая интеграция" },
        premium: { label: "Premium", coef: 1.35, features: "enterprise + API" },
      },
    },
    {
      key: "switch",
      label: "Ядро сети",
      influenceWeight: 0.3,
      fallbackUnitPrice: 85000,
      sourcePath: "/products/network-core",
      searchTerm: "коммутатор ядра сети",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "L2+ сегмент" },
        standard: { label: "Standard", coef: 1.0, features: "L3 базовый" },
        premium: { label: "Premium", coef: 1.25, features: "резервирование, HA" },
      },
    },
    {
      key: "storage",
      label: "Система хранения",
      influenceWeight: 0.3,
      fallbackUnitPrice: 190000,
      sourcePath: "/products/storage",
      searchTerm: "система хранения NAS видеонаблюдение",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовый архив" },
        standard: { label: "Standard", coef: 1.0, features: "типовой архив" },
        premium: { label: "Premium", coef: 1.3, features: "резерв и отказоустойчивость" },
      },
    },
  ],
  aps: [
    {
      key: "detectors",
      label: "Пожарные извещатели",
      influenceWeight: 0.55,
      fallbackUnitPrice: 2800,
      sourcePath: "/catalog/detectors",
      searchTerm: "пожарный извещатель адресный",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "точечные" },
        standard: { label: "Standard", coef: 1.0, features: "адресные" },
        premium: { label: "Premium", coef: 1.2, features: "адресно-аналоговые" },
      },
    },
    {
      key: "panel",
      label: "Приемно-контрольный прибор",
      influenceWeight: 0.3,
      fallbackUnitPrice: 152000,
      sourcePath: "/catalog/fire-panels",
      searchTerm: "ппкп пожарная сигнализация",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "2 шлейфа" },
        standard: { label: "Standard", coef: 1.0, features: "4 шлейфа" },
        premium: { label: "Premium", coef: 1.24, features: "8+ шлейфов" },
      },
    },
    {
      key: "notification",
      label: "Оповещатели",
      influenceWeight: 0.15,
      fallbackUnitPrice: 3500,
      sourcePath: "/catalog/sounders",
      searchTerm: "пожарный оповещатель светозвуковой",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовые табло" },
        standard: { label: "Standard", coef: 1.0, features: "табло + сирены" },
        premium: { label: "Premium", coef: 1.2, features: "адресные оповещатели" },
      },
    },
  ],
  soue: [
    {
      key: "speakers",
      label: "Оповещатели СОУЭ",
      influenceWeight: 0.52,
      fallbackUnitPrice: 2600,
      sourcePath: "/catalog/speakers",
      searchTerm: "соуэ оповещатель громкоговоритель",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовая акустика" },
        standard: { label: "Standard", coef: 1.0, features: "типовая акустика" },
        premium: { label: "Premium", coef: 1.24, features: "высокая разборчивость речи" },
      },
    },
    {
      key: "amplifiers",
      label: "Усилители СОУЭ",
      influenceWeight: 0.32,
      fallbackUnitPrice: 103000,
      sourcePath: "/catalog/amplifiers",
      searchTerm: "усилитель СОУЭ 4 канала",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "2 канала" },
        standard: { label: "Standard", coef: 1.0, features: "4 канала" },
        premium: { label: "Premium", coef: 1.25, features: "8 каналов, резерв" },
      },
    },
    {
      key: "lineModules",
      label: "Линейные модули",
      influenceWeight: 0.16,
      fallbackUnitPrice: 18000,
      sourcePath: "/catalog/line-modules",
      searchTerm: "линейный модуль СОУЭ",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовая зона" },
        standard: { label: "Standard", coef: 1.0, features: "типовая зона" },
        premium: { label: "Premium", coef: 1.18, features: "мультизонный режим" },
      },
    },
  ],
};

export function getEquipmentForSystem(systemType) {
  return EQUIPMENT_CATALOG[systemType] || [];
}

export function getDefaultEquipmentProfiles(systemType) {
  return getEquipmentForSystem(systemType).reduce((acc, item) => {
    acc[item.key] = "standard";
    return acc;
  }, {});
}

export function getCriticalEquipment(systemType) {
  return [...getEquipmentForSystem(systemType)].sort((a, b) => b.influenceWeight - a.influenceWeight);
}
