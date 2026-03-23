// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Форматирование в рубли (без копеек) */
export function rub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Форматирование чисел */
export function num(value, digits = 0) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

// --- ЛОГИКА РАСЧЕТА ПЛОЩАДЕЙ ---

/** * Пересчитывает площади всех зон, если изменился общий метраж или доля одной зоны,
 * чтобы сохранить пропорции и итоговую сумму.
 */
export function recalculateAreas(zones, totalArea, changedZoneId, nextPercent) {
  const safeTotalArea = Math.max(toNumber(totalArea), 0);
  if (zones.length === 0 || safeTotalArea <= 0) return zones;

  const clampedPercent = Math.min(Math.max(toNumber(nextPercent), 0), 100);
  
  // Вычисляем текущие доли в процентах
  const currentShares = zones.map((zone) => ({
    id: zone.id,
    percent: safeTotalArea > 0 ? (toNumber(zone.area) / safeTotalArea) * 100 : 0,
  }));

  const others = currentShares.filter((entry) => entry.id !== changedZoneId);
  const remainingPercent = Math.max(0, 100 - clampedPercent);
  const othersCurrentTotal = others.reduce((sum, entry) => sum + entry.percent, 0);

  // Рассчитываем новые доли
  const nextShares = currentShares.map((entry) => {
    if (entry.id === changedZoneId) return { ...entry, percent: clampedPercent };
    if (others.length === 0) return { ...entry, percent: remainingPercent };
    if (othersCurrentTotal <= 0) return { ...entry, percent: remainingPercent / others.length };
    return { ...entry, percent: (entry.percent / othersCurrentTotal) * remainingPercent };
  });

  // Превращаем проценты обратно в квадратные метры
  let remainingArea = safeTotalArea;
  const areasById = new Map();
  
  nextShares.forEach((entry, index) => {
    if (index === nextShares.length - 1) {
      // Последней зоне отдаем остаток, чтобы избежать ошибок округления
      areasById.set(entry.id, Math.max(0, remainingArea));
    } else {
      const zoneArea = (entry.percent / 100) * safeTotalArea;
      areasById.set(entry.id, zoneArea);
      remainingArea -= zoneArea;
    }
  });

  return zones.map(zone => ({
    ...zone,
    area: areasById.get(zone.id) || 0
  }));
}

// --- БАЗОВЫЙ РАСЧЕТ СИСТЕМЫ ---

export function calculateSystemBase(systemType, area, factor = 1.0) {
  // Базовая логика: количество устройств зависит от площади и типа системы
  const units = {
    sot: Math.ceil(area / 55),
    skud: Math.ceil(area / 150) * 2,
    aps: Math.ceil(area / 80),
    soue: Math.ceil(area / 60),
    sots: Math.ceil(area / 100),
    ssoi: 1
  };

  const count = units[systemType] || 0;
  return Math.ceil(count * factor);
}