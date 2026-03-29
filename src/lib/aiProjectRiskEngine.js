import { getRegionCoef } from "../config/regionsConfig";

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeText(value) {
  return String(value ?? "").trim();
}

function hasSystem(systems = [], types = []) {
  return (systems || []).some((item) => types.includes(item?.type));
}

function collectPriceSignals(systemResults = []) {
  let lowConfidenceSystems = 0;
  let missingPriceItems = 0;
  let manualCheckItems = 0;
  let highRecheckSystems = 0;
  let manufacturerPriceGaps = 0;

  for (const row of systemResults) {
    const marketEntries = Array.isArray(row?.equipmentData?.marketEntries) ? row.equipmentData.marketEntries : [];
    const marketSummary = row?.equipmentData?.marketSummary || {};
    const confidence = toNumber(marketSummary?.confidencePercent, 100);
    const recheckRequiredCount = toNumber(marketSummary?.recheckRequiredCount, 0);
    const checkedSourceCount = toNumber(marketSummary?.checkedSourceCount, 0);
    const pricedSourceCount = toNumber(marketSummary?.pricedSourceCount, 0);
    if (marketEntries.length && confidence < 70) lowConfidenceSystems += 1;
    if (recheckRequiredCount >= 2) highRecheckSystems += 1;
    if (checkedSourceCount > 0 && pricedSourceCount === 0) manufacturerPriceGaps += 1;

    for (const entry of marketEntries) {
      const priceState = safeText(entry?.priceState).toLowerCase();
      const requiresManualReview = Boolean(entry?.requiresManualReview);
      if (priceState === "missing" || priceState === "not_found") missingPriceItems += 1;
      if (requiresManualReview || priceState === "manual_review") manualCheckItems += 1;
    }
  }

  return {
    lowConfidenceSystems,
    missingPriceItems,
    manualCheckItems,
    highRecheckSystems,
    manufacturerPriceGaps,
  };
}

function collectSurveySignals(technicalSolution = {}, aiSurveyCompletion = {}, zones = []) {
  const answers = technicalSolution?.appliedAnswers || {};
  const hasAppliedSurvey = Boolean(technicalSolution?.appliedAt);
  const completionPercent = toNumber(aiSurveyCompletion?.percent, 0);
  const unfinishedRequired = Array.isArray(aiSurveyCompletion?.unansweredRequired)
    ? aiSurveyCompletion.unansweredRequired.length
    : 0;

  let restrictedZones = 0;
  let finishSensitiveZones = 0;
  let highCeilingZones = 0;
  let trayRoutingZones = 0;
  let ceilingVoidZones = 0;
  let raisedFloorZones = 0;
  let corridorRouteDefinedZones = 0;
  let lowCurrentRooms = toNumber(answers["object-low-current-rooms"], 0);
  let noRiserAccess = answers["object-riser-access"] === false ? 1 : 0;
  let reservePercent = toNumber(answers["object-cable-reserve"], 0);
  let nightShiftRequired = false;
  let phasedAccess = false;

  const workWindows = answers["operational-work-window"];
  const normalizedWindows = Array.isArray(workWindows) ? workWindows : [workWindows].filter(Boolean);
  if (normalizedWindows.includes("Ночные смены")) nightShiftRequired = true;
  if (normalizedWindows.includes("Поэтапно по зонам")) phasedAccess = true;

  for (const zone of zones) {
    const restrictions = answers[`zone_${zone.id}_constraints`] || answers[`zone-${zone.id}-finish-limitations`] || [];
    const normalizedRestrictions = Array.isArray(restrictions) ? restrictions : [restrictions].filter(Boolean);
    if (normalizedRestrictions.some((item) => ["Ограниченный доступ", "Ночной график", "Работа рядом с людьми"].includes(item))) restrictedZones += 1;
    if (normalizedRestrictions.includes("Чистовая отделка")) finishSensitiveZones += 1;

    const ceilingHeight =
      toNumber(answers[`zone_${zone.id}_max_install_height`], 0) || toNumber(answers[`zone-${zone.id}-ceiling-height`], 0);
    if (ceilingHeight >= 4.5) highCeilingZones += 1;

    const routeMethods = answers[`zone-${zone.id}-corridor-route-method`] || [];
    const normalizedRoutes = Array.isArray(routeMethods) ? routeMethods : [routeMethods].filter(Boolean);
    if (normalizedRoutes.length) corridorRouteDefinedZones += 1;

    const trayRouting = answers[`zone-${zone.id}-tray-routing-present`] === true || normalizedRoutes.includes("В лотке");
    const ceilingVoid =
      answers[`zone-${zone.id}-ceiling-void-present`] === true || normalizedRoutes.includes("В запотолочном пространстве");
    const raisedFloor =
      answers[`zone-${zone.id}-raised-floor-present`] === true || normalizedRoutes.includes("Под фальш-полом");

    if (trayRouting) trayRoutingZones += 1;
    if (ceilingVoid) ceilingVoidZones += 1;
    if (raisedFloor) raisedFloorZones += 1;
  }

  return {
    hasAppliedSurvey,
    completionPercent,
    unfinishedRequired,
    restrictedZones,
    finishSensitiveZones,
    highCeilingZones,
    trayRoutingZones,
    ceilingVoidZones,
    raisedFloorZones,
    corridorRouteDefinedZones,
    lowCurrentRooms,
    noRiserAccess,
    reservePercent,
    nightShiftRequired,
    phasedAccess,
  };
}

