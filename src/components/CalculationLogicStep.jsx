import React, { useMemo } from "react";
import { COEFFICIENT_GUIDE, SYSTEM_TYPES } from "../config/estimateConfig";
import { LABOR_MARKET_GUARDRAILS, LABOR_UNIT_RATES } from "../config/costModelConfig";
import { num, rub, toNumber } from "../lib/estimate";
import { buildCoefficientLayer } from "../lib/coefficient-engine";
import { repairReactTextTree } from "../lib/repairReactTree";
import { repairUtf8Cp1251Mojibake } from "../lib/textEncoding";
import { pickBestSourceUrl, toSourceHost } from "../lib/sourceLinks";

function downloadCsvFile(fileName, content) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = repairUtf8Cp1251Mojibake(String(value ?? ""));
  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatSourceHost(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    return toSourceHost(value);
  } catch {
    return value;
  }
}

function normalizeMatchKey(value) {
  return String(value || "").trim().toLowerCase();
}

function percent(value) {
  return `${num(toNumber(value, 0), 1)}%`;
}

function coef(value) {
  return `x${num(toNumber(value, 1), 2)}`;
}

function getSystemLabel(systemType) {
  return SYSTEM_TYPES.find((item) => item.code === systemType)?.name || systemType;
}

function getPrimaryOperationLabel(systemType, primaryUnitLabel) {
  const normalized = String(primaryUnitLabel || "").trim().toLowerCase();
  if (systemType === "aps") return normalized ? `Монтаж ${normalized}` : "Монтаж пожарных извещателей";
  if (systemType === "sots") return normalized ? `Монтаж ${normalized}` : "Монтаж охранных извещателей";
  if (systemType === "soue") return normalized ? `Монтаж ${normalized}` : "Монтаж оповещателей СОУЭ";
  if (systemType === "sot") return normalized ? `Монтаж ${normalized}` : "Монтаж камер";
  if (systemType === "skud") return normalized ? `Монтаж ${normalized}` : "Монтаж точек доступа";
  if (systemType === "ssoi") return "Монтаж узлов интеграции";
  return normalized ? `Монтаж ${normalized}` : "Монтаж основных элементов";
}

function getPnrOperationLabel(systemType, primaryUnitLabel) {
  const normalized = String(primaryUnitLabel || "").trim().toLowerCase();
  if (systemType === "aps") return normalized ? `ПНР ${normalized}` : "ПНР пожарных извещателей";
  if (systemType === "sots") return normalized ? `ПНР ${normalized}` : "ПНР охранных извещателей";
  if (systemType === "soue") return normalized ? `ПНР ${normalized}` : "ПНР оповещателей СОУЭ";
  if (systemType === "sot") return normalized ? `ПНР ${normalized}` : "ПНР камер";
  if (systemType === "skud") return normalized ? `ПНР ${normalized}` : "ПНР точек доступа";
  if (systemType === "ssoi") return "ПНР узлов интеграции";
  return normalized ? `ПНР ${normalized}` : "ПНР основных элементов";
}

export function buildBaseRateExportRows(systemResults = []) {
  return (systemResults || []).flatMap((row) => {
    const rates = row?.laborDetails?.unitRates || {};
    const breakdown = row?.laborDetails?.workBreakdown || {};
    const systemLabel = row?.systemName || getSystemLabel(row?.systemType);
    const primaryUnitLabel = row?.primaryUnitLabel || "ед.";
    const operations = [
      {
        id: `${row?.systemId || row?.systemType}-mount-primary`,
        workName: `${systemLabel}: ${getPrimaryOperationLabel(row?.systemType, primaryUnitLabel)}`,
        unit: primaryUnitLabel,
        quantity: toNumber(breakdown.primaryUnits, 0),
        unitPrice: toNumber(rates.mountPrimary, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-mount-controller`,
        workName: `${systemLabel}: Монтаж контроллеров и приборов`,
        unit: "шт",
        quantity: toNumber(breakdown.controllerUnits, 0),
        unitPrice: toNumber(rates.controllerMount, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-cable`,
        workName: `${systemLabel}: Прокладка кабеля`,
        unit: "м",
        quantity: toNumber(breakdown.cableLengthM, 0),
        unitPrice: toNumber(rates.cablePerMeter, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-pnr-primary`,
        workName: `${systemLabel}: ${getPnrOperationLabel(row?.systemType, primaryUnitLabel)}`,
        unit: primaryUnitLabel,
        quantity: toNumber(breakdown.primaryUnits, 0),
        unitPrice: toNumber(rates.pnrPrimary, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-pnr-active`,
        workName: `${systemLabel}: ПНР активных устройств`,
        unit: "шт",
        quantity: toNumber(breakdown.activeElements, 0),
        unitPrice: toNumber(rates.pnrActiveElement, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-integration`,
        workName: `${systemLabel}: Интеграционные подключения`,
        unit: "точка",
        quantity: toNumber(breakdown.integrationPoints, 0),
        unitPrice: toNumber(rates.integrationPoint, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-kns-cable`,
        workName: `${systemLabel}: Монтаж КНС по трассе`,
        unit: "м",
        quantity: toNumber(breakdown.knsLengthM, 0),
        unitPrice: toNumber(rates.knsPerMeter, 0),
      },
      {
        id: `${row?.systemId || row?.systemType}-kns-work`,
        workName: `${systemLabel}: Монтаж крепежа и сопутствующих КНС-операций`,
        unit: "усл. ед.",
        quantity: toNumber(breakdown.knsWorkUnits, 0),
        unitPrice: Number((toNumber(rates.knsPerMeter, 0) * 0.22).toFixed(2)),
      },
    ];

    return operations.filter((item) => item.quantity > 0 && item.unitPrice > 0);
  });
}

function t(value) {
  return repairUtf8Cp1251Mojibake(String(value ?? ""));
}

function formatHostList(hosts = []) {
  const normalized = [...new Set((hosts || []).map((item) => String(item || "").trim()).filter(Boolean))];
  return normalized.length ? normalized.join(", ") : "нет данных";
}

function formatDesignDurationExact(monthsExact) {
  const safeMonths = toNumber(monthsExact, 0);
  if (safeMonths <= 0) return "0 мес.";
  if (safeMonths < 1) return `${num(Math.max(safeMonths * 22, 1), 0)} раб. дн.`;
  return `${num(safeMonths, 1)} мес.`;
}

function summarizeAiGuard(systemResults) {
  const rows = systemResults
    .map((row) => row?.laborDetails)
    .filter(Boolean);

  const maxRisk = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.imbalanceRisk ?? item?.neuralCheck?.underestimationRisk, 0)), 0);
  const maxUplift = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.neuralUpliftMultiplier, 1)), 1);
  const maxOverpricingRisk = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.overestimationRisk, 0)), 0);
  const maxUnderpricingRisk = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.underestimationRisk, 0)), 0);
  const totalMarketFloor = rows.reduce((sum, item) => sum + toNumber(item?.marketGuard?.marketFloorTotal, 0), 0);

  return { maxRisk, maxUplift, maxOverpricingRisk, maxUnderpricingRisk, totalMarketFloor };
}

