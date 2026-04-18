import { toNumber } from "./estimate.js";
import { resolveVendorEquipment } from "../config/vendorResolver.js";
import { repairUtf8Cp1251Mojibake } from "./textEncoding.js";
import { getArchitectureComponent } from "./systemArchitecture.js";

const MARKET_KEY_ALIASES = {
  camera: ["cameras", "camera"],
  recorder: ["nvr", "recorder", "integrationServer"],
  hdd: ["storage", "hdd"],
  switch: ["switch", "switches", "network-core"],
  controller: ["controllers", "controller"],
  sensor: ["sensors", "sensor"],
  detector: ["detectors", "detector"],
  panel: ["panel", "panels", "fire-panels"],
  speaker: ["speakers", "speaker", "notification"],
  amplifier: ["amplifiers", "amplifier"],
};

const EDITABLE_ITEM_CODE_MAP = {
  CAM: "camera",
  NVR: "recorder",
  HDD: "hdd",
  SW: "switch",
  CTRL: "controller",
  SEN: "sensor",
  DET: "detector",
  PANEL: "panel",
  SPK: "speaker",
  AMP: "amplifier",
};

const MANAGEMENT_UNIT_DEFAULTS = {
  aps: { serverPrice: 265000, armPrice: 138000 },
  soue: { serverPrice: 228000, armPrice: 132000 },
  sots: { serverPrice: 214000, armPrice: 126000 },
  sot: { serverPrice: 325000, armPrice: 152000 },
  ssoi: { serverPrice: 460000, armPrice: 168000 },
  skud: { serverPrice: 208000, armPrice: 128000 },
};

const MANAGEMENT_UNIT_VENDOR_OVERRIDES = {
  skud: {
    Bastion: {
      serverPrice: 19000,
      armPrice: 6000,
    },
  },
};

const CATEGORY_PRICE_GUARDRAILS = {
  cameras: { min: 0.82, max: 1.32 },
  camera: { min: 0.82, max: 1.32 },
  nvr: { min: 0.86, max: 1.36 },
  recorder: { min: 0.86, max: 1.36 },
  integrationServer: { min: 0.88, max: 1.42 },
  storage: { min: 0.84, max: 1.34 },
  hdd: { min: 0.84, max: 1.34 },
  switch: { min: 0.84, max: 1.3 },
  switches: { min: 0.84, max: 1.3 },
  controller: { min: 0.85, max: 1.3 },
  controllers: { min: 0.85, max: 1.3 },
  readers: { min: 0.82, max: 1.28 },
  locks: { min: 0.8, max: 1.26 },
  sensors: { min: 0.8, max: 1.24 },
  sensor: { min: 0.8, max: 1.24 },
  detectors: { min: 0.8, max: 1.24 },
  detector: { min: 0.8, max: 1.24 },
  panel: { min: 0.88, max: 1.34 },
  panels: { min: 0.88, max: 1.34 },
  "fire-panels": { min: 0.88, max: 1.34 },
  speakers: { min: 0.82, max: 1.24 },
  speaker: { min: 0.82, max: 1.24 },
  amplifiers: { min: 0.86, max: 1.32 },
  amplifier: { min: 0.86, max: 1.32 },
  notification: { min: 0.8, max: 1.22 },
  "network-core": { min: 0.9, max: 1.36 },
};

function repairCatalogNode(value) {
  if (Array.isArray(value)) {
    return value.map((item) => repairCatalogNode(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [repairUtf8Cp1251Mojibake(key), repairCatalogNode(nestedValue)])
    );
  }

  return typeof value === "string" ? repairUtf8Cp1251Mojibake(value) : value;
}

function sanitizeDisplayText(value) {
  return repairUtf8Cp1251Mojibake(String(value ?? ""));
}

const DISCONTINUED_MODEL_REPLACEMENTS = {
  aps: {
    "Базовый": {
      "Сигнал-20П исп.01": "С2000-4",
    },
    Болид: {
      "Сигнал-20П исп.01": "С2000-4",
    },
  },
  sots: {
    "Базовый": {
      "Сигнал-20П исп.01": "С2000-4",
    },
    Болид: {
      "Сигнал-20П исп.01": "С2000-4",
    },
  },
  skud: {
    Parsec: {
      "NC-2000": "NC-60K.M",
      "NC-100K-IP": "NC-100K-IP.M",
    },
    Biosmart: {
      "BS-ACS-1": "BioSmart Prox-E",
      "BS-ACS-2": "BioSmart KeyPass",
      "BS-ACS-4": "BioSmart UniPass Pro 2",
    },
  },
};

const EXTRA_DISCONTINUED_MODEL_REPLACEMENTS = {
  aps: {
    "Р СѓР±РµР¶": {
      "Р СѓР±РµР¶-2РћРџ РїСЂРѕС‚.R3": "R3-Р СѓР±РµР¶-2РћРџ",
      "Р СѓР±РµР¶-20Рџ": "R3-Р СѓР±РµР¶-20Рџ",
    },
    "РђСЂРіСѓСЃ-РЎРїРµРєС‚СЂ": {
      "Р Р РћРџ2": "РџР°РЅРµР»СЊ-2-ПРО",
    },
  },
  sots: {
    "Р СѓР±РµР¶": {
      "РџРџРљРћРџ Р СѓР±РµР¶-20Рџ": "R3-Р СѓР±РµР¶-20Рџ",
    },
    "РђСЂРіСѓСЃ-РЎРїРµРєС‚СЂ": {
      "Р Р РћРџ2": "РџР°РЅРµР»СЊ-2-ПРО",
    },
  },
};

function resolveLifecycleVendorMap(catalog, systemType, vendor) {
  const systemCatalog = catalog?.[systemType];
  if (!systemCatalog) return {};
  const normalizedVendor = sanitizeDisplayText(vendor).toLowerCase();
  const resolvedVendorKey =
    Object.keys(systemCatalog).find((key) => sanitizeDisplayText(key).toLowerCase() === normalizedVendor) || vendor;
  return systemCatalog?.[resolvedVendorKey] || {};
}

function normalizeLifecycleModel(systemType, vendor, model) {
  const safeModel = sanitizeDisplayText(model).trim();
  if (!safeModel) return "";
  const normalizedVendor = sanitizeDisplayText(vendor).trim().toLowerCase();

  if (systemType === "aps" && normalizedVendor === "рубеж") {
    if (safeModel === "Рубеж-2ОП прот.R3") return "R3-Рубеж-2ОП";
    if (safeModel === "Рубеж-20П") return "R3-Рубеж-20П";
  }

  if (systemType === "sots" && normalizedVendor === "рубеж") {
    if (safeModel === "ППКОП Рубеж-20П") return "R3-Рубеж-20П";
  }

  if ((systemType === "aps" || systemType === "sots") && normalizedVendor === "аргус-спектр") {
    if (safeModel === "РРОП2") return "Панель-2-ПРО";
  }

  const vendorMap = {
    ...resolveLifecycleVendorMap(DISCONTINUED_MODEL_REPLACEMENTS, systemType, vendor),
    ...resolveLifecycleVendorMap(EXTRA_DISCONTINUED_MODEL_REPLACEMENTS, systemType, vendor),
  };
  if (!Object.keys(vendorMap).length) return safeModel;
  return sanitizeDisplayText(vendorMap[safeModel] || safeModel).trim();
}

