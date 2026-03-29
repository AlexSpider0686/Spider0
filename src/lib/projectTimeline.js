function safeNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildProjectTimeline(systemResults = [], objectData = {}, totals = {}) {
  const normalizedResults = Array.isArray(systemResults) ? systemResults : [];
  const systemsCount = Math.max(normalizedResults.length, 1);
  const area = safeNum(objectData?.totalArea, 0);
  const equipmentMillion = safeNum(totals?.totalEquipment, 0) / 1_000_000;
  const designMonths = Math.max(...normalizedResults.map((item) => Math.max(Math.ceil(safeNum(item?.designDurationMonths, 1)), 1)), 1);
  const executionMonthsFromSystems = Math.max(...normalizedResults.map((item) => Math.max(Math.ceil(safeNum(item?.executionDurationMonths, 0)), 0)), 0);
  const procurementMonths = clamp(Math.ceil(1 + systemsCount * 0.35 + equipmentMillion * 0.15), 1, 5);
  const deliveryMonths = clamp(Math.ceil(1 + systemsCount * 0.3 + equipmentMillion * 0.12), 1, 5);
  const smrMonths =
    executionMonthsFromSystems > 0
      ? clamp(executionMonthsFromSystems, 1, 9)
      : clamp(Math.ceil(1 + area / 12000 + systemsCount * 0.4), 2, 9);
  const pnrMonths = clamp(Math.ceil(1 + systemsCount * 0.3), 1, 4);

  const bars = [
    { key: "design", label: "Проектирование", start: 1, duration: designMonths, color: "F59E0B" },
    { key: "procurement", label: "Закупка и логистика", start: 1, duration: procurementMonths, color: "7C3AED" },
    { key: "delivery", label: "Поставка оборудования", start: 2, duration: deliveryMonths, color: "0EA5A8" },
    { key: "smr", label: "Строительно-монтажные работы", start: Math.max(2, designMonths), duration: smrMonths, color: "2563EB" },
    { key: "pnr", label: "ПНР и интеграция", start: Math.max(3, designMonths + smrMonths - 1), duration: pnrMonths, color: "16A34A" },
  ];

  const totalMonths = bars.reduce((acc, item) => Math.max(acc, item.start + item.duration - 1), 1);
  const phaseMap = Object.fromEntries(
    bars.map((item) => [
      item.key,
      {
        ...item,
        finish: item.start + item.duration - 1,
      },
    ])
  );

  return {
    bars,
    totalMonths,
    systemsCount,
    area,
    equipmentMillion,
    phaseMap,
    assumptions: [
      "План сформирован автоматически по параметрам объекта, составу систем, результатам AI-обследования, проектным данным и расчетным трудозатратам.",
      "Сроки являются предварительными и требуют уточнения после утверждения РД, календаря поставок, графика доступа на объект и подтверждения подрядных ресурсов.",
      "Верхнеуровневые фазы синхронизированы с таймлайном, который включается в экспорт ТКП.",
    ],
  };
}