function summarizeSurveyLayer(technicalSolution = {}, aiSurveyCompletion = {}) {
  const appliedAnswers = technicalSolution?.appliedAnswers || {};
  const appliedPhotoAnalyses = technicalSolution?.appliedPhotoAnalyses || {};
  const photoCount = Object.values(appliedPhotoAnalyses).filter((item) => item?.accepted !== false).length;
  const completionPercent = toNumber(aiSurveyCompletion?.percent, 0);
  const lowCurrentRooms = toNumber(appliedAnswers["object-low-current-rooms"], 0);
  const reservePercent = toNumber(appliedAnswers["object-cable-reserve"], 0);
  const noRiserAccess = appliedAnswers["object-riser-access"] === false;
  const routeSignals = Object.keys(appliedAnswers).filter((key) => key.endsWith("-corridor-route-method")).length;
  const appliedAt = technicalSolution?.appliedAt;

  const highlights = [
    appliedAt ? `Данные обследования уже загружены в расчет (${new Date(appliedAt).toLocaleString("ru-RU")}).` : "Данные обследования еще не загружены в расчет.",
    `Заполнение обязательной части чек-листа: ${num(completionPercent, 0)}%.`,
    photoCount > 0 ? `Принято фото/планов обследования: ${photoCount}.` : "Фото и планы в расчет пока не внесены.",
    lowCurrentRooms > 0 ? `Подтверждены слаботочные помещения/узлы связи: ${lowCurrentRooms}.` : "",
    reservePercent > 0 ? `По чек-листу заложен дополнительный резерв кабеля ${num(reservePercent, 0)}%.` : "",
    noRiserAccess ? "По обследованию не подтвержден свободный доступ к стоякам и вертикальным трассам." : "",
    routeSignals > 0 ? `Для ${routeSignals} зон уже зафиксированы способы прокладки по маршрутам.` : "",
  ].filter(Boolean);

  return {
    completionPercent,
    photoCount,
    highlights,
  };
}

const BASE_RATE_COMPOSITION = [
  {
    key: "mountPrimary",
    title: "Монтаж основного элемента",
    description: "Включает разметку, установку, крепление, подключение, базовую коммутацию и проверку установки основного устройства системы.",
  },
  {
    key: "controllerMount",
    title: "Монтаж контроллеров и приборов",
    description: "Включает сборку узла, крепление шкафа/прибора, силовое и слаботочное подключение, маркировку и подготовку к пусконаладке.",
  },
  {
    key: "cablePerMeter",
    title: "Прокладка кабеля",
    description:
      "Включает разметку маршрута, крепление кабеля, сверление и проходы по конструкциям, бурение стояков в составе типового объема, маркировку, укладку и первичную проверку линии.",
  },
  {
    key: "knsPerMeter",
    title: "КНС и трассообразующие элементы",
    description:
      "Включает лоток/короб/гофру/трубу по трассе, крепеж, подвесы, доборные элементы, повороты, стыковку, монтаж переходов и сопутствующие операции по кабеленесущей системе.",
  },
  {
    key: "pnrPrimary",
    title: "ПНР основного элемента",
    description: "Включает адресацию, базовую настройку, тест включения, проверку отклика и участие элемента в общем сценарии системы.",
  },
  {
    key: "pnrActiveElement",
    title: "ПНР активных устройств",
    description: "Включает настройку активного оборудования, проверку связи, сценариев, журналов и устойчивой работы в проектной конфигурации.",
  },
  {
    key: "integrationPoint",
    title: "Интеграционная точка",
    description: "Включает подключение к смежной системе, настройку обмена, проверку логики взаимодействия и тест сценария интеграции.",
  },
];

