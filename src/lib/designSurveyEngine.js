import { toNumber } from "./estimate";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function answerNumber(answers, key, fallback = 0) {
  const value = Number(answers?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function answerList(answers, key) {
  return Array.isArray(answers?.[key]) ? answers[key] : [];
}

function answerBool(answers, key) {
  return answers?.[key] === true;
}

function answerFalse(answers, key) {
  return answers?.[key] === false;
}

function sumZoneMetric(zones, selector) {
  return (zones || []).reduce((sum, zone) => sum + selector(zone), 0);
}

export function hasProjectForSystem(system, projectSnapshot = null) {
  return Boolean(system?.hasWorkingDocs || projectSnapshot?.active);
}

export function calculateDesignSurveyAdjustment({
  system,
  objectData,
  zones,
  surveyAnswers,
  projectSnapshot,
}) {
  if (hasProjectForSystem(system, projectSnapshot)) {
    return {
      skipped: true,
      designHoursMultiplier: 0,
      complexityMultiplier: 0,
      note: "Стоимость не рассчитывается, проект в наличии.",
      drivers: ["По системе отмечено наличие проекта, поэтому стоимость проектирования не рассчитывается."],
    };
  }

  const answers = surveyAnswers || {};
  const drivers = [];

  let designHoursMultiplier = 1;
  let complexityMultiplier = 1;

  const lowCurrentRooms = answerNumber(answers, "object-low-current-rooms", 0);
  if (lowCurrentRooms > 0) {
    const delta = clamp(lowCurrentRooms * 0.025, 0, 0.18);
    designHoursMultiplier += delta;
    drivers.push(`Слаботочные помещения и узлы связи: +${Math.round(delta * 100)}% к трудоемкости.`);
  }

  if (answerFalse(answers, "object-riser-access")) {
    designHoursMultiplier += 0.08;
    complexityMultiplier += 0.05;
    drivers.push("Нет подтвержденного свободного доступа к стоякам и вертикальным трассам.");
  }

  const cableReserve = answerNumber(answers, "object-cable-reserve", 10);
  if (cableReserve > 15) {
    const delta = clamp((cableReserve - 15) / 100, 0, 0.12);
    designHoursMultiplier += delta;
    drivers.push(`Повышенный резерв кабеля (${cableReserve}%) увеличивает объем проектных решений.`);
  }

  const workWindows = answerList(answers, "operational-work-window");
  const restrictiveWindows = workWindows.filter((item) => item !== "Рабочее время").length;
  if (restrictiveWindows > 0) {
    const delta = clamp(restrictiveWindows * 0.03, 0, 0.09);
    designHoursMultiplier += delta;
    drivers.push("Ограниченные окна производства работ требуют более детальной организации проектирования.");
  }

  if (answerBool(answers, "operational-finish-sensitive")) {
    designHoursMultiplier += 0.06;
    complexityMultiplier += 0.04;
    drivers.push("Монтаж без повреждения чистовой отделки повышает требования к проектным решениям.");
  }

  if (objectData?.buildingStatus === "construction") {
    if (answerFalse(answers, "construction-contour-ready")) {
      designHoursMultiplier += 0.08;
      complexityMultiplier += 0.05;
      drivers.push("Не подтверждена строительная готовность контура.");
    }
    if (answerFalse(answers, "construction-embedded-ready")) {
      designHoursMultiplier += 0.07;
      complexityMultiplier += 0.05;
      drivers.push("Нет подтверждения готовности закладных и проходок.");
    }
  }

  const avgCeilingHeight =
    (zones || []).length > 0
      ? sumZoneMetric(zones, (zone) => answerNumber(answers, `zone-${zone.id}-ceiling-height`, toNumber(zone?.ceilingHeight, 3))) /
        zones.length
      : toNumber(objectData?.ceilingHeight, 3);
  if (avgCeilingHeight > 4) {
    const delta = clamp((avgCeilingHeight - 4) * 0.04, 0, 0.14);
    designHoursMultiplier += delta;
    complexityMultiplier += delta * 0.6;
    drivers.push(`Средняя высота помещений ${avgCeilingHeight.toFixed(1)} м увеличивает сложность трассировки и размещения.`);
  }

  const finishLimitCount = sumZoneMetric(zones, (zone) => answerList(answers, `zone-${zone.id}-finish-limitations`).filter((item) => item !== "Нет ограничений").length);
  if (finishLimitCount > 0) {
    const delta = clamp(finishLimitCount * 0.015, 0, 0.12);
    designHoursMultiplier += delta;
    drivers.push("Ограничения по зонам обследования учтены в проектной трудоемкости.");
  }

  const mountHeightLimits = sumZoneMetric(zones, (zone) => {
    if (!answerBool(answers, `zone-${zone.id}-mount-height-limit-enabled`)) return 0;
    return answerNumber(answers, `zone-${zone.id}-mount-height-limit`, 0);
  });
  if (mountHeightLimits > 0) {
    const avgEnabledLimit = mountHeightLimits / Math.max(sumZoneMetric(zones, (zone) => (answerBool(answers, `zone-${zone.id}-mount-height-limit-enabled`) ? 1 : 0)), 1);
    const delta = clamp(Math.max(avgEnabledLimit - 3.5, 0) * 0.025, 0, 0.18);
    if (delta > 0) {
      designHoursMultiplier += delta;
      complexityMultiplier += delta * 0.7;
      drivers.push(`Указана зона со сложным монтажом по высоте до ${avgEnabledLimit.toFixed(1)} м.`);
    }
  }

  const routeComplexity = answerList(answers, `system-${system.id}-route-complexity`).filter((item) => item !== "Типовые условия").length;
  if (routeComplexity > 0) {
    const delta = clamp(routeComplexity * 0.04, 0, 0.16);
    designHoursMultiplier += delta;
    complexityMultiplier += delta * 0.75;
    drivers.push("Сложные маршруты и пересечения инженерных сетей увеличивают объем проектирования.");
  }

  const integrationCount = answerNumber(answers, `system-${system.id}-integration-count`, 0);
  if (integrationCount > 0) {
    const delta = clamp(integrationCount * 0.025, 0, 0.2);
    designHoursMultiplier += delta;
    complexityMultiplier += clamp(integrationCount * 0.015, 0, 0.12);
    drivers.push(`Интеграции по системе: ${integrationCount} точек.`);
  }

  const existingReuse = answerBool(answers, `system-${system.id}-reuse-existing-infra`);
  if (existingReuse) {
    designHoursMultiplier += 0.05;
    complexityMultiplier += 0.04;
    drivers.push("Нужно учитывать существующую инфраструктуру и точки подключения.");
  }

  const coordinationZones = answerNumber(answers, `system-${system.id}-coordination-zones`, 0);
  if (coordinationZones > 0) {
    const delta = clamp(coordinationZones * 0.02, 0, 0.14);
    designHoursMultiplier += delta;
    drivers.push(`Требуется координация размещения минимум по ${coordinationZones} зонам.`);
  }

  if (system.type === "aps" || system.type === "soue") {
    const voiceZones = answerNumber(answers, `system-${system.id}-voice-zones`, 1);
    if (voiceZones > 1) {
      const delta = clamp((voiceZones - 1) * 0.03, 0, 0.18);
      designHoursMultiplier += delta;
      complexityMultiplier += delta * 0.5;
      drivers.push(`Зоны оповещения/контроля: ${voiceZones}.`);
    }
  }

  if (system.type === "sot") {
    const scenarios = answerList(answers, `system-${system.id}-coverage-demand`).length;
    if (scenarios > 1) {
      const delta = clamp((scenarios - 1) * 0.04, 0, 0.16);
      designHoursMultiplier += delta;
      complexityMultiplier += delta * 0.5;
      drivers.push("Несколько сценариев видеоаналитики и наблюдения требуют дополнительной проработки.");
    }
  }

  if (system.type === "skud") {
    const accessPoints = answerNumber(answers, `system-${system.id}-access-points`, 0);
    if (accessPoints > 0) {
      const delta = clamp(accessPoints / 250, 0, 0.22);
      designHoursMultiplier += delta;
      drivers.push(`Количество точек прохода: ${accessPoints}.`);
    }
  }

  const normalizedHoursMultiplier = clamp(designHoursMultiplier, 0.85, 1.9);
  const normalizedComplexityMultiplier = clamp(complexityMultiplier, 0.9, 1.6);

  return {
    skipped: false,
    designHoursMultiplier: normalizedHoursMultiplier,
    complexityMultiplier: normalizedComplexityMultiplier,
    note:
      drivers.length > 0
        ? "Стоимость проектирования скорректирована по данным объекта и AI-обследования."
        : "Стоимость проектирования рассчитана по базовой модели без дополнительных корректировок обследования.",
    drivers,
  };
}