const CONCRETE_MODEL_CATALOG = repairCatalogNode({
  sot: {
    "Р‘Р°Р·РѕРІС‹Р№": {
      camera: {
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_2": "DS-2CD1123G2-LIU",
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_4": "DS-2CD2143G2-IU",
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_8": "DS-2CD2183G2-IU",
        "СѓР»РёС‡РЅС‹Рµ_2": "DS-2CD2T23G2-2I",
        "СѓР»РёС‡РЅС‹Рµ_4": "DS-2CD2T43G2-4I",
        "СѓР»РёС‡РЅС‹Рµ_8": "DS-2CD2T83G2-4I",
      },
      recorder: { 8: "DS-7108NI-Q1/M", 16: "DS-7616NXI-K2", 32: "DS-7732NXI-K4", 64: "DS-7764NXI-K4" },
      hdd: { 4: "WD Purple 4TB", 8: "WD Purple 8TB", 12: "WD Purple Pro 12TB", 16: "WD Purple Pro 16TB" },
      switch: {
        "8_true": "DS-3E0510HP-E",
        "16_true": "DS-3E0518HP-E",
        "24_true": "DS-3E0526P-E/M",
        "48_true": "DS-3E0552P-E",
        "8_false": "DS-3E0109P-E/M",
        "16_false": "DS-3E0318P-E/M",
        "24_false": "DS-3E0326P-E/M",
        "48_false": "DS-3E0352P-E",
      },
    },
    Hikvision: {
      camera: {
        "внутренние_2": "DS-2CD1123G2-LIU",
        "внутренние_4": "DS-2CD2143G2-IU",
        "внутренние_8": "DS-2CD2183G2-IU",
        "уличные_2": "DS-2CD2T23G2-2I",
        "уличные_4": "DS-2CD2T43G2-4I",
        "уличные_8": "DS-2CD2T83G2-4I",
      },
      recorder: { 8: "iDS-7108NXI-M1/S", 16: "iDS-7716NXI-M4/X", 32: "DS-7732NXI-K4", 64: "DS-7764NXI-K4" },
      hdd: { 4: "WD Purple 4TB", 8: "WD Purple 8TB", 12: "WD Purple Pro 12TB", 16: "WD Purple Pro 16TB" },
      switch: {
        "8_true": "DS-3E0510HP-E",
        "16_true": "DS-3E0518HP-E",
        "24_true": "DS-3E0526P-E/M",
        "48_true": "DS-3E0552P-E",
        "8_false": "DS-3E0109P-E/M",
        "16_false": "DS-3E0318P-E/M",
        "24_false": "DS-3E0326P-E/M",
        "48_false": "DS-3E0352P-E",
      },
    },
    Dahua: {
      camera: {
        "внутренние_2": "DH-IPC-HDW2230TP-AS-0280B",
        "внутренние_4": "DH-IPC-HDW2439TP-AS-LED-0280B",
        "внутренние_8": "DH-IPC-HDW2849TMP-S-IL-0280B",
        "уличные_2": "DH-IPC-HFW2230SP-S-0280B",
        "уличные_4": "DH-IPC-HFW2449SP-S-IL-0280B",
        "уличные_8": "DH-IPC-HFW2849TP-AS-LED-0280B",
      },
      recorder: { 8: "DHI-NVR2108HS-I2", 16: "DHI-NVR4216-4KS3", 32: "DHI-NVR5232-EI", 64: "DHI-NVR5864-EI" },
      hdd: { 4: "Seagate SkyHawk 4TB", 8: "Seagate SkyHawk 8TB", 12: "Seagate SkyHawk AI 12TB", 16: "Seagate SkyHawk AI 16TB" },
      switch: {
        "8_true": "PFS3010-8ET-96",
        "16_true": "PFS4218-16ET-190",
        "24_true": "PFS3226-24ET-240",
        "48_true": "PFS4252-48GT4XF-370",
        "8_false": "PFS3009-8ET1GT",
        "16_false": "PFS3018-16GT",
        "24_false": "PFS3024-24GT",
        "48_false": "PFS3048-48GT",
      },
    },
    TRASSIR: {
      camera: {
        "внутренние_2": "TR-D2121IR3 v6",
        "внутренние_4": "TR-D2B5 v2",
        "внутренние_8": "TR-D8221WDIR7 v2",
        "уличные_2": "TR-D2123IR6 v6",
        "уличные_4": "TR-D4B6 v3",
        "уличные_8": "TR-D8281WDIR8 v2",
      },
      recorder: { 8: "NeuroStation Compact 8", 16: "NeuroStation Compact 16", 32: "NeuroStation 8800R/32", 64: "NeuroStation 8800R/64" },
      hdd: { 4: "Seagate SkyHawk 4TB", 8: "Seagate SkyHawk 8TB", 12: "Seagate SkyHawk AI 12TB", 16: "Seagate SkyHawk AI 16TB" },
      switch: {
        "8_true": "TR-NS108P",
        "16_true": "TR-NS116P",
        "24_true": "TR-NS224P",
        "48_true": "TR-NS248P",
        "8_false": "TR-NS108",
        "16_false": "TR-NS116",
        "24_false": "TR-NS224",
        "48_false": "TR-NS248",
      },
    },
    Axis: {
      camera: {
        "внутренние_2": "M3085-V",
        "внутренние_4": "M4216-V",
        "внутренние_8": "P3268-LVE",
        "уличные_2": "P1465-LE",
        "уличные_4": "P1467-LE",
        "уличные_8": "Q1808-LE",
      },
      recorder: { 8: "S3008 Recorder", 16: "S3016 Recorder", 32: "S3050 Recorder", 64: "S3064 Recorder" },
      hdd: { 4: "WD Purple 4TB", 8: "WD Purple 8TB", 12: "WD Purple Pro 12TB", 16: "WD Purple Pro 16TB" },
      switch: {
        "8_true": "T8504-R",
        "16_true": "D8208-R",
        "24_true": "D8212-VE",
        "48_true": "D8308-R",
        "8_false": "TS1001",
        "16_false": "TU1001-VE",
        "24_false": "TU6004-E",
        "48_false": "TU8001-E",
      },
    },
    Uniview: {
      camera: {
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_2": "IPC3612LB-AF28K-G",
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_4": "IPC3614LB-AF28K-G",
        "РІРЅСѓС‚СЂРµРЅРЅРёРµ_8": "IPC3618LE-ADF28KM-G",
        "СѓР»РёС‡РЅС‹Рµ_2": "IPC2322LB-ADZK-G",
        "СѓР»РёС‡РЅС‹Рµ_4": "IPC2324LB-ADZK-G",
        "СѓР»РёС‡РЅС‹Рµ_8": "IPC2328SB-DZK-I0",
      },
      recorder: { 8: "NVR301-08S3", 16: "NVR301-16S3", 32: "NVR302-32S", 64: "NVR304-64S" },
      hdd: { 4: "Seagate SkyHawk 4TB", 8: "Seagate SkyHawk 8TB", 12: "Seagate SkyHawk AI 12TB", 16: "Seagate SkyHawk AI 16TB" },
      switch: {
        "8_true": "NSW2010-10T-POE-IN",
        "16_true": "NSW2018-16T2GC-POE-IN",
        "24_true": "NSW2026-24T1GT1GC-POE-IN",
        "48_true": "NSW2052-48T4GC-POE-IN",
        "8_false": "NSW2010-10T-IN",
        "16_false": "NSW2018-16T2GC-IN",
        "24_false": "NSW2026-24T1GT1GC-IN",
        "48_false": "NSW2050-48T4GC-IN",
      },
    },
  },
  ssoi: {
    "Р‘Р°Р·РѕРІС‹Р№": {
      recorder: { 8: "TRASSIR NeuroStation Compact 8", 16: "TRASSIR NeuroStation Compact 16", 32: "TRASSIR NeuroStation 8800R/32", 64: "TRASSIR NeuroStation 8800R/64" },
      switch: {
        "8_true": "Cisco CBS250-8P-E-2G",
        "16_true": "Cisco CBS250-16P-2G",
        "24_true": "Cisco CBS250-24P-4G",
        "48_true": "Cisco CBS250-48P-4G",
        "8_false": "Cisco CBS250-8T-E-2G",
        "16_false": "Cisco CBS250-16T-2G",
        "24_false": "Cisco CBS250-24T-4G",
        "48_false": "Cisco CBS250-48T-4G",
      },
    },
    TRASSIR: {
      recorder: { 8: "NeuroStation Compact 8", 16: "NeuroStation Compact 16", 32: "NeuroStation 8800R/32", 64: "NeuroStation 8800R/64" },
      switch: {
        "8_true": "TR-NS108P",
        "16_true": "TR-NS116P",
        "24_true": "TR-NS224P",
        "48_true": "TR-NS248P",
        "8_false": "TR-NS108",
        "16_false": "TR-NS116",
        "24_false": "TR-NS224",
        "48_false": "TR-NS248",
      },
    },
    "ISS (Интеллект)": {
      recorder: { 8: "Интеллект XServer S", 16: "Интеллект XServer M", 32: "Интеллект XServer L", 64: "Интеллект XServer XL" },
      switch: {
        "8_true": "Cisco CBS250-8P-E-2G",
        "16_true": "Cisco CBS250-16P-2G",
        "24_true": "Cisco CBS250-24P-4G",
        "48_true": "Cisco CBS250-48P-4G",
        "8_false": "Cisco CBS250-8T-E-2G",
        "16_false": "Cisco CBS250-16T-2G",
        "24_false": "Cisco CBS250-24T-4G",
        "48_false": "Cisco CBS250-48T-4G",
      },
    },
    Macroscop: {
      recorder: { 8: "Macroscop NVR Mini", 16: "Macroscop NVR 16", 32: "Macroscop NVR 32", 64: "Macroscop Ultra 64" },
      switch: {
        "8_true": "D-Link DGS-1100-10MPV2",
        "16_true": "D-Link DGS-1210-18MP",
        "24_true": "D-Link DGS-1210-28MP",
        "48_true": "D-Link DGS-1210-52MP",
        "8_false": "D-Link DGS-1100-10",
        "16_false": "D-Link DGS-1210-16",
        "24_false": "D-Link DGS-1210-28",
        "48_false": "D-Link DGS-1210-52",
      },
    },
    AxxonSoft: {
      recorder: { 8: "Axxon PSIM S", 16: "Axxon PSIM M", 32: "Axxon PSIM L", 64: "Axxon PSIM XL" },
      switch: {
        "8_true": "Cisco CBS250-8P-E-2G",
        "16_true": "Cisco CBS250-16P-2G",
        "24_true": "Cisco CBS250-24P-4G",
        "48_true": "Cisco CBS250-48P-4G",
        "8_false": "Cisco CBS250-8T-E-2G",
        "16_false": "Cisco CBS250-16T-2G",
        "24_false": "Cisco CBS250-24T-4G",
        "48_false": "Cisco CBS250-48T-4G",
      },
    },
  },
  sots: {
    "Базовый": {
      sensor: { "ИК": "С2000-ИК исп.03", "ИК+СВЧ": "С2000-СТИК", "вибрационный": "Шорох-2" },
      panel: { 2: "С2000-4", 4: "Сигнал-10", 8: "Сигнал-20М" },
    },
    "Болид": {
      sensor: { "ИК": "С2000-ИК исп.03", "ИК+СВЧ": "С2000-СТИК", "вибрационный": "Шорох-2" },
      panel: { 2: "С2000-4", 4: "Сигнал-10", 8: "Сигнал-20М" },
    },
    "Рубеж": {
      sensor: { "ИК": "ИО 409-28 Рубеж", "ИК+СВЧ": "ИО 414-1 Рубеж", "вибрационный": "ИО 102-26 исп.200" },
      panel: { 2: "ППКОП R3-Рубеж-2ОП", 4: "ППКОП R3-Рубеж-4ОП", 8: "ППКОП Рубеж-20П" },
    },
    "Аргус-Спектр": {
      sensor: { "ИК": "Икар-5РА", "ИК+СВЧ": "Икар-Ш", "вибрационный": "Стекло-3" },
      panel: { 2: "РРОП2", 4: "Стрелец-ПРО Контроллер", 8: "ППКОП Стрелец-Интеграл" },
    },
  },
  skud: {
    "Базовый": { controller: { 1: "Sigur E2", 2: "Sigur E210", 4: "Sigur E510" } },
    Sigur: { controller: { 1: "E510", 2: "E210", 4: "E5100" } },
    Parsec: { controller: { 1: "NC-100K-IP.M", 2: "NC-60K.M", 4: "2x NC-60K.M" } },
    PERCo: { controller: { 1: "CT/L04.2", 2: "CT/L14.1", 4: "CR11.2" } },
    Biosmart: { controller: { 1: "BioSmart Prox-E", 2: "BioSmart KeyPass", 4: "BioSmart UniPass Pro 2" } },
    RusGuard: { controller: { 1: "ACS-105-CE-BM", 2: "ACS-202-CE-BM", 4: "ACS-402-CE-BM" } },
    Bastion: { controller: { 1: "SPRUT PACS-02NET", 2: "SKAT AC 02NET PACS", 4: "2x SKAT AC 02NET PACS" } },
  },
  aps: {
    "Базовый": {
      detector: { "дымовой": "ДИП-34А-03", "тепловой": "С2000-ИП-03", "комбинированный": "С2000-ИПГ" },
      panel: { 2: "С2000-4", 4: "С2000-КДЛ", 8: "С2000М + С2000-КДЛ" },
    },
    "Болид": {
      detector: { "дымовой": "ДИП-34А-03", "тепловой": "С2000-ИП-03", "комбинированный": "С2000-ИПГ" },
      panel: { 2: "Сириус", 4: "Сириус", 8: "Сириус" },
    },
    "Рубеж": {
      detector: { "дымовой": "ИП 212-64-R3", "тепловой": "ИП 101-29-PR-R3", "комбинированный": "ИП 212/101-64-PR-R3" },
      panel: { 2: "R3-Рубеж-2ОП", 4: "Рубеж-2ОП прот.R3", 8: "Рубеж-20П" },
    },
    "Аргус-Спектр": {
      detector: { "дымовой": "Аврора-Д-ПРО", "тепловой": "Аврора-Т-ПРО", "комбинированный": "Аврора-ДТ-ПРО" },
      panel: { 2: "Стрелец-ПРО ППКУП", 4: "Стрелец-Интеграл", 8: "ППКУП Стрелец-ПРО" },
    },
    Simplex: {
      detector: { "дымовой": "4098-9714", "тепловой": "4098-9733", "комбинированный": "4098-9754" },
      panel: { 2: "4007ES", 4: "4100ES", 8: "4100ES Expanded" },
    },
    Siemens: {
      detector: { "дымовой": "OP720", "тепловой": "HI720", "комбинированный": "OH720" },
      panel: { 2: "FC722-ZZ", 4: "FC726-ZA", 8: "FC724-ZZ" },
    },
  },
  soue: {
    "Базовый": {
      speaker: { "настенный": "ОПОП 124-R3", "потолочный": "АС-4-1", "рупорный": "ОПОП 2-35" },
      amplifier: { 2: "Рупор-200", 4: "Рупор-300", 8: "Рупор-Диспетчер исп.02" },
    },
    "Болид": {
      speaker: { "настенный": "ОПОП 124-R3", "потолочный": "АС-4-1", "рупорный": "ОПОП 2-35" },
      amplifier: { 2: "Рупор-200", 4: "Рупор-300", 8: "Рупор-Диспетчер исп.02" },
    },
    "Рубеж": {
      speaker: { "настенный": "ОПОП 124-R3", "потолочный": "ОПОП 024-R3", "рупорный": "ОПОП 2-R3" },
      amplifier: { 2: "RM-2", 4: "RM-4", 8: "Sonar SCA-8240" },
    },
    Roxton: {
      speaker: { "настенный": "PA-620T", "потолочный": "PC-06T", "рупорный": "HS-30RT" },
      amplifier: { 2: "PA-200D", 4: "AA-1204", 8: "AA-2408" },
    },
  },
});

