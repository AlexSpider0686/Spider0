export const EQUIPMENT_CATALOG = {
  sot: [
    {
      key: "cameras",
      label: "IP-камеры",
      influenceWeight: 0.45,
      fallbackUnitPrice: 12000,
      sourcePath: "/en/products/network-products/network-cameras/",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "2MP, базовая аналитика" },
        standard: { label: "Standard", coef: 1.0, features: "4MP, WDR, IR" },
        premium: { label: "Premium", coef: 1.25, features: "4K, расширенная аналитика" },
      },
    },
    {
      key: "nvr",
      label: "Сервер/регистратор",
      influenceWeight: 0.25,
      fallbackUnitPrice: 185000,
      sourcePath: "/en/products/storage-and-display/",
      profiles: {
        economy: { label: "Economy", coef: 0.88, features: "до 32 каналов" },
        standard: { label: "Standard", coef: 1.0, features: "до 64 каналов" },
        premium: { label: "Premium", coef: 1.3, features: "HA, аналитика" },
      },
    },
  ],
  sots: [
    {
      key: "controllers",
      label: "Контроллеры",
      influenceWeight: 0.35,
      fallbackUnitPrice: 34000,
      sourcePath: "/catalog/kontrolno-priemnye-pribory/",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "базовая адресация" },
        standard: { label: "Standard", coef: 1.0, features: "типовой функционал" },
        premium: { label: "Premium", coef: 1.22, features: "резервирование" },
      },
    },
  ],
  skud: [
    {
      key: "readers",
      label: "Считыватели и контроллеры",
      influenceWeight: 0.5,
      fallbackUnitPrice: 26500,
      sourcePath: "/products/",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "Mifare, базовые сценарии" },
        standard: { label: "Standard", coef: 1.0, features: "Mifare + DESFire" },
        premium: { label: "Premium", coef: 1.28, features: "биометрия/мультифактор" },
      },
    },
  ],
  ssoi: [
    {
      key: "integrationServer",
      label: "Сервер интеграции",
      influenceWeight: 0.4,
      fallbackUnitPrice: 460000,
      sourcePath: "/en/solutions/enterprise-optical-network/",
      profiles: {
        economy: { label: "Economy", coef: 0.92, features: "базовое объединение" },
        standard: { label: "Standard", coef: 1.0, features: "типовая интеграция" },
        premium: { label: "Premium", coef: 1.35, features: "enterprise + API" },
      },
    },
  ],
  aps: [
    {
      key: "detectors",
      label: "Извещатели",
      influenceWeight: 0.55,
      fallbackUnitPrice: 2800,
      sourcePath: "/catalog/izveshchateli/",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "точечные" },
        standard: { label: "Standard", coef: 1.0, features: "адресные" },
        premium: { label: "Premium", coef: 1.2, features: "адресно-аналоговые" },
      },
    },
  ],
  soue: [
    {
      key: "speakers",
      label: "Оповещатели/усилители",
      influenceWeight: 0.5,
      fallbackUnitPrice: 7200,
      sourcePath: "/catalog/",
      profiles: {
        economy: { label: "Economy", coef: 0.9, features: "базовая акустика" },
        standard: { label: "Standard", coef: 1.0, features: "типовая акустика" },
        premium: { label: "Premium", coef: 1.24, features: "высокая разборчивость" },
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
