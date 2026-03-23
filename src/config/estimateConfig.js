import { Camera, Shield, Lock, Cpu, Bell, Siren } from "lucide-react";
import vendors, { getVendorNames } from "./vendorsConfig";
import { getDefaultEquipmentProfiles } from "./equipmentCatalog";
import { ZONE_TYPES } from "./zonesConfig";

export const SYSTEM_TYPES = [
  { code: "sot", name: "СОТ", icon: Camera },
  { code: "sots", name: "СОТС", icon: Shield },
  { code: "skud", name: "СКУД", icon: Lock },
  { code: "ssoi", name: "ССОИ", icon: Cpu },
  { code: "aps", name: "АПС", icon: Bell },
  { code: "soue", name: "СОУЭ", icon: Siren },
];

export const VENDORS = {
  sot: getVendorNames("sot"),
  sots: getVendorNames("sots"),
  skud: getVendorNames("skud"),
  ssoi: getVendorNames("ssoi"),
  aps: getVendorNames("aps"),
  soue: getVendorNames("soue"),
};

export const OBJECT_TYPES = [
  { value: "office", label: "Офисный" },
  { value: "mixed", label: "Смешанный" },
  { value: "tower", label: "Высотный / башня" },
];

export const DEFAULT_BUDGET = {
  cableCoef: 1.0,
  equipmentCoef: 1.0,
  laborCoef: 1.0,
  complexityCoef: 1.0,
  heightCoef: 1.0,
  constrainedCoef: 1.0,
  operatingFacilityCoef: 1.0,
  nightWorkCoef: 1.0,
  routingCoef: 1.0,
  finishCoef: 1.0,
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
    installPerUnit: 950,
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
  {
    key: "heightCoef",
    title: "Высотность работ",
    range: "1.00–1.25",
    tip: "Добавляй при значительной высоте монтажа и большом числе вертикальных участков.",
  },
  {
    key: "constrainedCoef",
    title: "Стеснённость",
    range: "1.00–1.30",
    tip: "Учитывает ограниченность доступа и сложную логистику на площадке.",
  },
  {
    key: "operatingFacilityCoef",
    title: "Действующий объект",
    range: "1.00–1.20",
    tip: "Повышает трудозатраты при работах без остановки эксплуатации объекта.",
  },
  {
    key: "nightWorkCoef",
    title: "Ночные работы",
    range: "1.00–1.35",
    tip: "Используй при работах в ночные смены и ограниченных окнах доступа.",
  },
  {
    key: "routingCoef",
    title: "Сложность трасс",
    range: "1.00–1.25",
    tip: "Влияет на прокладку при сложной геометрии и насыщенных инженерных зонах.",
  },
  {
    key: "finishCoef",
    title: "Чистовая отделка",
    range: "1.00–1.18",
    tip: "Добавляет аккуратный, более трудоёмкий монтаж в чистовых помещениях.",
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
  equipmentProfiles: getDefaultEquipmentProfiles(type),
  selectedEquipmentParams: {},
  note: "",
});

export { vendors };
