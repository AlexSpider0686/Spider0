import { calculateZoneModelWithoutPlans } from "./evacuationPlanRecognition";

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstAnswer(answers, key, fallback = []) {
  const value = answers?.[key];
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return fallback;
  return [value];
}

function numericAnswer(answers, key, fallback = 0) {
  const value = Number(answers?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

function boolAnswer(answers, key, fallback = false) {
  if (typeof answers?.[key] === "boolean") return answers[key];
  return fallback;
}

function collectRecognizedPlanData(photoAnalyses, systemType) {
  return Object.values(photoAnalyses || {}).reduce(
    (acc, analysis) => {
      const planRecognition = analysis?.planRecognition;
      if (!planRecognition) return acc;
      const systemPlan = (planRecognition.systems || []).find((item) => item.systemType === systemType);
      if (!systemPlan) return acc;

      acc.planCount += 1;
      acc.uploadedPlans += num(planRecognition.uploadedPlans, planRecognition.floorPlansAccepted || 0);
      acc.expectedFloors = Math.max(acc.expectedFloors, num(planRecognition.expectedFloorCount, 0));
      acc.forecastedFloors += num(planRecognition.forecastedFloors, 0);
      acc.totalZones += num(systemPlan.zoneCount, 0);
      acc.layoutTypes.add(planRecognition.layoutType || "Смешанная");
      acc.zoneNames.push(...(systemPlan.zones || []).map((zone) => zone.name));
      acc.validationSources.add(systemPlan.validationSource || "unknown");
      acc.notes.push(...(systemPlan.notes || []));
      acc.warnings.push(...((planRecognition.warnings || []).map((warning) => warning.message)));
      if (planRecognition.areaComparison) {
        acc.areaComparisons.push(planRecognition.areaComparison);
      }
      return acc;
    },
    {
      planCount: 0,
      uploadedPlans: 0,
      expectedFloors: 0,
      forecastedFloors: 0,
      totalZones: 0,
      layoutTypes: new Set(),
      zoneNames: [],
      validationSources: new Set(),
      notes: [],
      warnings: [],
      areaComparisons: [],
    }
  );
}

function summarizeAreaComparison(areaComparisons = []) {
  if (!areaComparisons.length) return null;

  const aggregate = areaComparisons.reduce(
    (acc, item) => {
      acc.userTotalArea += num(item.userTotalArea, 0);
      acc.predictedTotalArea += num(item.predictedTotalArea, 0);
      acc.recognizedAverageFloorArea += num(item.recognizedAverageFloorArea, 0);
      return acc;
    },
    {
      userTotalArea: 0,
      predictedTotalArea: 0,
      recognizedAverageFloorArea: 0,
    }
  );

  const deviationPercent =
    aggregate.userTotalArea > 0 ? ((aggregate.predictedTotalArea - aggregate.userTotalArea) / aggregate.userTotalArea) * 100 : 0;

  return {
    userTotalArea: Number(aggregate.userTotalArea.toFixed(1)),
    predictedTotalArea: Number(aggregate.predictedTotalArea.toFixed(1)),
    recognizedAverageFloorArea: Number((aggregate.recognizedAverageFloorArea / areaComparisons.length).toFixed(1)),
    deviationPercent: Number(deviationPercent.toFixed(1)),
  };
}

function buildPlanSpecRows(systemType, recognizedPlanData) {
  if (!["aps", "soue", "sots"].includes(systemType) || recognizedPlanData.totalZones <= 0) {
    return [];
  }

  const rowName =
    systemType === "soue"
      ? "Зональное деление СОУЭ по планировкам"
      : systemType === "sots"
        ? "Охранные зоны СОТС по планировкам"
        : "ЗКСПС АПС по планировкам";

  return [
    {
      key: `${systemType}-recognized-zones`,
      name: rowName,
      qty: recognizedPlanData.totalZones,
      unit: "зон",
      basis: `Определено по распознаванию и перепроверке планов эвакуации: ${recognizedPlanData.planCount} план(ов), типы планировки: ${Array.from(
        recognizedPlanData.layoutTypes
      ).join(", ")}${recognizedPlanData.expectedFloors ? `, этажей ожидается: ${recognizedPlanData.expectedFloors}` : ""}${
        recognizedPlanData.forecastedFloors ? `, спрогнозировано этажей: ${recognizedPlanData.forecastedFloors}` : ""
      }`,
    },
  ];
}

function buildStatusMaterials(systemType, objectData, markerUnits, answers, zones) {
  const materialRows = [];
  const floors = Math.max(num(objectData?.floors, 1), 1);
  const totalZoneFloors = Math.max((zones || []).reduce((sum, zone) => sum + Math.max(num(zone?.floors, 0), 0), 0), floors);
  const finishSensitive = answers["operational-finish-sensitive"] === true;
  const cableReservePercent = Math.max(num(answers["object-cable-reserve"], 10), 0);

  materialRows.push({
    key: `${systemType}-reserve`,
    name: "Запас кабеля и расходных материалов",
    qty: Math.max(Math.round(markerUnits * (1 + cableReservePercent / 100)), 1),
    unit: "усл. ед.",
    basis: `Запас ${cableReservePercent}% от базового объема системы`,
  });

  materialRows.push({
    key: `${systemType}-riser`,
    name: "Материалы для вертикальных трасс и промежуточных узлов",
    qty: Math.max(Math.ceil(totalZoneFloors * 1.2), 1),
    unit: "компл.",
    basis: `Этажность и вертикальные переходы: ${totalZoneFloors} этажных уровней`,
  });

  if (objectData?.buildingStatus === "construction") {
    materialRows.push({
      key: `${systemType}-rough-fasteners`,
      name: "Крепеж и закладные для строящегося объекта",
      qty: Math.max(Math.ceil(markerUnits * 0.8), 1),
      unit: "шт",
      basis: "Подготовка трасс и крепежа на стадии стройки",
    });
  } else {
    materialRows.push({
      key: `${systemType}-finish-fasteners`,
      name: "Крепеж и декоративные элементы для готовой отделки",
      qty: Math.max(Math.ceil(markerUnits * (finishSensitive ? 1.15 : 0.9)), 1),
      unit: "шт",
      basis: finishSensitive ? "Монтаж без повреждения чистовой отделки" : "Действующий объект без жестких отделочных ограничений",
    });
  }

  return materialRows;
}

function buildZoneMaterials(systemType, zones, answers) {
  return (zones || []).flatMap((zone) => {
    const wallMaterials = firstAnswer(answers, `zone-${zone.id}-wall-material`, []);
    const ceilingTypes = firstAnswer(answers, `zone-${zone.id}-ceiling-type`, []);
    const ceilingHeight = numericAnswer(answers, `zone-${zone.id}-ceiling-height`, 0);
    const routeMethods = firstAnswer(answers, `zone-${zone.id}-corridor-route-method`, []);
    const raisedFloor = boolAnswer(answers, `zone-${zone.id}-raised-floor-present`);
    const ceilingVoid = boolAnswer(answers, `zone-${zone.id}-ceiling-void-present`);
    const trayRouting = boolAnswer(answers, `zone-${zone.id}-tray-routing-present`);
    const rows = [];

    if (wallMaterials.includes("Бетон")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-anchors`,
        name: `Анкерный крепеж для зоны "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 18), 1),
        unit: "шт",
        basis: "Бетонные основания по фотофиксации / чек-листу",
      });
    }

    if (ceilingTypes.includes("Армстронг") || ceilingTypes.includes("Грильято")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-suspension`,
        name: `Подвесы и элементы скрытого монтажа для зоны "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 22), 1),
        unit: "шт",
        basis: "Подвесной потолок по результатам обследования",
      });
    }

    if (ceilingHeight >= 4.2) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-high-access`,
        name: `Подмости/подъемные элементы для высотного монтажа в зоне "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 90), 1),
        unit: "компл.",
        basis: `Высота помещения ${ceilingHeight.toFixed(1)} м по чек-листу/фотоанализу`,
      });
    }

    if (trayRouting || routeMethods.includes("В лотке")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-trays`,
        name: `Кабельные лотки для зоны "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 25), 1),
        unit: "м",
        basis: "Маршрут прокладки определен по фото коридора: лотковая трасса",
      });
    }

    if (routeMethods.includes("В коробе")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-boxes`,
        name: `Кабель-канал / короб для зоны "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 28), 1),
        unit: "м",
        basis: "Маршрут прокладки определен по фото коридора: короб",
      });
    }

    if (routeMethods.includes("В гофре/трубе")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-conduit`,
        name: `Гофра/труба для зоны "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 22), 1),
        unit: "м",
        basis: "Маршрут прокладки определен по фото коридора: труба/гофра",
      });
    }

    if (ceilingVoid || routeMethods.includes("В запотолочном пространстве")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-ceiling-void`,
        name: `Крепеж и подвесы для запотолочного пространства в зоне "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 35), 1),
        unit: "компл.",
        basis: "По обследованию подтверждено запотолочное пространство для трасс",
      });
    }

    if (raisedFloor || routeMethods.includes("Под фальш-полом")) {
      rows.push({
        key: `${systemType}-zone-${zone.id}-raised-floor`,
        name: `Материалы для прокладки под фальш-полом в зоне "${zone.name}"`,
        qty: Math.max(Math.ceil(num(zone.area) / 30), 1),
        unit: "компл.",
        basis: "По обследованию подтвержден фальш-пол",
      });
    }

    return rows;
  });
}

