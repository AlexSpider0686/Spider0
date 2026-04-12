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
            Детализация по текущему расчету: СМР <strong>{rub(detailedLaborBreakdown.totalSmr)}</strong>, ПНР <strong>{rub(detailedLaborBreakdown.totalPnr)}</strong>,
            интеграция <strong>{rub(detailedLaborBreakdown.totalIntegration)}</strong>, КНС <strong>{rub(detailedLaborBreakdown.totalKns)}</strong>.
          </p>
          <p>
            После коэффициентов условий и статуса здания: <strong>{rub(detailedLaborBreakdown.totalWorkAfterConditions)}</strong>. Начисления:
            ОПР <strong>{rub(detailedLaborBreakdown.totalOverhead)}</strong>, ФОТ/налоги <strong>{rub(detailedLaborBreakdown.totalPayrollTaxes)}</strong>,
            утилизация <strong>{rub(detailedLaborBreakdown.totalUtilization)}</strong>, СИЗ <strong>{rub(detailedLaborBreakdown.totalPpe)}</strong>,
            АХР <strong>{rub(detailedLaborBreakdown.totalAdmin)}</strong>.
          </p>
          <p>
            Защитные пороги базы: по единичным расценкам <strong>{rub(detailedLaborBreakdown.totalRateFloor)}</strong>, по маркеру
            <strong> {rub(detailedLaborBreakdown.totalMarkerFloor)}</strong>, AI floor <strong>{rub(detailedLaborBreakdown.totalNeuralFloor)}</strong>.
          </p>
          <div className="aps-ops-header" style={{ marginBottom: 12 }}>
            <span className="hint-inline">Кнопка выгружает все составные элементы стоимости работ: базовые операции, базу начисления, коэффициенты и отдельные начисления по текущему проекту.</span>
            <button className="ghost-btn" type="button" onClick={exportWorkUnitRates} disabled={!workUnitRateRows.length}>
              Выгрузить цены
            </button>
          </div>
          {workUnitRateRows.length ? (
            <div className="table-wrap compact" style={{ marginBottom: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Система</th>
                    <th>Тип строки</th>
                    <th>Группа</th>
                    <th>Вид работ</th>
                    <th>Кол-во</th>
                    <th>Ед.</th>
                    <th>База начисления</th>
                    <th>Расценка</th>
                    <th>Стоимость элемента</th>
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
                <strong>{item.systemLabel}:</strong> монтаж основного элемента {rub(item.rates.mountPrimary)}, ПНР основного элемента {rub(item.rates.pnrPrimary)},
                монтаж контроллера {rub(item.rates.controllerMount)}, ПНР активного элемента {rub(item.rates.pnrActiveElement)}, кабель {rub(item.rates.cablePerMeter)}/м,
                КНС {rub(item.rates.knsPerMeter)}/м, интеграция {rub(item.rates.integrationPoint)}/точка, проектирование {rub(item.rates.designHour)}/час.
                Минимальная база по ставкам: x{num(item.guard.minBaseFactor, 2)}, минимальный итог по маркеру: {rub(item.guard.minFinalPerMarker)}.
              </p>
            ))}
          </div>
        </article>

        <article className="logic-card">
          <h3>6. Risk Guard AI: контроль сбалансированности</h3>
          <p>В расчете есть отдельный AI-контур, который перепроверяет СМР+ПНР не только на недооцененность, но и на переоцененность. Он анализирует PDF-override, кабельную насыщенность, КНС, плотность узлов, набор оборудования, регион и условия работ.</p>
          <p>Если Risk Guard AI видит дисбаланс, он не меняет коэффициенты автоматически, а корректирует защитные границы расчета и подсказывает, где бюджет может быть занижен или перезаложен относительно параметров объекта.</p>
          <p>По текущему расчету максимальный риск дисбаланса: <strong>{num(aiGuard.maxRisk * 100, 0)}%</strong>, риск недооцененности: <strong>{num(aiGuard.maxUnderpricingRisk * 100, 0)}%</strong>, риск переоцененности: <strong>{num(aiGuard.maxOverpricingRisk * 100, 0)}%</strong>, суммарный рыночный floor: <strong>{rub(aiGuard.totalMarketFloor)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>7. AI-риски проекта</h3>
          <p>Отдельный модуль AI-рисков проекта в реальном времени анализирует весь собранный контур: объект, зонирование, системы, обследование, проектные PDF-данные, рыночные сигналы и ограничения монтажа.</p>
          <p>На выходе он показывает не общий список замечаний, а до пяти самых критичных индивидуальных рисков именно для текущего проекта, чтобы заранее увидеть возможные точки удорожания, сдвига сроков и корректировок спецификации.</p>
          <p>Сейчас в модуле зафиксировано <strong>{projectRisks.length}</strong> критичных/повышенных риска(ов).</p>
        </article>

        <article className="logic-card">
          <h3>8. Коэффициенты и начисления</h3>
          <p>После расчета базы работ система применяет коэффициенты условий выполнения, коэффициент действующего здания и региональный коэффициент. Региональная часть ограничена floor-логикой и не может искусственно удешевить труд ниже базы.</p>
          <p>Сводный коэффициент условий: <strong>{coef(conditionFactor)}</strong>. Начисления: ФОТ {percent(budget.payrollTaxesPercent)}, утилизация {percent(budget.utilizationPercent)}, СИЗ {percent(budget.ppePercent)}, АХР {percent(budget.adminPercent)}.</p>
          {appliedObjectCoefficients.length ? (
            <div className="logic-equipment-list">
              {appliedObjectCoefficients.map((item) => (
                <p key={item.key}>
                  <strong>{item.label}:</strong> {coef(item.value)}. {item.reason}
                </p>
              ))}
            </div>
          ) : (
            <p>По текущему объекту все ручные коэффициенты стоят в базовом значении x1.00; дополнительно применяются только встроенные базовые настройки модели.</p>
          )}
          <p>
            Сумма начислений по текущему расчету: <strong>{rub(totalCharges)}</strong>. До регионального коэффициента:
            <strong> {rub(totalWorkBeforeRegion)}</strong>; после регионального коэффициента:
            <strong> {rub(totalWorkWithCharges)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>9. Проектирование</h3>
          <p>Проектирование считается отдельно по каждой системе от расчетного объема и сложности. Данные объекта и AI-обследования корректируют трудоемкость: учитываются трассы, высоты, отделка, интеграции, координация по зонам и существующая инфраструктура.</p>
          <p>Если по системе есть проект или он загружен во вкладке «Системы», стоимость проектирования по этой системе не рассчитывается, а на вкладке «Проектирование» выводится пометка «стоимость не рассчитывается, проект в наличии».</p>
          <p>Суммарно по рассчитываемым системам: <strong>{num(totalDesignHours, 1)} ч</strong>, средняя группа <strong>{num(avgDesignTeam, 1)} чел.</strong>, максимальный срок <strong>{formatDesignDurationExact(maxDesignMonths)}</strong>, стоимость <strong>{rub(totalDesign)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>10. Итоговая формула бюджета</h3>
          <p><strong>Итог = Оборудование + Материалы + Работы + Проектирование + Рентабельность + НДС</strong></p>
          <p>Сейчас: оборудование <strong>{rub(totalEquipment)}</strong>, материалы <strong>{rub(totalMaterials)}</strong>, работы <strong>{rub(totals.totalWorks || totals.totalWork || 0)}</strong>, проектирование <strong>{rub(totalDesign)}</strong>, итог проекта <strong>{rub(totalProject)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>11. Что происходит при изменении параметров</h3>
          <p>Любое изменение объекта, систем, вендора, PDF-спецификации, цен, обследования или бюджета запускает пересчет: обновляются объемы, AI-аудит цен, контур рисков проекта, блок Risk Guard AI и общий бюджет проекта.</p>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-logic-${index}`}>
                <strong>{row.systemName}:</strong> кабель {num(row.cable || 0, 1)} м, работы {rub(row.workTotal || 0)}, проектирование {row.designSkipped ? "не рассчитывается" : rub(row.designTotal || 0)}, итог {rub(row.total || 0)}.
              </p>
            ))}
            {skippedDesignRows.length ? (
              <p>
                <strong>Системы с проектом:</strong> {skippedDesignRows.map((row) => row.systemName).join(", ")}.
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );

  return repairReactTextTree(content);
}
