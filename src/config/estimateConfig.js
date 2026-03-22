import { Camera, Shield, Lock, Cpu, Bell, Siren } from "lucide-react";

export const SYSTEM_TYPES = [
  { code: "sot", name: "СОТ", icon: Camera },
  { code: "sots", name: "СОТС", icon: Shield },
  { code: "skud", name: "СКУД", icon: Lock },
  { code: "ssoi", name: "ССОИ", icon: Cpu },
  { code: "aps", name: "АПС", icon: Bell },
  { code: "soue", name: "СОУЭ", icon: Siren },
];

export const VENDORS = {
  sot: ["Hikvision", "Dahua", "TRASSIR", "Flow", "Базовый"],
  sots: ["Бастион", "Рубеж", "Болид", "Базовый"],
  skud: ["Бастион", "Sigur", "Parsec", "Базовый"],
  ssoi: ["Huawei", "TRASSIR", "Интеграция", "Базовый"],
  aps: ["Болид", "Рубеж", "Simplex", "Базовый"],
  soue: ["Болид", "Рубеж", "Roxton", "Базовый"],
};

export const OBJECT_TYPES = [
  { value: "office", label: "Офисный" },
  { value: "mixed", label: "Смешанный" },
  { value: "tower", label: "Высотный / башня" },
];

export const ZONE_TYPES = [
  { value: "office", label: "Офис" },
  { value: "parking", label: "Паркинг" },
  { value: "public", label: "Общие зоны" },
  { value: "technical", label: "Техпомещения" },
];

export const DEFAULT_BUDGET = {
  cableCoef: 1.0,
  equipmentCoef: 1.0,
  laborCoef: 1.0,
  complexityCoef: 1.0,
  overheadPercent: 16,
  ppePercent: 3,
  payrollTaxesPercent: 30,
  profitabilityPercent: 18,
  vatPercent: 20,
  taxMode: "osno",
};

export const BASE_RATES = {
  sot: {
    cablePerM2: { office: 0.95, parking: 0.62, public: 1.15, technical: 0.7 },
    unitsPer1000: { office: 6.5, parking: 4.2, public: 10, technical: 5 },
    equipUnit: 24000,
    laborPerCableM: 210,
    installPerUnit: 2200,
  },
  sots: {
    cablePerM2: { office: 0.52, parking: 0.34, public: 0.74, technical: 0.48 },
    unitsPer1000: { office: 8, parking: 5, public: 12, technical: 7 },
    equipUnit: 6500,
    laborPerCableM: 185,
    installPerUnit: 950,
  },
  skud: {
    cablePerM2: { office: 0.38, parking: 0.18, public: 0.58, technical: 0.22 },
    unitsPer1000: { office: 1.6, parking: 0.6, public: 2.8, technical: 0.8 },
    equipUnit: 28000,
    laborPerCableM: 185,
    installPerUnit: 4800,
  },
  ssoi: {
    cablePerM2: { office: 0.16, parking: 0.1, public: 0.22, technical: 0.18 },
    unitsPer1000: { office: 1.1, parking: 0.5, public: 1.7, technical: 1.0 },
    equipUnit: 52000,
    laborPerCableM: 155,
    installPerUnit: 6500,
  },
  aps: {
    cablePerM2: { office: 0.64, parking: 0.42, public: 0.86, technical: 0.58 },
    unitsPer1000: { office: 26, parking: 14, public: 30, technical: 18 },
    equipUnit: 4200,
    laborPerCableM: 195,
    installPerUnit: 850,
  },
  soue: {
    cablePerM2: { office: 0.36, parking: 0.28, public: 0.48, technical: 0.24 },
    unitsPer1000: { office: 7, parking: 5, public: 10, technical: 4 },
    equipUnit: 7800,
    laborPerCableM: 180,
    installPerUnit: 740,
  },
};

export const VENDOR_INDEX = {
  sot: { "Базовый": 1.0, Hikvision: 1.04, Dahua: 1.0, TRASSIR: 1.12, Flow: 1.08 },
  sots: { "Базовый": 1.0, Бастион: 1.0, Рубеж: 1.03, Болид: 1.05 },
  skud: { "Базовый": 1.0, Бастион: 1.0, Sigur: 1.08, Parsec: 1.1 },
  ssoi: { "Базовый": 1.0, Huawei: 1.12, TRASSIR: 1.08, Интеграция: 1.15 },
  aps: { "Базовый": 1.0, Болид: 1.0, Рубеж: 1.02, Simplex: 1.35 },
  soue: { "Базовый": 1.0, Болид: 1.0, Рубеж: 1.03, Roxton: 1.14 },
};

export const COEFFICIENT_GUIDE = [
  {
    key: "cableCoef",
    title: "Коэффициент кабеля",
    range: "0.90–1.30",
    tip: "Повышай при сложной трассировке, длинных вертикалях и резервировании.",
  },
  {
    key: "equipmentCoef",
    title: "Коэффициент оборудования",
    range: "0.90–1.25",
    tip: "Используй для быстрых колебаний рынка и корректировки прайс-листов.",
  },
  {
    key: "laborCoef",
    title: "Коэффициент труда",
    range: "0.90–1.40",
    tip: "Увеличивай для ночных работ, стеснённых условий и сложного доступа.",
  },
  {
    key: "complexityCoef",
    title: "Коэффициент сложности",
    range: "1.00–1.35",
    tip: "Применяй для высоких требований к интеграции и нестандартных решений.",
  },
];

export const DEFAULT_ZONE = (id, name, type = "office", area = 1000, floors = 1) => ({
  id,
  name,
  type,
  area,
  floors,
  ceilingHeight: 3,
});

export const DEFAULT_SYSTEM = (id, type = "sot") => ({
  id,
  type,
  vendor: (VENDORS[type] || ["Базовый"])[0],
  baseVendor: "Базовый",
  customVendorIndex: 1,
  note: "",
});