function roundMoney(value) {
  return Number(num(value, 0).toFixed(2));
}

function detectSpecCategory(name = "", fallback = "equipment") {
  const normalized = String(name || "").toLowerCase();
  if (
    normalized.includes("кабель") ||
    normalized.includes("лот") ||
    normalized.includes("гофр") ||
    normalized.includes("труб") ||
    normalized.includes("короб") ||
    normalized.includes("креп") ||
    normalized.includes("подвес") ||
    normalized.includes("анкер") ||
    normalized.includes("материал") ||
    normalized.includes("заклад")
  ) {
    return "material";
  }
  return fallback;
}

function inferSurveyUnitPrice(row) {
  const normalized = String(row?.name || "").toLowerCase();
  if (normalized.includes("лот")) return 420;
  if (normalized.includes("короб")) return 310;
  if (normalized.includes("гофр") || normalized.includes("труб")) return 180;
  if (normalized.includes("анкер") || normalized.includes("креп")) return 65;
  if (normalized.includes("подмост") || normalized.includes("подъем")) return 6900;
  if (normalized.includes("зкспс") || normalized.includes("зональ")) return 850;
  if (normalized.includes("фальш-пол")) return 2600;
  if (normalized.includes("запотол")) return 2400;
  if (normalized.includes("вертикаль")) return 4200;
  if (normalized.includes("запас")) return 950;
  if (row?.unit === "м") return 180;
  if (row?.unit === "шт") return 120;
  if (row?.unit === "компл.") return 3200;
  if (row?.unit === "зон") return 850;
  return 1000;
}

