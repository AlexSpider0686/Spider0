export const SYSTEM_RULES = {
  sot: {
    equipmentMix: [
      { key: "core_devices", label: "Ключевые устройства", share: 0.62 },
      { key: "control_nodes", label: "Узлы управления", share: 0.23 },
      { key: "aux", label: "Вспомогательная инфраструктура", share: 0.15 },
    ],
    laborSplit: { smr: 0.68, pnr: 0.2, design: 0.12 },
  },
  sots: {
    equipmentMix: [
      { key: "core_devices", label: "Ключевые устройства", share: 0.56 },
      { key: "control_nodes", label: "Контроллеры и панели", share: 0.29 },
      { key: "aux", label: "Периферия", share: 0.15 },
    ],
    laborSplit: { smr: 0.64, pnr: 0.23, design: 0.13 },
  },
  skud: {
    equipmentMix: [
      { key: "core_devices", label: "Точки прохода", share: 0.58 },
      { key: "control_nodes", label: "Контроллеры", share: 0.27 },
      { key: "aux", label: "Инфраструктура", share: 0.15 },
    ],
    laborSplit: { smr: 0.6, pnr: 0.25, design: 0.15 },
  },
  ssoi: {
    equipmentMix: [
      { key: "core_devices", label: "Серверные/ядро", share: 0.7 },
      { key: "control_nodes", label: "Интеграционные узлы", share: 0.2 },
      { key: "aux", label: "Инфраструктура", share: 0.1 },
    ],
    laborSplit: { smr: 0.45, pnr: 0.35, design: 0.2 },
  },
  aps: {
    equipmentMix: [
      { key: "core_devices", label: "Извещатели", share: 0.62 },
      { key: "control_nodes", label: "ППКП/модули", share: 0.25 },
      { key: "aux", label: "Кабельная инфраструктура", share: 0.13 },
    ],
    laborSplit: { smr: 0.66, pnr: 0.21, design: 0.13 },
  },
  soue: {
    equipmentMix: [
      { key: "core_devices", label: "Оповещатели", share: 0.55 },
      { key: "control_nodes", label: "Усилители и шкафы", share: 0.3 },
      { key: "aux", label: "Кабельная инфраструктура", share: 0.15 },
    ],
    laborSplit: { smr: 0.63, pnr: 0.23, design: 0.14 },
  },
};

export function getSystemRules(systemType) {
  return SYSTEM_RULES[systemType] || SYSTEM_RULES.sot;
}

