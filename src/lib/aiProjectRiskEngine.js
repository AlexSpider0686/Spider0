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
  const unfinishedRequired = Array.isArray(aiSurveyCompletion?.unansweredRequired) ? aiSurveyCompletion.unansweredRequired.length : 0;

  let restrictedZones = 0;
  let finishSensitiveZones = 0;
  let highCeilingZones = 0;
  let trayRoutingZones = 0;
  let ceilingVoidZones = 0;
  let raisedFloorZones = 0;
  const lowCurrentRooms = toNumber(answers["object-low-current-rooms"], 0);
  const noRiserAccess = answers["object-riser-access"] === false ? 1 : 0;
  const reservePercent = toNumber(answers["object-cable-reserve"], 0);

  let nightShiftRequired = false;
  let phasedAccess = false;

  const workWindows = answers["operational-work-window"];
  const normalizedWindows = Array.isArray(workWindows) ? workWindows : [workWindows].filter(Boolean);
  if (normalizedWindows.includes("РќРѕС‡РЅС‹Рµ СЃРјРµРЅС‹")) nightShiftRequired = true;
  if (normalizedWindows.includes("РџРѕСЌС‚Р°РїРЅРѕ РїРѕ Р·РѕРЅР°Рј")) phasedAccess = true;

  for (const zone of zones) {
    const restrictions = answers[`zone_${zone.id}_constraints`] || answers[`zone-${zone.id}-finish-limitations`] || [];
    const normalizedRestrictions = Array.isArray(restrictions) ? restrictions : [restrictions].filter(Boolean);

    if (normalizedRestrictions.some((item) => ["РћРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РґРѕСЃС‚СѓРї", "РќРѕС‡РЅРѕР№ РіСЂР°С„РёРє", "Р Р°Р±РѕС‚Р° СЂСЏРґРѕРј СЃ Р»СЋРґСЊРјРё"].includes(item))) {
      restrictedZones += 1;
    }

    if (normalizedRestrictions.includes("Р§РёСЃС‚РѕРІР°СЏ РѕС‚РґРµР»РєР°")) finishSensitiveZones += 1;

    const ceilingHeight =
      toNumber(answers[`zone_${zone.id}_max_install_height`], 0) || toNumber(answers[`zone-${zone.id}-ceiling-height`], 0);
    if (ceilingHeight >= 4.5) highCeilingZones += 1;

    const routeMethods = answers[`zone-${zone.id}-corridor-route-method`] || [];
    const normalizedRoutes = Array.isArray(routeMethods) ? routeMethods : [routeMethods].filter(Boolean);
    if (answers[`zone-${zone.id}-tray-routing-present`] === true || normalizedRoutes.includes("Р’ Р»РѕС‚РєРµ")) trayRoutingZones += 1;
    if (answers[`zone-${zone.id}-ceiling-void-present`] === true || normalizedRoutes.includes("Р’ Р·Р°РїРѕС‚РѕР»РѕС‡РЅРѕРј РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµ")) ceilingVoidZones += 1;
    if (answers[`zone-${zone.id}-raised-floor-present`] === true || normalizedRoutes.includes("РџРѕРґ С„Р°Р»СЊС€-РїРѕР»РѕРј")) raisedFloorZones += 1;
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
    lowCurrentRooms,
    noRiserAccess,
    reservePercent,
    nightShiftRequired,
    phasedAccess,
  };
}

function collectApsSignals(apsProjectSnapshots = {}) {
  let unresolvedRows = 0;
  let lowRecognitionProjects = 0;
  let priceGapsInProjects = 0;

  for (const snapshot of Object.values(apsProjectSnapshots || {})) {
    if (!snapshot?.active) continue;
    unresolvedRows += Array.isArray(snapshot?.unrecognizedRows) ? snapshot.unrecognizedRows.length : 0;
    if (toNumber(snapshot?.sourceStats?.recognitionRate, 100) < 85) lowRecognitionProjects += 1;
    priceGapsInProjects += toNumber(snapshot?.sourceStats?.withoutPriceCount, 0);
  }

  return { unresolvedRows, lowRecognitionProjects, priceGapsInProjects };
}