const CONCRETE_MODEL_FALLBACK = {
  sots: {
    "\u0411\u043e\u043b\u0438\u0434": {
      sensor: {
        "\u0418\u041a": "\u04212000-\u0418\u041a \u0438\u0441\u043f.03",
        "\u0418\u041a+\u0421\u0412\u0427": "\u04212000-\u0421\u0422\u0418\u041a",
        "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0428\u043e\u0440\u043e\u0445-2",
      },
      panel: { 2: "\u0421\u0438\u0433\u043d\u0430\u043b-20\u041f \u0438\u0441\u043f.01", 4: "\u0421\u0438\u0433\u043d\u0430\u043b-10", 8: "\u0421\u0438\u0433\u043d\u0430\u043b-20\u041c" },
    },
    "\u0420\u0443\u0431\u0435\u0436": {
      sensor: {
        "\u0418\u041a": "\u0418\u041e 409-28 \u0420\u0443\u0431\u0435\u0436",
        "\u0418\u041a+\u0421\u0412\u0427": "\u0418\u041e 414-1 \u0420\u0443\u0431\u0435\u0436",
        "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0418\u041e 102-26 \u0438\u0441\u043f.200",
      },
      panel: { 2: "\u041f\u041f\u041a\u041e\u041f R3-\u0420\u0443\u0431\u0435\u0436-2\u041e\u041f", 4: "\u041f\u041f\u041a\u041e\u041f R3-\u0420\u0443\u0431\u0435\u0436-4\u041e\u041f", 8: "\u041f\u041f\u041a\u041e\u041f \u0420\u0443\u0431\u0435\u0436-20\u041f" },
    },
    "\u0410\u0440\u0433\u0443\u0441-\u0421\u043f\u0435\u043a\u0442\u0440": {
      sensor: {
        "\u0418\u041a": "\u0418\u043a\u0430\u0440-5\u0420\u0410",
        "\u0418\u041a+\u0421\u0412\u0427": "\u0418\u043a\u0430\u0440-\u0428",
        "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0421\u0442\u0435\u043a\u043b\u043e-3",
      },
      panel: { 2: "\u0420\u0420\u041e\u041f2", 4: "\u0421\u0442\u0440\u0435\u043b\u0435\u0446-\u041f\u0420\u041e \u041a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440", 8: "\u041f\u041f\u041a\u041e\u041f \u0421\u0442\u0440\u0435\u043b\u0435\u0446-\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b" },
    },
  },
};

const MANAGEMENT_MODEL_FALLBACK = {
  server: {
    compact: "iRU Rock 1206 / совместимый сервер управления",
    rack: "iRU Rock G2212 / совместимый сервер управления",
    enterprise: "DEPO Storm 3450 / совместимый сервер управления",
    default: "iRU Rock G2212 / совместимый сервер управления",
  },
  arm: {
    compact: "iRU Office 310 MT",
    rack: "iRU Office 515 MT",
    enterprise: "iRU Office 715 MT",
    default: "iRU Office 515 MT",
  },
};

const MANAGEMENT_HARDWARE_FALLBACK = {
  server: {
    compact: "Совместимый сервер управления, tower",
    rack: "Совместимый сервер управления, rack",
    enterprise: "Отказоустойчивый сервер управления",
    default: "Совместимый сервер управления, rack",
  },
  arm: {
    compact: "Совместимый АРМ оператора",
    rack: "Совместимый АРМ оператора",
    enterprise: "Совместимый диспетчерский АРМ",
    default: "Совместимый АРМ оператора",
  },
};

const BOLID_LIFE_SAFETY_SYSTEMS = new Set(["aps", "soue", "sots"]);
const BOLID_SERVER_STACK_PRICE = 22964 + 266111 + 8857 + 4429;
const BOLID_SERVER_HARDWARE_PRICE = Math.max(937591 - BOLID_SERVER_STACK_PRICE, 0);
const BOLID_URM_PRICE = 199175;
const BOLID_SIRIUS_PRICE = 36160;
const BOLID_KDL_S_PRICE = 3847;
const BOLID_ARM_EXTRA_SOFTWARE_PRICE = 8857 + 4429;
const BOLID_OPERATIONAL_TASK_TIERS = [
  { limit: 4, execution: 4, price: 17672 },
  { limit: 10, execution: 10, price: 35487 },
  { limit: 20, execution: 20, price: 62119 },
  { limit: 127, execution: 127, price: 106527 },
  { limit: 512, execution: 512, price: 266111 },
  { limit: 1024, execution: 1024, price: 399165 },
];