function collectApsSignals(apsProjectSnapshots = {}) {
  let importedProjects = 0;
  let unresolvedRows = 0;
  let lowRecognitionProjects = 0;
  let priceGapsInProjects = 0;

  for (const snapshot of Object.values(apsProjectSnapshots || {})) {
    if (!snapshot?.active) continue;
    importedProjects += 1;
    unresolvedRows += Array.isArray(snapshot?.unrecognizedRows) ? snapshot.unrecognizedRows.length : 0;
    const recognitionRate = toNumber(snapshot?.sourceStats?.recognitionRate, 100);
    if (recognitionRate < 85) lowRecognitionProjects += 1;
    const noPriceCount = toNumber(snapshot?.sourceStats?.withoutPriceCount, 0);
    priceGapsInProjects += noPriceCount;
  }

  return { importedProjects, unresolvedRows, lowRecognitionProjects, priceGapsInProjects };
}

function collectSystemSignals(systems = [], systemResults = []) {
  let projectBasedSystems = 0;
  let highRouteComplexitySystems = 0;
  let highLaborRiskSystems = 0;
  let highConditionSystems = 0;
  let highMarkerCostSystems = 0;
  let integrationHeavySystems = 0;
  let routingAdjustedSystems = 0;

  const vendorSet = new Set();
  const types = new Set();
  const routeSamples = [];

  for (const system of systems || []) {
    if (system?.vendor && safeText(system.vendor).toLowerCase() !== "базовый") vendorSet.add(system.vendor);
    if (system?.type) types.add(system.type);
  }

  for (const row of systemResults || []) {
    if (row?.projectInPlace || row?.estimateMode === "project_pdf") projectBasedSystems += 1;

    const routeComplexity = toNumber(row?.routeComplexityAverage, 0);
    if (routeComplexity > 0) routeSamples.push(routeComplexity);
    if (routeComplexity >= 1.18) highRouteComplexitySystems += 1;

    const laborRisk = toNumber(row?.laborDetails?.neuralCheck?.underestimationRisk, 0);
    if (laborRisk >= 0.45) highLaborRiskSystems += 1;

    const conditionFactor = toNumber(row?.trace?.conditionLaborFactor, 1);
    if (conditionFactor >= 1.18) highConditionSystems += 1;

    const markerCost = toNumber(row?.unitWorkMarker?.costPerUnit, 0);
    if (markerCost >= 12000) highMarkerCostSystems += 1;

    const integrationPoints = toNumber(row?.trace?.autoQuantities?.integrationPoints, 0);
    if (row?.systemType === "ssoi" || integrationPoints >= 3) integrationHeavySystems += 1;

    const routingZones = toNumber(row?.trace?.surveyRoutingAdjustment?.zoneCount, 0);
    if (routingZones > 0) routingAdjustedSystems += 1;
  }

  const avgRouteComplexity = routeSamples.length ? routeSamples.reduce((sum, value) => sum + value, 0) / routeSamples.length : 1;

  return {
    systemCount: (systems || []).length,
    vendorDiversity: vendorSet.size,
    uniqueTypeCount: types.size,
    projectBasedSystems,
    highRouteComplexitySystems,
    highLaborRiskSystems,
    highConditionSystems,
    highMarkerCostSystems,
    integrationHeavySystems,
    routingAdjustedSystems,
    avgRouteComplexity,
  };
}