function collectSystemSignals(systems = [], systemResults = []) {
  let projectBasedSystems = 0;
  let highRouteComplexitySystems = 0;
  let highLaborRiskSystems = 0;
  let highConditionSystems = 0;
  let highMarkerCostSystems = 0;
  let integrationHeavySystems = 0;
  const vendorSet = new Set();
  const routeSamples = [];

  for (const system of systems || []) {
    if (system?.vendor && safeText(system.vendor).toLowerCase() !== "Р±Р°Р·РѕРІС‹Р№") vendorSet.add(system.vendor);
  }

  for (const row of systemResults || []) {
    if (row?.projectInPlace || row?.estimateMode === "project_pdf") projectBasedSystems += 1;

    const routeComplexity = toNumber(row?.routeComplexityAverage, 0);
    if (routeComplexity > 0) routeSamples.push(routeComplexity);
    if (routeComplexity >= 1.18) highRouteComplexitySystems += 1;

    if (toNumber(row?.laborDetails?.neuralCheck?.underestimationRisk, 0) >= 0.45) highLaborRiskSystems += 1;
    if (toNumber(row?.trace?.conditionLaborFactor, 1) >= 1.18) highConditionSystems += 1;
    if (toNumber(row?.unitWorkMarker?.costPerUnit, 0) >= 12000) highMarkerCostSystems += 1;

    const integrationPoints = toNumber(row?.trace?.autoQuantities?.integrationPoints, 0);
    if (row?.systemType === "ssoi" || integrationPoints >= 3) integrationHeavySystems += 1;
  }

  const avgRouteComplexity = routeSamples.length ? routeSamples.reduce((sum, value) => sum + value, 0) / routeSamples.length : 1;

  return {
    systemCount: (systems || []).length,
    vendorDiversity: vendorSet.size,
    projectBasedSystems,
    highRouteComplexitySystems,
    highLaborRiskSystems,
    highConditionSystems,
    highMarkerCostSystems,
    integrationHeavySystems,
    avgRouteComplexity,
  };
}

function estimateBudgetImpact(projectBudget, score, minShare, maxShare) {
  const safeBudget = Math.max(toNumber(projectBudget, 0), 0);
  if (safeBudget <= 0) return 0;
  const normalizedScore = clamp(score, 0, 100) / 100;
  const share = minShare + (maxShare - minShare) * normalizedScore;
  return Math.round(safeBudget * share);
}