function finalizeSpecRows(rows, overrideMap = {}) {
  return rows.map((row, index) => {
    const override = overrideMap?.[row.key] || {};
    const qty = override.qty !== undefined ? Math.max(num(override.qty, row.qty), 0) : Math.max(num(row.qty, 0), 0);
    const unitPrice = roundMoney(row.unitPrice);
    return {
      ...row,
      order: row.order ?? index,
      qty,
      unitPrice,
      total: roundMoney(qty * unitPrice),
      category: row.category || "material",
      source: row.source || "algorithm",
    };
  });
}

function buildPricedEquipmentRows(systemType, result, apsSnapshot) {
  if (systemType === "aps" && apsSnapshot?.active && Array.isArray(apsSnapshot.items) && apsSnapshot.items.length) {
    return apsSnapshot.items.map((item, index) => ({
      key: item.id || `${systemType}-pdf-${index + 1}`,
      name: item.model ? `${item.name} (${item.model})` : item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: item.unit || "шт",
      basis: item.position ? `Позиция ${item.position} из проектной спецификации` : "Проектная спецификация APS",
      unitPrice: num(item.unitPrice, 0),
      category: item.category === "materials" ? "material" : "equipment",
      source: "project_pdf",
    }));
  }

  const bom = Array.isArray(result?.bom) ? result.bom : [];
  if (bom.length) {
    return bom.map((item, index) => ({
      key: item.code || `${systemType}-bom-${index + 1}`,
      name: item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: "шт",
      basis: "Расчетный BOM системы",
      unitPrice: num(item.unitPrice, 0),
      category: detectSpecCategory(item.name, "equipment"),
      source: "model_bom",
    }));
  }

  const keyEquipment = Array.isArray(result?.equipmentData?.keyEquipment) ? result.equipmentData.keyEquipment : [];
  return keyEquipment.map((item, index) => ({
    key: item.code || `${systemType}-key-${index + 1}`,
    name: item.label || item.name || `Позиция ${index + 1}`,
    qty: Math.max(num(item.qty, result?.units || 0), 0),
    unit: "шт",
    basis: "Ключевое оборудование по конфигуратору системы",
    unitPrice: num(item.unitPrice, 0),
    category: "equipment",
    source: "key_equipment",
  }));
}

