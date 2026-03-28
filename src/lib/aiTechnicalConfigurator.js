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

function collectRecognizedPlanData(photoAnalyses, systemType) {
  return Object.values(photoAnalyses || {}).reduce(
    (acc, analysis) => {
      const planRecognition = analysis?.planRecognition;
      if (!planRecognition) return acc;
      const systemPlan = (planRecognition.systems || []).find((item) => item.systemType === systemType);
      if (!systemPlan) return acc;

      acc.planCount += 1;
      acc.totalZones += num(systemPlan.zoneCount, 0);
      acc.layoutTypes.add(planRecognition.layoutType || "Смешанная");
      acc.zoneNames.push(...(systemPlan.zones || []).map((zone) => zone.name));
      acc.validationSources.add(systemPlan.validationSource || "unknown");
      acc.notes.push(...(systemPlan.notes || []));
      return acc;
    },
    {
      planCount: 0,
      totalZones: 0,
      layoutTypes: new Set(),
      zoneNames: [],
      validationSources: new Set(),
      notes: [],
    }
  );
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
      ).join(", ")}`,
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

    return rows;
  });
}

function buildBaseSpecRows(systemType, result, apsSnapshot) {
  if (systemType === "aps" && apsSnapshot?.active && Array.isArray(apsSnapshot.items) && apsSnapshot.items.length) {
    return apsSnapshot.items.slice(0, 12).map((item, index) => ({
      key: item.id || `${systemType}-pdf-${index + 1}`,
      name: item.model ? `${item.name} (${item.model})` : item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: item.unit || "шт",
      basis: item.positionNumber ? `Позиция ${item.positionNumber} из проектной спецификации` : "Проектная спецификация APS",
    }));
  }

  const bom = Array.isArray(result?.bom) ? result.bom : [];
  if (bom.length) {
    return bom.slice(0, 10).map((item, index) => ({
      key: item.code || `${systemType}-bom-${index + 1}`,
      name: item.name,
      qty: Math.max(num(item.qty, 0), 0),
      unit: "шт",
      basis: "Расчетный BOM системы",
    }));
  }

  const keyEquipment = Array.isArray(result?.equipmentData?.keyEquipment) ? result.equipmentData.keyEquipment : [];
  return keyEquipment.slice(0, 8).map((item, index) => ({
    key: item.code || `${systemType}-key-${index + 1}`,
    name: item.label || item.name || `Позиция ${index + 1}`,
    qty: Math.max(num(item.qty, result?.units || 0), 0),
    unit: "шт",
    basis: "Ключевое оборудование по конфигуратору системы",
  }));
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
    const baseRows = buildBaseSpecRows(system.type, result, apsProjectSnapshots?.[system.id]);
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
        }
      : recognizedPlanData;
    const materialRows = [
      ...buildStatusMaterials(system.type, objectData, markerUnits, surveyAnswers, zones),
      ...buildZoneMaterials(system.type, zones, surveyAnswers),
      ...buildPlanSpecRows(system.type, effectiveZoneData),
    ];
    const combinedRows = [...baseRows, ...materialRows].map((row) => {
      const override = specOverrides?.[system.id]?.[row.key] || {};
      return {
        ...row,
        qty: override.qty !== undefined ? Math.max(num(override.qty, row.qty), 0) : row.qty,
      };
    });

    const integrationCount = num(surveyAnswers?.[`system-${system.id}-integration-count`], result?.unitWorkMarker?.qty ? 1 : 0);
    const lowCurrentRooms = num(surveyAnswers?.["object-low-current-rooms"], 0);
    const avgZoneHeight =
      zones && zones.length
        ? zones.reduce((sum, zone) => sum + numericAnswer(surveyAnswers, `zone-${zone.id}-ceiling-height`, 0), 0) / zones.length
        : 0;
    const readinessScoreBase = 66 + (system.hasWorkingDocs ? 16 : 0) + (integrationCount > 0 ? 6 : 0) + (lowCurrentRooms > 0 ? 4 : 0);

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
            } для ${system.type.toUpperCase()} (${effectiveZoneData.planCount} план(ов), типы планировки: ${Array.from(
              effectiveZoneData.layoutTypes
            ).join(", ")}, источники: ${Array.from(effectiveZoneData.validationSources).join(", ")}).`
          : `Планы по ${system.type.toUpperCase()} не загружены или недостаточно надежны, поэтому используется fallback-алгоритм с перепроверкой по данным объекта.`,
        ...(effectiveZoneData.notes || []).slice(0, 2),
      ],
      influences: [
        { label: "Площадь и зоны", value: `${Math.round(num(objectData?.totalArea, 0))} м² / ${zones?.length || 0} зон` },
        { label: "Статус объекта", value: objectData?.buildingStatus === "construction" ? "Строящийся" : "Действующий" },
        { label: "Интеграция", value: `${integrationCount} точек` },
        { label: "Слаботочные узлы", value: `${lowCurrentRooms} помещений` },
        ...(effectiveZoneData.totalZones > 0
          ? [{ label: system.type === "aps" ? "ЗКСПС" : "Зоны по расчету", value: `${effectiveZoneData.totalZones} зон` }]
          : []),
      ],
      recognizedPlanData: effectiveZoneData,
    };
  });
}