const MANAGEMENT_MODEL_BY_VENDOR = {
  aps: {
    "Болид": {
      server: {
        compact: "Orion Pro Server Compact",
        rack: "Orion Pro Server",
        enterprise: "Orion Pro Server Cluster",
        default: "Orion Pro Server",
      },
      arm: {
        compact: "Orion Pro ARM Compact",
        rack: "Orion Pro ARM",
        enterprise: "Orion Pro ARM Dispatch",
        default: "Orion Pro ARM",
      },
    },
    "Рубеж": {
      server: {
        compact: "FireSec 3 Server Compact",
        rack: "FireSec 3 Server",
        enterprise: "FireSec 3 Server Cluster",
        default: "FireSec 3 Server",
      },
      arm: {
        compact: "FireSec 3 ARM Compact",
        rack: "FireSec 3 ARM",
        enterprise: "FireSec 3 Dispatch ARM",
        default: "FireSec 3 ARM",
      },
    },
    "Аргус-Спектр": {
      server: {
        compact: "Стрелец-Интеграл Server Compact",
        rack: "Стрелец-Интеграл Server",
        enterprise: "Стрелец-Интеграл Server Cluster",
        default: "Стрелец-Интеграл Server",
      },
      arm: {
        compact: "Стрелец-Интеграл ARM Compact",
        rack: "Стрелец-Интеграл ARM",
        enterprise: "Стрелец-Интеграл ARM Dispatch",
        default: "Стрелец-Интеграл ARM",
      },
    },
  },
  soue: {
    "Болид": {
      server: { compact: "Orion Pro Server Compact", rack: "Orion Pro Server", enterprise: "Orion Pro Server Cluster", default: "Orion Pro Server" },
      arm: { compact: "Orion Pro ARM Compact", rack: "Orion Pro ARM", enterprise: "Orion Pro ARM Dispatch", default: "Orion Pro ARM" },
    },
    "Рубеж": {
      server: { compact: "FireSec 3 Server Compact", rack: "FireSec 3 Server", enterprise: "FireSec 3 Server Cluster", default: "FireSec 3 Server" },
      arm: { compact: "FireSec 3 ARM Compact", rack: "FireSec 3 ARM", enterprise: "FireSec 3 Dispatch ARM", default: "FireSec 3 ARM" },
    },
    "Аргус-Спектр": {
      server: { compact: "Стрелец-Интеграл Server Compact", rack: "Стрелец-Интеграл Server", enterprise: "Стрелец-Интеграл Server Cluster", default: "Стрелец-Интеграл Server" },
      arm: { compact: "Стрелец-Интеграл ARM Compact", rack: "Стрелец-Интеграл ARM", enterprise: "Стрелец-Интеграл ARM Dispatch", default: "Стрелец-Интеграл ARM" },
    },
  },
  sots: {
    "Болид": {
      server: { compact: "Orion Pro Server Compact", rack: "Orion Pro Server", enterprise: "Orion Pro Server Cluster", default: "Orion Pro Server" },
      arm: { compact: "Orion Pro ARM Compact", rack: "Orion Pro ARM", enterprise: "Orion Pro ARM Dispatch", default: "Orion Pro ARM" },
    },
    "Рубеж": {
      server: { compact: "R3-Рубеж Server Compact", rack: "R3-Рубеж Server", enterprise: "R3-Рубеж Server Cluster", default: "R3-Рубеж Server" },
      arm: { compact: "R3-Рубеж ARM Compact", rack: "R3-Рубеж ARM", enterprise: "R3-Рубеж ARM Dispatch", default: "R3-Рубеж ARM" },
    },
    "Аргус-Спектр": {
      server: { compact: "Стрелец-Интеграл Server Compact", rack: "Стрелец-Интеграл Server", enterprise: "Стрелец-Интеграл Server Cluster", default: "Стрелец-Интеграл Server" },
      arm: { compact: "Стрелец-Интеграл ARM Compact", rack: "Стрелец-Интеграл ARM", enterprise: "Стрелец-Интеграл ARM Dispatch", default: "Стрелец-Интеграл ARM" },
    },
  },
  sot: {
    Hikvision: {
      server: { compact: "HikCentral Professional Workstation", rack: "HikCentral Professional Server", enterprise: "HikCentral Enterprise Server", default: "HikCentral Professional Server" },
      arm: { compact: "HikCentral Client ARM", rack: "HikCentral Operator Station", enterprise: "HikCentral Dispatch ARM", default: "HikCentral Operator Station" },
    },
    Dahua: {
      server: { compact: "DSS Express Workstation", rack: "DSS Professional Server", enterprise: "DSS Professional Enterprise Server", default: "DSS Professional Server" },
      arm: { compact: "DSS Client ARM", rack: "DSS Operator Station", enterprise: "DSS Dispatch ARM", default: "DSS Operator Station" },
    },
    TRASSIR: {
      server: { compact: "NeuroStation Compact", rack: "NeuroStation 8800R", enterprise: "NeuroStation Cluster", default: "NeuroStation 8800R" },
      arm: { compact: "TRASSIR Client Compact", rack: "TRASSIR Operator Station", enterprise: "TRASSIR Dispatch ARM", default: "TRASSIR Operator Station" },
    },
    Axis: {
      server: { compact: "AXIS Camera Station S12", rack: "AXIS Camera Station Server", enterprise: "AXIS Camera Station Enterprise Server", default: "AXIS Camera Station Server" },
      arm: { compact: "AXIS Client ARM", rack: "AXIS Operator Station", enterprise: "AXIS Dispatch ARM", default: "AXIS Operator Station" },
    },
    Uniview: {
      server: { compact: "EZStation Compact Server", rack: "Uniview VMS Server", enterprise: "Uniview VMS Enterprise Server", default: "Uniview VMS Server" },
      arm: { compact: "EZStation Client ARM", rack: "EZStation Operator Station", enterprise: "EZStation Dispatch ARM", default: "EZStation Operator Station" },
    },
  },
  ssoi: {
    TRASSIR: {
      server: { compact: "NeuroStation Compact", rack: "NeuroStation 8800R", enterprise: "NeuroStation Cluster", default: "NeuroStation 8800R" },
      arm: { compact: "TRASSIR Client Compact", rack: "TRASSIR Operator Station", enterprise: "TRASSIR Dispatch ARM", default: "TRASSIR Operator Station" },
    },
    "ISS (Интеллект)": {
      server: { compact: "Интеллект XServer S", rack: "Интеллект XServer L", enterprise: "Интеллект XServer XL", default: "Интеллект XServer L" },
      arm: { compact: "Интеллект ARM Compact", rack: "Интеллект Operator Station", enterprise: "Интеллект Dispatch ARM", default: "Интеллект Operator Station" },
    },
    Macroscop: {
      server: { compact: "Macroscop NVR Mini", rack: "Macroscop NVR 32", enterprise: "Macroscop Ultra 64", default: "Macroscop NVR 32" },
      arm: { compact: "Macroscop Client Compact", rack: "Macroscop Operator Station", enterprise: "Macroscop Dispatch ARM", default: "Macroscop Operator Station" },
    },
    AxxonSoft: {
      server: { compact: "Axxon PSIM S", rack: "Axxon PSIM L", enterprise: "Axxon PSIM XL", default: "Axxon PSIM L" },
      arm: { compact: "Axxon Client ARM", rack: "Axxon Operator Station", enterprise: "Axxon Dispatch ARM", default: "Axxon Operator Station" },
    },
  },
  skud: {
    Sigur: {
      server: { compact: "Sigur Server Compact", rack: "Sigur Server", enterprise: "Sigur Server Cluster", default: "Sigur Server" },
      arm: { compact: "Sigur Client ARM", rack: "Sigur Operator Station", enterprise: "Sigur Dispatch ARM", default: "Sigur Operator Station" },
    },
    Parsec: {
      server: { compact: "ParsecNET 3 Server Compact", rack: "ParsecNET 3 Server", enterprise: "ParsecNET 3 Server Cluster", default: "ParsecNET 3 Server" },
      arm: { compact: "ParsecNET 3 Client", rack: "ParsecNET 3 Operator Station", enterprise: "ParsecNET 3 Dispatch ARM", default: "ParsecNET 3 Operator Station" },
    },
    PERCo: {
      server: { compact: "PERCo-Web Server Compact", rack: "PERCo-Web Server", enterprise: "PERCo-Web Server Cluster", default: "PERCo-Web Server" },
      arm: { compact: "PERCo-Web Client", rack: "PERCo-Web Operator Station", enterprise: "PERCo-Web Dispatch ARM", default: "PERCo-Web Operator Station" },
    },
    Biosmart: {
      server: { compact: "BioSmart Studio Server Compact", rack: "BioSmart Studio Server", enterprise: "BioSmart Studio Server Cluster", default: "BioSmart Studio Server" },
      arm: { compact: "BioSmart Client ARM", rack: "BioSmart Operator Station", enterprise: "BioSmart Dispatch ARM", default: "BioSmart Operator Station" },
    },
    RusGuard: {
      server: { compact: "RusGuard Server Compact", rack: "RusGuard Server", enterprise: "RusGuard Server Cluster", default: "RusGuard Server" },
      arm: { compact: "RusGuard Client ARM", rack: "RusGuard Operator Station", enterprise: "RusGuard Dispatch ARM", default: "RusGuard Operator Station" },
    },
    Bastion: {
      server: { compact: "SPRUT Access Server Compact", rack: "SPRUT Access Server", enterprise: "SPRUT Access Server Cluster", default: "SPRUT Access Server" },
      arm: { compact: "SPRUT Access Client", rack: "SPRUT Access Operator Station", enterprise: "SPRUT Access Dispatch ARM", default: "SPRUT Access Operator Station" },
    },
  },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getAreaUnits(zones) {
  const safeArea = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0);
  return Math.max(safeArea / 1000, 1);
}