function makeRisk(id, title, severity, score, why, impact) {
  return {
    id,
    title,
    severity,
    score: Math.round(score),
    summary: why,
    impact,
  };
}

export function buildAiProjectRisks({
  objectData,
  zones,
  systems,
  systemResults,
  technicalSolution,
  aiSurveyCompletion,
  apsProjectSnapshots,
}) {
  const safeObject = objectData || {};
  const safeZones = Array.isArray(zones) ? zones : [];
  const safeSystems = Array.isArray(systems) ? systems : [];
  const safeSystemResults = Array.isArray(systemResults) ? systemResults : [];

  const totalArea = toNumber(safeObject.totalArea, 0);
  const floors = toNumber(safeObject.floors, 0);
  const basementFloors = toNumber(safeObject.basementFloors, 0);
  const protectedArea = toNumber(safeObject.protectedAreaM2 || safeObject.protectedArea, 0);
  const status = safeText(safeObject.buildingStatus);
  const objectType = safeText(safeObject.objectType);
  const regionCoef = toNumber(safeObject.regionCoef, getRegionCoef(safeObject.regionName));

  const systemsWithoutDocs = safeSystems.filter((item) => !item?.hasWorkingDocs).length;
  const priceSignals = collectPriceSignals(safeSystemResults);
  const surveySignals = collectSurveySignals(technicalSolution, aiSurveyCompletion, safeZones);
  const apsSignals = collectApsSignals(apsProjectSnapshots);
  const systemSignals = collectSystemSignals(safeSystems, safeSystemResults);

  const risks = [];

  const mountScore =
    (status === "operational" ? 30 : 12) +
    surveySignals.restrictedZones * 9 +
    surveySignals.finishSensitiveZones * 7 +
    surveySignals.nightShiftRequired * 8 +
    surveySignals.phasedAccess * 6 +
    surveySignals.noRiserAccess * 10 +
    systemSignals.highConditionSystems * 5 +
    (floors + basementFloors >= 8 ? 8 : 0) +
    (protectedArea >= 20000 ? 6 : 0);
  if (mountScore >= 34) {
    risks.push(
      makeRisk(
        "mount-constraints",
        "Риск удорожания и сдвига монтажных работ",
        mountScore >= 60 ? "high" : "medium",
        clamp(mountScore, 0, 100),
        `Объект ${status === "operational" ? "действующий" : "строящийся"}, а собранные данные уже показывают ограничения по доступу, режиму работ, чистовой отделке и условиям прохода трасс.`,
        "На реализации может понадобиться ночной или поэтапный монтаж, дополнительные согласования, более аккуратная организация работ и резерв по срокам."
      )
    );
  }

  const routeScore =
    (floors >= 10 ? 24 : floors >= 6 ? 16 : 8) +
    (basementFloors >= 2 ? 10 : basementFloors >= 1 ? 5 : 0) +
    surveySignals.highCeilingZones * 8 +
    surveySignals.trayRoutingZones * 4 +
    surveySignals.ceilingVoidZones * 5 +
    surveySignals.raisedFloorZones * 5 +
    systemSignals.highRouteComplexitySystems * 8 +
    (systemSignals.avgRouteComplexity >= 1.16 ? 8 : 0) +
    (totalArea >= 30000 ? 10 : totalArea >= 15000 ? 6 : 0);
  if (routeScore >= 30) {
    risks.push(
      makeRisk(
        "route-density",
        "Риск сложной трассировки и вертикальной инфраструктуры",
        routeScore >= 58 ? "high" : "medium",
        clamp(routeScore, 0, 100),
        `Этажность, подземные уровни, высотные зоны, коридорные маршруты и подтвержденные способы прокладки формируют повышенную сложность кабельной инфраструктуры.`,
        "Проекту может понадобиться больше лотков, проходок, вертикальных трасс, промежуточных узлов и трудозатрат на прокладку, чем в типовом сценарии."
      )
    );
  }

  const specificationScore =
    systemsWithoutDocs * 10 +
    apsSignals.unresolvedRows * 4 +
    apsSignals.lowRecognitionProjects * 12 +
    apsSignals.priceGapsInProjects * 2 +
    (!surveySignals.hasAppliedSurvey && systemsWithoutDocs > 0 ? 12 : 0) +
    (surveySignals.completionPercent < 70 ? 8 : 0) +
    surveySignals.unfinishedRequired * 3;
  if (specificationScore >= 24) {
    risks.push(
      makeRisk(
        "specification-gap",
        "Риск неполной спецификации и корректировок состава системы",
        specificationScore >= 55 ? "high" : "medium",
        clamp(specificationScore, 0, 100),
        `Часть систем идет без полного пакета РД, а распознанные проектные данные и результаты обследования все еще содержат зоны неопределенности.`,
        "На следующих этапах могут добавиться позиции оборудования, материалов, трасс, шкафов и точек подключения, что изменит структуру бюджета."
      )
    );
  }

  const procurementScore =
    priceSignals.missingPriceItems * 3 +
    priceSignals.manualCheckItems * 2 +
    priceSignals.lowConfidenceSystems * 12 +
    priceSignals.highRecheckSystems * 7 +
    priceSignals.manufacturerPriceGaps * 6 +
    (regionCoef >= 1.15 ? 8 : regionCoef <= 0.95 ? 3 : 0) +
    (systemSignals.vendorDiversity >= 3 ? 4 : 0);
  if (procurementScore >= 22) {
    risks.push(
      makeRisk(
        "procurement-market",
        "Риск закупки и уточнения рыночной цены",
        procurementScore >= 52 ? "high" : "medium",
        clamp(procurementScore, 0, 100),
        `По части позиций рынок покрыт неравномерно: есть пропуски цен, ручная перепроверка и площадки с низкой уверенностью определения стоимости.`,
        "На стадии закупки возможны уточнение брендов, замена отдельных позиций, корректировка unit-price и необходимость резервов на коммерческие отклонения."
      )
    );
  }

  const coordinationScore =
    Math.max(systemSignals.systemCount - 2, 0) * 8 +
    (safeZones.length >= 4 ? 9 : safeZones.length >= 3 ? 5 : 0) +
    systemSignals.integrationHeavySystems * 10 +
    systemSignals.vendorDiversity * 3 +
    surveySignals.restrictedZones * 4 +
    systemSignals.projectBasedSystems * 4;
  if (coordinationScore >= 24) {
    risks.push(
      makeRisk(
        "coordination",
        "Риск межсистемной координации и сложной ПНР",
        coordinationScore >= 48 ? "high" : "medium",
        clamp(coordinationScore, 0, 100),
        `В проекте несколько инженерных систем, разнотипные зоны, интеграционные связи и разные вендорные контуры, которые нужно синхронизировать по трассам, шкафам и пусконаладке.`,
        "Возрастает вероятность дополнительных итераций при проектировании, локальных коллизий на монтаже и удлинения ПНР из-за интеграции подсистем."
      )
    );
  }

  const laborScore =
    systemSignals.highLaborRiskSystems * 14 +
    systemSignals.highMarkerCostSystems * 8 +
    (surveySignals.reservePercent >= 20 ? 8 : surveySignals.reservePercent >= 10 ? 4 : 0) +
    (objectType === "transport" || objectType === "production" || objectType === "energy" ? 8 : 0);
  if (laborScore >= 24) {
    risks.push(
      makeRisk(
        "labor-underestimate",
        "Риск недооценки трудоемкости и резерва по работам",
        laborScore >= 46 ? "high" : "medium",
        clamp(laborScore, 0, 100),
        `Текущая конфигурация объекта и систем показывает повышенную трудоемкость: сложные условия, высокий unit-marker, сигналы AI-проверки и повышенные требования к кабельному резерву.`,
        "Без финансового и календарного резерва проект может выйти за план по СМР+ПНР при переходе от пресейла к реализации."
      )
    );
  }

  return risks.sort((a, b) => b.score - a.score).slice(0, 5);
}
