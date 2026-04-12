import React, { useMemo } from "react";
import { COEFFICIENT_GUIDE, SYSTEM_TYPES } from "../config/estimateConfig";
import { LABOR_MARKET_GUARDRAILS, LABOR_UNIT_RATES } from "../config/costModelConfig";
import { num, rub, toNumber } from "../lib/estimate";
import { buildCoefficientLayer } from "../lib/coefficient-engine";
import { repairReactTextTree } from "../lib/repairReactTree";
import { repairUtf8Cp1251Mojibake } from "../lib/textEncoding";

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
    return new URL(value).hostname.replace(/^www\./i, "");
  } catch {
    return value;
  }
}

function isGenericSourceUrl(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    return pathname.includes("/search") || pathname.includes("/catalog") || query.includes("q=") || query.includes("search=");
  } catch {
    return /search|catalog/i.test(value);
  }
}

function pickBestSourceUrl(candidateUrls = []) {
  const urls = [...new Set((candidateUrls || []).map((item) => String(item || "").trim()).filter(Boolean))];
  return urls.find((url) => !isGenericSourceUrl(url)) || urls[0] || "";
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

function t(value) {
  return repairUtf8Cp1251Mojibake(String(value ?? ""));
}

function formatHostList(hosts = []) {
  const normalized = [...new Set((hosts || []).map((item) => String(item || "").trim()).filter(Boolean))];
  return normalized.length ? normalized.join(", ") : "РЅРµС‚ РґР°РЅРЅС‹С…";
}

function formatDesignDurationExact(monthsExact) {
  const safeMonths = toNumber(monthsExact, 0);
  if (safeMonths <= 0) return "0 РјРµСЃ.";
  if (safeMonths < 1) return `${num(Math.max(safeMonths * 22, 1), 0)} СЂР°Р±. РґРЅ.`;
  return `${num(safeMonths, 1)} РјРµСЃ.`;
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

export default function CalculationLogicStep({
  objectData,
  effectiveObjectData,
  systems,
  systemResults,
  budget,
  totals,
  projectRisks = [],
  vendorPriceSnapshots = {},
}) {
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
  const skippedDesignRows = systemResults.filter((row) => row.designSkipped);
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
  const workUnitRateRows = useMemo(
    () =>
      (systemResults || []).flatMap((row) => {
        const rates = row?.laborDetails?.unitRates || {};
        const breakdown = row?.laborDetails?.workBreakdown || {};
        const chargePercents = row?.laborDetails?.chargePercents || {};
        const charges = row?.laborDetails?.workChargesBeforeRegion || {};
        const systemLabel = row?.systemName || getSystemLabel(row?.systemType);
        const entries = [
          ["base", "СМР", "Монтаж основных элементов", row?.primaryUnitLabel || "ед.", breakdown.primaryUnits, rates.mountPrimary, 0, "Количество основных элементов × базовая ставка монтажа"],
          ["base", "СМР", "Монтаж контроллеров и узлов", "ед.", breakdown.controllerUnits, rates.controllerMount, 0, "Количество контроллеров/узлов × ставка монтажа контроллера"],
          ["base", "СМР", "Кабельные работы", "м", breakdown.cableLengthM, rates.cablePerMeter, 0, "Длина трасс × ставка кабельных работ"],
          ["base", "ПНР", "ПНР основных элементов", row?.primaryUnitLabel || "ед.", breakdown.primaryUnits, rates.pnrPrimary, 0, "Количество основных элементов × ставка ПНР"],
          ["base", "ПНР", "ПНР активных элементов", "ед.", breakdown.activeElements, rates.pnrActiveElement, 0, "Количество активных элементов × ставка ПНР активного элемента"],
          ["base", "Интеграция", "Интеграционные работы", "точка", breakdown.integrationPoints, rates.integrationPoint, 0, "Количество точек интеграции × ставка интеграции"],
          ["base", "КНС", "Монтаж КНС по трассе", "м", breakdown.knsLengthM, rates.knsPerMeter, 0, "Длина КНС × ставка КНС"],
          ["base", "КНС", "Рабочие единицы КНС", "усл. ед.", breakdown.knsWorkUnits, toNumber(rates.knsPerMeter, 0) * 0.22, 0, "Рабочие единицы КНС × 22% от ставки КНС"],
          ["base", "Проектирование", "Проектные работы", "ч", row?.designHours, rates.designHour, 0, "Проектные часы × базовая часовая ставка"],
          ["coefficient", "Работы", "Коэффициент условий и статуса", "коэф.", 1, Math.max(toNumber(breakdown.conditionFactor, 1) * toNumber(breakdown.exploitedFactor, 1) - 1, 0), toNumber(breakdown.computedWorkBase, 0), "База работ × (коэффициент условий × коэффициент статуса - 1)"],
          ["charge", "Начисления", "ОПР", "%", toNumber(chargePercents.overhead, 0), 0.01, toNumber(row?.laborDetails?.workAfterConditions, 0), "Работы после условий × % ОПР"],
          ["charge", "Начисления", "ФОТ/налоги", "%", toNumber(chargePercents.payrollTaxes, 0), 0.01, toNumber(row?.laborDetails?.workAfterConditions, 0), "Работы после условий × % ФОТ/налогов"],
          ["charge", "Начисления", "Утилизация", "%", toNumber(chargePercents.utilization, 0), 0.01, toNumber(row?.laborDetails?.workAfterConditions, 0), "Работы после условий × % утилизации"],
          ["charge", "Начисления", "СИЗ", "%", toNumber(chargePercents.ppe, 0), 0.01, toNumber(row?.laborDetails?.workAfterConditions, 0), "Работы после условий × % СИЗ"],
          ["charge", "Начисления", "АХР", "%", toNumber(chargePercents.admin, 0), 0.01, toNumber(row?.laborDetails?.workAfterConditions, 0), "Работы после условий × % АХР"],
          ["coefficient", "Регион", "Региональный коэффициент", "коэф.", 1, Math.max(toNumber(breakdown.regionalFactor, 1) - 1, 0), toNumber(row?.laborDetails?.workTotalBeforeRegion, 0), "Работы до регионального коэффициента × (региональный коэффициент - 1)"],
        ];

        return entries
          .map(([rowType, workGroup, workType, unit, qtyRaw, rateRaw, baseRaw, formulaText], index) => {
            const qty = toNumber(qtyRaw, 0);
            const rate = toNumber(rateRaw, 0);
            const base = toNumber(baseRaw, 0);
            const baseAmount = rowType === "base" ? qty * rate : base * rate * qty;
            const amountFromCharges =
              workType === "ОПР"
                ? toNumber(charges.overhead, baseAmount)
                : workType === "ФОТ/налоги"
                  ? toNumber(charges.payrollTaxes, baseAmount)
                  : workType === "Утилизация"
                    ? toNumber(charges.utilization, baseAmount)
                    : workType === "СИЗ"
                      ? toNumber(charges.ppe, baseAmount)
                      : workType === "АХР"
                        ? toNumber(charges.admin, baseAmount)
                        : baseAmount;
            return {
              id: `${row?.systemId || row?.systemType}-${index}`,
              systemLabel,
              systemType: row?.systemType || "",
              rowType,
              workGroup,
              workType,
              unit,
              qty,
              rate,
              rateBase: base,
              baseAmount: amountFromCharges,
              formula:
                rowType === "base"
                  ? `${num(qty, unit === "м" || unit === "ч" || unit === "усл. ед." ? 1 : 0)} × ${rub(rate)}`
                  : base > 0
                    ? `${rub(base)} × ${num(qty, unit === "%" ? 2 : 1)} × ${num(rate * 100, 2)}%`
                    : formulaText,
              source: row?.laborDetails?.modelSource?.unitRatesConfig || "Внутренняя модель единичных расценок",
              basis: formulaText,
            };
          })
          .filter((item) => item.rate > 0 && (item.rowType !== "base" || item.qty > 0) && item.baseAmount > 0);
      }),
    [systemResults]
  );
  const exportWorkUnitRates = () => {
    if (!workUnitRateRows.length) return;
    const rows = [
      ["Система", "Код системы", "Тип строки", "Группа работ", "Вид работ", "Ед. изм.", "Количество/норматив", "База начисления, руб.", "Базовая единичная расценка", "Стоимость элемента, руб.", "Формула", "Основание", "Источник расценки"]
        .map(csvCell)
        .join(";"),
      ...workUnitRateRows.map((row) =>
        [
          row.systemLabel,
          row.systemType,
          row.rowType,
          row.workGroup,
          row.workType,
          row.unit,
          num(row.qty, row.unit === "м" || row.unit === "ч" || row.unit === "усл. ед." ? 1 : 0),
          num(row.rateBase, 2),
          num(row.rate, 2),
          num(row.baseAmount, 2),
          row.formula,
          row.basis,
          row.source,
        ]
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

  const content = (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Р›РѕРіРёРєР° СЂР°СЃС‡РµС‚Р°</h2>
          <p>РџРѕС€Р°РіРѕРІРѕ: РєР°Рє РїР»Р°С‚С„РѕСЂРјР° СЃРѕР±РёСЂР°РµС‚ РѕР±СЉРµРјС‹, РїСЂРѕРІРѕРґРёС‚ AI-Р°СѓРґРёС‚ С†РµРЅ, РёСЃРїРѕР»СЊР·СѓРµС‚ AI-РѕР±СЃР»РµРґРѕРІР°РЅРёРµ, РѕС†РµРЅРёРІР°РµС‚ СЂРёСЃРєРё РїСЂРѕРµРєС‚Р° Рё Р±Р°Р»Р°РЅСЃРёСЂСѓРµС‚ Р±СЋРґР¶РµС‚ С‡РµСЂРµР· РєРѕРЅС‚СЂРѕР»СЊ РєР°С‡РµСЃС‚РІР° Рё С‚РѕС‡РЅРѕСЃС‚Рё СЂР°СЃС‡РµС‚Р°.</p>
        </div>
      </div>

      <div className="logic-grid">
        <article className="logic-card">
          <h3>1. Р’С…РѕРґРЅС‹Рµ РїР°СЂР°РјРµС‚СЂС‹ РѕР±СЉРµРєС‚Р°</h3>
          <p>Р Р°СЃС‡РµС‚ РЅР°С‡РёРЅР°РµС‚СЃСЏ СЃ С‚РёРїР° РѕР±СЉРµРєС‚Р°, РїР»РѕС‰Р°РґРё, Р·Р°С‰РёС‰Р°РµРјРѕР№ РїР»РѕС‰Р°РґРё, СЌС‚Р°Р¶РЅРѕСЃС‚Рё, СЂРµРіРёРѕРЅР°, СЃС‚Р°С‚СѓСЃР° Р·РґР°РЅРёСЏ Рё РІС‹Р±СЂР°РЅРЅС‹С… СЃРёСЃС‚РµРј. Р­С‚Рё РґР°РЅРЅС‹Рµ С„РѕСЂРјРёСЂСѓСЋС‚ РїСЂРѕС„РёР»СЊ СЃР»РѕР¶РЅРѕСЃС‚Рё Рё СЃС‚Р°СЂС‚РѕРІС‹Рµ РѕР±СЉРµРјС‹ РїРѕ РєР°Р¶РґРѕР№ СЃРёСЃС‚РµРјРµ.</p>
          <p>РЎРµР№С‡Р°СЃ: РїР»РѕС‰Р°РґСЊ <strong>{num(calcObjectData.totalArea, 0)} РјВІ</strong>, СЃРёСЃС‚РµРј <strong>{num(systems.length, 0)}</strong>, СЂРµРіРёРѕРЅ <strong>{calcObjectData.regionName}</strong> ({coef(regionalCoef)}), СЃС‚Р°С‚СѓСЃ Р·РґР°РЅРёСЏ <strong>{calcObjectData.buildingStatus === "operational" ? "РґРµР№СЃС‚РІСѓСЋС‰РµРµ" : "СЃС‚СЂРѕСЏС‰РµРµСЃСЏ"}</strong> ({coef(exploitedBuildingCoef)}).</p>
        </article>

        <article className="logic-card">
          <h3>2. РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРѕРµ РѕРїСЂРµРґРµР»РµРЅРёРµ РѕР±СЉРµРјРѕРІ</h3>
          <p>Р”Р»СЏ РєР°Р¶РґРѕР№ СЃРёСЃС‚РµРјС‹ РґРІРёР¶РѕРє СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚ РєРѕР»РёС‡РµСЃС‚РІРѕ РѕСЃРЅРѕРІРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ, РєРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ, РєР°Р±РµР»СЏ, РљРќРЎ, РѕР±СЉРµРј РџРќР  Рё РїСЂРѕРµРєС‚РЅС‹С… С‡Р°СЃРѕРІ. РћСЃРЅРѕРІР° СЂР°СЃС‡РµС‚Р°: РїСЂРѕС„РёР»СЊ Р·РѕРЅ, РЅР°СЃС‹С‰РµРЅРЅРѕСЃС‚СЊ РѕР±СЉРµРєС‚Р°, СЌС‚Р°Р¶РЅРѕСЃС‚СЊ, РјР°СЂС€СЂСѓС‚С‹ Рё С‚РёРї СЌРєСЃРїР»СѓР°С‚Р°С†РёРё.</p>
          <p>Р•СЃР»Рё Р·Р°РіСЂСѓР¶РµРЅ PDF-РїСЂРѕРµРєС‚ РђРџРЎ, СЃРёСЃС‚РµРјР° РёСЃРїРѕР»СЊР·СѓРµС‚ СЃРїРµС†РёС„РёРєР°С†РёСЋ РїСЂРѕРµРєС‚Р° РєР°Рє РїСЂРёРѕСЂРёС‚РµС‚РЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє С„Р°РєС‚РёС‡РµСЃРєРёС… РѕР±СЉРµРјРѕРІ, Р° РЅРµ С‚РѕР»СЊРєРѕ РІРЅСѓС‚СЂРµРЅРЅСЋСЋ РјРѕРґРµР»СЊ.</p>
        </article>

        <article className="logic-card">
          <h3>2.1. Р›РѕРіРёРєР° Р·РѕРЅ Рё СЃРѕСЃС‚Р°РІР° РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ РїРѕ РѕР±СЉРµРєС‚Сѓ</h3>
          <div className="logic-equipment-list">
            {automaticVolumeRows.map((item) => (
              <p key={item.key}>
                <strong>{item.title}:</strong> {item.detail} {item.metrics} {item.extra}
              </p>
            ))}
          </div>
        </article>

        <article className="logic-card">
          <h3>3. AI-РѕР±СЃР»РµРґРѕРІР°РЅРёРµ</h3>
          <p>РџРѕСЃР»Рµ Р·Р°РїРѕР»РЅРµРЅРёСЏ РѕР±СЉРµРєС‚Р° РјРѕР¶РЅРѕ Р·Р°РїСѓСЃС‚РёС‚СЊ AI-РѕР±СЃР»РµРґРѕРІР°РЅРёРµ. РџР»Р°С‚С„РѕСЂРјР° СЃС‚СЂРѕРёС‚ Р°РґР°РїС‚РёРІРЅС‹Р№ С‡РµРє-Р»РёСЃС‚ РїРѕ РѕР±СЉРµРєС‚Сѓ, Р·РѕРЅР°Рј Рё СЃРёСЃС‚РµРјР°Рј Р±РµР· РїСЂРѕРµРєС‚Р°, РІРєР»СЋС‡Р°СЏ РІРѕРїСЂРѕСЃС‹, РЅРµРѕР±С…РѕРґРёРјС‹Рµ РґР»СЏ С‚РѕС‡РЅРѕРіРѕ СЂР°СЃС‡РµС‚Р° СЃС‚РѕРёРјРѕСЃС‚Рё РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ.</p>
          <p>Р”Р»СЏ РЎРћРўРЎ, РЎРћРЈР­ Рё РђРџРЎ С‡РµРє-Р»РёСЃС‚ РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ СЃРѕР±РёСЂР°РµС‚ РїР»Р°РЅС‹ СЌРІР°РєСѓР°С†РёРё. РџР»Р°С‚С„РѕСЂРјР° РїРѕРґСЃРєР°Р·С‹РІР°РµС‚, РєР°Рє РёС… С„РѕС‚РѕРіСЂР°С„РёСЂРѕРІР°С‚СЊ: РґРµСЂР¶Р°С‚СЊ РєР°РјРµСЂСѓ РїРѕС‡С‚Рё РїР°СЂР°Р»Р»РµР»СЊРЅРѕ РїР»РѕСЃРєРѕСЃС‚Рё СЃС…РµРјС‹, Р±СЂР°С‚СЊ РїР»Р°РЅ С†РµР»РёРєРѕРј, РёР·Р±РµРіР°С‚СЊ Р±Р»РёРєРѕРІ, СЃРјР°Р·Р° Рё СЃРёР»СЊРЅРѕРіРѕ РЅР°РєР»РѕРЅР°.</p>
          <p>Р¤РѕС‚РѕР°РЅР°Р»РёР· РїРѕРјРѕРіР°РµС‚ РїРѕРґС‚РІРµСЂРґРёС‚СЊ РјР°С‚РµСЂРёР°Р» СЃС‚РµРЅ, С‚РёРї РїРѕС‚РѕР»РєР° Рё, РµСЃР»Рё РєР°С‡РµСЃС‚РІРѕ СЃРЅРёРјРєР° РїРѕР·РІРѕР»СЏРµС‚, РѕС†РµРЅРёС‚СЊ РІС‹СЃРѕС‚Сѓ РїРѕРјРµС‰РµРЅРёСЏ. РћС‚РґРµР»СЊРЅС‹Р№ РјРѕРґСѓР»СЊ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ РїР»Р°РЅРёСЂРѕРІРѕРє Р°РЅР°Р»РёР·РёСЂСѓРµС‚ РїР»Р°РЅС‹ СЌРІР°РєСѓР°С†РёРё, РІС‹РґРµР»СЏРµС‚ РѕС…СЂР°РЅРЅС‹Рµ Р·РѕРЅС‹ РґР»СЏ РЎРћРўРЎ, Р·РѕРЅС‹ РѕРїРѕРІРµС‰РµРЅРёСЏ РґР»СЏ РЎРћРЈР­ Рё Р—РљРЎРџРЎ РґР»СЏ РђРџРЎ, Р° Р·Р°С‚РµРј РїРµСЂРµРїСЂРѕРІРµСЂСЏРµС‚ СЂРµР·СѓР»СЊС‚Р°С‚ РїРѕ РґР°РЅРЅС‹Рј РѕР±СЉРµРєС‚Р°.</p>
          <p>Р’ РјРѕРґСѓР»СЊ РІСЃС‚СЂРѕРµРЅР° Р·Р°С‰РёС‚Р° РѕС‚ Р»РѕР¶РЅРѕР№ С„РѕС‚РѕРёРЅС„РѕСЂРјР°С†РёРё: СЃС…РµРјС‹, РґРѕРєСѓРјРµРЅС‚С‹ Рё РЅРµСЂРµР»РµРІР°РЅС‚РЅС‹Рµ СЃРЅРёРјРєРё РЅРµ РїРѕРїР°РґР°СЋС‚ РІ С‡РµРє-Р»РёСЃС‚ Рё РЅРµ РёСЃРєР°Р¶Р°СЋС‚ РѕР±СЃР»РµРґРѕРІР°РЅРёРµ.</p>
        </article>

        <article className="logic-card">
          <h3>4. РћС‚РєСѓРґР° Р±РµСЂСѓС‚СЃСЏ С†РµРЅС‹ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ</h3>
          <p>
            РџРѕ С‚РµРєСѓС‰РµРјСѓ РїСЂРѕРµРєС‚Сѓ С†РµРЅС‹ СЃРѕР±РёСЂР°СЋС‚СЃСЏ РїРѕ РєР°Р¶РґРѕР№ РєР»СЋС‡РµРІРѕР№ РїРѕР·РёС†РёРё РѕС‚РґРµР»СЊРЅРѕ. РџР»Р°С‚С„РѕСЂРјР° С„РѕСЂРјРёСЂСѓРµС‚ РїРѕРёСЃРєРѕРІС‹Рµ Р·Р°РїСЂРѕСЃС‹ РёР·
            РІРµРЅРґРѕСЂР°, РјРѕРґРµР»Рё, Р°СЂС‚РёРєСѓР»Р° Рё РЅР°Р·РІР°РЅРёСЏ РїРѕР·РёС†РёРё, РїРѕСЃР»Рµ С‡РµРіРѕ РѕРїСЂР°С€РёРІР°РµС‚ СЃР°Р№С‚ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ Рё РїРѕСЃС‚Р°РІС‰РёРєРѕРІ, РїРѕРґРєР»СЋС‡РµРЅРЅС‹С… Рє
            РїСЂРѕРµРєС‚Сѓ.
          </p>
          <p>
            Р’ РєРѕРЅС‚СѓСЂ РёСЃС‚РѕС‡РЅРёРєРѕРІ РІС…РѕРґСЏС‚ СЃР°Р№С‚ РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ, Tinko, Luis, Garant, Ganimed Рё РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅС‹Рµ РІРµРЅРґРѕСЂРЅС‹Рµ РІРёС‚СЂРёРЅС‹. Р”Р»СЏ
            РѕС‚РґРµР»СЊРЅС‹С… Р±СЂРµРЅРґРѕРІ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ СЃРїРµС†РёР°Р»СЊРЅС‹Рµ РёСЃС‚РѕС‡РЅРёРєРё, РЅР°РїСЂРёРјРµСЂ `hikvision-shop.ru` Рё `dahua.market`. Р•СЃР»Рё РїРѕ СЃРёСЃС‚РµРјРµ
            Р·Р°РіСЂСѓР¶РµРЅ РїСЂРѕРµРєС‚, РїСЂРёРѕСЂРёС‚РµС‚ РїРѕР»СѓС‡Р°СЋС‚ СЃС‚СЂРѕРєРё СЂР°СЃРїРѕР·РЅР°РЅРЅРѕР№ РїСЂРѕРµРєС‚РЅРѕР№ СЃРїРµС†РёС„РёРєР°С†РёРё, Р° С†РµРЅС‹ СЃРѕР±РёСЂР°СЋС‚СЃСЏ СѓР¶Рµ РїРѕ РЅРёРј.
          </p>
          <p>
            РђР»РіРѕСЂРёС‚Рј СЃРЅР°С‡Р°Р»Р° РёС‰РµС‚ С‚РѕС‡РЅС‹Рµ СЃРѕРІРїР°РґРµРЅРёСЏ РїРѕ Р°СЂС‚РёРєСѓР»Сѓ Рё РјРѕРґРµР»Рё. Р•СЃР»Рё РЅР°Р№РґРµРЅРѕ РЅРµСЃРєРѕР»СЊРєРѕ СЂРµР»РµРІР°РЅС‚РЅС‹С… РїСЂРµРґР»РѕР¶РµРЅРёР№, РІ СЂР°СЃС‡РµС‚
            Р±РµСЂРµС‚СЃСЏ СѓСЃСЂРµРґРЅРµРЅРЅР°СЏ С†РµРЅР° РїРѕ РІР°Р»РёРґРЅС‹Рј РёСЃС‚РѕС‡РЅРёРєР°Рј РїРѕСЃР»Рµ РѕС‚СЃРµС‡РµРЅРёСЏ РІС‹Р±СЂРѕСЃРѕРІ. Р•СЃР»Рё С‚РѕС‡РЅРѕРіРѕ СЃРѕРІРїР°РґРµРЅРёСЏ РЅРµС‚, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ
            РїРѕРёСЃРє РїРѕ РјРѕРґРµР»Рё Рё РЅР°Р·РІР°РЅРёСЋ РїРѕР·РёС†РёРё СЃ РїСЂРѕРІРµСЂРєРѕР№ РµРґРёРЅРёС†С‹ РёР·РјРµСЂРµРЅРёСЏ Рё Р·Р°С‰РёС‚РѕР№ РѕС‚ СЃР»РёС€РєРѕРј РЅРёР·РєРёС… РёР»Рё СЃР»РёС€РєРѕРј РІС‹СЃРѕРєРёС… С†РµРЅ.
          </p>
          <div className="logic-equipment-list">
            {vendorPricingRows.map((row) => (
              <p key={`pricing-${row.systemId}`}>
                <strong>{row.systemLabel} / {row.vendor}:</strong> РїСЂРѕРІРµСЂРµРЅРѕ С…РѕСЃС‚РѕРІ {row.checkedHosts.length}, РїРѕР·РёС†РёРё СЃ
                РїРѕРґС‚РІРµСЂР¶РґРµРЅРЅРѕР№ С†РµРЅРѕР№ {row.sourceCount} РёР· {row.totalEntries}, СЃСЂРµРґРЅСЏСЏ СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊ {num(row.avgConfidence * 100, 0)}%.
                РџСЂРѕРІРµСЂРµРЅРЅС‹Рµ С…РѕСЃС‚С‹: {formatHostList(row.checkedHosts)}. РҐРѕСЃС‚С‹, РїРѕРґС‚РІРµСЂРґРёРІС€РёРµ С†РµРЅСѓ: {formatHostList(row.matchedHosts)}.
                {row.warning ? ` РџСЂРµРґСѓРїСЂРµР¶РґРµРЅРёРµ: ${row.warning}.` : ""}
              </p>
            ))}
            {vendorPricingPositionRows.map((row) =>
              row.positions.map((item, index) => (
                <p key={`pricing-position-${row.systemId}-${index}`}>
                  <strong>{row.systemLabel} / {row.vendor}:</strong> РїРѕР·РёС†РёСЏ {item.name}
                  {item.model ? `, РјРѕРґРµР»СЊ ${item.model}` : ""}, РєРѕР»РёС‡РµСЃС‚РІРѕ {num(item.qty, 0)} {item.unit}, С†РµРЅР° Р·Р° РµРґРёРЅРёС†Сѓ{" "}
                  {rub(item.unitPrice)}, сумма по проекту {rub(item.total)}{item.sourceLabel ? `. Источник: ${item.sourceLabel}.` : ""}
                  {item.confidence > 0 ? ` РЈРІРµСЂРµРЅРЅРѕСЃС‚СЊ ${num(item.confidence * 100, 0)}%.` : ""}
                  {item.selectionStrategy ? ` РЎС‚СЂР°С‚РµРіРёСЏ РІС‹Р±РѕСЂР°: ${item.selectionStrategy}.` : ""}
                </p>
              ))
            )}
          </div>
          <p>
            РРјРµРЅРЅРѕ РїРѕСЌС‚РѕРјСѓ РІРѕ РІРєР»Р°РґРєРµ `РЎРёСЃС‚РµРјС‹` РїРѕРєР°Р·С‹РІР°СЋС‚СЃСЏ РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ РёСЃС‚РѕС‡РЅРёРєРё, СЃС‚СЂР°С‚РµРіРёСЏ РІС‹Р±РѕСЂР° Рё СѓСЂРѕРІРµРЅСЊ СѓРІРµСЂРµРЅРЅРѕСЃС‚Рё: СЌС‚Рѕ
            РєСЂР°С‚РєР°СЏ СЂР°СЃС€РёС„СЂРѕРІРєР° С‚РѕРіРѕ, РєР°Рє РїРѕ С‚РµРєСѓС‰РµРјСѓ РѕР±СЉРµРєС‚Сѓ СЃРѕР±СЂР°Р»СЃСЏ РёС‚РѕРіРѕРІС‹Р№ С†РµРЅРЅРёРє.
          </p>
        </article>

        <article className="logic-card">
          <h3>5. РљР°Рє СЃС‡РёС‚Р°РµС‚СЃСЏ СЃС‚РѕРёРјРѕСЃС‚СЊ СЂР°Р±РѕС‚</h3>
          <p>РЎРњР +РџРќР  СЃС‡РёС‚Р°СЋС‚СЃСЏ РїРѕ СЃРѕСЃС‚Р°РІСѓ СЂР°Р±РѕС‚, Р° РЅРµ РїРѕ СЂСѓР±Р»СЏРј Р·Р° РєРІР°РґСЂР°С‚РЅС‹Р№ РјРµС‚СЂ. Р‘Р°Р·Р° СЃРєР»Р°РґС‹РІР°РµС‚СЃСЏ РёР· РјРѕРЅС‚Р°Р¶Р° РѕСЃРЅРѕРІРЅС‹С… СЌР»РµРјРµРЅС‚РѕРІ, РџРќР , РєРѕРЅС‚СЂРѕР»Р»РµСЂРѕРІ, РєР°Р±РµР»СЊРЅС‹С… СЂР°Р±РѕС‚, РљРќРЎ Рё С‚РѕС‡РµРє РёРЅС‚РµРіСЂР°С†РёРё.</p>
          <p>РСЃС‚РѕС‡РЅРёРє Р±Р°Р·РѕРІС‹С… СЂР°СЃС†РµРЅРѕРє вЂ” РІРЅСѓС‚СЂРµРЅРЅСЏСЏ РЅРѕСЂРјР°С‚РёРІРЅР°СЏ Р±Р°Р·Р° РїР»Р°С‚С„РѕСЂРјС‹: РІ РЅРµР№ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅС‹ РµРґРёРЅРёС‡РЅС‹Рµ СЃС‚Р°РІРєРё РЅР° РјРѕРЅС‚Р°Р¶, РџРќР , РёРЅС‚РµРіСЂР°С†РёСЋ, РєР°Р±РµР»СЊРЅС‹Рµ Рё РљРќРЎ-СЂР°Р±РѕС‚С‹ РїРѕ РєР°Р¶РґРѕРјСѓ С‚РёРїСѓ СЃРёСЃС‚РµРјС‹, Р° С‚Р°РєР¶Рµ РєРѕРЅСЃРµСЂРІР°С‚РёРІРЅС‹Рµ РЅРёР¶РЅРёРµ РїРѕСЂРѕРіРё, РЅРёР¶Рµ РєРѕС‚РѕСЂС‹С… С‚СЂСѓРґРѕРІР°СЏ С‡Р°СЃС‚СЊ РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РѕРїСѓС‰РµРЅР° РґР°Р¶Рµ РїСЂРё РЅРµРїРѕР»РЅС‹С… РёР»Рё СЃР»РёС€РєРѕРј РѕРїС‚РёРјРёСЃС‚РёС‡РЅС‹С… РёСЃС…РѕРґРЅС‹С… РґР°РЅРЅС‹С…. Р­С‚Рѕ СѓС‚РІРµСЂР¶РґРµРЅРЅР°СЏ СЂР°СЃС‡РµС‚РЅР°СЏ Р±Р°Р·Р° С‚РµРєСѓС‰РµР№ РІРµСЂСЃРёРё РїР»Р°С‚С„РѕСЂРјС‹, Р° РЅРµ РїСЂРѕРёР·РІРѕР»СЊРЅС‹Рµ С†РёС„СЂС‹ РёР· РєРѕРЅРєСЂРµС‚РЅРѕР№ СЃРјРµС‚С‹.</p>
          <p>
            РџРѕСЂСЏРґРѕРє СЂР°СЃС‡РµС‚Р° РїРѕ С„РѕСЂРјСѓР»Рµ: <strong>Р‘Р°Р·Р° СЂР°Р±РѕС‚ = РЎРњР  + РџРќР  + РёРЅС‚РµРіСЂР°С†РёСЏ + РљРќРЎ</strong>.
            РЎРњР  = РїРµСЂРІРёС‡РЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Г— СЃС‚Р°РІРєР° РјРѕРЅС‚Р°Р¶Р° + РєРѕРЅС‚СЂРѕР»Р»РµСЂС‹ Г— СЃС‚Р°РІРєР° РјРѕРЅС‚Р°Р¶Р° РєРѕРЅС‚СЂРѕР»Р»РµСЂР° + РєР°Р±РµР»СЊ Г— СЃС‚Р°РІРєР° Р·Р° 1 Рј.
            РџРќР  = РїРµСЂРІРёС‡РЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Г— СЃС‚Р°РІРєР° РџРќР  + Р°РєС‚РёРІРЅС‹Рµ СЌР»РµРјРµРЅС‚С‹ Г— СЃС‚Р°РІРєР° РџРќР  РЅР° Р°РєС‚РёРІРЅС‹Р№ СЌР»РµРјРµРЅС‚.
            РРЅС‚РµРіСЂР°С†РёСЏ = С‚РѕС‡РєРё РёРЅС‚РµРіСЂР°С†РёРё Г— СЃС‚Р°РІРєР° РёРЅС‚РµРіСЂР°С†РёРё.
            РљРќРЎ = РјРµС‚СЂС‹ РљРќРЎ Г— СЃС‚Р°РІРєР° РљРќРЎ + СЂР°Р±РѕС‡РёРµ РµРґРёРЅРёС†С‹ РљРќРЎ Г— 22% СЌС‚РѕР№ Р¶Рµ СЃС‚Р°РІРєРё.
          </p>
          <p>
            Р”Р°Р»РµРµ СЃРёСЃС‚РµРјР° РїСЂРёРјРµРЅСЏРµС‚ С†РµРїРѕС‡РєСѓ: <strong>Р±Р°Р·Р° СЂР°Р±РѕС‚ Г— РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ СѓСЃР»РѕРІРёР№ Г— РєРѕСЌС„С„РёС†РёРµРЅС‚ РґРµР№СЃС‚РІСѓСЋС‰РµРіРѕ Р·РґР°РЅРёСЏ = СЂР°Р±РѕС‚С‹ РїРѕСЃР»Рµ СѓСЃР»РѕРІРёР№</strong>,
            Р·Р°С‚РµРј РЅР° СЌС‚Сѓ РІРµР»РёС‡РёРЅСѓ РЅР°С‡РёСЃР»СЏСЋС‚СЃСЏ РћРџР , Р¤РћРў, СѓС‚РёР»РёР·Р°С†РёСЏ, РЎРР— Рё РђРҐР , РїРѕСЃР»Рµ С‡РµРіРѕ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ СЂРµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕСЌС„С„РёС†РёРµРЅС‚.
            РС‚РѕРіРѕРІР°СЏ Р±Р°Р·Р° СЂР°Р±РѕС‚ РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ Р·Р°С‰РёС‰Р°РµС‚СЃСЏ СЃРЅРёР·Сѓ С‚СЂРµРјСЏ Р±Р°СЂСЊРµСЂР°РјРё: РјРёРЅРёРјСѓРјРѕРј РїРѕ РµРґРёРЅРёС‡РЅС‹Рј СЃС‚Р°РІРєР°Рј, РјРёРЅРёРјСѓРјРѕРј РїРѕ РјР°СЂРєРµСЂСѓ СЃРёСЃС‚РµРјС‹ Рё AI-floor.
          </p>
          <p>Р‘Р°Р·Р° СЂР°Р±РѕС‚ РїРѕ С‚РµРєСѓС‰РµРјСѓ СЂР°СЃС‡РµС‚Сѓ: <strong>{rub(totalWorkBase)}</strong>. РџРѕСЃР»Рµ РЅР°С‡РёСЃР»РµРЅРёР№ Рё РєРѕСЌС„С„РёС†РёРµРЅС‚РѕРІ: <strong>{rub(totalWorkWithCharges)}</strong>.</p>
          <p>
            Р”РµС‚Р°Р»РёР·Р°С†РёСЏ РїРѕ С‚РµРєСѓС‰РµРјСѓ СЂР°СЃС‡РµС‚Сѓ: РЎРњР  <strong>{rub(detailedLaborBreakdown.totalSmr)}</strong>, РџРќР  <strong>{rub(detailedLaborBreakdown.totalPnr)}</strong>,
            РёРЅС‚РµРіСЂР°С†РёСЏ <strong>{rub(detailedLaborBreakdown.totalIntegration)}</strong>, РљРќРЎ <strong>{rub(detailedLaborBreakdown.totalKns)}</strong>.
          </p>
          <p>
            РџРѕСЃР»Рµ РєРѕСЌС„С„РёС†РёРµРЅС‚РѕРІ СѓСЃР»РѕРІРёР№ Рё СЃС‚Р°С‚СѓСЃР° Р·РґР°РЅРёСЏ: <strong>{rub(detailedLaborBreakdown.totalWorkAfterConditions)}</strong>. РќР°С‡РёСЃР»РµРЅРёСЏ:
            РћРџР  <strong>{rub(detailedLaborBreakdown.totalOverhead)}</strong>, Р¤РћРў <strong>{rub(detailedLaborBreakdown.totalPayrollTaxes)}</strong>,
            СѓС‚РёР»РёР·Р°С†РёСЏ <strong>{rub(detailedLaborBreakdown.totalUtilization)}</strong>, РЎРР— <strong>{rub(detailedLaborBreakdown.totalPpe)}</strong>,
            РђРҐР  <strong>{rub(detailedLaborBreakdown.totalAdmin)}</strong>.
          </p>
          <p>
            Р—Р°С‰РёС‚РЅС‹Рµ РїРѕСЂРѕРіРё Р±Р°Р·С‹: РїРѕ РµРґРёРЅРёС‡РЅС‹Рј СЂР°СЃС†РµРЅРєР°Рј <strong>{rub(detailedLaborBreakdown.totalRateFloor)}</strong>, РїРѕ РјР°СЂРєРµСЂСѓ
            <strong> {rub(detailedLaborBreakdown.totalMarkerFloor)}</strong>, AI floor <strong>{rub(detailedLaborBreakdown.totalNeuralFloor)}</strong>.
          </p>
          <div className="aps-ops-header" style={{ marginBottom: 12 }}>
            <span className="hint-inline">Кнопка выгружает все составные элементы стоимости работ: базовые операции, базу начисления, коэффициенты и отдельные начисления по текущему проекту.</span>
            <button className="ghost-btn" type="button" onClick={exportWorkUnitRates} disabled={!workUnitRateRows.length}>
              Р’С‹РіСЂСѓР·РёС‚СЊ С†РµРЅС‹
            </button>
          </div>
          {workUnitRateRows.length ? (
            <div className="table-wrap compact" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>РЎРёСЃС‚РµРјР°</th>
                    <th>РўРёРї СЃС‚СЂРѕРєРё</th>
                    <th>Р“СЂСѓРїРїР°</th>
                    <th>Р’РёРґ СЂР°Р±РѕС‚</th>
                    <th>РљРѕР»-РІРѕ</th>
                    <th>Р•Рґ.</th>
                    <th>Р‘Р°Р·Р° РЅР°С‡РёСЃР»РµРЅРёСЏ</th>
                    <th>Р Р°СЃС†РµРЅРєР°</th>
                    <th>РЎС‚РѕРёРјРѕСЃС‚СЊ СЌР»РµРјРµРЅС‚Р°</th>
                  </tr>
                </thead>
                <tbody>
                  {workUnitRateRows.slice(0, 24).map((row) => (
                    <tr key={row.id}>
                      <td>{row.systemLabel}</td>
                      <td>{row.rowType}</td>
                      <td>{row.workGroup}</td>
                      <td>{row.workType}</td>
                      <td>{num(row.qty, row.unit === "м" || row.unit === "ч" || row.unit === "усл. ед." ? 1 : 0)}</td>
                      <td>{row.unit}</td>
                      <td>{row.rateBase ? rub(row.rateBase) : "—"}</td>
                      <td>{rub(row.rate)}</td>
                      <td>{rub(row.baseAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="logic-equipment-list">
            {ratesDigest.map((item) => (
              <p key={`rates-${item.systemType}`}>
                <strong>{item.systemLabel}:</strong> РјРѕРЅС‚Р°Р¶ РѕСЃРЅРѕРІРЅРѕРіРѕ СЌР»РµРјРµРЅС‚Р° {rub(item.rates.mountPrimary)}, РџРќР  РѕСЃРЅРѕРІРЅРѕРіРѕ СЌР»РµРјРµРЅС‚Р° {rub(item.rates.pnrPrimary)},
                РјРѕРЅС‚Р°Р¶ РєРѕРЅС‚СЂРѕР»Р»РµСЂР° {rub(item.rates.controllerMount)}, РџРќР  Р°РєС‚РёРІРЅРѕРіРѕ СЌР»РµРјРµРЅС‚Р° {rub(item.rates.pnrActiveElement)}, РєР°Р±РµР»СЊ {rub(item.rates.cablePerMeter)}/Рј,
                РљРќРЎ {rub(item.rates.knsPerMeter)}/Рј, РёРЅС‚РµРіСЂР°С†РёСЏ {rub(item.rates.integrationPoint)}/С‚РѕС‡РєР°, РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ {rub(item.rates.designHour)}/С‡Р°СЃ.
                РњРёРЅРёРјР°Р»СЊРЅР°СЏ Р±Р°Р·Р° РїРѕ СЃС‚Р°РІРєР°Рј: x{num(item.guard.minBaseFactor, 2)}, РјРёРЅРёРјР°Р»СЊРЅС‹Р№ РёС‚РѕРі РїРѕ РјР°СЂРєРµСЂСѓ: {rub(item.guard.minFinalPerMarker)}.
              </p>
            ))}
          </div>
        </article>

        <article className="logic-card">
          <h3>6. Risk Guard AI: РєРѕРЅС‚СЂРѕР»СЊ СЃР±Р°Р»Р°РЅСЃРёСЂРѕРІР°РЅРЅРѕСЃС‚Рё</h3>
          <p>Р’ СЂР°СЃС‡РµС‚Рµ РµСЃС‚СЊ РѕС‚РґРµР»СЊРЅС‹Р№ AI-РєРѕРЅС‚СѓСЂ, РєРѕС‚РѕСЂС‹Р№ РїРµСЂРµРїСЂРѕРІРµСЂСЏРµС‚ РЎРњР +РџРќР  РЅРµ С‚РѕР»СЊРєРѕ РЅР° РЅРµРґРѕРѕС†РµРЅРµРЅРЅРѕСЃС‚СЊ, РЅРѕ Рё РЅР° РїРµСЂРµРѕС†РµРЅРµРЅРЅРѕСЃС‚СЊ. РћРЅ Р°РЅР°Р»РёР·РёСЂСѓРµС‚ PDF-override, РєР°Р±РµР»СЊРЅСѓСЋ РЅР°СЃС‹С‰РµРЅРЅРѕСЃС‚СЊ, РљРќРЎ, РїР»РѕС‚РЅРѕСЃС‚СЊ СѓР·Р»РѕРІ, РЅР°Р±РѕСЂ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ, СЂРµРіРёРѕРЅ Рё СѓСЃР»РѕРІРёСЏ СЂР°Р±РѕС‚.</p>
          <p>Р•СЃР»Рё Risk Guard AI РІРёРґРёС‚ РґРёСЃР±Р°Р»Р°РЅСЃ, РѕРЅ РЅРµ РјРµРЅСЏРµС‚ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё, Р° РєРѕСЂСЂРµРєС‚РёСЂСѓРµС‚ Р·Р°С‰РёС‚РЅС‹Рµ РіСЂР°РЅРёС†С‹ СЂР°СЃС‡РµС‚Р° Рё РїРѕРґСЃРєР°Р·С‹РІР°РµС‚, РіРґРµ Р±СЋРґР¶РµС‚ РјРѕР¶РµС‚ Р±С‹С‚СЊ Р·Р°РЅРёР¶РµРЅ РёР»Рё РїРµСЂРµР·Р°Р»РѕР¶РµРЅ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РїР°СЂР°РјРµС‚СЂРѕРІ РѕР±СЉРµРєС‚Р°.</p>
          <p>РџРѕ С‚РµРєСѓС‰РµРјСѓ СЂР°СЃС‡РµС‚Сѓ РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЂРёСЃРє РґРёСЃР±Р°Р»Р°РЅСЃР°: <strong>{num(aiGuard.maxRisk * 100, 0)}%</strong>, СЂРёСЃРє РЅРµРґРѕРѕС†РµРЅРµРЅРЅРѕСЃС‚Рё: <strong>{num(aiGuard.maxUnderpricingRisk * 100, 0)}%</strong>, СЂРёСЃРє РїРµСЂРµРѕС†РµРЅРµРЅРЅРѕСЃС‚Рё: <strong>{num(aiGuard.maxOverpricingRisk * 100, 0)}%</strong>, СЃСѓРјРјР°СЂРЅС‹Р№ СЂС‹РЅРѕС‡РЅС‹Р№ floor: <strong>{rub(aiGuard.totalMarketFloor)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>7. AI-СЂРёСЃРєРё РїСЂРѕРµРєС‚Р°</h3>
          <p>РћС‚РґРµР»СЊРЅС‹Р№ РјРѕРґСѓР»СЊ AI-СЂРёСЃРєРѕРІ РїСЂРѕРµРєС‚Р° РІ СЂРµР°Р»СЊРЅРѕРј РІСЂРµРјРµРЅРё Р°РЅР°Р»РёР·РёСЂСѓРµС‚ РІРµСЃСЊ СЃРѕР±СЂР°РЅРЅС‹Р№ РєРѕРЅС‚СѓСЂ: РѕР±СЉРµРєС‚, Р·РѕРЅРёСЂРѕРІР°РЅРёРµ, СЃРёСЃС‚РµРјС‹, РѕР±СЃР»РµРґРѕРІР°РЅРёРµ, РїСЂРѕРµРєС‚РЅС‹Рµ PDF-РґР°РЅРЅС‹Рµ, СЂС‹РЅРѕС‡РЅС‹Рµ СЃРёРіРЅР°Р»С‹ Рё РѕРіСЂР°РЅРёС‡РµРЅРёСЏ РјРѕРЅС‚Р°Р¶Р°.</p>
          <p>РќР° РІС‹С…РѕРґРµ РѕРЅ РїРѕРєР°Р·С‹РІР°РµС‚ РЅРµ РѕР±С‰РёР№ СЃРїРёСЃРѕРє Р·Р°РјРµС‡Р°РЅРёР№, Р° РґРѕ РїСЏС‚Рё СЃР°РјС‹С… РєСЂРёС‚РёС‡РЅС‹С… РёРЅРґРёРІРёРґСѓР°Р»СЊРЅС‹С… СЂРёСЃРєРѕРІ РёРјРµРЅРЅРѕ РґР»СЏ С‚РµРєСѓС‰РµРіРѕ РїСЂРѕРµРєС‚Р°, С‡С‚РѕР±С‹ Р·Р°СЂР°РЅРµРµ СѓРІРёРґРµС‚СЊ РІРѕР·РјРѕР¶РЅС‹Рµ С‚РѕС‡РєРё СѓРґРѕСЂРѕР¶Р°РЅРёСЏ, СЃРґРІРёРіР° СЃСЂРѕРєРѕРІ Рё РєРѕСЂСЂРµРєС‚РёСЂРѕРІРѕРє СЃРїРµС†РёС„РёРєР°С†РёРё.</p>
          <p>РЎРµР№С‡Р°СЃ РІ РјРѕРґСѓР»Рµ Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅРѕ <strong>{projectRisks.length}</strong> РєСЂРёС‚РёС‡РЅС‹С…/РїРѕРІС‹С€РµРЅРЅС‹С… СЂРёСЃРєР°(РѕРІ).</p>
        </article>

        <article className="logic-card">
          <h3>8. РљРѕСЌС„С„РёС†РёРµРЅС‚С‹ Рё РЅР°С‡РёСЃР»РµРЅРёСЏ</h3>
          <p>РџРѕСЃР»Рµ СЂР°СЃС‡РµС‚Р° Р±Р°Р·С‹ СЂР°Р±РѕС‚ СЃРёСЃС‚РµРјР° РїСЂРёРјРµРЅСЏРµС‚ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ СѓСЃР»РѕРІРёР№ РІС‹РїРѕР»РЅРµРЅРёСЏ, РєРѕСЌС„С„РёС†РёРµРЅС‚ РґРµР№СЃС‚РІСѓСЋС‰РµРіРѕ Р·РґР°РЅРёСЏ Рё СЂРµРіРёРѕРЅР°Р»СЊРЅС‹Р№ РєРѕСЌС„С„РёС†РёРµРЅС‚. Р РµРіРёРѕРЅР°Р»СЊРЅР°СЏ С‡Р°СЃС‚СЊ РѕРіСЂР°РЅРёС‡РµРЅР° floor-Р»РѕРіРёРєРѕР№ Рё РЅРµ РјРѕР¶РµС‚ РёСЃРєСѓСЃСЃС‚РІРµРЅРЅРѕ СѓРґРµС€РµРІРёС‚СЊ С‚СЂСѓРґ РЅРёР¶Рµ Р±Р°Р·С‹.</p>
          <p>РЎРІРѕРґРЅС‹Р№ РєРѕСЌС„С„РёС†РёРµРЅС‚ СѓСЃР»РѕРІРёР№: <strong>{coef(conditionFactor)}</strong>. РќР°С‡РёСЃР»РµРЅРёСЏ: Р¤РћРў {percent(budget.payrollTaxesPercent)}, СѓС‚РёР»РёР·Р°С†РёСЏ {percent(budget.utilizationPercent)}, РЎРР— {percent(budget.ppePercent)}, РђРҐР  {percent(budget.adminPercent)}.</p>
          {appliedObjectCoefficients.length ? (
            <div className="logic-equipment-list">
              {appliedObjectCoefficients.map((item) => (
                <p key={item.key}>
                  <strong>{item.label}:</strong> {coef(item.value)}. {item.reason}
                </p>
              ))}
            </div>
          ) : (
            <p>РџРѕ С‚РµРєСѓС‰РµРјСѓ РѕР±СЉРµРєС‚Сѓ РІСЃРµ СЂСѓС‡РЅС‹Рµ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ СЃС‚РѕСЏС‚ РІ Р±Р°Р·РѕРІРѕРј Р·РЅР°С‡РµРЅРёРё x1.00; РґРѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РїСЂРёРјРµРЅСЏСЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РІСЃС‚СЂРѕРµРЅРЅС‹Рµ Р±Р°Р·РѕРІС‹Рµ РЅР°СЃС‚СЂРѕР№РєРё РјРѕРґРµР»Рё.</p>
          )}
          <p>
            РЎСѓРјРјР° РЅР°С‡РёСЃР»РµРЅРёР№ РїРѕ С‚РµРєСѓС‰РµРјСѓ СЂР°СЃС‡РµС‚Сѓ: <strong>{rub(totalCharges)}</strong>. Р”Рѕ СЂРµРіРёРѕРЅР°Р»СЊРЅРѕРіРѕ РєРѕСЌС„С„РёС†РёРµРЅС‚Р°:
            <strong> {rub(totalWorkBeforeRegion)}</strong>; РїРѕСЃР»Рµ СЂРµРіРёРѕРЅР°Р»СЊРЅРѕРіРѕ РєРѕСЌС„С„РёС†РёРµРЅС‚Р°:
            <strong> {rub(totalWorkWithCharges)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>9. РџСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ</h3>
          <p>РџСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ СЃС‡РёС‚Р°РµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ РїРѕ РєР°Р¶РґРѕР№ СЃРёСЃС‚РµРјРµ РѕС‚ СЂР°СЃС‡РµС‚РЅРѕРіРѕ РѕР±СЉРµРјР° Рё СЃР»РѕР¶РЅРѕСЃС‚Рё. Р”Р°РЅРЅС‹Рµ РѕР±СЉРµРєС‚Р° Рё AI-РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ РєРѕСЂСЂРµРєС‚РёСЂСѓСЋС‚ С‚СЂСѓРґРѕРµРјРєРѕСЃС‚СЊ: СѓС‡РёС‚С‹РІР°СЋС‚СЃСЏ С‚СЂР°СЃСЃС‹, РІС‹СЃРѕС‚С‹, РѕС‚РґРµР»РєР°, РёРЅС‚РµРіСЂР°С†РёРё, РєРѕРѕСЂРґРёРЅР°С†РёСЏ РїРѕ Р·РѕРЅР°Рј Рё СЃСѓС‰РµСЃС‚РІСѓСЋС‰Р°СЏ РёРЅС„СЂР°СЃС‚СЂСѓРєС‚СѓСЂР°.</p>
          <p>Р•СЃР»Рё РїРѕ СЃРёСЃС‚РµРјРµ РµСЃС‚СЊ РїСЂРѕРµРєС‚ РёР»Рё РѕРЅ Р·Р°РіСЂСѓР¶РµРЅ РІРѕ РІРєР»Р°РґРєРµ В«РЎРёСЃС‚РµРјС‹В», СЃС‚РѕРёРјРѕСЃС‚СЊ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ РїРѕ СЌС‚РѕР№ СЃРёСЃС‚РµРјРµ РЅРµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ, Р° РЅР° РІРєР»Р°РґРєРµ В«РџСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµВ» РІС‹РІРѕРґРёС‚СЃСЏ РїРѕРјРµС‚РєР° В«СЃС‚РѕРёРјРѕСЃС‚СЊ РЅРµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ, РїСЂРѕРµРєС‚ РІ РЅР°Р»РёС‡РёРёВ».</p>
          <p>РЎСѓРјРјР°СЂРЅРѕ РїРѕ СЂР°СЃСЃС‡РёС‚С‹РІР°РµРјС‹Рј СЃРёСЃС‚РµРјР°Рј: <strong>{num(totalDesignHours, 1)} С‡</strong>, СЃСЂРµРґРЅСЏСЏ РіСЂСѓРїРїР° <strong>{num(avgDesignTeam, 1)} С‡РµР».</strong>, РјР°РєСЃРёРјР°Р»СЊРЅС‹Р№ СЃСЂРѕРє <strong>{formatDesignDurationExact(maxDesignMonths)}</strong>, СЃС‚РѕРёРјРѕСЃС‚СЊ <strong>{rub(totalDesign)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>10. РС‚РѕРіРѕРІР°СЏ С„РѕСЂРјСѓР»Р° Р±СЋРґР¶РµС‚Р°</h3>
          <p><strong>РС‚РѕРі = РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ + РњР°С‚РµСЂРёР°Р»С‹ + Р Р°Р±РѕС‚С‹ + РџСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ + Р РµРЅС‚Р°Р±РµР»СЊРЅРѕСЃС‚СЊ + РќР”РЎ</strong></p>
          <p>РЎРµР№С‡Р°СЃ: РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ <strong>{rub(totalEquipment)}</strong>, РјР°С‚РµСЂРёР°Р»С‹ <strong>{rub(totalMaterials)}</strong>, СЂР°Р±РѕС‚С‹ <strong>{rub(totals.totalWorks || totals.totalWork || 0)}</strong>, РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ <strong>{rub(totalDesign)}</strong>, РёС‚РѕРі РїСЂРѕРµРєС‚Р° <strong>{rub(totalProject)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>11. Р§С‚Рѕ РїСЂРѕРёСЃС…РѕРґРёС‚ РїСЂРё РёР·РјРµРЅРµРЅРёРё РїР°СЂР°РјРµС‚СЂРѕРІ</h3>
          <p>Р›СЋР±РѕРµ РёР·РјРµРЅРµРЅРёРµ РѕР±СЉРµРєС‚Р°, СЃРёСЃС‚РµРј, РІРµРЅРґРѕСЂР°, PDF-СЃРїРµС†РёС„РёРєР°С†РёРё, С†РµРЅ, РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ РёР»Рё Р±СЋРґР¶РµС‚Р° Р·Р°РїСѓСЃРєР°РµС‚ РїРµСЂРµСЃС‡РµС‚: РѕР±РЅРѕРІР»СЏСЋС‚СЃСЏ РѕР±СЉРµРјС‹, AI-Р°СѓРґРёС‚ С†РµРЅ, РєРѕРЅС‚СѓСЂ СЂРёСЃРєРѕРІ РїСЂРѕРµРєС‚Р°, Р±Р»РѕРє Risk Guard AI Рё РѕР±С‰РёР№ Р±СЋРґР¶РµС‚ РїСЂРѕРµРєС‚Р°.</p>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-logic-${index}`}>
                <strong>{row.systemName}:</strong> РєР°Р±РµР»СЊ {num(row.cable || 0, 1)} Рј, СЂР°Р±РѕС‚С‹ {rub(row.workTotal || 0)}, РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёРµ {row.designSkipped ? "РЅРµ СЂР°СЃСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ" : rub(row.designTotal || 0)}, РёС‚РѕРі {rub(row.total || 0)}.
              </p>
            ))}
            {skippedDesignRows.length ? (
              <p>
                <strong>РЎРёСЃС‚РµРјС‹ СЃ РїСЂРѕРµРєС‚РѕРј:</strong> {skippedDesignRows.map((row) => row.systemName).join(", ")}.
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );

  return repairReactTextTree(content);
}
