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
  sot: ["Hikvision", "Dahua", "TRASSIR", "Базовый"],
  sots: ["Болид", "Рубеж", "Теко", "Базовый"],
  skud: ["Parsec", "Sigur", "Perco", "Базовый"],
  ssoi: ["Орион Про", "Интеллект", "Axxon", "Базовый"],
  aps: ["Болид", "Рубеж", "Аргус-Спектр", "Базовый"],
  soue: ["Тромбон", "Inter-M", "ITC-ESCORT", "Базовый"],
};

export const COMPLEXITY_COEFS = [
  {
    key: "highAltitudeCoef",
    title: "Высотные работы",
    range: "1.00–1.25",
    tip: "Применяй, если монтаж выше 3 метров или требует подъемных участков.",
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

export const DEFAULT_ZONE = (id, name) => ({
  id,
  name: name || "Новая зона",
  type: "office",
  area: 100,
  systems: {
    sot: true,
    sots: false,
    skud: true,
    ssoi: false,
    aps: true,
    soue: true,
  }
});