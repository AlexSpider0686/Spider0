const vendors = {
  sot: [
    {
      name: "Базовый",
      description: "Сбалансированное решение для типового офисного и mixed-сегмента.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 350, efficiency: 0.82, integrationComplexity: 1.0 },
    },
    {
      name: "Hikvision",
      description: "Широкая линейка и стабильная аналитика, немного выше средней цены.",
      qualityCoefficient: 1.08,
      equipmentPriceIndex: 1.12,
      cableCoefficient: 1.01,
      installationSpeed: 1.04,
      technicalParameters: { maxDistance: 420, efficiency: 0.88, integrationComplexity: 1.05 },
    },
    {
      name: "Dahua",
      description: "Оптимальный баланс стоимости и функциональности.",
      qualityCoefficient: 1.02,
      equipmentPriceIndex: 1.03,
      cableCoefficient: 1.0,
      installationSpeed: 1.02,
      technicalParameters: { maxDistance: 390, efficiency: 0.85, integrationComplexity: 1.01 },
    },
    {
      name: "TRASSIR",
      description: "Сильная видеоаналитика и интеграционный контур, дороже среднего.",
      qualityCoefficient: 1.12,
      equipmentPriceIndex: 1.18,
      cableCoefficient: 1.03,
      installationSpeed: 0.97,
      technicalParameters: { maxDistance: 440, efficiency: 0.9, integrationComplexity: 1.12 },
    },
  ],
  sots: [
    {
      name: "Базовый",
      description: "Базовый сценарий СОТС для коммерческой недвижимости.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 280, efficiency: 0.8, integrationComplexity: 1.0 },
    },
    {
      name: "Бастион",
      description: "Надёжная и предсказуемая конфигурация по средней цене.",
      qualityCoefficient: 1.01,
      equipmentPriceIndex: 1.02,
      cableCoefficient: 1.0,
      installationSpeed: 1.03,
      technicalParameters: { maxDistance: 300, efficiency: 0.82, integrationComplexity: 1.01 },
    },
    {
      name: "Рубеж",
      description: "Чуть выше ценовой сегмент с хорошей масштабируемостью.",
      qualityCoefficient: 1.05,
      equipmentPriceIndex: 1.08,
      cableCoefficient: 1.02,
      installationSpeed: 0.99,
      technicalParameters: { maxDistance: 330, efficiency: 0.86, integrationComplexity: 1.07 },
    },
    {
      name: "Болид",
      description: "Популярная экосистема с богатыми интеграциями.",
      qualityCoefficient: 1.07,
      equipmentPriceIndex: 1.1,
      cableCoefficient: 1.03,
      installationSpeed: 0.97,
      technicalParameters: { maxDistance: 340, efficiency: 0.87, integrationComplexity: 1.09 },
    },
  ],
  skud: [
    {
      name: "Базовый",
      description: "Типовой уровень СКУД без премиальной интеграции.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 180, efficiency: 0.79, integrationComplexity: 1.0 },
    },
    {
      name: "Бастион",
      description: "Рациональный baseline для стандартных сценариев доступа.",
      qualityCoefficient: 1.02,
      equipmentPriceIndex: 1.03,
      cableCoefficient: 1.01,
      installationSpeed: 1.02,
      technicalParameters: { maxDistance: 190, efficiency: 0.81, integrationComplexity: 1.02 },
    },
    {
      name: "Sigur",
      description: "Выше цена, но лучше UX и гибкость интеграций.",
      qualityCoefficient: 1.08,
      equipmentPriceIndex: 1.14,
      cableCoefficient: 1.02,
      installationSpeed: 0.98,
      technicalParameters: { maxDistance: 210, efficiency: 0.86, integrationComplexity: 1.1 },
    },
    {
      name: "Parsec",
      description: "Продвинутые enterprise-сценарии с более дорогим железом.",
      qualityCoefficient: 1.1,
      equipmentPriceIndex: 1.16,
      cableCoefficient: 1.03,
      installationSpeed: 0.96,
      technicalParameters: { maxDistance: 220, efficiency: 0.88, integrationComplexity: 1.12 },
    },
  ],
  ssoi: [
    {
      name: "Базовый",
      description: "Типовой контур ССОИ с умеренной глубиной интеграции.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 500, efficiency: 0.8, integrationComplexity: 1.0 },
    },
    {
      name: "Huawei",
      description: "Высокая производительность и enterprise-профиль, выше цена.",
      qualityCoefficient: 1.12,
      equipmentPriceIndex: 1.2,
      cableCoefficient: 1.03,
      installationSpeed: 0.98,
      technicalParameters: { maxDistance: 650, efficiency: 0.91, integrationComplexity: 1.16 },
    },
    {
      name: "TRASSIR",
      description: "Усиленная аналитика и интеграции безопасности.",
      qualityCoefficient: 1.09,
      equipmentPriceIndex: 1.15,
      cableCoefficient: 1.02,
      installationSpeed: 0.99,
      technicalParameters: { maxDistance: 600, efficiency: 0.89, integrationComplexity: 1.13 },
    },
    {
      name: "Интеграция",
      description: "Кастомная интеграция с максимальной глубиной и дорогим внедрением.",
      qualityCoefficient: 1.16,
      equipmentPriceIndex: 1.24,
      cableCoefficient: 1.05,
      installationSpeed: 0.92,
      technicalParameters: { maxDistance: 700, efficiency: 0.92, integrationComplexity: 1.22 },
    },
  ],
  aps: [
    {
      name: "Базовый",
      description: "Стандартный уровень АПС для большинства объектов.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 260, efficiency: 0.81, integrationComplexity: 1.0 },
    },
    {
      name: "Болид",
      description: "Сильный рынок АПС, хорошая совместимость и поддержка.",
      qualityCoefficient: 1.04,
      equipmentPriceIndex: 1.06,
      cableCoefficient: 1.01,
      installationSpeed: 1.01,
      technicalParameters: { maxDistance: 280, efficiency: 0.85, integrationComplexity: 1.05 },
    },
    {
      name: "Рубеж",
      description: "Сбалансированный профиль с умеренным удорожанием.",
      qualityCoefficient: 1.03,
      equipmentPriceIndex: 1.05,
      cableCoefficient: 1.01,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 275, efficiency: 0.84, integrationComplexity: 1.04 },
    },
    {
      name: "Simplex",
      description: "Премиум-сегмент с высоким качеством и дорогим внедрением.",
      qualityCoefficient: 1.18,
      equipmentPriceIndex: 1.35,
      cableCoefficient: 1.06,
      installationSpeed: 0.9,
      technicalParameters: { maxDistance: 320, efficiency: 0.92, integrationComplexity: 1.2 },
    },
  ],
  soue: [
    {
      name: "Базовый",
      description: "Стандартная СОУЭ без повышенных требований к акустике.",
      qualityCoefficient: 1.0,
      equipmentPriceIndex: 1.0,
      cableCoefficient: 1.0,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 240, efficiency: 0.8, integrationComplexity: 1.0 },
    },
    {
      name: "Болид",
      description: "Надёжный массовый вариант с хорошей доступностью компонентов.",
      qualityCoefficient: 1.03,
      equipmentPriceIndex: 1.05,
      cableCoefficient: 1.01,
      installationSpeed: 1.02,
      technicalParameters: { maxDistance: 255, efficiency: 0.84, integrationComplexity: 1.04 },
    },
    {
      name: "Рубеж",
      description: "Чуть дороже базового уровня, но с хорошей масштабируемостью.",
      qualityCoefficient: 1.04,
      equipmentPriceIndex: 1.08,
      cableCoefficient: 1.02,
      installationSpeed: 1.0,
      technicalParameters: { maxDistance: 265, efficiency: 0.85, integrationComplexity: 1.06 },
    },
    {
      name: "Roxton",
      description: "Премиальная акустическая линия для более требовательных объектов.",
      qualityCoefficient: 1.12,
      equipmentPriceIndex: 1.16,
      cableCoefficient: 1.03,
      installationSpeed: 0.95,
      technicalParameters: { maxDistance: 290, efficiency: 0.9, integrationComplexity: 1.12 },
    },
  ],
};

