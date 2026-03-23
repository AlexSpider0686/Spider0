export const VENDOR_EQUIPMENT = {
  sot: {
    Hikvision: {
      camera: {
        resolution: [2, 4, 8],
        matrix: ["1/2.8", "1/1.8"],
        type: ["dome", "bullet"],
        outdoor: [true, false],
        ptz: [true, false],
        basePrices: {
          "2_false_false": 8000,
          "4_false_false": 12000,
          "8_true_true": 45000,
        },
      },
    },
    Dahua: {
      camera: {
        resolution: [2, 4, 8],
        matrix: ["1/2.8", "1/1.8"],
        type: ["dome", "bullet"],
        outdoor: [true, false],
        ptz: [true, false],
        basePrices: {
          "2_false_false": 7600,
          "4_false_false": 11200,
          "8_true_true": 42000,
        },
      },
      note: "Dahua — массовый сегмент.",
    },
    Flow: {
      camera: {
        resolution: [2, 4, 8],
        matrix: ["1/2.8", "1/1.8"],
        type: ["dome", "bullet"],
        outdoor: [true, false],
        ptz: [true, false],
        basePrices: {
          "2_false_false": 9000,
          "4_false_false": 13800,
          "8_true_true": 47000,
        },
      },
      note: "Flow = премиум аналог Dahua.",
    },
  },
  ssoi: {
    Huawei: {
      switch: {
        ports: [8, 16, 24, 48],
        poe: [true, false],
        basePrices: {
          "8_false": 12000,
          "16_false": 20500,
          "24_true": 48000,
          "48_true": 91000,
        },
      },
    },
  },
};

export function getVendorEquipment(systemType, vendor) {
  return VENDOR_EQUIPMENT?.[systemType]?.[vendor] || null;
}
