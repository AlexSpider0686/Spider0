function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SYSTEM_LABELS = {
  aps: "АПС",
  soue: "СОУЭ",
  sots: "СОТС",
};

const SYSTEM_ZONE_TERMS = {
  aps: "ЗКСПС",
  soue: "зона оповещения",
  sots: "охранная зона",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getZoneRiskWeight(zoneType) {
  switch (zoneType) {
    case "parking":
    case "storage":
    case "production":
      return 1;
    case "lobby":
    case "public":
      return 0.5;
    default:
      return 0;
  }
}

function classifyLayout(meta) {
  const middle = meta?.features?.middleRegion;
  const top = meta?.features?.topRegion;
  if (!middle || !top) {
    return { type: "Смешанная", confidence: 0.42 };
  }

  if (middle.edgeDensity > 0.24 && middle.verticalEdgeDensity > 0.05 && middle.horizontalEdgeDensity > 0.05) {
    return { type: "Ячеистая", confidence: 0.78 };
  }
  if (middle.horizontalEdgeDensity > middle.verticalEdgeDensity * 1.25 && top.brightness > 150) {
    return { type: "Коридорная", confidence: 0.73 };
  }
  if (middle.edgeDensity < 0.16 && middle.contrast < 34) {
    return { type: "Открытая", confidence: 0.66 };
  }
  return { type: "Смешанная", confidence: 0.58 };
}

function assessCaptureQuality(meta) {
  const top = meta?.features?.topRegion;
  const middle = meta?.features?.middleRegion;
  const width = num(meta?.width, 0);
  const height = num(meta?.height, 0);

  let score = 0.42;
  const notes = [];

  if (width >= 1100 && height >= 800) {
    score += 0.18;
    notes.push("Разрешение достаточно для чтения планировки.");
  }
  if (meta?.orientation === "landscape") {
    score += 0.08;
    notes.push("Ориентация кадра подходит для плана.");
  }
  if ((top?.brightness || 0) > 150) {
    score += 0.07;
    notes.push("Фон плана достаточно светлый.");
  }
  if ((middle?.contrast || 0) > 28 && (middle?.edgeDensity || 0) > 0.14) {
    score += 0.11;
    notes.push("Линии и контуры схемы различимы.");
  }
  if ((middle?.saturation || 0) > 0.24) {
    score -= 0.08;
    notes.push("Есть риск цветовых артефактов или бликов.");
  }

  score = clamp(score, 0.18, 0.94);
  return {
    score: Number(score.toFixed(2)),
    label: score >= 0.76 ? "Высокое" : score >= 0.56 ? "Среднее" : "Низкое",
    notes,
  };
}

function derivePlanSignals(meta, layout, zone, objectData) {
  const middle = meta?.features?.middleRegion;
  const top = meta?.features?.topRegion;
  const area = Math.max(num(zone?.area, num(objectData?.totalArea, 0)), 0);
  const floors = Math.max(num(zone?.floors, objectData?.floors || 1), 1);

  const roomCellEstimate = clamp(
    Math.round(area / (layout.type === "Ячеистая" ? 220 : layout.type === "Коридорная" ? 320 : 450)) +
      (layout.type === "Ячеистая" ? 2 : 0) +
      ((middle?.verticalEdgeDensity || 0) > 0.06 ? 1 : 0),
    1,
    18
  );

  const corridorSegmentEstimate = clamp(
    Math.round(area / (layout.type === "Коридорная" ? 900 : 1400)) +
      (layout.type === "Коридорная" ? 1 : 0) +
      ((middle?.horizontalEdgeDensity || 0) > 0.07 ? 1 : 0),
    1,
    8
  );

  const stairEstimate = clamp(
    Math.round(floors / 2) +
      (floors > 3 ? 1 : 0) +
      ((top?.brightness || 0) > 165 && (middle?.contrast || 0) > 32 ? 1 : 0),
    1,
    4
  );

  const isolatedBlockEstimate = clamp(
    Math.round(area / 1800) + (getZoneRiskWeight(zone?.type) >= 1 ? 1 : 0),
    1,
    6
  );

  return {
    roomCellEstimate,
    corridorSegmentEstimate,
    stairEstimate,
    isolatedBlockEstimate,
  };
}

function estimateEgressCount(zone, layoutType, planSignals) {
  const area = num(zone?.area, 0);
  let count = area >= 2500 ? 3 : area >= 900 ? 2 : 1;
  if (layoutType === "Коридорная") count += 1;
  if (zone?.floors > 1) count += 1;
  if (planSignals?.stairEstimate > 2) count += 1;
  return clamp(count, 1, 6);
}

function calculateFallbackZoneCount(systemType, zone, objectData, layoutType) {
  const area = num(zone?.area, num(objectData?.totalArea, 0));
  const floors = Math.max(num(zone?.floors, objectData?.floors || 1), 1);
  const riskWeight = getZoneRiskWeight(zone?.type);

  let base = area >= 3500 ? 4 : area >= 1800 ? 3 : area >= 700 ? 2 : 1;
  base += floors > 1 ? 1 : 0;
  base += riskWeight;

  if (layoutType === "Ячеистая") base += 1;
  if (layoutType === "Открытая") base -= 1;

  if (systemType === "aps") base += 1;
  if (systemType === "soue") base = Math.max(base, Math.round(area / 1200));
  if (systemType === "sots" && riskWeight >= 1) base += 1;

  return clamp(Math.round(base), 1, 12);
}

function calculatePlanBasedZoneCount(systemType, planSignals, egressCount, zone, objectData) {
  const area = num(zone?.area, num(objectData?.totalArea, 0));

  if (systemType === "aps") {
    return clamp(
      planSignals.roomCellEstimate + Math.max(0, planSignals.corridorSegmentEstimate - 1) + planSignals.stairEstimate,
      1,
      24
    );
  }

  if (systemType === "soue") {
    return clamp(
      Math.max(egressCount, planSignals.corridorSegmentEstimate) + Math.max(1, Math.round(planSignals.roomCellEstimate / 3)) + (area > 4000 ? 1 : 0),
      1,
      16
    );
  }

  return clamp(
    planSignals.isolatedBlockEstimate + Math.max(1, Math.round(planSignals.roomCellEstimate / 4)) + (getZoneRiskWeight(zone?.type) >= 1 ? 1 : 0),
    1,
    14
  );
}

function crossCheckCounts({ primaryCount, fallbackCount, captureQuality, layoutConfidence, objectData, zone }) {
  const floors = Math.max(num(zone?.floors, objectData?.floors || 1), 1);
  const area = num(zone?.area, num(objectData?.totalArea, 0));
  const tolerance = area > 4000 || floors > 3 ? 3 : 2;
  const diff = Math.abs(primaryCount - fallbackCount);

  if (captureQuality.score >= 0.74 && layoutConfidence >= 0.68 && diff <= tolerance) {
    return { finalCount: primaryCount, confidence: "high", source: "plan+cross-check", deviation: diff };
  }

  if (captureQuality.score >= 0.62 && diff <= tolerance + 1) {
    return { finalCount: Math.max(primaryCount, fallbackCount), confidence: "medium", source: "plan+fallback-balance", deviation: diff };
  }

  return {
    finalCount: fallbackCount,
    confidence: captureQuality.score >= 0.56 ? "medium" : "low",
    source: captureQuality.score >= 0.56 ? "fallback-after-review" : "fallback-no-reliable-plan",
    deviation: diff,
  };
}

function buildZoneLabels(systemType, zoneName, count, layoutType) {
  const label = SYSTEM_ZONE_TERMS[systemType] || "зона";

  return Array.from({ length: count }, (_, index) => ({
    code: `${systemType}-${index + 1}`,
    name: `${zoneName}: ${label} ${index + 1}`,
    purpose:
      systemType === "aps"
        ? layoutType === "Коридорная"
          ? "Контроль коридорного и смежных участков СПС"
          : layoutType === "Ячеистая"
            ? "Контроль группы помещений СПС"
            : "Контроль укрупненного участка СПС"
        : systemType === "soue"
          ? "Локальный контур оповещения и управления эвакуацией"
          : "Локальный охранный контур",
  }));
}

function buildMethodNotes(systemType, finalDecision, planSignals, fallbackCount, egressCount) {
  const zoneWord = systemType === "aps" ? "ЗКСПС" : systemType === "soue" ? "зон оповещения" : "охранных зон";
  return [
    `Расчет по планировке: помещения ${planSignals.roomCellEstimate}, коридоры ${planSignals.corridorSegmentEstimate}, лестничные клетки ${planSignals.stairEstimate}.`,
    `Перепроверка по объекту и fallback-алгоритму: ${fallbackCount} ${zoneWord}.`,
    `Эвакуационные маршруты/выходы: ~${egressCount}. Итоговый источник: ${finalDecision.source}.`,
  ];
}

export function recognizeEvacuationPlanLayout({ prompt, zones, systems, meta, objectData }) {
  const zone = (zones || []).find((item) => String(item?.id) === String(prompt?.zoneId)) || null;
  const activeSystems = (systems || []).filter((system) => ["aps", "soue", "sots"].includes(system?.type));
  const layout = classifyLayout(meta);
  const capture = assessCaptureQuality(meta);
  const planSignals = derivePlanSignals(meta, layout, zone, objectData);
  const egressCount = estimateEgressCount(zone, layout.type, planSignals);

  const recognizedSystems = activeSystems.map((system) => {
    const planBasedCount = calculatePlanBasedZoneCount(system.type, planSignals, egressCount, zone, objectData);
    const fallbackCount = calculateFallbackZoneCount(system.type, zone, objectData, layout.type);
    const finalDecision = crossCheckCounts({
      primaryCount: planBasedCount,
      fallbackCount,
      captureQuality: capture,
      layoutConfidence: layout.confidence,
      objectData,
      zone,
    });

    return {
      systemType: system.type,
      systemLabel: SYSTEM_LABELS[system.type] || String(system.type || "").toUpperCase(),
      zoneTerm: SYSTEM_ZONE_TERMS[system.type] || "зона",
      zoneCount: finalDecision.finalCount,
      planBasedCount,
      fallbackCount,
      confidence: finalDecision.confidence,
      validationSource: finalDecision.source,
      crossCheckDeviation: finalDecision.deviation,
      notes: buildMethodNotes(system.type, finalDecision, planSignals, fallbackCount, egressCount),
      zones: buildZoneLabels(system.type, zone?.name || "Зона", finalDecision.finalCount, layout.type),
    };
  });

  return {
    zoneId: zone?.id ?? prompt?.zoneId ?? null,
    zoneName: zone?.name || prompt?.zoneName || "Зона",
    layoutType: layout.type,
    layoutConfidence: layout.confidence,
    captureQuality: capture,
    planSignals,
    egressCount,
    totalDerivedZones: recognizedSystems.reduce((sum, item) => sum + item.zoneCount, 0),
    systems: recognizedSystems,
  };
}

export function calculateZoneModelWithoutPlans({ systemType, objectData, zones = [] }) {
  const normalizedZones = Array.isArray(zones) && zones.length ? zones : [{ id: "object", name: "Объект", area: objectData?.totalArea, floors: objectData?.floors, type: "office" }];

  const zoneBreakdown = normalizedZones.map((zone) => {
    const layoutType = zone?.area > 2500 ? "Коридорная" : zone?.type === "office" ? "Ячеистая" : "Смешанная";
    const fallbackCount = calculateFallbackZoneCount(systemType, zone, objectData, layoutType);
    const planSignals = {
      roomCellEstimate: clamp(Math.round(num(zone?.area, 0) / 350), 1, 12),
      corridorSegmentEstimate: clamp(Math.round(num(zone?.area, 0) / 1400), 1, 6),
      stairEstimate: clamp(Math.round(Math.max(num(zone?.floors, objectData?.floors || 1), 1) / 2), 1, 3),
      isolatedBlockEstimate: clamp(Math.round(num(zone?.area, 0) / 1800), 1, 5),
    };
    const egressCount = estimateEgressCount(zone, layoutType, planSignals);
    const planBasedCount = calculatePlanBasedZoneCount(systemType, planSignals, egressCount, zone, objectData);
    const finalDecision = crossCheckCounts({
      primaryCount: planBasedCount,
      fallbackCount,
      captureQuality: { score: 0.55 },
      layoutConfidence: 0.52,
      objectData,
      zone,
    });

    return {
      zoneId: zone?.id ?? null,
      zoneName: zone?.name || "Объект",
      zoneCount: finalDecision.finalCount,
      validationSource: "fallback-no-plan",
      zones: buildZoneLabels(systemType, zone?.name || "Объект", finalDecision.finalCount, layoutType),
      notes: buildMethodNotes(systemType, finalDecision, planSignals, fallbackCount, egressCount),
    };
  });

  return {
    totalZones: zoneBreakdown.reduce((sum, item) => sum + item.zoneCount, 0),
    zoneNames: zoneBreakdown.flatMap((item) => item.zones.map((zone) => zone.name)),
    validationSources: new Set(["fallback-no-plan"]),
    notes: zoneBreakdown.flatMap((item) => item.notes),
    layoutTypes: new Set(["fallback"]),
    planCount: 0,
    breakdown: zoneBreakdown,
  };
}