function makeRisk(id, title, severity, score, summary, impact, mitigation, budgetImpact, basis = []) {
  return {
    id,
    title,
    severity,
    score: Math.round(score),
    summary,
    impact,
    mitigation,
    budgetImpact: Math.round(toNumber(budgetImpact, 0)),
    basis: basis.filter(Boolean),
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
  const projectBudget = safeSystemResults.reduce((sum, row) => sum + toNumber(row?.total, 0), 0);

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
    (surveySignals.nightShiftRequired ? 8 : 0) +
    (surveySignals.phasedAccess ? 6 : 0) +
    surveySignals.noRiserAccess * 10 +
    systemSignals.highConditionSystems * 5 +
    (floors + basementFloors >= 8 ? 8 : 0) +
    (protectedArea >= 20000 ? 6 : 0);

  if (mountScore >= 34) {
    const score = clamp(mountScore, 0, 100);
    risks.push(
      makeRisk(
        "mount-constraints",
        "Риск удорожания и сдвига монтажных работ",
        score >= 60 ? "high" : "medium",
        score,
        `Объект ${status === "operational" ? "действующий" : "строящийся"}, а текущие данные уже показывают ограничения по доступу, отделке и режиму работ.`,
        "Для этого объекта это означает рост стоимости СМР и ПНР из-за поэтапного допуска, ночных окон, аккуратного монтажа в чистовых зонах и дополнительных организационных потерь.",
        "Что делать: подтвердить окна доступа, проверить маршруты по чистовым зонам, отдельно зафиксировать стояки и проходы, не убирать резерв по срокам и организации работ до финального согласования.",
        estimateBudgetImpact(projectBudget, score, 0.018, 0.065),
        [
          surveySignals.restrictedZones ? `Зон с ограничениями: ${surveySignals.restrictedZones}` : "",
          surveySignals.finishSensitiveZones ? `Зон с чистовой отделкой: ${surveySignals.finishSensitiveZones}` : "",
          surveySignals.nightShiftRequired ? "Есть ночной режим работ" : "",
          surveySignals.phasedAccess ? "Есть поэтапный допуск по зонам" : "",
          surveySignals.noRiserAccess ? "Не подтвержден доступ к стоякам" : "",
        ]
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
    const score = clamp(routeScore, 0, 100);
    risks.push(
      makeRisk(
        "route-density",
        "Риск сложной трассировки и вертикальной инфраструктуры",
        score >= 58 ? "high" : "medium",
        score,
        "Этажность, подземные уровни, высокие зоны и подтвержденные способы прокладки формируют нетипично сложный контур трасс.",
        "Для этого объекта это означает риск роста объема лотков, труб, коробов, проходок, бурения стояков и трудозатрат на кабельную инфраструктуру относительно усредненного сценария.",
        "Что делать: отдельно проверить вертикальные трассы, потолочные и подпольные маршруты, выделить объемы проходок и бурения по зонам и не финализировать кабельную часть без этого уточнения.",
        estimateBudgetImpact(projectBudget, score, 0.016, 0.058),
        [
          floors ? `Этажей: ${floors}` : "",
          basementFloors ? `Подземных уровней: ${basementFloors}` : "",
          surveySignals.highCeilingZones ? `Высотных зон: ${surveySignals.highCeilingZones}` : "",
          surveySignals.trayRoutingZones ? `Зон с лотком: ${surveySignals.trayRoutingZones}` : "",
          surveySignals.ceilingVoidZones ? `Зон с запотолочным пространством: ${surveySignals.ceilingVoidZones}` : "",
          surveySignals.raisedFloorZones ? `Зон с фальшполом: ${surveySignals.raisedFloorZones}` : "",
        ]
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
    const score = clamp(specificationScore, 0, 100);
    risks.push(
      makeRisk(
        "specification-gap",
        "Риск неполной спецификации и корректировок состава системы",
        score >= 55 ? "high" : "medium",
        score,
        "Часть систем идет без полного пакета РД, а проектные данные и обследование пока не закрыли все зоны неопределенности.",
        "Для этого объекта это означает вероятность добавления позиций оборудования, материалов, шкафов, трасс и точек подключения уже после выпуска предварительного бюджета.",
        "Что делать: добить обязательные поля чек-листа, разобрать нераспознанные строки проекта, отдельно пересмотреть системы без РД и зафиксировать допущения по каждой такой системе.",
        estimateBudgetImpact(projectBudget, score, 0.02, 0.075),
        [
          systemsWithoutDocs ? `Систем без РД: ${systemsWithoutDocs}` : "",
          apsSignals.unresolvedRows ? `Нераспознанных строк проекта: ${apsSignals.unresolvedRows}` : "",
          surveySignals.unfinishedRequired ? `Незаполненных обязательных ответов: ${surveySignals.unfinishedRequired}` : "",
          `Заполнение чек-листа: ${surveySignals.completionPercent}%`,
        ]
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
    const score = clamp(procurementScore, 0, 100);
    risks.push(
      makeRisk(
        "procurement-market",
        "Риск закупки и уточнения рыночной цены",
        score >= 52 ? "high" : "medium",
        score,
        "По части позиций рынок подтвержден неравномерно: есть пропуски цен, ручная перепроверка и источники с пониженной уверенностью.",
        "Для этого объекта это означает, что отдельные unit-price еще могут заметно измениться после коммерческих запросов, уточнения брендов и подтверждения источников.",
        "Что делать: вынести на ручную проверку позиции с низкой уверенностью, отдельно подтвердить цены производителя и поставщика по ключевым позициям, сохранить резерв под коммерческие отклонения.",
        estimateBudgetImpact(projectBudget, score, 0.012, 0.05),
        [
          priceSignals.lowConfidenceSystems ? `Систем с низкой уверенностью цен: ${priceSignals.lowConfidenceSystems}` : "",
          priceSignals.missingPriceItems ? `Позиций без цены: ${priceSignals.missingPriceItems}` : "",
          priceSignals.manualCheckItems ? `Позиций на ручной проверке: ${priceSignals.manualCheckItems}` : "",
          priceSignals.manufacturerPriceGaps ? `Систем без подтвержденной цены у производителя: ${priceSignals.manufacturerPriceGaps}` : "",
        ]
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
    const score = clamp(coordinationScore, 0, 100);
    risks.push(
      makeRisk(
        "coordination",
        "Риск межсистемной координации и сложной ПНР",
        score >= 48 ? "high" : "medium",
        score,
        "В проекте несколько систем, разные зоны, интеграционные связи и несколько вендорных контуров, которые нужно синхронизировать между собой.",
        "Для этого объекта это означает дополнительные итерации на стадии проектирования, монтажные коллизии и удлинение пусконаладки из-за межсистемных зависимостей.",
        "Что делать: заранее выделить интеграционные точки, проверить шкафы и смежные системы по зонам, зафиксировать очередность ПНР и ответственность по каждому контуру.",
        estimateBudgetImpact(projectBudget, score, 0.01, 0.04),
        [
          systemSignals.systemCount ? `Систем в проекте: ${systemSignals.systemCount}` : "",
          safeZones.length ? `Зон объекта: ${safeZones.length}` : "",
          systemSignals.integrationHeavySystems ? `Систем с выраженной интеграцией: ${systemSignals.integrationHeavySystems}` : "",
          systemSignals.vendorDiversity ? `Вендорных контуров: ${systemSignals.vendorDiversity}` : "",
        ]
      )
    );
  }

  const laborScore =
    systemSignals.highLaborRiskSystems * 14 +
    systemSignals.highMarkerCostSystems * 8 +
    (surveySignals.reservePercent >= 20 ? 8 : surveySignals.reservePercent >= 10 ? 4 : 0) +
    (["transport", "production", "energy"].includes(objectType) ? 8 : 0) +
    (surveySignals.lowCurrentRooms <= 0 ? 4 : 0);

  if (laborScore >= 24) {
    const score = clamp(laborScore, 0, 100);
    risks.push(
      makeRisk(
        "labor-underestimate",
        "Риск дисбаланса трудоемкости и резерва по работам",
        score >= 46 ? "high" : "medium",
        score,
        "Текущая конфигурация объекта и систем показывает повышенную трудоемкость: сложные условия монтажа, высокий unit-marker и сигналы AI-проверки по работе.",
        "Для этого объекта это означает, что трудовая часть бюджета может быть недооценена, если резерв по сложным операциям снять слишком рано.",
        "Что делать: перепроверить состав СМР и ПНР по операциям, отдельно пересмотреть кабельные, КНС- и интеграционные работы, не убирать резерв по сложным зонам до подтверждения обследованием.",
        estimateBudgetImpact(projectBudget, score, 0.015, 0.055),
        [
          systemSignals.highLaborRiskSystems ? `Систем с высоким AI-риском трудоемкости: ${systemSignals.highLaborRiskSystems}` : "",
          systemSignals.highMarkerCostSystems ? `Систем с высоким unit-marker: ${systemSignals.highMarkerCostSystems}` : "",
          surveySignals.reservePercent ? `Резерв кабеля в чек-листе: ${surveySignals.reservePercent}%` : "",
          surveySignals.lowCurrentRooms <= 0 ? "Не подтверждены слаботочные помещения/узлы связи" : "",
        ]
      )
    );
  }

  return risks.sort((a, b) => b.score - a.score).slice(0, 5);
}