function getValue(input, fallback) {
  return input === undefined || input === null || input === "" ? fallback : input;
}

function makeDisplayName(label, model) {
  const safeLabel = sanitizeDisplayText(label);
  const safeModel = sanitizeDisplayText(model);
  return safeModel ? `${safeLabel} (${safeModel})` : safeLabel;
}

function pushItem(details, item) {
  details.push({
    ...item,
    name: sanitizeDisplayText(item.name),
    model: sanitizeDisplayText(item.model),
    basis: sanitizeDisplayText(item.basis),
    qty: Math.max(toNumber(item.qty), 1),
    unitPrice: Math.max(toNumber(item.unitPrice), 0),
  });
}

function hasDetailCode(details, code) {
  return details.some((item) => item.code === code);
}

function buildSupplementalArchitectureRow(component, qty, priceMultiplier = 1) {
  if (!component || qty <= 0) return null;
  return {
    code: component.code,
    name: component.name,
    model: component.model,
    qty,
    unitPrice: Math.max(toNumber(component.unitPrice, 0) * Math.max(toNumber(priceMultiplier, 1), 0.01), 0),
    total: qty * Math.max(toNumber(component.unitPrice, 0) * Math.max(toNumber(priceMultiplier, 1), 0.01), 0),
    isKey: Boolean(component.isKey),
    basis: component.basis || "",
  };
}

function minHddTbPerCamera(resolutionMp) {
  const perCameraPerDayTb = resolutionMp >= 8 ? 0.08 : resolutionMp >= 4 ? 0.045 : 0.025;
  return perCameraPerDayTb * 30;
}

function weightedMedian(entries = []) {
  const sorted = [...entries].sort((left, right) => left.ratio - right.ratio);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 1;

  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= totalWeight / 2) return item.ratio;
  }

  return sorted[sorted.length - 1]?.ratio || 1;
}

function resolveCategoryGuardrails(aliasKeys = []) {
  for (const key of aliasKeys || []) {
    if (CATEGORY_PRICE_GUARDRAILS[key]) return CATEGORY_PRICE_GUARDRAILS[key];
  }
  return { min: 0.78, max: 1.34 };
}

function buildMarketRatioMap(marketEntries = []) {
  const grouped = new Map();

  for (const entry of marketEntries || []) {
    const equipmentKey = entry?.equipmentKey;
    const fallback = toNumber(entry?.fallbackPrice, 0);
    const price = toNumber(entry?.price, 0);
    if (!equipmentKey || fallback <= 0 || price <= 0) continue;

    const confidence = clamp(toNumber(entry?.priceConfidence, 0.55), 0.15, 1);
    const hasManufacturerMatch = Array.isArray(entry?.matchedSourceHosts) && entry.matchedSourceHosts.length > 0;
    const weakEvidence = Boolean(entry?.recheckRequired) || toNumber(entry?.sourceCount, 0) < 2 || confidence < 0.45;
    if (weakEvidence && !hasManufacturerMatch) continue;

    const { min, max } = resolveCategoryGuardrails([equipmentKey]);
    const ratio = clamp(price / fallback, hasManufacturerMatch ? Math.max(min - 0.18, 0.45) : min, hasManufacturerMatch ? max + 0.22 : max);
    const weight = confidence * (hasManufacturerMatch ? 1.35 : 1) * (entry?.recheckRequired ? 0.55 : 1);
    if (!grouped.has(equipmentKey)) grouped.set(equipmentKey, []);
    grouped.get(equipmentKey).push({ ratio, weight });
  }

  const map = new Map();
  grouped.forEach((values, key) => {
    if (!values.length) return;
    const median = weightedMedian(values);
    const filtered = values.filter((item) => Math.abs(item.ratio - median) <= Math.max(median * 0.18, 0.12));
    const weightedAverage =
      filtered.reduce((sum, item) => sum + item.ratio * item.weight, 0) /
      Math.max(filtered.reduce((sum, item) => sum + item.weight, 0), 0.0001);
    const { min, max } = resolveCategoryGuardrails([key]);
    map.set(key, clamp(weightedAverage, min, max));
  });

  return map;
}

function pickMarketRatio(marketRatios, aliasKeys) {
  for (const key of aliasKeys || []) {
    if (marketRatios.has(key)) return marketRatios.get(key);
  }
  return 1;
}

function resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, aliasKeys, priceMultiplier = 1) {
  const ratio = pickMarketRatio(marketRatios, aliasKeys);
  const reference = toNumber(basePrice, 0) || toNumber(fallbackUnitPrice, 0);
  return Math.max(reference * ratio * Math.max(toNumber(priceMultiplier, 1), 0.01), 0);
}

function resolveManagementUnitPrice(systemType, vendor, unitType, marketRatios, priceMultiplier = 1) {
  const defaults = MANAGEMENT_UNIT_DEFAULTS[systemType] || MANAGEMENT_UNIT_DEFAULTS.ssoi;
  const vendorDefaults = MANAGEMENT_UNIT_VENDOR_OVERRIDES?.[systemType]?.[vendor] || null;
  const effectiveDefaults =
    vendorDefaults && (vendorDefaults.serverPrice || vendorDefaults.armPrice)
      ? {
          serverPrice: toNumber(vendorDefaults.serverPrice, defaults.serverPrice),
          armPrice: toNumber(vendorDefaults.armPrice, defaults.armPrice),
        }
      : defaults;
  const basePrice = unitType === "server" ? effectiveDefaults.serverPrice : effectiveDefaults.armPrice;
  const aliasKeys = unitType === "server" ? MARKET_KEY_ALIASES.recorder : MARKET_KEY_ALIASES.controller;
  return resolveUnitPrice(basePrice, basePrice, marketRatios, aliasKeys, priceMultiplier);
}

function resolveManagementModel(systemType, vendor, unitType, modelTier) {
  const vendorCatalog = MANAGEMENT_MODEL_BY_VENDOR?.[systemType]?.[vendor]?.[unitType];
  const unitCatalog = vendorCatalog || MANAGEMENT_MODEL_FALLBACK[unitType];
  if (!unitCatalog) return "";
  return unitCatalog[modelTier] || unitCatalog.default || "";
}

function estimateBolidManagedDeviceCount(quantityContext) {
  const secondary = quantityContext?.secondary || {};
  return Math.max(
    toNumber(secondary.mainPanels, 0) +
      toNumber(secondary.loopControllers, 0) +
      toNumber(secondary.controllers, 0) +
      toNumber(secondary.amplifiers, 0) +
      toNumber(secondary.powerUnits, 0),
    toNumber(quantityContext?.controllerUnits, 0),
    1
  );
}

function resolveBolidOperationalTaskTier(quantityContext) {
  return (
    BOLID_OPERATIONAL_TASK_TIERS.find((item) => estimateBolidManagedDeviceCount(quantityContext) <= item.limit) ||
    BOLID_OPERATIONAL_TASK_TIERS[BOLID_OPERATIONAL_TASK_TIERS.length - 1]
  );
}

function resolveManagementSoftwareModel(systemType, vendor, unitType, modelTier, managementPlan, quantityContext) {
  if (vendor === "Болид" && BOLID_LIFE_SAFETY_SYSTEMS.has(systemType)) {
    if (unitType === "server" && managementPlan?.deploymentMode === "server") {
      return 'ПО АРМ "Орион Про": Центральный сервер + Оперативная задача + АБД + ГО';
    }
    if (unitType === "arm") {
      const tier = resolveBolidOperationalTaskTier(quantityContext);
      return `ПО АРМ "Орион Про": Оперативная задача исп.${tier.execution} + АБД + ГО`;
    }
  }

  const softwareNameOverrides = {
    aps: {
      Рубеж: 'ПО FireSec 3',
      "Аргус-Спектр": 'ПО АРМ "Стрелец-Интеграл"',
      Simplex: "ПО Simplex 4100ES",
      Siemens: "ПО Cerberus PRO",
    },
    soue: {
      Болид: 'ПО АРМ "Орион Про"',
      Рубеж: "ПО FireSec 3",
      Roxton: "ПО Roxton",
    },
    sots: {
      Болид: 'ПО АРМ "Орион Про"',
      Рубеж: "ПО R3-Рубеж",
      "Аргус-Спектр": 'ПО АРМ "Стрелец-Интеграл"',
    },
    sot: {
      Hikvision: "ПО HikCentral Professional",
      Dahua: "ПО DSS Professional",
      TRASSIR: "ПО TRASSIR",
      Axis: "ПО AXIS Camera Station",
      Uniview: "ПО EZStation",
    },
    ssoi: {
      TRASSIR: "ПО TRASSIR",
      "ISS (Интеллект)": "ПО Интеллект X",
      Macroscop: "ПО Macroscop",
      AxxonSoft: "ПО Axxon PSIM",
    },
    skud: {
      Sigur: "ПО Sigur",
      Parsec: "ПО ParsecNET 3",
      PERCo: "ПО PERCo-Web",
      Biosmart: "ПО BioSmart Studio",
      RusGuard: "ПО RusGuard",
      Bastion: "ПО SPRUT Access",
    },
  };
  const vendorOverride = softwareNameOverrides?.[systemType]?.[vendor];
  if (vendorOverride) return vendorOverride;

  const model = resolveManagementModel(systemType, vendor, unitType, modelTier);
  if (!model) return unitType === "server" ? "ПО сервера управления" : "ПО рабочего места оператора";
  return /^ПО\b/i.test(model) ? model : `ПО ${model}`;
}