export function getVendorsBySystem(systemType) {
  return vendors[systemType] || vendors.sot;
}

export function getVendorByName(systemType, vendorName) {
  return getVendorsBySystem(systemType).find((vendor) => vendor.name === vendorName) || getVendorsBySystem(systemType)[0];
}

export function getVendorNames(systemType) {
  return getVendorsBySystem(systemType).map((vendor) => vendor.name);
}

export const MANUFACTURER_SOURCES = {
  sot: {
    Базовый: { website: "https://www.hikvision.com" },
    Hikvision: { website: "https://www.hikvision.com" },
    Dahua: { website: "https://www.dahuasecurity.com" },
    TRASSIR: { website: "https://trassir.com" },
  },
  sots: {
    Базовый: { website: "https://bolid.ru" },
    Бастион: { website: "https://bast.ru" },
    Рубеж: { website: "https://rubezh.ru" },
    Болид: { website: "https://bolid.ru" },
  },
  skud: {
    Базовый: { website: "https://sigur.com" },
    Бастион: { website: "https://bast.ru" },
    Sigur: { website: "https://sigur.com" },
    Parsec: { website: "https://parsec.ru" },
  },
  ssoi: {
    Базовый: { website: "https://www.huawei.com" },
    Huawei: { website: "https://www.huawei.com" },
    TRASSIR: { website: "https://trassir.com" },
    Интеграция: { website: "https://www.huawei.com" },
  },
  aps: {
    Базовый: { website: "https://bolid.ru" },
    Болид: { website: "https://bolid.ru" },
    Рубеж: { website: "https://rubezh.ru" },
    Simplex: { website: "https://www.johnsoncontrols.com/fire-detection/simplex" },
  },
  soue: {
    Базовый: { website: "https://roxton-audio.com" },
    Болид: { website: "https://bolid.ru" },
    Рубеж: { website: "https://rubezh.ru" },
    Roxton: { website: "https://roxton-audio.com" },
  },
};

export function getManufacturerSource(systemType, vendorName) {
  return MANUFACTURER_SOURCES[systemType]?.[vendorName] || { website: "" };
}

export default vendors;
