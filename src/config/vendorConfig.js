const CCTV_PROFILE = {
  camera: {
    placement: ["внутренние", "уличные"],
    resolution: [2, 4, 8],
    basePrices: {
      "внутренние_2": 7800,
      "внутренние_4": 12400,
      "внутренние_8": 23600,
      "уличные_2": 9800,
      "уличные_4": 15400,
      "уличные_8": 27900,
    },
  },
  recorder: {
    channels: [8, 16, 32, 64],
    basePrices: {
      8: 32000,
      16: 47000,
      32: 86000,
      64: 168000,
    },
  },
  hdd: {
    tb: [4, 8, 12, 16],
    basePrices: {
      4: 11500,
      8: 19800,
      12: 28400,
      16: 35800,
    },
  },
  switch: {
    ports: [8, 16, 24, 48],
    poe: [true, false],
    basePrices: {
      "8_true": 18200,
      "16_true": 32400,
      "24_true": 45800,
      "48_true": 89800,
      "8_false": 9800,
      "16_false": 15400,
      "24_false": 22800,
      "48_false": 48200,
    },
  },
};

export const VENDOR_EQUIPMENT = {
  sot: {
    Базовый: CCTV_PROFILE,
    Hikvision: CCTV_PROFILE,
    Dahua: CCTV_PROFILE,
    TRASSIR: CCTV_PROFILE,
    Axis: {
      ...CCTV_PROFILE,
      camera: {
        ...CCTV_PROFILE.camera,
        basePrices: {
          "внутренние_2": 11500,
          "внутренние_4": 18400,
          "внутренние_8": 33200,
          "уличные_2": 14300,
          "уличные_4": 22100,
          "уличные_8": 39800,
        },
      },
    },
  },
  ssoi: {
    Базовый: {
      recorder: CCTV_PROFILE.recorder,
      switch: CCTV_PROFILE.switch,
      note: "Для ССОИ используются серверные узлы, регистраторы и сетевой контур.",
    },
    "TRASSIR": {
      recorder: {
        ...CCTV_PROFILE.recorder,
        basePrices: { 8: 38000, 16: 56000, 32: 98000, 64: 182000 },
      },
      switch: CCTV_PROFILE.switch,
    },
    "ISS (Интеллект)": {
      recorder: {
        ...CCTV_PROFILE.recorder,
        basePrices: { 8: 42000, 16: 59000, 32: 108000, 64: 198000 },
      },
      switch: CCTV_PROFILE.switch,
    },
    Macroscop: {
      recorder: {
        ...CCTV_PROFILE.recorder,
        basePrices: { 8: 40000, 16: 58000, 32: 102000, 64: 190000 },
      },
      switch: CCTV_PROFILE.switch,
    },
  },
  skud: {
    Базовый: {
      controller: {
        channels: [1, 2, 4],
        basePrices: { 1: 14800, 2: 23600, 4: 39200 },
      },
      note: "Для СКУД можно уточнить ёмкость контроллера по числу точек доступа.",
    },
    Sigur: { controller: { channels: [1, 2, 4], basePrices: { 1: 16200, 2: 25400, 4: 42400 } } },
    Parsec: { controller: { channels: [1, 2, 4], basePrices: { 1: 17400, 2: 26800, 4: 44800 } } },
    PERCo: { controller: { channels: [1, 2, 4], basePrices: { 1: 16800, 2: 26000, 4: 43800 } } },
    Biosmart: { controller: { channels: [1, 2, 4], basePrices: { 1: 18600, 2: 29500, 4: 49600 } } },
  },
  aps: {
    Базовый: {
      detector: {
        kind: ["дымовой", "тепловой", "комбинированный"],
        basePrices: { дымовой: 1700, тепловой: 1600, комбинированный: 2350 },
      },
      panel: {
        loops: [2, 4, 8],
        basePrices: { 2: 98000, 4: 136000, 8: 198000 },
      },
    },
    Болид: {
      detector: { kind: ["дымовой", "тепловой", "комбинированный"], basePrices: { дымовой: 1850, тепловой: 1650, комбинированный: 2480 } },
      panel: { loops: [2, 4, 8], basePrices: { 2: 110000, 4: 152000, 8: 215000 } },
    },
    Рубеж: {
      detector: { kind: ["дымовой", "тепловой", "комбинированный"], basePrices: { дымовой: 1790, тепловой: 1630, комбинированный: 2410 } },
      panel: { loops: [2, 4, 8], basePrices: { 2: 104000, 4: 146000, 8: 208000 } },
    },
    "Аргус-Спектр": {
      detector: { kind: ["дымовой", "тепловой", "комбинированный"], basePrices: { дымовой: 2360, тепловой: 2150, комбинированный: 3190 } },
      panel: { loops: [2, 4, 8], basePrices: { 2: 132000, 4: 176000, 8: 246000 } },
    },
    Simplex: {
      detector: { kind: ["дымовой", "тепловой", "комбинированный"], basePrices: { дымовой: 2900, тепловой: 2680, комбинированный: 3820 } },
      panel: { loops: [2, 4, 8], basePrices: { 2: 188000, 4: 262000, 8: 356000 } },
    },
  },
  soue: {
    Базовый: {
      controller: { channels: [2, 4, 8], basePrices: { 2: 52000, 4: 84000, 8: 142000 } },
      note: "Для СОУЭ можно уточнить ёмкость контроллера/усилительного сегмента.",
    },
    Болид: { controller: { channels: [2, 4, 8], basePrices: { 2: 56000, 4: 91000, 8: 151000 } } },
    Рубеж: { controller: { channels: [2, 4, 8], basePrices: { 2: 57000, 4: 94000, 8: 156000 } } },
    Roxton: { controller: { channels: [2, 4, 8], basePrices: { 2: 65000, 4: 108000, 8: 178000 } } },
  },
};

export function getVendorEquipment(systemType, vendor) {
  return VENDOR_EQUIPMENT?.[systemType]?.[vendor] || VENDOR_EQUIPMENT?.[systemType]?.Базовый || null;
}