function resolveManagementHardwareModel(systemType, vendor, unitType, modelTier, managementPlan) {
  if (vendor === "Болид" && BOLID_LIFE_SAFETY_SYSTEMS.has(systemType) && managementPlan?.deploymentMode === "server") {
    if (unitType === "server") return "Сервер ОПС512 исп.02";
    if (unitType === "arm") return "УРМ-ОРИОН исп.02";
  }

  const vendorHardwareOverrides = {
    sot: {
      TRASSIR: {
        server: {
          compact: "NeuroStation Compact",
          rack: "NeuroStation 8800R",
          enterprise: "NeuroStation Cluster",
          default: "NeuroStation 8800R",
        },
      },
    },
    ssoi: {
      TRASSIR: {
        server: {
          compact: "NeuroStation Compact",
          rack: "NeuroStation 8800R",
          enterprise: "NeuroStation Cluster",
          default: "NeuroStation 8800R",
        },
      },
    },
  };

  const vendorCatalog = vendorHardwareOverrides?.[systemType]?.[vendor]?.[unitType];
  if (vendorCatalog) {
    return vendorCatalog[modelTier] || vendorCatalog.default || "";
  }

  const fallbackCatalog = MANAGEMENT_HARDWARE_FALLBACK[unitType];
  return fallbackCatalog?.[modelTier] || fallbackCatalog?.default || "";
}

function resolveManagementSoftwarePrice(systemType, vendor, unitType, marketRatios, priceMultiplier, managementPlan, quantityContext) {
  if (vendor === "Болид" && BOLID_LIFE_SAFETY_SYSTEMS.has(systemType)) {
    if (unitType === "server" && managementPlan?.deploymentMode === "server") {
      return BOLID_SERVER_STACK_PRICE;
    }
    if (unitType === "arm") {
      const tier = resolveBolidOperationalTaskTier(quantityContext);
      return tier.price + BOLID_ARM_EXTRA_SOFTWARE_PRICE;
    }
  }

  const bundlePrice = resolveManagementUnitPrice(systemType, vendor, unitType, marketRatios, priceMultiplier);
  const share = unitType === "server" ? 0.28 : 0.34;
  return Math.max(Number((bundlePrice * share).toFixed(2)), 0);
}

function resolveManagementHardwarePrice(
  systemType,
  vendor,
  unitType,
  marketRatios,
  priceMultiplier,
  managementPlan,
  quantityContext,
  softwareIncluded = false
) {
  if (vendor === "Болид" && BOLID_LIFE_SAFETY_SYSTEMS.has(systemType) && managementPlan?.deploymentMode === "server") {
    if (unitType === "server") return BOLID_SERVER_HARDWARE_PRICE;
    if (unitType === "arm") return BOLID_URM_PRICE;
  }

  const bundlePrice = resolveManagementUnitPrice(systemType, vendor, unitType, marketRatios, priceMultiplier);
  if (!softwareIncluded) return bundlePrice;

  const softwarePrice = resolveManagementSoftwarePrice(
    systemType,
    vendor,
    unitType,
    marketRatios,
    priceMultiplier,
    managementPlan,
    quantityContext
  );
  const hardwareFloorShare = unitType === "server" ? 0.52 : 0.46;
  return Math.max(Number((bundlePrice - softwarePrice).toFixed(2)), Number((bundlePrice * hardwareFloorShare).toFixed(2)), 0);
}

function appendFieldArchitectureRows(details, system, quantityContext, priceMultiplier) {
  const secondary = quantityContext?.secondary || {};
  const primaryUnits = Math.max(toNumber(quantityContext?.primaryUnits, 0), 0);

  const appendRow = (role, qty) => {
    if (qty <= 0) return;
    const component = getArchitectureComponent(system.type, system.vendor, role);
    const row = buildSupplementalArchitectureRow(component, qty, priceMultiplier);
    if (!row || hasDetailCode(details, row.code)) return;
    pushItem(details, row);
  };

  if (system.type === "aps") {
    appendRow("power", Math.max(toNumber(secondary.powerUnits, 0), 0));
    return;
  }

  if (system.type === "soue") {
    appendRow("controller", Math.max(toNumber(secondary.controllers, 0), 0));
    appendRow("cabinet", Math.max(Math.ceil((toNumber(secondary.controllers, 0) + toNumber(secondary.amplifiers, 0)) / 3), 0));
    return;
  }

  if (system.type === "sots") {
    appendRow("module", Math.max(toNumber(secondary.boundaries, 0), 0));
    appendRow("power", Math.max(toNumber(secondary.cabinets, 0), 0));
    return;
  }

  if (system.type === "skud") {
    appendRow("reader", Math.max(toNumber(secondary.readers, 0), 0));
    appendRow("lock", Math.max(toNumber(secondary.turnstiles, 0), primaryUnits, 0));
    appendRow("cabinet", Math.max(toNumber(secondary.cabinets, 0), 0));
    return;
  }

  if (system.type === "ssoi") {
    appendRow("gateway", Math.max(toNumber(secondary.gateways, 0), 0));
  }
}

function appendManagementInfrastructure(details, systemType, vendor, quantityContext, marketRatios, priceMultiplier) {
  const managementPlan = quantityContext?.secondary?.managementPlan;
  if (!managementPlan) return;

  const serverQty = Math.max(toNumber(managementPlan.serverCount, quantityContext?.secondary?.servers), 0);
  const armQty = Math.max(toNumber(managementPlan.armCount, quantityContext?.secondary?.arms), 0);
  const tierMultiplier =
    managementPlan.modelTier === "enterprise" ? 1.28 : managementPlan.modelTier === "rack" ? 1.14 : managementPlan.modelTier === "compact" ? 0.9 : 1;

  if (serverQty > 0) {
    const softwareModel = resolveManagementSoftwareModel(
      systemType,
      vendor,
      "server",
      managementPlan.modelTier,
      managementPlan,
      quantityContext
    );
    const softwarePrice = resolveManagementSoftwarePrice(
      systemType,
      vendor,
      "server",
      marketRatios,
      priceMultiplier * tierMultiplier,
      managementPlan,
      quantityContext
    );
    const hardwareModel = resolveManagementHardwareModel(systemType, vendor, "server", managementPlan.modelTier, managementPlan);
    const hardwarePrice = resolveManagementHardwarePrice(
      systemType,
      vendor,
      "server",
      marketRatios,
      priceMultiplier * tierMultiplier,
      managementPlan,
      quantityContext,
      true
    );

    pushItem(details, {
      code: "SRV_SW",
      name: `ПО серверного контура ${systemType.toUpperCase()}`,
      model: softwareModel,
      qty: serverQty,
      unitPrice: softwarePrice,
      total: serverQty * softwarePrice,
      isKey: true,
      basis: `${managementPlan.reason || ""} Отдельно выделено серверное программное обеспечение.`.trim(),
    });
    pushItem(details, {
      code: "SRV",
      name: `Сервер управления ${systemType.toUpperCase()}`,
      model: hardwareModel,
      qty: serverQty,
      unitPrice: hardwarePrice,
      total: serverQty * hardwarePrice,
      isKey: true,
      basis: `${managementPlan.reason || ""} Серверное оборудование выделено отдельной позицией от ПО.`.trim(),
    });
  }

  if (armQty > 0) {
    const armSoftwareRequired = managementPlan.deploymentMode !== "server";
    if (armSoftwareRequired) {
      const softwareModel = resolveManagementSoftwareModel(
        systemType,
        vendor,
        "arm",
        managementPlan.modelTier,
        managementPlan,
        quantityContext
      );
      const softwarePrice = resolveManagementSoftwarePrice(
        systemType,
        vendor,
        "arm",
        marketRatios,
        priceMultiplier,
        managementPlan,
        quantityContext
      );
      pushItem(details, {
        code: "ARM_SW",
        name: `ПО АРМ оператора ${systemType.toUpperCase()}`,
        model: softwareModel,
        qty: armQty,
        unitPrice: softwarePrice,
        total: armQty * softwarePrice,
        isKey: false,
        basis: "Локальное рабочее место должно учитывать отдельную лицензию операторского ПО.",
      });
    }

    const hardwareModel = resolveManagementHardwareModel(systemType, vendor, "arm", managementPlan.modelTier, managementPlan);
    const hardwarePrice = resolveManagementHardwarePrice(
      systemType,
      vendor,
      "arm",
      marketRatios,
      priceMultiplier,
      managementPlan,
      quantityContext,
      armSoftwareRequired
    );
    pushItem(details, {
      code: "ARM",
      name: `АРМ оператора ${systemType.toUpperCase()}`,
      model: hardwareModel,
      qty: armQty,
      unitPrice: hardwarePrice,
      total: armQty * hardwarePrice,
      isKey: false,
      basis: `${managementPlan.reason || ""} Рабочее место оператора отражено как отдельное аппаратное место.`.trim(),
    });
  }
}

