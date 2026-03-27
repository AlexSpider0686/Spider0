import { Camera, Shield, Lock, Cpu, Bell, Siren } from "lucide-react";
import vendors, { getVendorNames } from "./vendorsConfig";
import { getDefaultEquipmentProfiles } from "./equipmentCatalog";
import { APP_VERSION, SYSTEM_BUILD_NUMBER } from "./buildInfo";

export const BUILD_NUMBER = SYSTEM_BUILD_NUMBER;
export const APP_VERSION_LABEL = APP_VERSION;

export const SYSTEM_TYPES = [
  { code: "sot", shortName: "СОТ", name: "Система охранного телевидения (СОТ)", icon: Camera },
  { code: "sots", shortName: "СОТС", name: "Система охранно-тревожной сигнализации (СОТС)", icon: Shield },
  { code: "skud", shortName: "СКУД", name: "Система контроля и управления доступом (СКУД)", icon: Lock },
  { code: "ssoi", shortName: "ССОИ", name: "Система сбора и обработки информации (ССОИ)", icon: Cpu },
  { code: "aps", shortName: "АПС", name: "Автоматическая пожарная сигнализация (АПС)", icon: Bell },
  { code: "soue", shortName: "СОУЭ", name: "Система оповещения и управления эвакуацией (СОУЭ)", icon: Siren },
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
  {
    value: "production",
    label: "Производственные объекты",
    description: "Заводы, фабрики, цеха, мастерские, где осуществляется выпуск продукции.",
  },
  {
    value: "warehouse",
    label: "Складские объекты",
    description: "Склады, ангары, хранилища, логистические центры (в т.ч. с опасными веществами).",
  },
  {
    value: "public",
    label: "Общественные здания",
    description: "Здания с массовым пребыванием людей, административные здания, офисы, учебные заведения, больницы, гостиницы.",
  },
  {
    value: "residential",
    label: "Жилые здания",
    description: "Многоквартирные дома, общежития.",
  },
  {
    value: "transport",
    label: "Объекты транспортной инфраструктуры",
    description: "Вокзалы, аэропорты, метрополитены, паркинги.",
  },
  {
    value: "energy",
    label: "Объекты энергетики",
    description: "Электростанции, подстанции.",
  },
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
  utilizationPercent: 8,
  adminPercent: 12,
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
    title: "Коэффициент кабельных работ",
    range: "0.90–1.30",
    tip: "Применяется при сложной трассировке, большом количестве вертикалей и резервировании.",
  },
  {
    key: "equipmentCoef",
    title: "Коэффициент стоимости оборудования",
    range: "0.90–1.25",
    tip: "Используется для быстрой корректировки рыночной стоимости оборудования.",
  },
  {
    key: "laborCoef",
    title: "Коэффициент трудозатрат",
    range: "0.90–1.40",
    tip: "Увеличивается при ограничениях по времени и доступу, а также при работе на действующем объекте.",
  },
  {
    key: "complexityCoef",
    title: "Коэффициент технологической сложности",
    range: "1.00–1.35",
    tip: "Применяется для интеграционных сценариев, нестандартных решений и усиленных требований заказчика.",
  },
  {
    key: "heightCoef",
    title: "Высотность работ",
    range: "1.00–1.25",
    tip: "Учитывает монтаж на высоте и дополнительные меры безопасности.",
  },
  {
    key: "constrainedCoef",
    title: "Стеснённость условий",
    range: "1.00–1.30",
    tip: "Учитывает ограниченный доступ, сложную логистику и плотную инженерную среду.",
  },
  {
    key: "operatingFacilityCoef",
    title: "Работы на действующем объекте",
    range: "1.00–1.20",
    tip: "Применяется, когда монтаж ведётся без остановки эксплуатации объекта.",
  },
  {
    key: "nightWorkCoef",
    title: "Ночные работы",
    range: "1.00–1.35",
    tip: "Применяется при ночных сменах и технологических окнах.",
  },
  {
    key: "routingCoef",
    title: "Сложность маршрутов",
    range: "1.00–1.25",
    tip: "Учитывает геометрию трасс и плотность инженерных коммуникаций.",
  },
  {
    key: "finishCoef",
    title: "Чистовая отделка",
    range: "1.00–1.18",
    tip: "Повышает трудоёмкость из-за требований к аккуратному монтажу.",
  },
];

export const DEFAULT_ZONE = (id, name, type = "office", area = 5000, floors = 1) => ({
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
  baseVendor: (VENDORS[type] || ["Базовый"])[0],
  customVendorIndex: 1,
  hasWorkingDocs: false,
  equipmentProfiles: getDefaultEquipmentProfiles(type),
  selectedEquipmentParams: {},
  note: "",
});

export { vendors };