export default function CalculationLogicStep({
  objectData,
  effectiveObjectData,
  systems,
  systemResults,
  budget,
  totals,
  projectRisks = [],
  technicalSolution = {},
  aiSurveyCompletion = {},
  vendorPriceSnapshots = {},
}) {
  const [activeLogicSection, setActiveLogicSection] = React.useState(null);
  const calcObjectData = effectiveObjectData || objectData;
  const coefficientLayer = useMemo(
    () =>
      buildCoefficientLayer({
        budget,
        buildingStatus: calcObjectData?.buildingStatus,
        regionSubject: calcObjectData?.regionSubject,
        regionCoef: calcObjectData?.regionCoef,
      }),
    [budget, calcObjectData]
  );
  const conditionFactor = toNumber(coefficientLayer.conditionLaborFactor, 1);
  const exploitedBuildingCoef = toNumber(coefficientLayer.exploitedBuildingCoefficient, 1);
  const regionalCoef = toNumber(coefficientLayer.regionalCoefficient, 1);
  const calculatedDesignRows = systemResults.filter((row) => !row.designSkipped);
  const totalDesignHours = calculatedDesignRows.reduce((sum, row) => sum + toNumber(row.designHours, 0), 0);
  const avgDesignTeam =
    calculatedDesignRows.length > 0
      ? calculatedDesignRows.reduce((sum, row) => sum + toNumber(row.designTeamSize, 1), 0) / calculatedDesignRows.length
      : 0;
  const maxDesignMonths = Math.max(...calculatedDesignRows.map((row) => row.designMonthsExact || row.designDurationMonths || 0), 0);

  const totalWorkBase = systemResults.reduce((sum, row) => sum + toNumber(row.workBase, 0), 0);
  const totalWorkWithCharges = systemResults.reduce((sum, row) => sum + toNumber(row.workTotal, 0), 0);
  const totalEquipment = toNumber(totals.totalEquipment, 0);
  const totalMaterials = toNumber(totals.totalMaterials, 0);
  const totalDesign = toNumber(totals.totalDesign, 0);
  const totalProject = toNumber(totals.total, 0);
  const aiGuard = summarizeAiGuard(systemResults);
  const surveySummary = useMemo(() => summarizeSurveyLayer(technicalSolution, aiSurveyCompletion), [technicalSolution, aiSurveyCompletion]);
  const skippedDesignRows = systemResults.filter((row) => row.designSkipped);
  const aiGuardRows = useMemo(
    () =>
      [...(systemResults || [])]
        .map((row) => ({
          systemName: row.systemName,
          underpricingRisk: toNumber(row?.laborDetails?.neuralCheck?.underestimationRisk, 0),
          overpricingRisk: toNumber(row?.laborDetails?.neuralCheck?.overestimationRisk, 0),
          marketFloor: toNumber(row?.laborDetails?.marketGuard?.marketFloorTotal, 0),
        }))
        .sort((a, b) => Math.max(b.underpricingRisk, b.overpricingRisk) - Math.max(a.underpricingRisk, a.overpricingRisk))
        .slice(0, 3),
    [systemResults]
  );
  const totalWorkBeforeRegion = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workTotalBeforeRegion, 0), 0);
  const appliedObjectCoefficients = useMemo(() => {
    const entries = [];
    const guideMap = new Map(COEFFICIENT_GUIDE.map((item) => [item.key, item]));
    const budgetKeys = ["cableCoef", "equipmentCoef", "laborCoef", "complexityCoef"];

    budgetKeys.forEach((key) => {
      const value = toNumber(budget?.[key], 1);
      if (Math.abs(value - 1) < 0.001) return;
      entries.push({
        key,
        label: guideMap.get(key)?.title || key,
        value,
        reason: guideMap.get(key)?.tip || "РџСЂРёРјРµРЅРµРЅ РІ С‚РµРєСѓС‰РµРј СЂР°СЃС‡РµС‚Рµ Р±СЋРґР¶РµС‚Р°.",
      });
    });

    (coefficientLayer.conditionRows || []).forEach((row) => {
      const value = toNumber(row?.value, 1);
      if (Math.abs(value - 1) < 0.001) return;
      entries.push({
        key: row.key,
        label: row.label || guideMap.get(row.key)?.title || row.key,
        value,
        reason: row.wasSuppressed
          ? "Р’РІРµРґРµРЅРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ Р±С‹Р»Рѕ РЅРѕСЂРјР°Р»РёР·РѕРІР°РЅРѕ РјРѕРґРµР»СЊСЋ, С‡С‚РѕР±С‹ РЅРµ РґРѕРїСѓСЃС‚РёС‚СЊ РґРІРѕР№РЅРѕРіРѕ СѓС‡РµС‚Р° РєРѕСЌС„С„РёС†РёРµРЅС‚РѕРІ."
          : guideMap.get(row.key)?.tip || "РџСЂРёРјРµРЅРµРЅ РІ С‚РµРєСѓС‰РµРј СЂР°СЃС‡РµС‚Рµ Р±СЋРґР¶РµС‚Р°.",
      });
    });

    if (Math.abs(exploitedBuildingCoef - 1) > 0.001) {
      entries.push({
        key: "exploitedBuildingCoefficient",
        label: "РљРѕСЌС„С„РёС†РёРµРЅС‚ РґРµР№СЃС‚РІСѓСЋС‰РµРіРѕ Р·РґР°РЅРёСЏ",
        value: exploitedBuildingCoef,
        reason: "РџСЂРёРјРµРЅСЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Рє С‚СЂСѓРґРѕР·Р°РІРёСЃРёРјРѕР№ С‡Р°СЃС‚Рё СЂР°Р±РѕС‚ РґР»СЏ РґРµР№СЃС‚РІСѓСЋС‰РµРіРѕ РѕР±СЉРµРєС‚Р°.",
      });
    }

    if (Math.abs(regionalCoef - 1) > 0.001) {
      entries.push({
        key: "regionalCoefficient",
        label: "Р РµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕСЌС„С„РёС†РёРµРЅС‚",
        value: regionalCoef,
        reason: `Р‘РµСЂРµС‚СЃСЏ РёР· РєР°СЂС‚РѕС‡РєРё РѕР±СЉРµРєС‚Р° РґР»СЏ СЂРµРіРёРѕРЅР° ${calcObjectData?.regionName || calcObjectData?.regionSubject || "РѕР±СЉРµРєС‚Р°"}.`,
      });
    }

    return entries;
  }, [budget, calcObjectData, coefficientLayer.conditionRows, exploitedBuildingCoef, regionalCoef]);
  const totalCharges = systemResults.reduce(
    (sum, row) =>
      sum +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.overhead, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.payrollTaxes, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.utilization, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.ppe, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.admin, 0),
    0
  );
  const detailedLaborBreakdown = useMemo(() => {
    const totalSmr = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.smrBase, 0), 0);
    const totalPnr = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.pnrBase, 0), 0);
    const totalIntegration = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.integrationBase, 0), 0);
    const totalKns = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.knsBase, 0), 0);
    const totalWorkAfterConditions = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workAfterConditions, 0), 0);
    const totalOverhead = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.overhead, 0), 0);
    const totalPayrollTaxes = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.payrollTaxes, 0), 0);
    const totalUtilization = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.utilization, 0), 0);
    const totalPpe = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.ppe, 0), 0);
    const totalAdmin = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.admin, 0), 0);
    const totalNeuralFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.neuralCheck?.neuralFloorBase, 0), 0);
    const totalRateFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.marketGuard?.marketFloorBaseByRates, 0), 0);
    const totalMarkerFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.marketGuard?.marketFloorBaseByMarker, 0), 0);

    return {
      totalSmr,
      totalPnr,
      totalIntegration,
      totalKns,
      totalWorkAfterConditions,
      totalOverhead,
      totalPayrollTaxes,
      totalUtilization,
      totalPpe,
      totalAdmin,
      totalNeuralFloor,
      totalRateFloor,
      totalMarkerFloor,
    };
  }, [systemResults]);
  const ratesDigest = useMemo(() => {
    const seen = new Set();

    return (systemResults || [])
      .map((row) => row?.systemType)
      .filter(Boolean)
      .filter((systemType) => {
        if (seen.has(systemType)) return false;
        seen.add(systemType);
        return true;
      })
      .map((systemType) => {
        const rates = LABOR_UNIT_RATES[systemType] || LABOR_UNIT_RATES.sot;
        const guard = LABOR_MARKET_GUARDRAILS[systemType] || LABOR_MARKET_GUARDRAILS.sot;
        return {
          systemType,
          systemLabel: getSystemLabel(systemType),
          rates,
          guard,
        };
      });
  }, [systemResults]);
  const workUnitRateRows = useMemo(() => buildBaseRateExportRows(systemResults), [systemResults]);
  const exportWorkUnitRates = () => {
    if (!workUnitRateRows.length) return;
    const rows = [
      ["Наименование работ", "Стоимость за единицу, руб.", "Количество"].map(csvCell).join(";"),
      ...workUnitRateRows.map((row) =>
        [row.workName, num(row.unitPrice, 2), `${num(row.quantity, row.unit === "м" || row.unit === "усл. ед." ? 1 : 0)} ${row.unit}`]
          .map(csvCell)
          .join(";")
      ),
    ];
    downloadCsvFile("base-work-unit-rates.csv", rows.join("\n"));
  };
  const automaticVolumeRows = useMemo(
    () =>
      (systemResults || []).map((row) => {
        const systemMeta = (systems || []).find((item) => item.id === row.systemId);
        const systemLabel = row.systemName || getSystemLabel(row.systemType);
        const units = num(row.units || 0, 0);
        const cable = num(row.cable || 0, 1);
        const controllers = num(row?.quantities?.secondaryUnits || row?.laborDetails?.workBreakdown?.controllers || 0, 0);
        const managementMode = row?.laborDetails?.unitRates?.managementMode || row?.managementMode || "arm";

        let principle =
          `РџРѕ РѕР±СЉРµРєС‚Сѓ РґР»СЏ СЃРёСЃС‚РµРјС‹ В«${systemLabel}В» СЂР°СЃС‡РµС‚ РІРµРґРµС‚СЃСЏ РѕС‚ Р·Р°С‰РёС‰Р°РµРјС‹С… Р·РѕРЅ, РїСЂРѕС„РёР»СЊРЅРѕРіРѕ РјР°СЂРєРµСЂР° СЃРёСЃС‚РµРјС‹ Рё С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ СЃРѕСЃС‚Р°РІР°.`;

        if (row.systemType === "aps") {
          principle =
            `Р—РљРЎРџРЎ Рё РїРѕР¶Р°СЂРЅС‹Рµ Р·РѕРЅС‹ С„РѕСЂРјРёСЂСѓСЋС‚СЃСЏ РїРѕ СЌС‚Р°Р¶РЅРѕСЃС‚Рё, С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Рј РїРѕРјРµС‰РµРЅРёСЏРј Рё Р·Р°С‰РёС‰Р°РµРјРѕР№ РїР»РѕС‰Р°РґРё РѕР±СЉРµРєС‚Р°. Р”Р»СЏ РєР°Р¶РґРѕР№ Р·РѕРЅС‹ СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ РёР·РІРµС‰Р°С‚РµР»Рё, РїР°РЅРµР»Рё/РљР”Р›, РєР°Р±РµР»СЊРЅС‹Рµ Р»РёРЅРёРё Рё СЂРµР·РµСЂРІ СѓРїСЂР°РІР»РµРЅРёСЏ; РїСЂРё РЅР°Р»РёС‡РёРё PDF-РїСЂРѕРµРєС‚Р° РїСЂРёРѕСЂРёС‚РµС‚ РїРѕР»СѓС‡Р°РµС‚ С„Р°РєС‚РёС‡РµСЃРєР°СЏ СЃРїРµС†РёС„РёРєР°С†РёСЏ.`;
        } else if (row.systemType === "soue") {
          principle =
            `Р—РѕРЅС‹ РѕРїРѕРІРµС‰РµРЅРёСЏ С„РѕСЂРјРёСЂСѓСЋС‚СЃСЏ РїРѕ СЃС†РµРЅР°СЂРёСЏРј СЌРІР°РєСѓР°С†РёРё Рё СЃРѕСЃС‚Р°РІСѓ РѕР±С‰РµСЃС‚РІРµРЅРЅС‹С… РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІ. Р—Р°С‚РµРј СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ РѕРїРѕРІРµС‰Р°С‚РµР»Рё, СѓСЃРёР»РёС‚РµР»Рё, Р»РёРЅРёРё СЃРІСЏР·Рё Рё СЂРµР·РµСЂРІ РјРѕС‰РЅРѕСЃС‚Рё РїРѕ РѕР±СЉРµРєС‚Сѓ.`;
        } else if (row.systemType === "sots") {
          principle =
            `РћС…СЂР°РЅРЅС‹Рµ Р·РѕРЅС‹ СЃС‚СЂРѕСЏС‚СЃСЏ РїРѕ С„СѓРЅРєС†РёРѕРЅР°Р»СЊРЅС‹Рј РїРѕРјРµС‰РµРЅРёСЏРј Рё РїРµСЂРёРјРµС‚СЂСѓ СЂРёСЃРєР°. РџРѕ РєР°Р¶РґРѕР№ Р·РѕРЅРµ СЃС‡РёС‚Р°СЋС‚СЃСЏ РґР°С‚С‡РёРєРё, РїСЂРёР±РѕСЂС‹/РїР°РЅРµР»Рё, РєР°Р±РµР»СЊ Рё РѕР±СЉРµРј РџРќР .`;
        } else if (row.systemType === "sot") {
          principle =
            `Р—РѕРЅС‹ РІРёРґРµРѕРєРѕРЅС‚СЂРѕР»СЏ РѕРїСЂРµРґРµР»СЏСЋС‚СЃСЏ РїРѕ С‚РёРїР°Рј РїРѕРјРµС‰РµРЅРёР№, РїСѓС‚СЏРј РґРІРёР¶РµРЅРёСЏ Рё РїРµСЂРёРјРµС‚СЂСѓ. Р—Р°С‚РµРј СЃС‡РёС‚Р°СЋС‚СЃСЏ РєР°РјРµСЂС‹, СЂРµРіРёСЃС‚СЂР°С‚РѕСЂС‹/СЃРµСЂРІРµСЂС‹, РєРѕРјРјСѓС‚Р°С†РёСЏ, Р°СЂС…РёРІ Рё С‚СЂР°СЃСЃС‹.`;
        } else if (row.systemType === "skud") {
          principle =
            `Р—РѕРЅС‹ РґРѕСЃС‚СѓРїР° СЃС‚СЂРѕСЏС‚СЃСЏ РѕС‚ С‚РѕС‡РµРє РїСЂРѕС…РѕРґР°, РІС…РѕРґРЅС‹С… РіСЂСѓРїРї Рё СЂРµР¶РёРјРЅС‹С… РїРѕРјРµС‰РµРЅРёР№. Р”Р°Р»СЊС€Рµ СЂР°СЃСЃС‡РёС‚С‹РІР°СЋС‚СЃСЏ РєРѕРЅС‚СЂРѕР»Р»РµСЂС‹, СЃС‡РёС‚С‹РІР°С‚РµР»Рё, РёСЃРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° Рё Р»РёРЅРёРё СѓРїСЂР°РІР»РµРЅРёСЏ.`;
        } else if (row.systemType === "ssoi") {
          principle =
            `РРЅС‚РµРіСЂР°С†РёРѕРЅРЅС‹Рµ Р·РѕРЅС‹ С„РѕСЂРјРёСЂСѓСЋС‚СЃСЏ РїРѕ СЃРѕСЃС‚Р°РІСѓ РїРѕРґРєР»СЋС‡Р°РµРјС‹С… РїРѕРґСЃРёСЃС‚РµРј Рё Р°СЂС…РёС‚РµРєС‚СѓСЂРµ РѕР±СЉРµРєС‚Р°. Р Р°СЃС‡РµС‚ РѕРїСЂРµРґРµР»СЏРµС‚ СЃРµСЂРІРµСЂРЅС‹Р№ РєРѕРЅС‚СѓСЂ, РђР Рњ, С‚РѕС‡РєРё РёРЅС‚РµРіСЂР°С†РёРё Рё СЃРµС‚РµРІСѓСЋ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂСѓ.`;
        }

        return {
          key: row.systemId || row.systemType,
          title: systemLabel,
          detail: principle,
          metrics: `РћСЃРЅРѕРІРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР°: ${units}; РєР°Р±РµР»СЊ: ${cable} Рј; СЂР°Р±РѕС‚С‹: ${rub(row.workTotal || 0)}; РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ: ${row.designSkipped ? "РїСЂРѕРµРєС‚ РІ РЅР°Р»РёС‡РёРё" : rub(row.designTotal || 0)}; СЂРµР¶РёРј СѓРїСЂР°РІР»РµРЅРёСЏ: ${managementMode}.`,
          vendor: systemMeta?.vendor || row.vendor || "Р‘Р°Р·РѕРІС‹Р№",
          marker: row?.unitWorkMarker?.label || "РјР°СЂРєРµСЂ СЃРёСЃС‚РµРјС‹",
          extra: `РџРѕРґР±РѕСЂ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Рё С‚СЂСѓРґРѕРµРјРєРѕСЃС‚Рё РїСЂРёРІСЏР·Р°РЅ Рє РІС‹Р±СЂР°РЅРЅРѕРјСѓ РІРµРЅРґРѕСЂСѓ В«${systemMeta?.vendor || row.vendor || "Р‘Р°Р·РѕРІС‹Р№"}В», РјР°СЂРєРµСЂСѓ В«${row?.unitWorkMarker?.label || "РјР°СЂРєРµСЂ СЃРёСЃС‚РµРјС‹"}В» Рё СЂР°СЃС‡РµС‚РЅРѕРјСѓ РєРѕР»РёС‡РµСЃС‚РІСѓ СѓРїСЂР°РІР»СЏСЋС‰РёС… СѓСЃС‚СЂРѕР№СЃС‚РІ ${controllers}.`,
        };
      }),
    [systemResults, systems]
  );
  const vendorPricingRows = useMemo(
    () =>
      (systems || [])
        .map((system, index) => {
          const snapshot = vendorPriceSnapshots?.[system.id];
          const result = systemResults?.[index];
          if (!snapshot || !result) return null;
          const entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
          const checkedHosts = [...new Set(entries.flatMap((entry) => entry?.checkedSourceHosts || []).filter(Boolean))];
          const matchedHosts = [...new Set(entries.flatMap((entry) => entry?.matchedSourceHosts || entry?.usedSourceHosts || []).filter(Boolean))];
          const sourceCount = entries.filter((entry) => Number(entry?.sourceCount || 0) > 0).length;
          const avgConfidence = entries.length
            ? entries.reduce((sum, entry) => sum + toNumber(entry?.priceConfidence, 0), 0) / entries.length
            : 0;

          return {
            systemId: system.id,
            systemLabel: result.systemName || getSystemLabel(system.type),
            vendor: system.vendor || "Р‘Р°Р·РѕРІС‹Р№",
            checkedHosts,
            matchedHosts,
            sourceCount,
            totalEntries: entries.length,
            avgConfidence,
            warning: snapshot.warning || "",
          };
        })
        .filter(Boolean),
    [systems, systemResults, vendorPriceSnapshots]
  );
  const vendorPricingPositionRows = useMemo(
    () =>
      (systems || [])
        .map((system, index) => {
          const snapshot = vendorPriceSnapshots?.[system.id];
          const result = systemResults?.[index];
          if (!result) return null;

          const marketEntries = Array.isArray(result?.equipmentData?.marketEntries) ? result.equipmentData.marketEntries : [];
          const details = Array.isArray(result?.equipmentData?.details) ? result.equipmentData.details : [];
          const marketIndex = new Map();

          marketEntries.forEach((entry) => {
            [entry?.equipmentLabel, entry?.equipmentKey, entry?.model, entry?.name]
              .map(normalizeMatchKey)
              .filter(Boolean)
              .forEach((candidate) => {
                if (!marketIndex.has(candidate)) marketIndex.set(candidate, entry);
              });
          });

          const positions = details
            .filter((item) => item?.category !== "material")
            .slice(0, 8)
            .map((item) => {
              const marketEntry =
                [item?.name, item?.model, item?.code, `${item?.name || ""} ${item?.model || ""}`]
                  .map(normalizeMatchKey)
                  .filter(Boolean)
                  .map((candidate) => marketIndex.get(candidate))
                  .find(Boolean) || null;
              const sourceUrl = pickBestSourceUrl([
                ...(item?.matchedSources || []),
                ...(item?.usedSources || []),
                item?.sourceUrl,
                ...(marketEntry?.matchedSources || []),
                ...(marketEntry?.usedSources || []),
              ]);

              return {
                name: item?.name || item?.code || "РџРѕР·РёС†РёСЏ",
                model: item?.model || marketEntry?.model || marketEntry?.modelToken || "",
                qty: toNumber(item?.qty, 0),
                unit: item?.unit || "С€С‚",
                unitPrice: toNumber(item?.unitPrice ?? marketEntry?.price ?? item?.price, 0),
                total: toNumber(item?.total, toNumber(item?.qty, 0) * toNumber(item?.unitPrice, 0)),
                sourceUrl,
                sourceLabel: formatSourceHost(sourceUrl),
                confidence: toNumber(marketEntry?.priceConfidence, 0),
                selectionStrategy: marketEntry?.selectionStrategy || snapshot?.selectionStrategy || "",
              };
            })
            .filter((item) => item.unitPrice > 0 || item.total > 0);

          if (!positions.length) return null;

          return {
            systemId: system.id,
            systemLabel: result.systemName || getSystemLabel(system.type),
            vendor: system.vendor || "Р‘Р°Р·РѕРІС‹Р№",
            positions,
          };
        })
        .filter(Boolean),
    [systems, systemResults, vendorPriceSnapshots]
  );

  const logicSections = useMemo(
    () => [
      {
        key: "inputs",
        title: "1. Входные параметры объекта",
        summary: "Какие исходные данные формируют расчетную модель текущего проекта.",
        body: (
          <>
            <p>
              Расчет стартует от типа объекта, площади, этажности, статуса здания, региона и состава выбранных систем. Эти данные задают
              рамку для объемов, сложности монтажа и проектирования.
            </p>
            <p>
              Сейчас по объекту: площадь <strong>{num(calcObjectData.totalArea, 0)} м2</strong>, систем <strong>{num(systems.length, 0)}</strong>,
              регион <strong>{calcObjectData.regionName || calcObjectData.regionSubject || "не указан"}</strong> ({coef(regionalCoef)}), статус здания{' '}
              <strong>{calcObjectData.buildingStatus === "operational" ? "действующее" : "строящееся"}</strong> ({coef(exploitedBuildingCoef)}).
            </p>
          </>
        ),
      },
      {
        key: "volumes",
        title: "2. Автоматическое определение объемов",
        summary: "Как платформа раскладывает проект на устройства, кабель, узлы и ПНР.",
        body: (
          <>
            <p>
              Для каждой системы движок рассчитывает количество оконечных устройств, контроллеров, длину трасс, КНС, интеграционные точки и
              пусконаладочные работы. Если загружен проектный PDF, фактическая спецификация получает приоритет над усредненной моделью.
            </p>
            <div className="logic-equipment-list">
              {automaticVolumeRows.map((item) => (
                <p key={item.key}>
                  <strong>{t(item.title)}:</strong> {t(item.detail)} {t(item.metrics)} {t(item.extra)}
                </p>
              ))}
            </div>
          </>
        ),
      },
      {
        key: "survey",
        title: "3. AI-обследование",
        summary: "Как фото, чек-листы и планы эвакуации влияют на уточнение расчета.",
        body: (
          <>
            <p>
              AI-обследование собирает уточнения по материалам, высотам, трассам, ограничениям монтажа и сценариям эксплуатации. Для АПС,
              СОТС и СОУЭ отдельное внимание уделяется планам эвакуации и схеме зонирования.
            </p>
            <p>
              Цель этого блока не украшать смету, а сократить неопределенность по фактическим работам и проектированию до выхода в финальный
              бюджет.
            </p>
            <div className="logic-equipment-list">
              {surveySummary.highlights.map((item, index) => (
                <p key={`survey-highlight-${index}`}>
                  <strong>Результат обследования:</strong> {item}
                </p>
              ))}
            </div>
          </>
        ),
      },
      {
        key: "pricing",
        title: "4. Источники цен оборудования",
        summary: "Откуда берутся рыночные цены и какие источники подтвердили позиции проекта.",
        body: (
          <>
            <p>
              Цены собираются по каждой ключевой позиции отдельно через карточки производителя и поставщиков. Приоритет отдается точным
              совпадениям по артикулу и модели, затем подтвержденным карточкам производителя, и только потом более широкому поиску.
            </p>
            <div className="logic-equipment-list">
              {vendorPricingRows.map((row) => (
                <p key={"pricing-" + row.systemId}>
                  <strong>
                    {row.systemLabel} / {row.vendor}:
                  </strong>{' '}
                  проверено хостов {row.checkedHosts.length}, позиций с подтвержденной ценой {row.sourceCount} из {row.totalEntries}, средняя
                  уверенность {num(row.avgConfidence * 100, 0)}%. Проверенные хосты: {formatHostList(row.checkedHosts)}. Хосты, подтвердившие
                  цену: {formatHostList(row.matchedHosts)}.
                  {row.warning ? " Предупреждение: " + t(row.warning) + "." : ""}
                </p>
              ))}
              {vendorPricingPositionRows.map((row) =>
                row.positions.map((item, index) => (
                  <p key={"pricing-position-" + row.systemId + "-" + index}>
                    <strong>
                      {row.systemLabel} / {row.vendor}:
                    </strong>{' '}
                    позиция {item.name}
                    {item.model ? ", модель " + item.model : ""}, количество {num(item.qty, 0)} {item.unit}, цена за единицу {rub(item.unitPrice)},
                    сумма по проекту {rub(item.total)}
                    {item.sourceLabel ? ". Источник: " + item.sourceLabel + "." : ""}
                    {item.confidence > 0 ? " Уверенность " + num(item.confidence * 100, 0) + "%." : ""}
                    {item.selectionStrategy ? " Стратегия выбора: " + item.selectionStrategy + "." : ""}
                  </p>
                ))
              )}
            </div>
          </>
        ),
      },
      {
        key: "base-rates",
        title: "5. Базовые расценки работ",
        summary: "Только базовые монтажные и пусконаладочные операции без начислений и коэффициентов.",
        body: (
          <>
            <p>
              По кнопке выгружаются только базовые работы текущего проекта: монтаж устройств, монтаж приборов и контроллеров, кабельные работы,
              ПНР, интеграционные подключения и КНС-операции. Проектные работы, коэффициенты, ОПР, ФОТ/налоги, утилизация, СИЗ, АХР и
              региональные надбавки сюда не попадают.
            </p>
            <p>
              Базовая стоимость работ по проекту до начислений и коэффициентов: <strong>{rub(totalWorkBase)}</strong>. Ставки в текущей версии
              обновлены до среднерыночного уровня и используются как база, от которой дальше считаются коэффициенты, начисления и итоговая
              трудовая часть.
            </p>
            <div className="aps-ops-header logic-export-bar">
              <span className="hint-inline">
                Выгрузка формирует три столбца: наименование работ, стоимость за единицу и количество именно по текущему проекту.
              </span>
              <button className="ghost-btn" type="button" onClick={exportWorkUnitRates} disabled={!workUnitRateRows.length}>
                Выгрузить базовые расценки
              </button>
            </div>
            {workUnitRateRows.length ? (
              <div className="table-wrap compact logic-base-rates-table">
                <table>
                  <thead>
                    <tr>
                      <th>Наименование работ</th>
                      <th>Стоимость за единицу</th>
                      <th>Количество</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workUnitRateRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.workName}</td>
                        <td>{rub(row.unitPrice)}</td>
                        <td>
                          {num(row.quantity, row.unit === "м" || row.unit === "усл. ед." ? 1 : 0)} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>По текущему набору систем пока нет рассчитанных базовых работ для выгрузки.</p>
            )}
            <div className="logic-equipment-list">
              {ratesDigest.map((item) => (
                <p key={"rates-" + item.systemType}>
                  <strong>{item.systemLabel}:</strong> монтаж основного элемента {rub(item.rates.mountPrimary)}, ПНР основного элемента{' '}
                  {rub(item.rates.pnrPrimary)}, монтаж контроллера {rub(item.rates.controllerMount)}, ПНР активного элемента{' '}
                  {rub(item.rates.pnrActiveElement)}, кабель {rub(item.rates.cablePerMeter)}/м, КНС {rub(item.rates.knsPerMeter)}/м, интеграция{' '}
                  {rub(item.rates.integrationPoint)}/точка.
                </p>
              ))}
              {BASE_RATE_COMPOSITION.map((item) => (
                <p key={`base-rate-composition-${item.key}`}>
                  <strong>{item.title}:</strong> {item.description}
                </p>
              ))}
            </div>
          </>
        ),
      },
      {
        key: "risk-guard",
        title: "6. Risk Guard AI",
        summary: "Контроль недооценки и переоценки трудовой части проекта.",
        body: (
          <>
            <p>
              Отдельный AI-контур перепроверяет СМР и ПНР на перекосы относительно состава оборудования, насыщенности трасс, КНС, региона и
              условий монтажа.
            </p>
            <p>
              Максимальный риск дисбаланса: <strong>{num(aiGuard.maxRisk * 100, 0)}%</strong>, риск недооцененности{' '}
              <strong>{num(aiGuard.maxUnderpricingRisk * 100, 0)}%</strong>, риск переоцененности{' '}
              <strong>{num(aiGuard.maxOverpricingRisk * 100, 0)}%</strong>, суммарный рыночный floor <strong>{rub(aiGuard.totalMarketFloor)}</strong>.
            </p>
            <div className="logic-equipment-list">
              {aiGuardRows.map((item) => (
                <p key={`guard-${item.systemName}`}>
                  <strong>{item.systemName}:</strong> риск недооцененности {num(item.underpricingRisk * 100, 0)}%, риск переоцененности{" "}
                  {num(item.overpricingRisk * 100, 0)}%, рыночный floor {rub(item.marketFloor)}. Для этого объекта это означает, что именно по
                  этой системе нужно вручную перепроверить объем СМР/ПНР и не убирать резерв до подтверждения трасс и состава работ.
                </p>
              ))}
            </div>
          </>
        ),
      },
      {
        key: "project-risks",
        title: "7. AI-риски проекта",
        summary: "Какие точки удорожания и сдвига сроков система видит по текущему объекту.",
        body: (
          <>
            <p>
              Модуль рисков проекта анализирует объект, системы, обследование, проектные PDF-данные, рыночные сигналы и ограничения монтажа.
            </p>
            <p>
              Сейчас зафиксировано <strong>{projectRisks.length}</strong> критичных или повышенных риска(ов) для этого проекта.
            </p>
            <div className="logic-equipment-list">
              {projectRisks.length ? (
                projectRisks.map((risk) => (
                  <p key={`project-risk-${risk.id}`}>
                    <strong>{risk.title}:</strong> {risk.summary} Потенциальное влияние на бюджет: {rub(risk.budgetImpact || 0)}.
                  </p>
                ))
              ) : (
                <p>Выраженных рисков по текущему набору данных не выявлено.</p>
              )}
            </div>
          </>
        ),
      },
      {
        key: "coefficients",
        title: "8. Коэффициенты и начисления",
        summary: "Что применяется поверх базовых расценок уже после расчета состава работ.",
        body: (
          <>
            <p>
              Коэффициенты условий, коэффициент действующего здания, ОПР, ФОТ/налоги, утилизация, СИЗ, АХР и региональный коэффициент относятся
              к надстройке над базой работ, а не к базовым расценкам.
            </p>
            <p>
              Сводный коэффициент условий: <strong>{coef(conditionFactor)}</strong>. До регионального коэффициента{' '}
              <strong>{rub(totalWorkBeforeRegion)}</strong>, после начислений и регионального коэффициента{' '}
              <strong>{rub(totalWorkWithCharges)}</strong>. Сумма начислений <strong>{rub(totalCharges)}</strong>.
            </p>
            {appliedObjectCoefficients.length ? (
              <div className="logic-equipment-list">
                {appliedObjectCoefficients.map((item) => (
                  <p key={item.key}>
                    <strong>{t(item.label)}:</strong> {coef(item.value)}. {t(item.reason)}
                  </p>
                ))}
              </div>
            ) : (
              <p>По текущему объекту ручные коэффициенты не отклонены от базового значения x1.00.</p>
            )}
          </>
        ),
      },
      {
        key: "design",
        title: "9. Проектирование",
        summary: "Как считается проектирование и когда оно исключается из расчета.",
        body: (
          <>
            <p>
              Проектирование считается отдельно по системе от объема, сложности, обследования и координации с другими подсистемами. Если по
              системе уже есть проект, стоимость проектирования по ней не начисляется.
            </p>
            <p>
              Суммарно по рассчитываемым системам: <strong>{num(totalDesignHours, 1)} ч</strong>, средняя группа{' '}
              <strong>{num(avgDesignTeam, 1)} чел.</strong>, максимальный срок <strong>{formatDesignDurationExact(maxDesignMonths)}</strong>,
              стоимость <strong>{rub(totalDesign)}</strong>.
            </p>
            <div className="logic-equipment-list">
              {ratesDigest.map((item) => (
                <p key={`design-${item.systemType}`}>
                  <strong>{item.systemLabel}:</strong> базовая ставка проектирования {rub(item.rates.designHour)}/час. На стоимость влияют объем
                  системы, насыщенность оборудования, кабельная часть, интеграционные точки, результаты обследования и межсистемная координация.
                </p>
              ))}
            </div>
          </>
        ),
      },
      {
        key: "budget",
        title: "10. Итоговая формула бюджета",
        summary: "Как складывается итоговая сумма проекта после всех подсчетов.",
        body: (
          <>
            <p>
              <strong>Итог = Оборудование + Материалы + Работы + Проектирование + Рентабельность + НДС</strong>
            </p>
            <p>
              Сейчас: оборудование <strong>{rub(totalEquipment)}</strong>, материалы <strong>{rub(totalMaterials)}</strong>, работы{' '}
              <strong>{rub(totals.totalWorks || totals.totalWork || 0)}</strong>, проектирование <strong>{rub(totalDesign)}</strong>, итог проекта{' '}
              <strong>{rub(totalProject)}</strong>.
            </p>
          </>
        ),
      },
      {
        key: "recalc",
        title: "11. Пересчет при изменениях",
        summary: "Что именно обновляется, когда меняются параметры проекта.",
        body: (
          <>
            <p>
              Любое изменение объекта, систем, вендора, PDF-спецификации, цен, обследования или бюджета запускает полный пересчет объемов,
              ценового контура, рисков и итогового бюджета.
            </p>
            <div className="logic-equipment-list">
              <p>
                <strong>Журнал зависимостей:</strong> объект и зоны меняют объемы и трассы; системы и вендоры меняют состав оборудования;
                обследование меняет маршруты, материалы и трудоемкость; PDF и цены меняют unit-price; бюджет меняет коэффициенты и начисления.
              </p>
              {systemResults.map((row, index) => (
                <p key={row.systemType + "-logic-" + index}>
                  <strong>{row.systemName}:</strong> кабель {num(row.cable || 0, 1)} м, работы {rub(row.workTotal || 0)}, проектирование{' '}
                  {row.designSkipped ? "не рассчитывается" : rub(row.designTotal || 0)}, итог {rub(row.total || 0)}.
                </p>
              ))}
              {skippedDesignRows.length ? (
                <p>
                  <strong>Системы с готовым проектом:</strong> {skippedDesignRows.map((row) => row.systemName).join(", ")}.
                </p>
              ) : null}
            </div>
          </>
        ),
      },
    ],
    [
      aiGuard.maxOverpricingRisk,
      aiGuard.maxRisk,
      aiGuard.maxUnderpricingRisk,
      aiGuard.totalMarketFloor,
      aiGuardRows,
      appliedObjectCoefficients,
      automaticVolumeRows,
      avgDesignTeam,
      calcObjectData.buildingStatus,
      calcObjectData.regionName,
      calcObjectData.regionSubject,
      calcObjectData.totalArea,
      conditionFactor,
      exploitedBuildingCoef,
      maxDesignMonths,
      projectRisks,
      ratesDigest,
      regionalCoef,
      skippedDesignRows,
      surveySummary,
      systems.length,
      systemResults,
      totalCharges,
      totalDesign,
      totalDesignHours,
      totalEquipment,
      totalMaterials,
      totalProject,
      totalWorkBase,
      totalWorkBeforeRegion,
      totalWorkWithCharges,
      totals.totalWork,
      totals.totalWorks,
      vendorPricingPositionRows,
      vendorPricingRows,
      workUnitRateRows,
    ]
  );
  const activeSectionData = logicSections.find((section) => section.key === activeLogicSection) || null;

  const content = (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Логика расчета</h2>
          <p>
            Все блоки свернуты в отдельные карточки. Открывайте нужный раздел по кнопке, чтобы посмотреть, как именно платформа считает объемы,
            цены, базовые расценки и итог бюджета.
          </p>
        </div>
      </div>

      <div className="logic-stack">
        {logicSections.map((section) => (
          <button key={section.key} type="button" className="ghost-btn logic-section-btn" onClick={() => setActiveLogicSection(section.key)}>
            <span className="logic-section-btn__title">{section.title}</span>
            <span className="logic-section-btn__summary">{section.summary}</span>
          </button>
        ))}
      </div>

      {activeSectionData ? (
        <div className="project-plan-modal logic-modal" role="dialog" aria-modal="true" aria-labelledby="logic-modal-title">
          <button className="project-plan-modal__backdrop" type="button" aria-label="Закрыть окно" onClick={() => setActiveLogicSection(null)} />
          <div className="project-plan-modal__card logic-modal__card">
            <div className="project-plan-modal__header">
              <div>
                <div className="project-plan-modal__eyebrow">Логика расчета</div>
                <h3 id="logic-modal-title">{activeSectionData.title}</h3>
                <p>{activeSectionData.summary}</p>
              </div>
              <button className="ghost-btn project-plan-modal__close" type="button" onClick={() => setActiveLogicSection(null)}>
                Закрыть
              </button>
            </div>
            <div className="logic-card logic-modal__body">{activeSectionData.body}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
  return repairReactTextTree(content);
}