export function getConcreteModel(systemType, vendor, itemType, optionKey) {
  const systemCatalog = CONCRETE_MODEL_CATALOG?.[systemType];
  const fallbackSystemCatalog = CONCRETE_MODEL_FALLBACK?.[systemType];
  if (!systemCatalog && !fallbackSystemCatalog) return "";

  const normalizedVendor = sanitizeDisplayText(vendor).toLowerCase();
  const normalizedOptionKey = sanitizeDisplayText(optionKey);
  const resolveFromCatalog = (catalog) => {
    if (!catalog) return "";
    const resolvedVendorKey = Object.keys(catalog).find((key) => sanitizeDisplayText(key).toLowerCase() === normalizedVendor) || vendor;
    const itemCatalog = catalog?.[resolvedVendorKey]?.[itemType];
    if (!itemCatalog || typeof itemCatalog !== "object") return "";
    const resolvedOptionKey =
      Object.keys(itemCatalog).find((key) => sanitizeDisplayText(key) === normalizedOptionKey || String(key) === String(optionKey)) || optionKey;
    return normalizeLifecycleModel(systemType, vendor, itemCatalog?.[resolvedOptionKey] || "");
  };

  return resolveFromCatalog(systemCatalog) || resolveFromCatalog(fallbackSystemCatalog);
}

function buildEditableModelEntries(itemType, itemMeta, systemType, vendor) {
  if (!itemMeta?.basePrices || typeof itemMeta.basePrices !== "object") return [];

  if (itemType === "camera") {
    const placements = Array.isArray(itemMeta.placement) ? itemMeta.placement : [];
    const resolutions = Array.isArray(itemMeta.resolution) ? itemMeta.resolution : [];
    return placements.flatMap((placement) =>
      resolutions.map((resolution) => {
        const optionKey = `${placement}_${resolution}`;
        return {
          optionKey,
          basePrice: toNumber(itemMeta.basePrices[optionKey], 0),
          model: getConcreteModel(systemType, vendor, itemType, optionKey),
        };
      })
    );
  }

  if (itemType === "switch") {
    const ports = Array.isArray(itemMeta.ports) ? itemMeta.ports : [];
    const poeValues = Array.isArray(itemMeta.poe) ? itemMeta.poe : [];
    return ports.flatMap((port) =>
      poeValues.map((poe) => {
        const optionKey = `${port}_${poe}`;
        return {
          optionKey,
          basePrice: toNumber(itemMeta.basePrices[optionKey], 0),
          model: getConcreteModel(systemType, vendor, itemType, optionKey),
        };
      })
    );
  }

  const numericOptions = itemMeta.channels || itemMeta.loops || itemMeta.tb;
  if (Array.isArray(numericOptions)) {
    return numericOptions.map((value) => ({
      optionKey: value,
      basePrice: toNumber(itemMeta.basePrices[value], 0),
      model: getConcreteModel(systemType, vendor, itemType, value),
    }));
  }

  const textOptions = itemMeta.kind || [];
  if (Array.isArray(textOptions)) {
    return textOptions.map((value) => ({
      optionKey: value,
      basePrice: toNumber(itemMeta.basePrices[value], 0),
      model: getConcreteModel(systemType, vendor, itemType, value),
    }));
  }

  return [];
}

export function getEditableModelOptions(systemType, vendor, itemCode) {
  const itemType = EDITABLE_ITEM_CODE_MAP[String(itemCode || "").trim().toUpperCase()];
  if (!itemType) return [];

  const vendorMeta = resolveVendorEquipment(systemType, vendor);
  if (!vendorMeta?.[itemType]) return [];

  return buildEditableModelEntries(itemType, vendorMeta[itemType], systemType, vendor)
    .filter((item) => item.model && item.basePrice > 0)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.model === item.model) === index);
}

export function resolveModelPriceOverride(systemType, vendor, itemCode, nextModel, currentModel, currentUnitPrice) {
  const options = getEditableModelOptions(systemType, vendor, itemCode);
  const normalizedNextModel = normalizeLifecycleModel(systemType, vendor, nextModel);
  const normalizedCurrentModel = normalizeLifecycleModel(systemType, vendor, currentModel);
  const nextOption = options.find((item) => item.model === normalizedNextModel);
  if (!nextOption) {
    return {
      model: normalizedNextModel,
      unitPrice: Math.max(toNumber(currentUnitPrice, 0), 0),
    };
  }

  const currentOption = options.find((item) => item.model === normalizedCurrentModel);
  const currentBasePrice = toNumber(currentOption?.basePrice, 0);
  const currentPrice = Math.max(toNumber(currentUnitPrice, 0), 0);
  const appliedRatio = currentBasePrice > 0 && currentPrice > 0 ? currentPrice / currentBasePrice : 1;

  return {
    model: nextOption.model,
    unitPrice: Math.max(Number((nextOption.basePrice * appliedRatio).toFixed(2)), 0),
  };
}

export function isLifecycleModelAllowed(systemType, vendor, model) {
  return normalizeLifecycleModel(systemType, vendor, model) === sanitizeDisplayText(model).trim();
}

function resolveQuantity(systemType, itemType, quantityContext, fallbackQty) {
  const primaryUnits = Math.max(toNumber(quantityContext?.primaryUnits, 0), 0);
  const secondary = quantityContext?.secondary || {};
  const fallback = Math.max(toNumber(fallbackQty, 0), 1);

  switch (`${systemType}:${itemType}`) {
    case "sot:camera":
      return Math.max(primaryUnits, fallback);
    case "sot:recorder":
      return Math.max(toNumber(secondary.nvr, 0), fallback);
    case "sot:switch":
      return Math.max(toNumber(secondary.switches, 0), fallback);
    case "ssoi:recorder":
      return Math.max(toNumber(secondary.servers, 0), fallback);
    case "ssoi:switch":
      return Math.max(toNumber(secondary.switches, 0), fallback);
    case "sots:sensor":
      return Math.max(primaryUnits, fallback);
    case "sots:panel":
      return Math.max(toNumber(secondary.controllers, 0), fallback);
    case "skud:controller":
      return Math.max(toNumber(secondary.controllers, 0), fallback);
    case "aps:detector":
      return Math.max(primaryUnits, fallback);
    case "aps:panel":
      return Math.max(toNumber(secondary.panels, 0), fallback);
    case "soue:speaker":
      return Math.max(primaryUnits, fallback);
    case "soue:amplifier":
      return Math.max(toNumber(secondary.amplifiers, 0), fallback);
    default:
      return fallback;
  }
}