function buildInfrastructureRows(systemType, result) {
  if (!result) return [];

  const rows = [];
  const cableQty = Math.max(num(result?.cable, 0), 0);
  if (cableQty > 0) {
    rows.push({
      key: `${systemType}-cable-line`,
      name: "Кабельные линии системы",
      qty: Number(cableQty.toFixed(1)),
      unit: "м",
      unitPrice: cableQty > 0 ? num(result?.cableMaterials, 0) / cableQty : 0,
      basis: "Рассчитано по длинам трасс системы, этажности и структуре зон.",
      category: "material",
      source: "cable_model",
    });
  }

  const trayQty = Math.max(num(result?.trayLength, result?.trace?.trayLengthM), 0);
  if (trayQty > 0) {
    rows.push({
      key: `${systemType}-tray-line`,
      name: "Кабельные лотки",
      qty: Number(trayQty.toFixed(1)),
      unit: "м",
      unitPrice: 95,
      basis: "Лотковая часть трасс рассчитана по маршрутам прокладки и КНС-модели.",
      category: "material",
      source: "kns_model",
    });
  }

  const conduitQty = Math.max(num(result?.conduitLength, result?.trace?.conduitLengthM), 0);
  if (conduitQty > 0) {
    rows.push({
      key: `${systemType}-conduit-line`,
      name: "Гофра / труба для кабельных линий",
      qty: Number(conduitQty.toFixed(1)),
      unit: "м",
      unitPrice: 88,
      basis: "Трубная часть трасс рассчитана по маршрутам прокладки и КНС-модели.",
      category: "material",
      source: "kns_model",
    });
  }

  const fastenerQty = Math.max(num(result?.fastenerUnits, result?.trace?.fastenerUnits), 0);
  if (fastenerQty > 0) {
    rows.push({
      key: `${systemType}-fasteners`,
      name: "Крепеж и подвесы",
      qty: Math.round(fastenerQty),
      unit: "шт",
      unitPrice: 6,
      basis: "Количество крепежа определено по длинам трасс, вертикальным участкам и монтажным условиям.",
      category: "material",
      source: "kns_model",
    });
  }

  const penetrationQty = Math.max(num(result?.penetrationUnits, result?.trace?.penetrationUnits), 0);
  if (penetrationQty > 0) {
    rows.push({
      key: `${systemType}-penetrations`,
      name: "Проходки и узлы пересечения",
      qty: Math.round(penetrationQty),
      unit: "шт",
      unitPrice: 240,
      basis: "Проходки рассчитаны по этажности, вертикальным трассам и переходам между зонами.",
      category: "material",
      source: "kns_model",
    });
  }

  const resourceMaterialsTotal = Math.max(num(result?.breakdown?.materials?.resourceMaterials, 0), 0);
  const resourceUnits = Math.max(num(result?.units, 0), 1);
  if (resourceMaterialsTotal > 0) {
    rows.push({
      key: `${systemType}-resource-materials`,
      name: "Расходные материалы и коммутация",
      qty: resourceUnits,
      unit: "компл.",
      unitPrice: resourceMaterialsTotal / resourceUnits,
      basis: "Алгоритмически рассчитанный комплект расходных материалов по составу системы.",
      category: "material",
      source: "resource_model",
    });
  }

  return rows;
}

function buildSurveySpecRows(materialRows = []) {
  return materialRows.map((row) => ({
    ...row,
    unitPrice: inferSurveyUnitPrice(row),
    category: "material",
    source: "survey_ai",
  }));
}

