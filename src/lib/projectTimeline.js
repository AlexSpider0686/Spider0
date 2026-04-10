const WORKING_DAYS_PER_MONTH = 22;

function safeNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function monthsToDays(value, minMonths = 1) {
  return Math.max(Math.ceil(safeNum(value, minMonths) * WORKING_DAYS_PER_MONTH), WORKING_DAYS_PER_MONTH * Math.max(minMonths, 0));
}

export function buildProjectTimeline(systemResults = [], objectData = {}, totals = {}) {
  const normalizedResults = Array.isArray(systemResults) ? systemResults : [];
  const systemsCount = Math.max(normalizedResults.length, 1);
  const area = safeNum(objectData?.totalArea, 0);
  const equipmentMillion = safeNum(totals?.totalEquipment, 0) / 1_000_000;
  const travelEstimate = objectData?.travelEstimate || totals?.travelEstimate || null;
  const outboundTravelDays = Math.max(Math.ceil(safeNum(travelEstimate?.oneWayTravelDays, 0)), 0);
  const inboundTravelDays = Math.max(Math.ceil(safeNum(travelEstimate?.oneWayTravelDays, 0)), 0);

  const designMonths = Math.max(
    ...normalizedResults.map((item) => Math.max(Math.ceil(safeNum(item?.designDurationMonths, 1)), 1)),
    1
  );
  const executionMonthsFromSystems = Math.max(
    ...normalizedResults.map((item) => Math.max(Math.ceil(safeNum(item?.executionDurationMonths, 0)), 0)),
    0
  );
  const procurementMonths = clamp(Math.ceil(1 + systemsCount * 0.35 + equipmentMillion * 0.15), 1, 5);
  const deliveryMonths = clamp(Math.ceil(1 + systemsCount * 0.3 + equipmentMillion * 0.12), 1, 5);
  const smrMonths =
    executionMonthsFromSystems > 0
      ? clamp(executionMonthsFromSystems, 1, 9)
      : clamp(Math.ceil(1 + area / 12000 + systemsCount * 0.4), 2, 9);
  const pnrMonths = clamp(Math.ceil(1 + systemsCount * 0.3), 1, 4);

  const designStartMonth = 1;
  const procurementStartMonth = 1;
  const deliveryStartMonth = 2;
  const smrStartMonth = Math.max(2, designMonths) + (outboundTravelDays > 0 ? Math.ceil(outboundTravelDays / WORKING_DAYS_PER_MONTH) : 0);
  const pnrStartMonth = Math.max(3, designMonths + smrMonths - 1) + (outboundTravelDays > 0 ? Math.ceil(outboundTravelDays / WORKING_DAYS_PER_MONTH) : 0);

  const monthBars = [
    { key: "design", label: "Проектирование", startMonth: designStartMonth, durationMonths: designMonths, color: "F59E0B" },
    { key: "procurement", label: "Закупка и логистика", startMonth: procurementStartMonth, durationMonths: procurementMonths, color: "7C3AED" },
    { key: "delivery", label: "Поставка оборудования", startMonth: deliveryStartMonth, durationMonths: deliveryMonths, color: "0EA5A8" },
    {
      key: "smr",
      label: "Строительно-монтажные работы",
      startMonth: smrStartMonth,
      durationMonths: smrMonths,
      color: "2563EB",
    },
    {
      key: "pnr",
      label: "ПНР и интеграция",
      startMonth: pnrStartMonth,
      durationMonths: pnrMonths,
      color: "16A34A",
    },
  ];

  const bars = monthBars.map((item) => {
    const start = (item.startMonth - 1) * WORKING_DAYS_PER_MONTH + 1;
    const duration = Math.max(item.durationMonths * WORKING_DAYS_PER_MONTH, 1);
    return {
      key: item.key,
      label: item.label,
      color: item.color,
      start,
      duration,
      finish: start + duration - 1,
      startMonth: item.startMonth,
      durationMonths: item.durationMonths,
      finishMonth: item.startMonth + item.durationMonths - 1,
    };
  });

  if (outboundTravelDays > 0) {
    const smrBar = bars.find((item) => item.key === "smr");
    bars.push({
      key: "travel_out",
      label: "Выезд бригады на объект",
      color: "2563EB",
      start: Math.max((smrBar?.start || 1) - outboundTravelDays, 1),
      duration: outboundTravelDays,
      finish: Math.max((smrBar?.start || 1) - 1, outboundTravelDays),
      startMonth: 1,
      durationMonths: Math.max(Math.ceil(outboundTravelDays / WORKING_DAYS_PER_MONTH), 1),
      finishMonth: 1,
    });
  }

  if (inboundTravelDays > 0) {
    const pnrBar = bars.find((item) => item.key === "pnr");
    const start = (pnrBar?.finish || 0) + 1;
    bars.push({
      key: "travel_back",
      label: "Возврат бригады",
      color: "0F766E",
      start,
      duration: inboundTravelDays,
      finish: start + inboundTravelDays - 1,
      startMonth: 1,
      durationMonths: Math.max(Math.ceil(inboundTravelDays / WORKING_DAYS_PER_MONTH), 1),
      finishMonth: 1,
    });
  }

  const totalDays = bars.reduce((acc, item) => Math.max(acc, item.finish), 1);
  const totalMonths = Math.max(Math.ceil(totalDays / WORKING_DAYS_PER_MONTH), 1);
  const phaseMap = Object.fromEntries(bars.map((item) => [item.key, item]));

  return {
    bars,
    totalDays,
    totalMonths,
    systemsCount,
    area,
    equipmentMillion,
    phaseMap,
    travelDays: outboundTravelDays + inboundTravelDays,
    assumptions: [
      "План сформирован автоматически по параметрам объекта, составу систем, результатам AI-обследования, проектным данным и расчетным трудозатратам.",
      "Сроки указаны в рабочих днях и требуют уточнения после утверждения РД, календаря поставок, графика доступа на объект и подтверждения подрядных ресурсов.",
      "Фазы плана синхронизированы с верхнеуровневым таймлайном, который выводится в экспортируемом ТКП и плане проекта.",
      outboundTravelDays + inboundTravelDays > 0 ? "В таймлайн дополнительно включено время переезда бригады к объекту и обратно." : "В таймлайне не учитывались отдельные переезды бригады.",
    ],
    constants: {
      workingDaysPerMonth: WORKING_DAYS_PER_MONTH,
      designDays: monthsToDays(designMonths),
      procurementDays: monthsToDays(procurementMonths),
      deliveryDays: monthsToDays(deliveryMonths),
      smrDays: monthsToDays(smrMonths),
      pnrDays: monthsToDays(pnrMonths),
      travelDays: outboundTravelDays + inboundTravelDays,
    },
  };
}
