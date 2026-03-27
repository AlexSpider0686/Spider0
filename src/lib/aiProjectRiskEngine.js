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

  for (const row of systemResults) {
    const marketEntries = Array.isArray(row?.equipmentData?.marketEntries) ? row.equipmentData.marketEntries : [];
    const confidence = toNumber(row?.equipmentData?.marketSummary?.confidencePercent, 100);
    if (marketEntries.length && confidence < 70) lowConfidenceSystems += 1;

    for (const entry of marketEntries) {
      const priceState = safeText(entry?.priceState).toLowerCase();
      const requiresManualReview = Boolean(entry?.requiresManualReview);
      if (priceState === "missing" || priceState === "not_found") missingPriceItems += 1;
      if (requiresManualReview || priceState === "manual_review") manualCheckItems += 1;
    }
  }

  return { lowConfidenceSystems, missingPriceItems, manualCheckItems };
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

  for (const zone of zones) {
    const restrictions = answers[`zone_${zone.id}_constraints`] || [];
    const normalized = Array.isArray(restrictions) ? restrictions : [restrictions].filter(Boolean);
    if (normalized.some((item) => ["Ограниченный доступ", "Ночной график", "Работа рядом с людьми"].includes(item))) restrictedZones += 1;
    if (normalized.includes("Чистовая отделка")) finishSensitiveZones += 1;

    const ceilingHeight = toNumber(answers[`zone_${zone.id}_max_install_height`], 0);
    if (ceilingHeight >= 4.5) highCeilingZones += 1;
  }

  return { hasAppliedSurvey, completionPercent, unfinishedRequired, restrictedZones, finishSensitiveZones, highCeilingZones };
}

function collectApsSignals(apsProjectSnapshots = {}) {
  let importedProjects = 0;
  let unresolvedRows = 0;
  let lowRecognitionProjects = 0;

  for (const snapshot of Object.values(apsProjectSnapshots || {})) {
    if (!snapshot?.active) continue;
    importedProjects += 1;
    unresolvedRows += Array.isArray(snapshot?.unrecognizedRows) ? snapshot.unrecognizedRows.length : 0;
    const recognitionRate = toNumber(snapshot?.sourceStats?.recognitionRate, 100);
    if (recognitionRate < 85) lowRecognitionProjects += 1;
  }

  return { importedProjects, unresolvedRows, lowRecognitionProjects };
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
  const regionCoef = Math.max(toNumber(safeObject.regionCoef, getRegionCoef(safeObject.regionName)), 1);

  const systemsWithoutDocs = safeSystems.filter((item) => !item?.hasWorkingDocs).length;
  const priceSignals = collectPriceSignals(safeSystemResults);
  const surveySignals = collectSurveySignals(technicalSolution, aiSurveyCompletion, safeZones);
  const apsSignals = collectApsSignals(apsProjectSnapshots);

  const risks = [];

  const mountScore =
    (status === "operational" ? 34 : 14) +
    surveySignals.restrictedZones * 9 +
    surveySignals.finishSensitiveZones * 8 +
    (floors + basementFloors >= 8 ? 10 : 0) +
    (protectedArea >= 20000 ? 8 : 0);
  if (mountScore >= 34) {
    risks.push(
      makeRisk(
        "mount-constraints",
        "Риск удорожания и сдвига монтажа",
        mountScore >= 60 ? "high" : "medium",
        clamp(mountScore, 0, 100),
        `Объект ${status === "operational" ? "действующий" : "строящийся"}, при этом в обследовании уже видны ограничения по доступу, отделке и режиму работ.`,
        "В ходе реализации может потребоваться ночной график, более аккуратный монтаж и запас по срокам на согласование работ."
      )
    );
  }

  const routeScore =
    (floors >= 10 ? 28 : floors >= 6 ? 18 : 8) +
    (basementFloors >= 2 ? 12 : basementFloors >= 1 ? 6 : 0) +
    surveySignals.highCeilingZones * 10 +
    (totalArea >= 30000 ? 12 : totalArea >= 15000 ? 7 : 0);
  if (routeScore >= 30) {
    risks.push(
      makeRisk(
        "route-density",
        "Риск сложных трасс и вертикальной инфраструктуры",
        routeScore >= 58 ? "high" : "medium",
        clamp(routeScore, 0, 100),
        `Этажность, подземные уровни, высотные зоны и масштаб объекта формируют нетипичную вертикальную и кабельную нагрузку.`,
        "Проекту может понадобиться больше промежуточных узлов, шкафов, вертикальных трасс и монтажного ресурса, чем в типовой схеме."
      )
    );
  }

  const specificationScore =
    systemsWithoutDocs * 11 +
    apsSignals.unresolvedRows * 4 +
    apsSignals.lowRecognitionProjects * 12 +
    (surveySignals.hasAppliedSurvey ? 0 : 10);
  if (specificationScore >= 24) {
    risks.push(
      makeRisk(
        "specification-gap",
        "Риск неполной спецификации и корректировок состава",
        specificationScore >= 55 ? "high" : "medium",
        clamp(specificationScore, 0, 100),
        `Часть систем идет без РД, а распознанные проектные данные и обследование еще оставляют зоны неопределенности.`,
        "На следующих этапах могут добавиться позиции оборудования, материалов и корректировки по точкам подключения или трассам."
      )
    );
  }

  const procurementScore =
    priceSignals.missingPriceItems * 3 +
    priceSignals.manualCheckItems * 2 +
    priceSignals.lowConfidenceSystems * 12 +
    (regionCoef >= 1.15 ? 8 : 0);
  if (procurementScore >= 22) {
    risks.push(
      makeRisk(
        "procurement-market",
        "Риск закупки и уточнения рыночной цены",
        procurementScore >= 52 ? "high" : "medium",
        clamp(procurementScore, 0, 100),
        `По части позиций есть неполное ценовое покрытие рынка или требуется ручная перепроверка найденных предложений.`,
        "На стадии закупки возможны уточнения брендов, цен за единицу и источников поставки, что влияет на резерв бюджета."
      )
    );
  }

  const coordinationScore =
    Math.max(safeSystems.length - 2, 0) * 8 +
    (safeZones.length >= 4 ? 10 : safeZones.length >= 3 ? 6 : 0) +
    (systemsWithoutDocs >= 2 ? 10 : 0) +
    surveySignals.restrictedZones * 4;
  if (coordinationScore >= 24) {
    risks.push(
      makeRisk(
        "coordination",
        "Риск межсистемной координации",
        coordinationScore >= 48 ? "high" : "medium",
        clamp(coordinationScore, 0, 100),
        `В проекте несколько инженерных систем, разнотипные зоны и условия, которые надо синхронизировать по трассам, шкафам и интеграции.`,
        "Понадобится более плотная координация проектирования, монтажа и ПНР, иначе возрастает риск дополнительных итераций и локальных коллизий."
      )
    );
  }

  return risks.sort((a, b) => b.score - a.score).slice(0, 5);
}