function buildBaseSpecRows(systemType, result, apsSnapshot) {
  if (systemType === "aps" && apsSnapshot?.active && Array.isArray(apsSnapshot.items) && apsSnapshot.items.length) {
    return apsSnapshot.items.map((item, index) => ({
      key: item.id || `${systemType}-pdf-${index + 1}`,
      name: item.model ? `${item.name} (${item.model})` : item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: item.unit || "шт",
      basis: item.position ? `Позиция ${item.position} из проектной спецификации` : "Проектная спецификация APS",
    }));
  }

  const bom = Array.isArray(result?.bom) ? result.bom : [];
  if (bom.length) {
    return bom.map((item, index) => ({
      key: item.code || `${systemType}-bom-${index + 1}`,
      name: item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: "шт",
      basis: "Расчетный BOM системы",
    }));
  }

  const keyEquipment = Array.isArray(result?.equipmentData?.keyEquipment) ? result.equipmentData.keyEquipment : [];
  return keyEquipment.map((item, index) => ({
    key: item.code || `${systemType}-key-${index + 1}`,
    name: item.label || item.name || `Позиция ${index + 1}`,
    qty: Math.max(num(item.qty, result?.units || 0), 0),
    unit: "шт",
    basis: "Ключевое оборудование по конфигуратору системы",
  }));
}

function buildRouteInfluence(zones, answers) {
  const routeCounts = {
    tray: 0,
    conduit: 0,
    box: 0,
    ceilingVoid: 0,
    raisedFloor: 0,
  };

  (zones || []).forEach((zone) => {
    const routeMethods = firstAnswer(answers, `zone-${zone.id}-corridor-route-method`, []);
    if (routeMethods.includes("В лотке") || boolAnswer(answers, `zone-${zone.id}-tray-routing-present`)) routeCounts.tray += 1;
    if (routeMethods.includes("В гофре/трубе")) routeCounts.conduit += 1;
    if (routeMethods.includes("В коробе")) routeCounts.box += 1;
    if (routeMethods.includes("В запотолочном пространстве") || boolAnswer(answers, `zone-${zone.id}-ceiling-void-present`)) routeCounts.ceilingVoid += 1;
    if (routeMethods.includes("Под фальш-полом") || boolAnswer(answers, `zone-${zone.id}-raised-floor-present`)) routeCounts.raisedFloor += 1;
  });

  return routeCounts;
}

