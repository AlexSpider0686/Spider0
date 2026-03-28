function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const MIN_ACCEPTABLE_PLAN_QUALITY = 0.5;

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

function classifyLayout(meta, deepVision = null) {
  const segmentation = deepVision?.segmentation;
  if (segmentation) {
    if (segmentation.corridorCount >= Math.max(segmentation.roomCount * 0.45, 2)) {
      return { type: "Коридорная", code: "corridor", confidence: 0.82 };
    }
    if (segmentation.roomCount >= 5) {
      return { type: "Ячеистая", code: "cell", confidence: 0.84 };
    }
    if (segmentation.roomCount <= 2 && segmentation.corridorCount === 0) {
      return { type: "Открытая", code: "open", confidence: 0.72 };
    }
  }

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

function buildQualityImprovements(meta) {
  const top = meta?.features?.topRegion;
  const middle = meta?.features?.middleRegion;
  const improvements = [];

  if (num(meta?.width) < 1200 || num(meta?.height) < 900) {
    improvements.push("Подойдите ближе или снимайте в большем разрешении, чтобы мелкие подписи и контуры читались увереннее.");
  }
  if (meta?.orientation !== "landscape") {
    improvements.push("Держите камеру горизонтально и захватывайте план целиком в альбомной ориентации.");
  }
  if ((top?.brightness || 0) < 145) {
    improvements.push("Добавьте освещение или уберите тень, чтобы фон плана был светлее и равномернее.");
  }
  if ((middle?.contrast || 0) < 30 || (middle?.edgeDensity || 0) < 0.15) {
    improvements.push("Держите камеру ровнее, без смаза и сильного наклона, чтобы линии стен и маршрутов были четкими.");
  }
  if ((middle?.saturation || 0) > 0.24) {
    improvements.push("Уберите блики и цветовые засветы. Лучше снимать без вспышки и почти параллельно плоскости плана.");
  }

  if (!improvements.length) {
    improvements.push("Повторите съемку без бликов, с полным захватом листа и параллельным положением камеры.");
  }

  return improvements;
}

function assessCaptureQuality(meta, deepVision = null) {
  const top = meta?.features?.topRegion;
  const middle = meta?.features?.middleRegion;
  const width = num(meta?.width, 0);
  const height = num(meta?.height, 0);

  let score = 0.44;
  const notes = [];

  if (width >= 1400 && height >= 1000) {
    score += 0.2;
    notes.push("Разрешение достаточно для чтения планировки.");
  } else if (width >= 1100 && height >= 800) {
    score += 0.12;
    notes.push("Разрешение приемлемое, но есть запас для более точного чтения.");
  }

  if (meta?.orientation === "landscape") {
    score += 0.06;
    notes.push("Ориентация кадра подходит для плана.");
  }
  if ((top?.brightness || 0) > 152) {
    score += 0.06;
    notes.push("Фон плана достаточно светлый.");
  }
  if ((middle?.contrast || 0) > 30 && (middle?.edgeDensity || 0) > 0.15) {
    score += 0.12;
    notes.push("Линии стен и контуры схемы различимы.");
  }
  if ((middle?.verticalEdgeDensity || 0) > 0.04 && (middle?.horizontalEdgeDensity || 0) > 0.04) {
    score += 0.08;
    notes.push("Геометрия плана читается по обоим направлениям.");
  }
  if ((middle?.saturation || 0) > 0.24) {
    score -= 0.1;
    notes.push("Есть риск бликов, цветовых артефактов или пересвета.");
  }
  if ((middle?.contrast || 0) < 24) {
    score -= 0.08;
    notes.push("Контраст низкий, часть линий может теряться.");
  }

  if ((deepVision?.quality?.segmentationConfidence || 0) >= 0.72) {
    score += 0.1;
    notes.push("Deep segmentation выделила стены, помещения и коридоры.");
  }
  if ((deepVision?.quality?.ocrConfidence || 0) >= 0.58) {
    score += 0.06;
    notes.push("OCR-блоки подписей плана распознаны с приемлемой уверенностью.");
  }

  score = clamp(score, 0.18, 0.96);
  const roundedScore = Number(score.toFixed(2));

  return {
    score: roundedScore,
    label: roundedScore >= 0.84 ? "Высокое" : roundedScore >= MIN_ACCEPTABLE_PLAN_QUALITY ? "Достаточное" : roundedScore >= 0.4 ? "Пограничное" : "Низкое",
    accepted: roundedScore >= MIN_ACCEPTABLE_PLAN_QUALITY,
    notes,
    improvements: buildQualityImprovements(meta),
  };
}

function derivePlanSignals(meta, layout, zone, objectData, deepVision = null) {
  const middle = meta?.features?.middleRegion;
  const top = meta?.features?.topRegion;
  const area = Math.max(num(zone?.area, num(objectData?.totalArea, 0)), 0);
  const floors = Math.max(num(zone?.floors, objectData?.floors || 1), 1);
  const segmentation = deepVision?.segmentation;
  const layoutCode =
    layout?.code ||
    (middle?.edgeDensity > 0.24 && middle?.verticalEdgeDensity > 0.05 && middle?.horizontalEdgeDensity > 0.05
      ? "cell"
      : middle?.horizontalEdgeDensity > middle?.verticalEdgeDensity * 1.25 && (top?.brightness || 0) > 150
        ? "corridor"
        : middle?.edgeDensity < 0.16 && (middle?.contrast || 0) < 34
          ? "open"
          : "mixed");

  const roomCellEstimate = clamp(
    Math.round(segmentation?.roomCount || area / (layoutCode === "cell" ? 220 : layoutCode === "corridor" ? 320 : 450)) +
      (layoutCode === "cell" ? 2 : 0) +
      ((middle?.verticalEdgeDensity || 0) > 0.06 ? 1 : 0),
    1,
    24
  );

  const corridorSegmentEstimate = clamp(
    Math.round(segmentation?.corridorCount || area / (layoutCode === "corridor" ? 900 : 1400)) +
      (layoutCode === "corridor" ? 1 : 0) +
      ((middle?.horizontalEdgeDensity || 0) > 0.07 ? 1 : 0),
    1,
    10
  );

  const stairEstimate = clamp(
    Math.round(segmentation?.stairCount || floors / 2) +
      (floors > 3 ? 1 : 0) +
      ((top?.brightness || 0) > 165 && (middle?.contrast || 0) > 32 ? 1 : 0),
    1,
    4
  );

  const isolatedBlockEstimate = clamp(
    Math.round(area / 1800) + (getZoneRiskWeight(zone?.type) >= 1 ? 1 : 0),
    1,
    8
  );

  return {
    roomCellEstimate,
    corridorSegmentEstimate,
    stairEstimate,
    isolatedBlockEstimate,
    ocrLabelCount: (deepVision?.textBlocks || []).length,
    labeledRoomCount: (segmentation?.labeledRooms || []).length,
  };
}

function estimateEgressCount(zone, layoutType, planSignals, deepVision = null) {
  const area = num(zone?.area, 0);
  let count = deepVision?.segmentation?.egressCount || (area >= 2500 ? 3 : area >= 900 ? 2 : 1);
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

  if (captureQuality.score >= 0.8 && layoutConfidence >= 0.68 && diff <= tolerance) {
    return { finalCount: primaryCount, confidence: "high", source: "plan+cross-check", deviation: diff };
  }

  if (captureQuality.score >= MIN_ACCEPTABLE_PLAN_QUALITY && diff <= tolerance + 1) {
    return { finalCount: Math.max(primaryCount, fallbackCount), confidence: "medium", source: "plan+fallback-balance", deviation: diff };
  }

  return {
    finalCount: fallbackCount,
    confidence: captureQuality.score >= 0.56 ? "medium" : "low",
    source: captureQuality.score >= 0.56 ? "fallback-after-review" : "fallback-no-reliable-plan",
    deviation: diff,
  };
}

function getSurfaceDerivedScale(relatedPhotoAnalyses, zoneId) {
  const candidates = Object.values(relatedPhotoAnalyses || {}).filter((analysis) => {
    if (!analysis?.accepted) return false;
    if (analysis?.promptType !== "surface_scan") return false;
    return String(analysis?.zoneId) === String(zoneId);
  });

  if (!candidates.length) {
    return { factor: 1, source: "no-surface-photo" };
  }

  const avgHeight =
    candidates.reduce((sum, item) => sum + num(item?.estimatedCeilingHeight, 0), 0) /
    Math.max(candidates.filter((item) => num(item?.estimatedCeilingHeight, 0) > 0).length, 1);

  if (!avgHeight) {
    return { factor: 1.02, source: "surface-photo-outline" };
  }

  if (avgHeight >= 4.6) return { factor: 1.12, source: "surface-photo-high-ceiling" };
  if (avgHeight <= 2.9) return { factor: 0.94, source: "surface-photo-compact-height" };
  return { factor: 1.03, source: "surface-photo-balanced" };
}

function estimatePlanGeometry({
  zone,
  objectData,
  layoutType,
  captureQuality,
  planSignals,
  floorIndex,
  expectedFloorCount,
  relatedPhotoAnalyses,
  deepVision,
}) {
  const zoneArea = Math.max(num(zone?.area, num(objectData?.totalArea, 0)), 0);
  const floorCount = Math.max(expectedFloorCount || num(zone?.floors, objectData?.floors || 1), 1);
  const perFloorBaseArea = zoneArea > 0 ? zoneArea / floorCount : Math.max(num(objectData?.totalArea, 0) / floorCount, 0);
  const segmentation = deepVision?.segmentation;
  const layoutTypeCode =
    null ||
    (planSignals.corridorSegmentEstimate >= Math.max(planSignals.roomCellEstimate * 0.45, 2) ? "corridor" : planSignals.roomCellEstimate >= 5 ? "cell" : "mixed");
  const layoutFactor = layoutTypeCode === "corridor" ? 1.04 : layoutTypeCode === "cell" ? 0.98 : 1;
  const qualityFactor = captureQuality.score >= MIN_ACCEPTABLE_PLAN_QUALITY ? 0.97 : 0.92;
  const surfaceScale = getSurfaceDerivedScale(relatedPhotoAnalyses, zone?.id);
  const deepVisionArea = num(deepVision?.scaleHint?.areaLabelM2, 0) || num(segmentation?.averageRoomAreaM2, 0) * Math.max(segmentation?.roomCount || 0, 0);
  const estimatedFloorArea = Math.max((deepVisionArea > 0 ? deepVisionArea : perFloorBaseArea) * layoutFactor * qualityFactor * surfaceScale.factor, 0);
  const areaDeviationPercent = perFloorBaseArea > 0 ? ((estimatedFloorArea - perFloorBaseArea) / perFloorBaseArea) * 100 : 0;
  const representativeLength =
    num(segmentation?.metersPerPixel, 0) > 0
      ? (deepVision.width || 1) * segmentation.metersPerPixel
      : Math.sqrt(Math.max(estimatedFloorArea, 1)) * (layoutTypeCode === "corridor" ? 1.7 : 1.35);
  const representativeWidth =
    num(segmentation?.metersPerPixel, 0) > 0
      ? (deepVision.height || 1) * segmentation.metersPerPixel
      : Math.max(estimatedFloorArea / Math.max(representativeLength, 1), 1);
  const averageRoomArea = segmentation?.averageRoomAreaM2 || estimatedFloorArea / Math.max(planSignals.roomCellEstimate, 1);
  const corridorLength =
    segmentation?.corridorCount > 0
      ? representativeLength * clamp(segmentation.corridorCount / Math.max(planSignals.roomCellEstimate, 1), 0.32, 0.82)
      : representativeLength * (layoutTypeCode === "corridor" ? 0.72 : 0.42);

  return {
    floorIndex,
    expectedFloorCount: floorCount,
    floorAreaEstimated: Number(estimatedFloorArea.toFixed(1)),
    floorAreaUserBaseline: Number(perFloorBaseArea.toFixed(1)),
    areaDeviationPercent: Number(areaDeviationPercent.toFixed(1)),
    representativeLengthM: Number(representativeLength.toFixed(1)),
    representativeWidthM: Number(representativeWidth.toFixed(1)),
    averageRoomAreaM2: Number(averageRoomArea.toFixed(1)),
    corridorLengthM: Number(corridorLength.toFixed(1)),
    scaleSource: surfaceScale.source,
    ocrScaleDetected: deepVision?.scaleHint?.drawingScale || null,
    detectedLabels: (segmentation?.labeledRooms || []).slice(0, 8),
  };
}

function buildZoneLabels(systemType, zoneName, count, layoutType, floorIndex = null) {
  const label = SYSTEM_ZONE_TERMS[systemType] || "зона";
  const floorPrefix = floorIndex ? `этаж ${floorIndex}: ` : "";

  return Array.from({ length: count }, (_, index) => ({
    code: `${systemType}-${floorIndex || "all"}-${index + 1}`,
    name: `${zoneName}: ${floorPrefix}${label} ${index + 1}`,
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

function buildMethodNotes(systemType, finalDecision, planSignals, fallbackCount, egressCount, geometry, deepVision = null) {
  const zoneWord = systemType === "aps" ? "ЗКСПС" : systemType === "soue" ? "зон оповещения" : "охранных зон";
  const notes = [
    `Расчет по планировке: помещения ${planSignals.roomCellEstimate}, коридоры ${planSignals.corridorSegmentEstimate}, лестничные клетки ${planSignals.stairEstimate}.`,
    `Перепроверка по объекту и fallback-алгоритму: ${fallbackCount} ${zoneWord}.`,
    `Эвакуационные маршруты/выходы: ~${egressCount}. Итоговый источник: ${finalDecision.source}.`,
    `Оценка геометрии плана: длина около ${geometry.representativeLengthM} м, ширина около ${geometry.representativeWidthM} м, площадь этажа около ${geometry.floorAreaEstimated} м?.`,
  ];

  if (deepVision?.textBlocks?.length) {
    notes.push(
      `OCR/segmentation: текстовых блоков ${deepVision.textBlocks.length}, подписанных помещений ${deepVision.segmentation?.labeledRooms?.length || 0}, масштаб ${
        deepVision.scaleHint?.drawingScale ? `1:${deepVision.scaleHint.drawingScale}` : "не найден"
      }.`
    );
  }

  return notes;
}

function createRecognitionWarning(message, severity = "warning") {
  return { message, severity };
}

export function recognizeEvacuationPlanLayout({ prompt, zones, systems, meta, objectData, floorIndex = 1, expectedFloorCount = null, relatedPhotoAnalyses = {}, deepVision = null }) {
  const zone = (zones || []).find((item) => String(item?.id) === String(prompt?.zoneId)) || null;
  const activeSystems = (systems || []).filter((system) => ["aps", "soue", "sots"].includes(system?.type));
  const layout = classifyLayout(meta, deepVision);
  const capture = assessCaptureQuality(meta, deepVision);
  const normalizedExpectedFloorCount = Math.max(expectedFloorCount || num(zone?.floors, objectData?.floors || 1), 1);
  const zoneForFloor = {
    ...zone,
    area: Math.max(num(zone?.area, num(objectData?.totalArea, 0)) / normalizedExpectedFloorCount, 0),
    floors: 1,
  };
  const planSignals = derivePlanSignals(meta, layout, zoneForFloor, objectData, deepVision);
  const egressCount = estimateEgressCount(zoneForFloor, layout.type, planSignals, deepVision);
  const geometry = estimatePlanGeometry({
    zone,
    objectData,
    layoutType: layout.type,
    captureQuality: capture,
    planSignals,
    floorIndex,
    expectedFloorCount: normalizedExpectedFloorCount,
    relatedPhotoAnalyses,
    deepVision,
  });

  const warnings = [];
  if (!capture.accepted) {
    warnings.push(
      createRecognitionWarning(
        `Снимок плана имеет пригодность ${Math.round(capture.score * 100)}%. Ниже порога 50%, поэтому он не должен участвовать в расчетах до пересъемки.`,
        "error"
      )
    );
  }

  const recognizedSystems = activeSystems.map((system) => {
    const planBasedCount = calculatePlanBasedZoneCount(system.type, planSignals, egressCount, zoneForFloor, objectData);
    const fallbackCount = calculateFallbackZoneCount(system.type, zoneForFloor, objectData, layout.type);
    const finalDecision = crossCheckCounts({
      primaryCount: planBasedCount,
      fallbackCount,
      captureQuality: capture,
      layoutConfidence: layout.confidence,
      objectData,
      zone: zoneForFloor,
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
      notes: buildMethodNotes(system.type, finalDecision, planSignals, fallbackCount, egressCount, geometry, deepVision),
      zones: buildZoneLabels(system.type, zone?.name || "Зона", finalDecision.finalCount, layout.type, floorIndex),
    };
  });

  return {
    accepted: capture.accepted,
    zoneId: zone?.id ?? prompt?.zoneId ?? null,
    zoneName: zone?.name || prompt?.zoneName || "Зона",
    floorIndex,
    expectedFloorCount: normalizedExpectedFloorCount,
    layoutType: layout.type,
    layoutConfidence: layout.confidence,
    captureQuality: capture,
    planSignals,
    geometry,
    egressCount,
    deepVision: deepVision
      ? {
          textBlocks: deepVision.textBlocks || [],
          segmentation: deepVision.segmentation || null,
          quality: deepVision.quality || null,
          scaleHint: deepVision.scaleHint || null,
        }
      : null,
    totalDerivedZones: recognizedSystems.reduce((sum, item) => sum + item.zoneCount, 0),
    warnings,
    systems: recognizedSystems,
  };
}

function mergeSystemRecognitions(systemType, systemPlans, floorSummaries, expectedFloorCount, forecastedFloors) {
  const zoneTerm = SYSTEM_ZONE_TERMS[systemType] || "зона";
  const totalDetectedZones = systemPlans.reduce((sum, item) => sum + num(item.zoneCount, 0), 0);
  const averageDetectedZones = systemPlans.length ? totalDetectedZones / systemPlans.length : 0;
  const fallbackAverage = systemPlans.length ? systemPlans.reduce((sum, item) => sum + num(item.fallbackCount, 0), 0) / systemPlans.length : 0;
  const forecastZones = forecastedFloors > 0 ? Math.max(Math.round((averageDetectedZones || fallbackAverage || 1) * forecastedFloors), 1) : 0;
  const zoneCount = totalDetectedZones + forecastZones;

  return {
    systemType,
    systemLabel: SYSTEM_LABELS[systemType] || String(systemType || "").toUpperCase(),
    zoneTerm,
    zoneCount,
    detectedZoneCount: totalDetectedZones,
    forecastZoneCount: forecastZones,
    planBasedCount: systemPlans.reduce((sum, item) => sum + num(item.planBasedCount, 0), 0),
    fallbackCount: Math.max(Math.round(systemPlans.reduce((sum, item) => sum + num(item.fallbackCount, 0), 0) + forecastZones), 1),
    confidence:
      systemPlans.every((item) => item.confidence === "high")
        ? "high"
        : systemPlans.some((item) => item.confidence === "medium")
          ? "medium"
          : "low",
    validationSource:
      forecastedFloors > 0
        ? "plan+forecast-cross-check"
        : systemPlans.every((item) => item.validationSource === "plan+cross-check")
          ? "plan+cross-check"
          : "plan+fallback-balance",
    crossCheckDeviation: systemPlans.reduce((max, item) => Math.max(max, num(item.crossCheckDeviation, 0)), 0),
    floorBreakdown: floorSummaries.map((summary) => ({
      floorIndex: summary.floorIndex,
      zoneCount: num(summary.systems.find((item) => item.systemType === systemType)?.zoneCount, 0),
      floorAreaEstimated: num(summary.geometry?.floorAreaEstimated, 0),
    })),
    notes: [
      `Распознано планов этажей: ${systemPlans.length} из ${expectedFloorCount}.`,
      forecastedFloors > 0
        ? `Для недостающих этажей (${forecastedFloors}) количество ${zoneTerm} спрогнозировано по распознанным планам и данным объекта.`
        : "Все загруженные планы участвуют в расчете без прогноза по этажам.",
      `Определено ${totalDetectedZones} ${zoneTerm} по планам и ${forecastZones} ${zoneTerm} прогнозом.`,
    ],
    zones: [
      ...systemPlans.flatMap((item) => item.zones || []),
      ...Array.from({ length: forecastZones }, (_, index) => ({
        code: `${systemType}-forecast-${index + 1}`,
        name: `Прогноз ${zoneTerm} ${index + 1}`,
        purpose: "Прогноз недостающего этажного плана по данным объекта и распознанным этажам",
      })),
    ],
  };
}

function buildAreaComparison(floorRecognitions, zone, objectData, expectedFloorCount) {
  const uploadedPlans = floorRecognitions.length;
  const userTotalArea = Math.max(num(zone?.area, num(objectData?.totalArea, 0)), 0);
  const userPerFloorArea = expectedFloorCount > 0 ? userTotalArea / expectedFloorCount : userTotalArea;
  const recognizedTotalArea = floorRecognitions.reduce((sum, item) => sum + num(item.geometry?.floorAreaEstimated, 0), 0);
  const recognizedAverageFloorArea = uploadedPlans ? recognizedTotalArea / uploadedPlans : 0;
  const predictedTotalArea = recognizedAverageFloorArea * expectedFloorCount;
  const deviationPercent = userTotalArea > 0 ? ((predictedTotalArea - userTotalArea) / userTotalArea) * 100 : 0;

  return {
    userTotalArea: Number(userTotalArea.toFixed(1)),
    userPerFloorArea: Number(userPerFloorArea.toFixed(1)),
    recognizedAverageFloorArea: Number(recognizedAverageFloorArea.toFixed(1)),
    predictedTotalArea: Number(predictedTotalArea.toFixed(1)),
    deviationPercent: Number(deviationPercent.toFixed(1)),
  };
}

export function aggregatePlanRecognitions({ recognitions = [], prompt, zones, systems, objectData }) {
  const acceptedRecognitions = (recognitions || []).filter((item) => item?.accepted !== false);
  const zone = (zones || []).find((item) => String(item?.id) === String(prompt?.zoneId)) || null;
  const expectedFloorCount = Math.max(num(zone?.floors, objectData?.floors || 1), 1);
  const uploadedPlans = acceptedRecognitions.length;
  const forecastedFloors = Math.max(expectedFloorCount - uploadedPlans, 0);
  const warnings = [];

  if (uploadedPlans !== expectedFloorCount) {
    warnings.push(
      createRecognitionWarning(
        `Количество загруженных планов (${uploadedPlans}) не совпадает с количеством этажей (${expectedFloorCount}). Недостающие этажи будут рассчитаны прогнозом по имеющимся планам и данным объекта.`,
        "warning"
      )
    );
  }

  const floorSummaries = acceptedRecognitions.map((recognition, index) => ({
    ...recognition,
    floorIndex: recognition.floorIndex || index + 1,
  }));

  const activeSystems = (systems || []).filter((system) => ["aps", "soue", "sots"].includes(system?.type));
  const systemSummaries = activeSystems.map((system) => {
    const systemPlans = floorSummaries
      .map((item) => item.systems.find((systemPlan) => systemPlan.systemType === system.type))
      .filter(Boolean);

    if (!systemPlans.length) {
      const fallback = calculateZoneModelWithoutPlans({
        systemType: system.type,
        objectData,
        zones: zone ? [{ ...zone, floors: expectedFloorCount }] : zones,
      });
      return {
        systemType: system.type,
        systemLabel: SYSTEM_LABELS[system.type] || String(system.type || "").toUpperCase(),
        zoneTerm: SYSTEM_ZONE_TERMS[system.type] || "зона",
        zoneCount: fallback.totalZones,
        detectedZoneCount: 0,
        forecastZoneCount: fallback.totalZones,
        planBasedCount: 0,
        fallbackCount: fallback.totalZones,
        confidence: "low",
        validationSource: "fallback-no-plan",
        crossCheckDeviation: 0,
        notes: fallback.notes,
        zones: fallback.breakdown.flatMap((item) => item.zones || []),
      };
    }

    return mergeSystemRecognitions(system.type, systemPlans, floorSummaries, expectedFloorCount, forecastedFloors);
  });

  const areaComparison = buildAreaComparison(floorSummaries, zone, objectData, expectedFloorCount);
  if (Math.abs(areaComparison.deviationPercent) > 12) {
    warnings.push(
      createRecognitionWarning(
        `Площадь по планировкам отличается от введенной пользователем на ${Math.abs(areaComparison.deviationPercent)}%. Техрешение будет построено с учетом этой разницы и объектных данных.`,
        "warning"
      )
    );
  }

  return {
    accepted: uploadedPlans > 0,
    zoneId: zone?.id ?? prompt?.zoneId ?? null,
    zoneName: zone?.name || prompt?.zoneName || "Зона",
    expectedFloorCount,
    uploadedPlans,
    forecastedFloors,
    floorPlansAccepted: uploadedPlans,
    floorPlansRejected: Math.max((recognitions || []).length - uploadedPlans, 0),
    layoutType:
      floorSummaries.length === 1
        ? floorSummaries[0].layoutType
        : floorSummaries.length
          ? "Смешанная"
          : "fallback",
    layoutConfidence: floorSummaries.length
      ? Number(
          (
            floorSummaries.reduce((sum, item) => sum + num(item.layoutConfidence, 0), 0) /
            Math.max(floorSummaries.length, 1)
          ).toFixed(2)
        )
      : 0.52,
    captureQuality: {
      score: floorSummaries.length
        ? Number((floorSummaries.reduce((sum, item) => sum + num(item.captureQuality?.score, 0), 0) / floorSummaries.length).toFixed(2))
        : 0,
      label: floorSummaries.every((item) => item.captureQuality?.accepted) ? "Достаточное" : "Смешанное",
      accepted: uploadedPlans > 0,
    },
    egressCount: floorSummaries.reduce((max, item) => Math.max(max, num(item.egressCount, 0)), 0),
    totalDerivedZones: systemSummaries.reduce((sum, item) => sum + num(item.zoneCount, 0), 0),
    floorRecognitions: floorSummaries,
    areaComparison,
    warnings,
    systems: systemSummaries,
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
    const egressCount = estimateEgressCount(zone, layoutType, planSignals, null);
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
      notes: [
        `Планов эвакуации по зоне "${zone?.name || "Объект"}" нет, используется расчет по данным объекта и fallback-алгоритму.`,
        `Прогноз для ${SYSTEM_ZONE_TERMS[systemType] || "зон"}: ${finalDecision.finalCount}.`,
      ],
    };
  });

  return {
    totalZones: zoneBreakdown.reduce((sum, item) => sum + item.zoneCount, 0),
    zoneNames: zoneBreakdown.flatMap((item) => item.zones.map((zone) => zone.name)),
    validationSources: new Set(["fallback-no-plan"]),
    notes: zoneBreakdown.flatMap((item) => item.notes),
    layoutTypes: new Set(["fallback"]),
    planCount: 0,
    uploadedPlans: 0,
    forecastedFloors: Math.max(num(objectData?.floors, 1), 1),
    breakdown: zoneBreakdown,
  };
}

export { MIN_ACCEPTABLE_PLAN_QUALITY, SYSTEM_ZONE_TERMS };