export const SYSTEM_RESOURCE_MODEL = {
  sot: {
    elements: [
      { key: "camera", label: "Камеры", densityPer1000: { office: 6, parking: 4.5, public: 8.5, technical: 4 }, cablePerUnit: 28, materialPerUnit: 520, mountHours: 0.9, connectHours: 0.35, setupHours: 0.45, pnrHours: 0.22, designHours: 0.12, priceShare: 0.54 },
      { key: "recorder", label: "Регистраторы / серверы", densityPer1000: { office: 0.24, parking: 0.2, public: 0.34, technical: 0.26 }, cablePerUnit: 12, materialPerUnit: 1450, mountHours: 1.4, connectHours: 1.1, setupHours: 1.8, pnrHours: 1.1, designHours: 0.4, priceShare: 0.2 },
      { key: "switch", label: "PoE-коммутаторы", densityPer1000: { office: 0.58, parking: 0.42, public: 0.75, technical: 0.46 }, cablePerUnit: 16, materialPerUnit: 980, mountHours: 1.1, connectHours: 0.7, setupHours: 0.85, pnrHours: 0.5, designHours: 0.24, priceShare: 0.16 },
      { key: "ups", label: "ИБП и шкафная инфраструктура", densityPer1000: { office: 0.36, parking: 0.28, public: 0.45, technical: 0.3 }, cablePerUnit: 10, materialPerUnit: 1200, mountHours: 1.2, connectHours: 0.6, setupHours: 0.65, pnrHours: 0.4, designHours: 0.18, priceShare: 0.1 },
    ],
  },
  sots: {
    elements: [
      { key: "sensor", label: "Охранные датчики", densityPer1000: { office: 7.5, parking: 5.2, public: 9.8, technical: 6.4 }, cablePerUnit: 22, materialPerUnit: 260, mountHours: 0.55, connectHours: 0.28, setupHours: 0.3, pnrHours: 0.18, designHours: 0.1, priceShare: 0.47 },
      { key: "panel", label: "Контрольные панели", densityPer1000: { office: 0.5, parking: 0.36, public: 0.64, technical: 0.44 }, cablePerUnit: 14, materialPerUnit: 930, mountHours: 1.1, connectHours: 0.9, setupHours: 1.25, pnrHours: 0.8, designHours: 0.32, priceShare: 0.24 },
      { key: "module", label: "Модули расширения", densityPer1000: { office: 0.9, parking: 0.6, public: 1.1, technical: 0.82 }, cablePerUnit: 10, materialPerUnit: 640, mountHours: 0.8, connectHours: 0.6, setupHours: 0.7, pnrHours: 0.42, designHours: 0.2, priceShare: 0.16 },
      { key: "power", label: "Блоки питания и АКБ", densityPer1000: { office: 0.74, parking: 0.58, public: 0.9, technical: 0.7 }, cablePerUnit: 8, materialPerUnit: 580, mountHours: 0.75, connectHours: 0.35, setupHours: 0.4, pnrHours: 0.22, designHours: 0.14, priceShare: 0.13 },
    ],
  },
  skud: {
    elements: [
      { key: "reader", label: "Считыватели / терминалы", densityPer1000: { office: 1.5, parking: 0.6, public: 2, technical: 0.8 }, cablePerUnit: 30, materialPerUnit: 760, mountHours: 1.1, connectHours: 0.65, setupHours: 0.62, pnrHours: 0.28, designHours: 0.18, priceShare: 0.4 },
      { key: "controller", label: "Контроллеры доступа", densityPer1000: { office: 0.5, parking: 0.22, public: 0.62, technical: 0.34 }, cablePerUnit: 20, materialPerUnit: 1320, mountHours: 1.3, connectHours: 1.05, setupHours: 1.4, pnrHours: 0.8, designHours: 0.35, priceShare: 0.28 },
      { key: "lock", label: "Электрозамки / доводчики", densityPer1000: { office: 0.95, parking: 0.32, public: 1.2, technical: 0.48 }, cablePerUnit: 18, materialPerUnit: 980, mountHours: 1.05, connectHours: 0.62, setupHours: 0.52, pnrHours: 0.25, designHours: 0.16, priceShare: 0.2 },
      { key: "cabinet", label: "Шкафы и БП", densityPer1000: { office: 0.26, parking: 0.16, public: 0.35, technical: 0.24 }, cablePerUnit: 10, materialPerUnit: 1500, mountHours: 1.2, connectHours: 0.7, setupHours: 0.72, pnrHours: 0.35, designHours: 0.2, priceShare: 0.12 },
    ],
  },
  ssoi: {
    elements: [
      { key: "server", label: "Серверы и core-узлы", densityPer1000: { office: 0.46, parking: 0.22, public: 0.58, technical: 0.4 }, cablePerUnit: 14, materialPerUnit: 2100, mountHours: 1.8, connectHours: 1.5, setupHours: 2.2, pnrHours: 1.45, designHours: 0.55, priceShare: 0.48 },
      { key: "gateway", label: "Интеграционные шлюзы", densityPer1000: { office: 0.4, parking: 0.2, public: 0.5, technical: 0.36 }, cablePerUnit: 12, materialPerUnit: 1650, mountHours: 1.35, connectHours: 1.2, setupHours: 1.8, pnrHours: 1.1, designHours: 0.48, priceShare: 0.26 },
      { key: "operator", label: "АРМ операторов", densityPer1000: { office: 0.2, parking: 0.12, public: 0.26, technical: 0.16 }, cablePerUnit: 8, materialPerUnit: 860, mountHours: 0.65, connectHours: 0.5, setupHours: 0.95, pnrHours: 0.62, designHours: 0.3, priceShare: 0.18 },
      { key: "network", label: "Сеть и кросс-инфраструктура", densityPer1000: { office: 0.38, parking: 0.25, public: 0.5, technical: 0.34 }, cablePerUnit: 16, materialPerUnit: 1100, mountHours: 0.95, connectHours: 0.7, setupHours: 0.92, pnrHours: 0.5, designHours: 0.28, priceShare: 0.08 },
    ],
  },
  aps: {
    elements: [
      { key: "detector", label: "Пожарные извещатели", densityPer1000: { office: 24, parking: 13, public: 30, technical: 17 }, cablePerUnit: 9, materialPerUnit: 140, mountHours: 0.3, connectHours: 0.16, setupHours: 0.12, pnrHours: 0.08, designHours: 0.05, priceShare: 0.46 },
      { key: "module", label: "Модули и ППКП", densityPer1000: { office: 1.1, parking: 0.7, public: 1.4, technical: 0.9 }, cablePerUnit: 18, materialPerUnit: 760, mountHours: 1.15, connectHours: 0.88, setupHours: 1.3, pnrHours: 0.86, designHours: 0.34, priceShare: 0.28 },
      { key: "notification", label: "Оповещатели и табло", densityPer1000: { office: 3.6, parking: 2.4, public: 4.8, technical: 2.6 }, cablePerUnit: 12, materialPerUnit: 280, mountHours: 0.42, connectHours: 0.22, setupHours: 0.18, pnrHours: 0.1, designHours: 0.07, priceShare: 0.16 },
      { key: "power", label: "Питание и АКБ", densityPer1000: { office: 0.8, parking: 0.56, public: 1.05, technical: 0.74 }, cablePerUnit: 8, materialPerUnit: 540, mountHours: 0.7, connectHours: 0.3, setupHours: 0.36, pnrHours: 0.2, designHours: 0.12, priceShare: 0.1 },
    ],
  },
  soue: {
    elements: [
      { key: "speaker", label: "Оповещатели", densityPer1000: { office: 6.6, parking: 4.8, public: 8.5, technical: 3.8 }, cablePerUnit: 11, materialPerUnit: 220, mountHours: 0.4, connectHours: 0.2, setupHours: 0.22, pnrHours: 0.12, designHours: 0.07, priceShare: 0.43 },
      { key: "amp", label: "Усилители/контроллеры", densityPer1000: { office: 0.64, parking: 0.42, public: 0.82, technical: 0.5 }, cablePerUnit: 14, materialPerUnit: 940, mountHours: 1.1, connectHours: 0.85, setupHours: 1.2, pnrHours: 0.78, designHours: 0.3, priceShare: 0.27 },
      { key: "line", label: "Линейные модули", densityPer1000: { office: 1.2, parking: 0.8, public: 1.5, technical: 0.95 }, cablePerUnit: 10, materialPerUnit: 520, mountHours: 0.72, connectHours: 0.5, setupHours: 0.56, pnrHours: 0.3, designHours: 0.16, priceShare: 0.18 },
      { key: "cabinet", label: "Шкафы и БП", densityPer1000: { office: 0.38, parking: 0.25, public: 0.52, technical: 0.32 }, cablePerUnit: 8, materialPerUnit: 900, mountHours: 0.95, connectHours: 0.6, setupHours: 0.7, pnrHours: 0.4, designHours: 0.2, priceShare: 0.12 },
    ],
  },
};

export function getSystemResourceModel(systemType) {
  return SYSTEM_RESOURCE_MODEL[systemType] || SYSTEM_RESOURCE_MODEL.sot;
}