export function buildAiTechnicalRecommendations({
  systems,
  systemResults,
  objectData,
  zones,
  surveyAnswers,
  photoAnalyses,
  apsProjectSnapshots,
  specOverrides,
}) {
  return (systems || []).map((system, index) => {
    const result = systemResults?.[index];
    const markerUnits = Math.max(num(result?.unitWorkMarker?.qty, result?.units), 1);
    const recognizedPlanData = collectRecognizedPlanData(photoAnalyses, system.type);
    const fallbackZoneModel =
      recognizedPlanData.totalZones > 0 || !["aps", "soue", "sots"].includes(system.type)
        ? null
        : calculateZoneModelWithoutPlans({
            systemType: system.type,
            objectData,
            zones,
          });

    const effectiveZoneData = fallbackZoneModel
      ? {
          ...recognizedPlanData,
          totalZones: fallbackZoneModel.totalZones,
          zoneNames: fallbackZoneModel.zoneNames,
          validationSources: fallbackZoneModel.validationSources,
          notes: fallbackZoneModel.notes,
          layoutTypes: fallbackZoneModel.layoutTypes,
          planCount: fallbackZoneModel.planCount,
          uploadedPlans: fallbackZoneModel.uploadedPlans,
          forecastedFloors: fallbackZoneModel.forecastedFloors,
        }
      : recognizedPlanData;

    const areaComparison = summarizeAreaComparison(effectiveZoneData.areaComparisons || []);
    const routeInfluence = buildRouteInfluence(zones, surveyAnswers);

    const materialRows = [
      ...buildStatusMaterials(system.type, objectData, markerUnits, surveyAnswers, zones),
      ...buildZoneMaterials(system.type, zones, surveyAnswers),
      ...buildPlanSpecRows(system.type, effectiveZoneData),
    ];

    const combinedRows = finalizeSpecRows(
      [
        ...buildPricedEquipmentRows(system.type, result, apsProjectSnapshots?.[system.id]),
        ...buildInfrastructureRows(system.type, result),
        ...buildSurveySpecRows(materialRows),
      ],
      specOverrides?.[system.id] || {}
    );

    const integrationCount = num(surveyAnswers?.[`system-${system.id}-integration-count`], result?.unitWorkMarker?.qty ? 1 : 0);
    const lowCurrentRooms = num(surveyAnswers?.["object-low-current-rooms"], 0);
    const avgZoneHeight =
      zones && zones.length
        ? zones.reduce((sum, zone) => sum + numericAnswer(surveyAnswers, `zone-${zone.id}-ceiling-height`, 0), 0) / zones.length
        : 0;

    const readinessScoreBase =
      66 +
      (system.hasWorkingDocs ? 16 : 0) +
      (integrationCount > 0 ? 6 : 0) +
      (lowCurrentRooms > 0 ? 4 : 0) +
      (routeInfluence.tray > 0 || routeInfluence.ceilingVoid > 0 || routeInfluence.raisedFloor > 0 ? 4 : 0);

    return {
      systemId: system.id,
      systemType: system.type,
      hasWorkingDocs: Boolean(system.hasWorkingDocs),
      readinessScore: Math.min(readinessScoreBase, 98),
      specRows: combinedRows,
      summary: [
        `Площадь и зонирование учтены через расчетные объемы системы: ${Math.round(num(result?.units, markerUnits))} базовых единиц.`,
        `Этажность и вертикальные переходы учтены через дополнительные материалы и узлы: ${Math.max(num(objectData?.floors, 1), 1)} этажей.`,
        system.hasWorkingDocs
          ? "По системе отмечено наличие РД, поэтому AI-обследование используется как уточняющий, а не базовый контур."
          : "По системе нет РД, поэтому AI-обследование напрямую влияет на формирование техрешения.",
        effectiveZoneData.totalZones > 0
          ? `По планам эвакуации и перепроверке распознано ${effectiveZoneData.totalZones} ${
              system.type === "aps" ? "ЗКСПС" : system.type === "soue" ? "зон оповещения" : "охранных зон"
            } для ${system.type.toUpperCase()} (${effectiveZoneData.uploadedPlans || effectiveZoneData.planCount} принятых план(ов) из ${
              effectiveZoneData.expectedFloors || "не задано"
            } этажей).`
          : `Планы по ${system.type.toUpperCase()} не загружены или недостаточно надежны, поэтому используется fallback-алгоритм с перепроверкой по данным объекта.`,
        areaComparison
          ? `Сравнение площадей: пользователь ввел ${areaComparison.userTotalArea} м², по планировкам и фото прогнозируется ${areaComparison.predictedTotalArea} м² (отклонение ${areaComparison.deviationPercent}%).`
          : "Сравнение площадей по планировкам недоступно: используется только введенная пользователем площадь.",
        routeInfluence.tray || routeInfluence.conduit || routeInfluence.box || routeInfluence.ceilingVoid || routeInfluence.raisedFloor
          ? `Фото коридоров уточнили способы прокладки: лотки ${routeInfluence.tray}, труба/гофра ${routeInfluence.conduit}, короб ${routeInfluence.box}, запотолок ${routeInfluence.ceilingVoid}, фальш-пол ${routeInfluence.raisedFloor}.`
          : "Фото коридоров не дали выраженных признаков трасс, поэтому применены типовые предпосылки прокладки.",
        ...(effectiveZoneData.warnings || []).slice(0, 2),
        ...(effectiveZoneData.notes || []).slice(0, 2),
      ],
      influences: [
        { label: "Площадь и зоны", value: `${Math.round(num(objectData?.totalArea, 0))} м² / ${zones?.length || 0} зон` },
        { label: "Статус объекта", value: objectData?.buildingStatus === "construction" ? "Строящийся" : "Действующий" },
        { label: "Интеграция", value: `${integrationCount} точек` },
        { label: "Слаботочные узлы", value: `${lowCurrentRooms} помещений` },
        ...(areaComparison ? [{ label: "Площадь по планам", value: `${areaComparison.predictedTotalArea} м²` }] : []),
        ...(effectiveZoneData.totalZones > 0
          ? [{ label: system.type === "aps" ? "ЗКСПС" : "Зоны по расчету", value: `${effectiveZoneData.totalZones} зон` }]
          : []),
        { label: "Лотковые трассы", value: `${routeInfluence.tray}` },
        { label: "Запотолочные трассы", value: `${routeInfluence.ceilingVoid}` },
        { label: "Фальш-пол", value: `${routeInfluence.raisedFloor}` },
        { label: "Средняя высота", value: avgZoneHeight ? `${avgZoneHeight.toFixed(1)} м` : "нет данных" },
      ],
      recognizedPlanData: effectiveZoneData,
    };
  });
}