export function calculateEquipment(
  system,
  zones,
  selectedParams = {},
  fallbackUnitPrice = 0,
  marketEntries = [],
  quantityContext = null,
  priceMultiplier = 1
) {
  const areaUnits = getAreaUnits(zones);
  const vendorMeta = resolveVendorEquipment(system.type, system.vendor);
  const marketRatios = buildMarketRatioMap(marketEntries);

  if (!vendorMeta) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
      keyEquipment: [],
    };
  }

  const details = [];

  if (vendorMeta.camera) {
    const placement = getValue(selectedParams.cameraPlacement, vendorMeta.camera.placement[0]);
    const resolution = Number(getValue(selectedParams.cameraResolution, vendorMeta.camera.resolution[1] || vendorMeta.camera.resolution[0]));
    const key = `${placement}_${resolution}`;
    const model = getConcreteModel(system.type, system.vendor, "camera", key);
    const basePrice = vendorMeta.camera.basePrices[key] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.camera, priceMultiplier);
    const qty = resolveQuantity(system.type, "camera", quantityContext, Math.round(areaUnits * 6.5));
    pushItem(details, {
      code: "CAM",
      name: makeDisplayName(`Камера (${placement}, ${resolution} Мп)`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество камер берется из расчетной плотности и зональной структуры системы.",
    });
  }

  if (vendorMeta.recorder) {
    const channels = Number(getValue(selectedParams.recorderChannels, vendorMeta.recorder.channels[2] || vendorMeta.recorder.channels[0]));
    const model = getConcreteModel(system.type, system.vendor, "recorder", channels);
    const basePrice = vendorMeta.recorder.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.recorder, priceMultiplier);
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = resolveQuantity(system.type, "recorder", quantityContext, Math.ceil(cameraQty / Math.max(channels, 1)));
    pushItem(details, {
      code: "NVR",
      name: makeDisplayName(`Регистратор (${channels} каналов)`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество вычисляется от числа камер и серверных каналов по расчетному объему системы.",
    });
  }

  if (vendorMeta.hdd) {
    const hddTb = Number(getValue(selectedParams.hddTb, vendorMeta.hdd.tb[1] || vendorMeta.hdd.tb[0]));
    const model = getConcreteModel(system.type, system.vendor, "hdd", hddTb);
    const basePrice = vendorMeta.hdd.basePrices[hddTb] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.hdd, priceMultiplier);
    const recorderQty = details.find((item) => item.code === "NVR")?.qty || 1;
    const cameraResolution = Number(getValue(selectedParams.cameraResolution, 4));
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const minTb = Math.max(cameraQty * minHddTbPerCamera(cameraResolution), 8);
    const qty = Math.max(Math.ceil(minTb / Math.max(hddTb, 1)), recorderQty * 2);
    pushItem(details, {
      code: "HDD",
      name: makeDisplayName(`HDD ${hddTb} ТБ (архив 30 дней)`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: `Минимальная емкость архива 30 дней: ${Math.ceil(minTb)} ТБ.`,
    });
  }

  if (vendorMeta.switch) {
    const ports = Number(getValue(selectedParams.switchPorts, vendorMeta.switch.ports[2] || vendorMeta.switch.ports[0]));
    const poe = Boolean(getValue(selectedParams.switchPoe, true));
    const key = `${ports}_${poe}`;
    const model = getConcreteModel(system.type, system.vendor, "switch", key);
    const basePrice = vendorMeta.switch.basePrices[key] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.switch, priceMultiplier);
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = resolveQuantity(system.type, "switch", quantityContext, Math.ceil(cameraQty / Math.max(ports, 1)));
    pushItem(details, {
      code: "SW",
      name: makeDisplayName(`Коммутатор ${ports} портов (${poe ? "PoE" : "без PoE"})`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество коммутаторов увязано с расчетным количеством полевых устройств.",
    });
  }

  if (vendorMeta.controller) {
    const channels = Number(getValue(selectedParams.controllerChannels, vendorMeta.controller.channels[1] || vendorMeta.controller.channels[0]));
    const model = getConcreteModel(system.type, system.vendor, "controller", channels);
    const basePrice = vendorMeta.controller.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.controller, priceMultiplier);
    const qty = resolveQuantity(system.type, "controller", quantityContext, Math.round(areaUnits));
    pushItem(details, {
      code: "CTRL",
      name: makeDisplayName(`Контроллер доступа (${channels} точки)`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Контроллеры берутся из расчета точек прохода и этажности.",
    });
  }

  if (vendorMeta.sensor) {
    const kind = getValue(selectedParams.sensorKind, vendorMeta.sensor.kind[0]);
    const sotsSensorFallback =
      system.type === "sots"
        ? {
            "\u0411\u043e\u043b\u0438\u0434": {
              "\u0418\u041a": "\u04212000-\u0418\u041a \u0438\u0441\u043f.03",
              "\u0418\u041a+\u0421\u0412\u0427": "\u04212000-\u0421\u0422\u0418\u041a",
              "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0428\u043e\u0440\u043e\u0445-2",
            },
            "\u0420\u0443\u0431\u0435\u0436": {
              "\u0418\u041a": "\u0418\u041e 409-28 \u0420\u0443\u0431\u0435\u0436",
              "\u0418\u041a+\u0421\u0412\u0427": "\u0418\u041e 414-1 \u0420\u0443\u0431\u0435\u0436",
              "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0418\u041e 102-26 \u0438\u0441\u043f.200",
            },
            "\u0410\u0440\u0433\u0443\u0441-\u0421\u043f\u0435\u043a\u0442\u0440": {
              "\u0418\u041a": "\u0418\u043a\u0430\u0440-5\u0420\u0410",
              "\u0418\u041a+\u0421\u0412\u0427": "\u0418\u043a\u0430\u0440-\u0428",
              "\u0432\u0438\u0431\u0440\u0430\u0446\u0438\u043e\u043d\u043d\u044b\u0439": "\u0421\u0442\u0435\u043a\u043b\u043e-3",
            },
          }?.[system.vendor]?.[kind] || ""
        : "";
    const model = getConcreteModel(system.type, system.vendor, "sensor", kind) || sotsSensorFallback;
    const basePrice = vendorMeta.sensor.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.sensor, priceMultiplier);
    const qty = resolveQuantity(system.type, "sensor", quantityContext, Math.round(areaUnits * 9));
    pushItem(details, {
      code: "SEN",
      name: makeDisplayName(`Охранный датчик (${kind})`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Датчики охраны привязаны к типу зон, объекту и заданной плотности.",
    });
  }

  if (vendorMeta.detector) {
    const kind = getValue(selectedParams.detectorKind, vendorMeta.detector.kind[0]);
    const model = getConcreteModel(system.type, system.vendor, "detector", kind);
    const basePrice = vendorMeta.detector.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.detector, priceMultiplier);
    const qty = resolveQuantity(system.type, "detector", quantityContext, Math.round(areaUnits * 24));
    pushItem(details, {
      code: "DET",
      name: makeDisplayName(`Извещатель (${kind})`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество извещателей берется из зонального и объектного расчета APS.",
    });
  }

  if (vendorMeta.panel) {
    const loops = Number(getValue(selectedParams.panelLoops, vendorMeta.panel.loops[1] || vendorMeta.panel.loops[0]));
    const sotsPanelFallback =
      system.type === "sots"
        ? {
            "\u0411\u043e\u043b\u0438\u0434": { 2: "\u0421\u0438\u0433\u043d\u0430\u043b-20\u041f \u0438\u0441\u043f.01", 4: "\u0421\u0438\u0433\u043d\u0430\u043b-10", 8: "\u0421\u0438\u0433\u043d\u0430\u043b-20\u041c" },
            "\u0420\u0443\u0431\u0435\u0436": { 2: "\u041f\u041f\u041a\u041e\u041f R3-\u0420\u0443\u0431\u0435\u0436-2\u041e\u041f", 4: "\u041f\u041f\u041a\u041e\u041f R3-\u0420\u0443\u0431\u0435\u0436-4\u041e\u041f", 8: "\u041f\u041f\u041a\u041e\u041f \u0420\u0443\u0431\u0435\u0436-20\u041f" },
            "\u0410\u0440\u0433\u0443\u0441-\u0421\u043f\u0435\u043a\u0442\u0440": { 2: "\u0420\u0420\u041e\u041f2", 4: "\u0421\u0442\u0440\u0435\u043b\u0435\u0446-\u041f\u0420\u041e \u041a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440", 8: "\u041f\u041f\u041a\u041e\u041f \u0421\u0442\u0440\u0435\u043b\u0435\u0446-\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u043b" },
          }?.[system.vendor]?.[loops] || ""
        : "";
    const model = getConcreteModel(system.type, system.vendor, "panel", loops) || sotsPanelFallback;
    const basePrice = vendorMeta.panel.basePrices[loops] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.panel, priceMultiplier);
    const detectorsQty =
      details.find((item) => item.code === "DET")?.qty || details.find((item) => item.code === "SEN")?.qty || Math.max(Math.round(areaUnits * 20), 1);
    const qty = resolveQuantity(system.type, "panel", quantityContext, Math.ceil(detectorsQty / Math.max(loops * 64, 1)));
    const isBolidAps = system.type === "aps" && system.vendor === "Болид";
    pushItem(details, {
      code: "PANEL",
      name: makeDisplayName(isBolidAps ? "Главный прибор АПС / ППКП" : `Панель / ППКП (${loops} шлейфа)`, model),
      model,
      qty,
      unitPrice: isBolidAps ? BOLID_SIRIUS_PRICE : unitPrice,
      total: qty * (isBolidAps ? BOLID_SIRIUS_PRICE : unitPrice),
      isKey: true,
      basis: isBolidAps
        ? "Сириус учитывается как главный прибор приемно-контрольный и управления пожарный, отдельный от контроллеров адресных линий."
        : "Панели и ППКП увязаны с расчетными шлейфами, зонами и мощностью системы.",
    });

    if (isBolidAps) {
      const loopControllerQty = Math.max(toNumber(quantityContext?.secondary?.loopControllers, 0), 0);
      if (loopControllerQty > 0) {
        pushItem(details, {
          code: "MOD",
          name: makeDisplayName("Контроллер / модуль адресной линии АПС", "С2000-КДЛ-С"),
          model: "С2000-КДЛ-С",
          qty: loopControllerQty,
          unitPrice: BOLID_KDL_S_PRICE,
          total: loopControllerQty * BOLID_KDL_S_PRICE,
          isKey: true,
          basis: "Дополнительные адресные линии к главному прибору АПС учитываются отдельными контроллерами С2000-КДЛ-С.",
        });
      }
    }
  }

  if (vendorMeta.speaker) {
    const kind = getValue(selectedParams.speakerKind, vendorMeta.speaker.kind[0]);
    const model = getConcreteModel(system.type, system.vendor, "speaker", kind);
    const basePrice = vendorMeta.speaker.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.speaker, priceMultiplier);
    const qty = resolveQuantity(system.type, "speaker", quantityContext, Math.round(areaUnits * 7));
    pushItem(details, {
      code: "SPK",
      name: makeDisplayName(`Оповещатель СОУЭ (${kind})`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество оповещателей берется из расчетной плотности и зон оповещения.",
    });
  }

  if (vendorMeta.amplifier) {
    const channels = Number(getValue(selectedParams.amplifierChannels, vendorMeta.amplifier.channels[1] || vendorMeta.amplifier.channels[0]));
    const model = getConcreteModel(system.type, system.vendor, "amplifier", channels);
    const basePrice = vendorMeta.amplifier.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.amplifier, priceMultiplier);
    const speakerQty = details.find((item) => item.code === "SPK")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = resolveQuantity(system.type, "amplifier", quantityContext, Math.ceil(speakerQty / Math.max(channels * 8, 1)));
    pushItem(details, {
      code: "AMP",
      name: makeDisplayName(`Усилитель СОУЭ (${channels} канала)`, model),
      model,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Усилители увязаны с расчетным количеством оповещателей и зон оповещения.",
    });
  }

  appendFieldArchitectureRows(details, system, quantityContext, priceMultiplier);
  appendManagementInfrastructure(details, system.type, system.vendor, quantityContext, marketRatios, priceMultiplier);

  if (!details.length) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
      keyEquipment: [],
    };
  }

  const totalEquipmentCost = details.reduce((sum, item) => sum + item.total, 0);
  const keyEquipment = details.filter((item) => item.isKey);
  const normalizedUnits = Math.max(toNumber(quantityContext?.markerUnits, keyEquipment[0]?.qty || areaUnits), 1);

  return {
    units: normalizedUnits,
    unitPrice: totalEquipmentCost / normalizedUnits,
    totalEquipmentCost,
    selectionKey: keyEquipment.map((item) => item.code).join("+"),
    mode: marketEntries?.length ? "vendor-market-parametric" : "vendor-parametric",
    details,
    keyEquipment,
  };
}
