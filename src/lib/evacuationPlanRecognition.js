function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SYSTEM_LABELS = {
  aps: "АПС",
  soue: "СОУЭ",
  sots: "СОТС",
};

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

  score = Math.min(Math.max(score, 0.18), 0.94);
  return {
    score: Number(score.toFixed(2)),
    label: score >= 0.76 ? "Высокое" : score >= 0.56 ? "Среднее" : "Низкое",
    notes,
  };
}

function estimateEgressCount(zone, layoutType) {
  const area = num(zone?.area, 0);
  let count = area >= 2500 ? 3 : area >= 900 ? 2 : 1;
  if (layoutType === "Коридорная") count += 1;
  if (zone?.floors > 1) count += 1;
  return Math.min(Math.max(count, 1), 5);
}

function estimateSystemZoneCount(systemType, zone, layoutType, egressCount) {
  const area = num(zone?.area, 0);
  const floors = Math.max(num(zone?.floors, 1), 1);
  const riskWeight = getZoneRiskWeight(zone?.type);

  let base = area >= 3500 ? 4 : area >= 1800 ? 3 : area >= 700 ? 2 : 1;
  base += floors > 1 ? 1 : 0;
  base += riskWeight;

  if (layoutType === "Ячеистая") base += 1;
  if (layoutType === "Открытая") base -= 1;

  if (systemType === "soue") {
    base = Math.max(base, egressCount);
    if (layoutType === "Коридорная") base += 1;
  }

  if (systemType === "aps") {
    base += layoutType === "Ячеистая" ? 1 : 0;
  }

  if (systemType === "sots") {
    base += riskWeight >= 1 ? 1 : 0;
  }

  return Math.min(Math.max(Math.round(base), 1), 8);
}

function buildZoneLabels(systemType, zoneName, count, layoutType) {
  const label =
    systemType === "soue" ? "зона оповещения" : systemType === "sots" ? "охранная зона" : "зона контроля";

  return Array.from({ length: count }, (_, index) => ({
    code: `${systemType}-${index + 1}`,
    name: `${zoneName}: ${label} ${index + 1}`,
    purpose:
      layoutType === "Коридорная"
        ? "Линейный маршрут / последовательное оповещение"
        : layoutType === "Ячеистая"
          ? "Локальный контур помещения"
          : "Укрупненный зональный контур",
  }));
}

export function recognizeEvacuationPlanLayout({ prompt, zones, systems, meta }) {
  const zone = (zones || []).find((item) => String(item?.id) === String(prompt?.zoneId)) || null;
  const activeSystems = (systems || []).filter((system) => ["aps", "soue", "sots"].includes(system?.type));
  const layout = classifyLayout(meta);
  const capture = assessCaptureQuality(meta);
  const egressCount = estimateEgressCount(zone, layout.type);

  const recognizedSystems = activeSystems.map((system) => {
    const zoneCount = estimateSystemZoneCount(system.type, zone, layout.type, egressCount);
    return {
      systemType: system.type,
      systemLabel: SYSTEM_LABELS[system.type] || String(system.type || "").toUpperCase(),
      zoneCount,
      zones: buildZoneLabels(system.type, zone?.name || "Зона", zoneCount, layout.type),
    };
  });

  const totalDerivedZones = recognizedSystems.reduce((sum, item) => sum + item.zoneCount, 0);

  return {
    zoneId: zone?.id ?? prompt?.zoneId ?? null,
    zoneName: zone?.name || prompt?.zoneName || "Зона",
    layoutType: layout.type,
    layoutConfidence: layout.confidence,
    captureQuality: capture,
    egressCount,
    totalDerivedZones,
    systems: recognizedSystems,
  };
}

