import React, { useEffect, useState } from "react";
import { Plus, Trash2, Shield, FileUp, RefreshCcw, Eye, EyeOff, CheckCircle2, Download, BarChart3 } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getManufacturerSource, getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import { getConcreteModel, getEditableModelOptions, resolveModelPriceOverride } from "../lib/equipment";
import { summarizePriceSnapshot } from "../lib/priceCollector";
import { repairReactTextTree } from "../lib/repairReactTree";
import VendorConfigurator from "./VendorConfigurator";

function renderApsImportStatus(status) {
  if (!status) return null;
  if (status.state === "loading") return <p className="hint-inline">Статус: {status.message}</p>;
  if (status.state === "warning") return <p className="warn-inline">Статус: {status.message}</p>;
  if (status.state === "error") return <p className="warn-inline">Статус: {status.message}</p>;
  return <p className="hint-inline">Статус: {status.message}</p>;
}

function renderApsImportProgress(status, elapsedSeconds = 0) {
  if (!status) return null;
  const stages = [
    { key: "parsing", label: "1. Анализ PDF" },
    { key: "pricing", label: "2. Сбор цен" },
    { key: "done", label: "3. Финализация" },
  ];
  const currentIndex = Math.max(
    stages.findIndex((item) => item.key === status.stage),
    status.state === "success" || status.state === "warning" ? 2 : 0
  );

  const progressPercent =
    status.state === "success" || status.state === "warning"
      ? 100
      : status.stage === "pricing"
        ? 72
        : status.stage === "parsing"
          ? 34
          : 12;

  return (
    <>
      <div className="pricing-source-row comparison-summary-row" style={{ marginTop: 8, marginBottom: 8 }}>
      {stages.map((stage, index) => {
        const isCompleted = index < currentIndex || ((status.state === "success" || status.state === "warning") && index === currentIndex);
        const isActive = status.state === "loading" && index === currentIndex;
        const tone = status.state === "error" && index === currentIndex ? "warn" : isCompleted ? "ok" : isActive ? "muted" : "muted";
        return (
          <span className={`pricing-source-chip ${tone}`} key={`${status.stage || status.state}-${stage.key}`}>
            <strong>{stage.label}</strong>
            {isActive ? "..." : ""}
          </span>
        );
      })}
      {status.state === "loading" ? (
        <span className="pricing-source-chip muted">
          <strong>Время:</strong> {elapsedSeconds} сек.
        </span>
      ) : null}
      {status.parsedItems ? (
        <span className="pricing-source-chip ok">
          <strong>Позиции:</strong> {status.parsedItems}
        </span>
      ) : null}
      </div>
      <div style={{ marginTop: 6, marginBottom: 10 }}>
        <div style={{ height: 6, background: "#E6ECE8", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: status.state === "error" ? "#E07A5F" : status.state === "warning" ? "#E0A458" : "#219653",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </>
  );
}

function renderVendorPricingProgress(progress) {
  if (!progress) return null;
  const percent = Math.max(0, Math.min(toNumber(progress.percent, 0), 100));
  const tone =
    progress.state === "error" ? "#E07A5F" : progress.state === "warning" ? "#E0A458" : progress.state === "success" ? "#219653" : "#1E9FC5";

  return (
    <div className="calc-explain" style={{ marginTop: 10 }}>
      <div className="pricing-source-row" style={{ marginBottom: 8 }}>
        <span className={`pricing-source-chip ${progress.state === "error" ? "warn" : progress.state === "warning" ? "muted" : "ok"}`}>
          <strong>Обновление цен</strong>
        </span>
        {progress.total ? (
          <span className="pricing-source-chip muted">
            <strong>Позиции:</strong> {progress.processed || 0} / {progress.total}
          </span>
        ) : null}
      </div>
      <p className={progress.state === "error" ? "warn-inline" : "hint-inline"}>{progress.message}</p>
      <div style={{ marginTop: 8, height: 8, background: "#E6ECE8", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: tone, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function renderComparisonProgress(progress) {
  if (!progress || progress.state !== "loading") return null;
  const percent = Math.max(0, Math.min(toNumber(progress.percent, 0), 100));
  return (
    <div className="calc-explain" style={{ marginTop: 10 }}>
      <div className="pricing-source-row" style={{ marginBottom: 8 }}>
        <span className="pricing-source-chip ok">
          <strong>Сравнение цен</strong>
        </span>
        {progress.total ? (
          <span className="pricing-source-chip muted">
            <strong>Вендоры:</strong> {progress.processed || 0} / {progress.total}
          </span>
        ) : null}
      </div>
      <p className="hint-inline">{progress.message}</p>
      <div style={{ marginTop: 8, height: 8, background: "#E6ECE8", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", background: "#1E9FC5", transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function toHost(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function buildSearchLink(query) {
  const normalized = String(query || "").trim();
  return normalized ? `https://www.tinko.ru/search/?q=${encodeURIComponent(normalized)}` : "";
}

function formatTechnicalSpecPosition(row) {
  const name = String(row?.name || "").trim();
  const model = String(row?.model || "").trim();
  if (!model || !name) return name || model || "вЂ”";
  return name.includes(model) ? name : `${name} (${model})`;
}

function buildSpecModelOptions(system, row) {
  if (!row?.isModelEditable || row?.category !== "equipment") return [];
  const options = getEditableModelOptions(system?.type, system?.vendor, row?.itemCode);
  if (!row?.model || options.some((item) => item.model === row.model)) return options;
  return [{ model: row.model, optionKey: "", basePrice: 0 }, ...options];
}

const TECHNICAL_SOURCE_LABELS = {
  project_pdf: "PDF",
  model_bom: "BOM",
  cable_model: "кабель",
  kns_model: "КНС",
  resource_model: "ресурсы",
  survey_ai: "AI",
  key_equipment: "вендор",
  algorithm: "модель",
};

function resolveKeyEquipmentModel(system, item) {
  const explicitModel = String(item?.model || "").trim();
  if (explicitModel) return explicitModel;

  const selected = system?.selectedEquipmentParams || {};
  const optionMap = {
    CAM: ["camera", `${selected.cameraPlacement}_${selected.cameraResolution}`],
    REC: ["recorder", selected.recorderChannels],
    SW: ["switch", `${selected.switchPorts}_${selected.switchPoe}`],
    CTRL: ["controller", selected.controllerChannels],
    SEN: ["sensor", selected.sensorKind],
    DET: ["detector", selected.detectorKind],
    PANEL: ["panel", selected.panelLoops],
    SPK: ["speaker", selected.speakerKind],
    AMP: ["amplifier", selected.amplifierChannels],
  };

  const [itemType, optionKey] = optionMap[item?.code] || [];
  if (!itemType || optionKey === undefined || optionKey === null || optionKey === "") return "-";
  return getConcreteModel(system?.type, system?.vendor, itemType, optionKey) || "-";
}

function resolveUnrecognizedReason(reason) {
  const map = {
    position_not_found: "не найден номер позиции",
    descriptor_missing: "нет описания позиции",
    qty_or_unit_not_found: "не определены количество или единица измерения",
    validation_failed: "не пройдена валидация строки",
    not_parsed: "строка требует ручной проверки",
  };
  return map[reason] || "строка требует ручной проверки";
}

function formatSelectionStrategy(strategy) {
  const value = String(strategy || "");
  if (value.includes("article_exact_match")) return "точное совпадение артикула";
  if (value.includes("model_token_match")) return "совпадение артикула/модели";
  if (value.includes("luis_api_exact_model")) return "точное совпадение модели (LUIS+ API)";
  if (value.includes("luis_api_model_bias")) return "приоритет по модели (LUIS+ API)";
  if (value.includes("manufacturer_source_bias")) return "приоритет источника производителя";
  if (value.includes("average_all_sources")) return "среднее по доступным источникам";
  return "алгоритм по умолчанию";
}

function buildSourceLinkIndex(result) {
  const entries = Array.isArray(result?.equipmentData?.marketEntries) ? result.equipmentData.marketEntries : [];
  const index = new Map();

  entries.forEach((entry) => {
    const sourceLink = String((entry?.usedSources || [])[0] || "").trim();
    if (!sourceLink) return;
    [entry?.equipmentLabel, entry?.equipmentKey].filter(Boolean).forEach((rawKey) => {
      const key = String(rawKey).trim().toLowerCase();
      if (key && !index.has(key)) {
        index.set(key, sourceLink);
      }
    });
  });

  return index;
}

function resolveEquipmentSourceLink(item, result, system, manufacturerWebsite = "") {
  const ownLink = String((item?.usedSources || [])[0] || item?.sourceUrl || "").trim();
  if (ownLink) return ownLink;

  const linkIndex = buildSourceLinkIndex(result);
  const keys = [item?.name, item?.label, item?.model, item?.code]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  const matched = keys.find((key) => linkIndex.has(key));
  if (matched) return linkIndex.get(matched) || "";

  return "";
}

function buildTechnicalSpecSourceMeta(row, result, system, manufacturerWebsite = "") {
  const directLink = resolveEquipmentSourceLink(row, result, system, manufacturerWebsite);
  if (directLink) {
    return {
      label: toHost(directLink) || "ссылка",
      url: directLink,
    };
  }

  const searchUrl = buildSearchLink(row?.model || row?.name || "");
  const sourceLabel = TECHNICAL_SOURCE_LABELS[row?.source] || (row?.source === "survey_ai" ? "AI" : "—");
  if (searchUrl) {
    return {
      label: `${TECHNICAL_SOURCE_LABELS[row?.source] || "поиск"} / поиск позиции`,
      url: searchUrl,
    };
  }

  return {
    label: sourceLabel,
    url: "",
  };
}

function formatPricingWarning(snapshot) {
  const warning = String(snapshot?.warning || "").trim();
  if (!warning) return "";
  if (warning === "price_collection_unavailable_fallback_mode") {
    return "Сервис сбора цен временно недоступен. Использован резервный режим и fallback-логика.";
  }
  return warning;
}

const APS_MANUAL_UNIT_OPTIONS = ["шт", "компл", "м", "м2", "кг", "л", "уп", "лист"];

function defaultManualDraft() {
  return {
    kind: "equipment",
    name: "",
    model: "",
    unit: "шт",
    qty: 1,
    unitPrice: 0,
  };
}

function formatMultiplier(value) {
  return `x${num(value || 0, 2)}`;
}

function renderWorkCostPopover(result) {
  const laborDetails = result?.laborDetails;
  if (!laborDetails?.unitRates || !laborDetails?.workBreakdown) {
    return <span className="pricing-chip-popover">{"\u0414\u0435\u0442\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u0440\u0430\u0441\u0447\u0435\u0442\u0430 \u0440\u0430\u0431\u043e\u0442 \u043f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u0438\u0442\u043e\u0433\u043e\u0432\u043e\u0433\u043e \u0440\u0430\u0441\u0447\u0435\u0442\u0430 \u0441\u0438\u0441\u0442\u0435\u043c\u044b."}</span>;
  }

  const rates = laborDetails.unitRates;
  const breakdown = laborDetails.workBreakdown;
  const charges = laborDetails.workChargesBeforeRegion || {};
  const chargePercents = laborDetails.chargePercents || {};
  const marketGuard = laborDetails.marketGuard || {};
  const neuralCheck = laborDetails.neuralCheck || {};
  const modelSource = laborDetails.modelSource || {};
  const regionalFactor = Math.max(toNumber(breakdown.regionalFactor, 1), 0.0001);
  const workBase = toNumber(result?.workBase || breakdown.computedWorkBase, 0);
  const workAfterConditions = toNumber(result?.laborBase, 0) / regionalFactor;
  const chargesTotal =
    toNumber(charges.overhead, 0) +
    toNumber(charges.payrollTaxes, 0) +
    toNumber(charges.utilization, 0) +
    toNumber(charges.ppe, 0) +
    toNumber(charges.admin, 0);
  const markerLabel = result?.unitWorkMarker?.label || "marker";
  const markerUnits = Math.max(toNumber(laborDetails.markerUnits, 0), 1);
  const marketFloorBaseByRates = toNumber(marketGuard.marketFloorBaseByRates, 0);
  const marketFloorBaseByMarker = toNumber(marketGuard.marketFloorBaseByMarker, 0);
  const neuralFloorBase = toNumber(neuralCheck.neuralFloorBase, 0);

  return (
    <span className="pricing-chip-popover work-cost-popover">
      <span className="work-cost-popover__section">
        <strong>{"\u041a\u0430\u043a \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0440\u0430\u0431\u043e\u0442"}</strong>
        <span>{"\u0417\u0434\u0435\u0441\u044c \u043f\u043e\u043a\u0430\u0437\u0430\u043d \u043f\u043e\u043b\u043d\u044b\u0439 \u043f\u043e\u0440\u044f\u0434\u043e\u043a \u0440\u0430\u0441\u0447\u0435\u0442\u0430 \u0421\u041c\u0420+\u041f\u041d\u0420: \u043e\u0442 \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0435\u0434\u0438\u043d\u0438\u0447\u043d\u044b\u0445 \u0440\u0430\u0441\u0446\u0435\u043d\u043e\u043a \u0438 \u043e\u0431\u044a\u0435\u043c\u043e\u0432 \u0434\u043e \u043d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0439, \u0440\u0435\u0433\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e\u0433\u043e \u043a\u043e\u044d\u0444\u0444\u0438\u0446\u0438\u0435\u043d\u0442\u0430 \u0438 \u0437\u0430\u0449\u0438\u0442\u044b \u043e\u0442 \u043d\u0435\u0434\u043e\u043e\u0446\u0435\u043d\u043a\u0438."}</span>
        <span>{`\u041f\u0440\u043e\u0435\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044f \u043e\u0442\u0434\u0435\u043b\u044c\u043d\u043e \u043f\u043e \u0441\u0442\u0430\u0432\u043a\u0435 ${rub(rates.designHour)} / \u0447\u0430\u0441 \u0438 \u0432 \u044d\u0442\u0443 \u0441\u0443\u043c\u043c\u0443 \u0440\u0430\u0431\u043e\u0442 \u043d\u0435 \u0432\u0445\u043e\u0434\u0438\u0442.`}</span>
      </span>

      <span className="work-cost-popover__section">
        <strong>{"\u041e\u0442\u043a\u0443\u0434\u0430 \u0431\u0435\u0440\u0443\u0442\u0441\u044f \u0441\u0442\u0430\u0432\u043a\u0438 \u0438 \u043d\u043e\u0440\u043c\u044b"}</strong>
        <span>{`\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0431\u0430\u0437\u043e\u0432\u044b\u0445 \u0440\u0430\u0441\u0446\u0435\u043d\u043e\u043a: ${modelSource.unitRatesConfig || "LABOR_UNIT_RATES / src/config/costModelConfig.js"}.`}</span>
        <span>{"\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u0441\u0442\u0430\u0432\u043a\u0438 \u2014 \u044d\u0442\u043e \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u043d\u044b\u0435 \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0438\u0435 \u0435\u0434\u0438\u043d\u0438\u0447\u043d\u044b\u0435 \u043d\u043e\u0440\u043c\u044b \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u044b; \u043e\u043d\u0438 \u043f\u0440\u0438\u043c\u0435\u043d\u044f\u044e\u0442\u0441\u044f \u043e\u0434\u0438\u043d\u0430\u043a\u043e\u0432\u043e \u0434\u043b\u044f \u0432\u0441\u0435\u0445 \u0440\u0430\u0441\u0447\u0435\u0442\u043e\u0432 \u044d\u0442\u043e\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0438 \u0437\u0430\u0442\u0435\u043c \u043a\u043e\u0440\u0440\u0435\u043a\u0442\u0438\u0440\u0443\u044e\u0442\u0441\u044f \u0443\u0441\u043b\u043e\u0432\u0438\u044f\u043c\u0438 \u043c\u043e\u043d\u0442\u0430\u0436\u0430, \u0440\u0435\u0433\u0438\u043e\u043d\u043e\u043c \u0438 \u0437\u0430\u0449\u0438\u0442\u043d\u044b\u043c\u0438 \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430\u043c\u0438."}</span>
        <span>{`\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0437\u0430\u0449\u0438\u0442\u043d\u044b\u0445 \u043f\u043e\u0440\u043e\u0433\u043e\u0432: ${modelSource.marketGuardConfig || "LABOR_MARKET_GUARDRAILS / src/config/costModelConfig.js"}.`}</span>
        <span>{modelSource.scheduleCalibration || "\u0422\u0440\u0443\u0434\u043e\u0435\u043c\u043a\u043e\u0441\u0442\u044c \u043a\u0430\u043b\u0438\u0431\u0440\u0443\u0435\u0442\u0441\u044f \u0432\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u0435\u0439 \u043c\u043e\u0434\u0435\u043b\u044c\u044e \u0441\u0442\u0430\u0432\u043e\u043a, \u043d\u043e\u0440\u043c \u0438 \u043e\u0431\u044a\u0435\u043c\u043e\u0432."}</span>
      </span>

      <span className="work-cost-popover__section">
        <strong>{"\u0411\u0430\u0437\u043e\u0432\u044b\u0435 \u0435\u0434\u0438\u043d\u0438\u0447\u043d\u044b\u0435 \u0440\u0430\u0441\u0446\u0435\u043d\u043a\u0438 \u0434\u043b\u044f \u044d\u0442\u043e\u0439 \u0441\u0438\u0441\u0442\u0435\u043c\u044b"}</strong>
        <span>{`\u041c\u043e\u043d\u0442\u0430\u0436 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0433\u043e \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430: ${rub(rates.mountPrimary)} / \u0448\u0442; \u041f\u041d\u0420 \u043e\u0441\u043d\u043e\u0432\u043d\u043e\u0433\u043e \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430: ${rub(rates.pnrPrimary)} / \u0448\u0442.`}</span>
        <span>{`\u041c\u043e\u043d\u0442\u0430\u0436 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440\u0430: ${rub(rates.controllerMount)} / \u0448\u0442; \u041f\u041d\u0420 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0433\u043e \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u0430: ${rub(rates.pnrActiveElement)} / \u0448\u0442.`}</span>
        <span>{`\u041a\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0435 \u043b\u0438\u043d\u0438\u0438: ${rub(rates.cablePerMeter)} / \u043c; \u041a\u041d\u0421: ${rub(rates.knsPerMeter)} / \u043c; \u0442\u043e\u0447\u043a\u0430 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438: ${rub(rates.integrationPoint)} / \u0442\u043e\u0447\u043a\u0443.`}</span>
      </span>

      <span className="work-cost-popover__section">
        <strong>{"\u041e\u0431\u044a\u0435\u043c\u044b, \u043a\u043e\u0442\u043e\u0440\u044b\u0435 \u0432\u043e\u0448\u043b\u0438 \u0432 \u0440\u0430\u0441\u0447\u0435\u0442"}</strong>
        <span>{`\u041e\u0441\u043d\u043e\u0432\u043d\u044b\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u044b: ${num(breakdown.primaryUnits, 0)}; \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440\u044b: ${num(breakdown.controllerUnits, 0)}; \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0435 \u044d\u043b\u0435\u043c\u0435\u043d\u0442\u044b \u041f\u041d\u0420: ${num(breakdown.activeElements, 0)}.`}</span>
        <span>{`\u0422\u043e\u0447\u043a\u0438 \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438: ${num(breakdown.integrationPoints, 0)}; \u043a\u0430\u0431\u0435\u043b\u044c: ${num(breakdown.cableLengthM, 1)} \u043c; \u041a\u041d\u0421: ${num(breakdown.knsLengthM, 1)} \u043c; \u0443\u0441\u043b\u043e\u0432\u043d\u044b\u0435 \u0440\u0430\u0431\u043e\u0442\u044b \u043f\u043e \u041a\u041d\u0421: ${num(breakdown.knsWorkUnits, 1)}.`}</span>
        <span>{`\u041c\u0430\u0440\u043a\u0435\u0440 \u043d\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f: \u00ab${markerLabel}\u00bb; \u043a\u043e\u043b\u0438\u0447\u0435\u0441\u0442\u0432\u043e \u043c\u0430\u0440\u043a\u0435\u0440\u043e\u0432 \u0432 \u0440\u0430\u0441\u0447\u0435\u0442\u0435: ${num(markerUnits, 0)}.`}</span>
      </span>

      <span className="work-cost-popover__section">
        <strong>{"\u041f\u043e\u0448\u0430\u0433\u043e\u0432\u0430\u044f \u0444\u043e\u0440\u043c\u0443\u043b\u0430 \u0440\u0430\u0441\u0447\u0435\u0442\u0430"}</strong>
        <span>{`1) \u0421\u041c\u0420 = ${num(breakdown.primaryUnits, 0)} x ${rub(rates.mountPrimary)} + ${num(breakdown.controllerUnits, 0)} x ${rub(rates.controllerMount)} + ${num(breakdown.cableLengthM, 1)} \u043c x ${rub(rates.cablePerMeter)} = ${rub(breakdown.smrBase)}.`}</span>
        <span>{`2) \u041f\u041d\u0420 = ${num(breakdown.primaryUnits, 0)} x ${rub(rates.pnrPrimary)} + ${num(breakdown.activeElements, 0)} x ${rub(rates.pnrActiveElement)} = ${rub(breakdown.pnrBase)}.`}</span>
        <span>{`3) \u0418\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u044f = ${num(breakdown.integrationPoints, 0)} x ${rub(rates.integrationPoint)} = ${rub(breakdown.integrationBase)}.`}</span>
        <span>{`4) \u041a\u041d\u0421 = ${num(breakdown.knsLengthM, 1)} \u043c x ${rub(rates.knsPerMeter)} + ${num(breakdown.knsWorkUnits, 1)} x ${rub(rates.knsPerMeter)} x 0.22 = ${rub(breakdown.knsBase)}.`}</span>
        <span>{`5) \u0420\u0430\u0441\u0447\u0435\u0442\u043d\u0430\u044f \u0431\u0430\u0437\u0430 \u043f\u043e \u0435\u0434\u0438\u043d\u0438\u0447\u043d\u044b\u043c \u0440\u0430\u0441\u0446\u0435\u043d\u043a\u0430\u043c = ${rub(breakdown.computedWorkBase)}.`}</span>
        <span>{`6) \u0417\u0430\u0449\u0438\u0449\u0435\u043d\u043d\u0430\u044f \u0431\u0430\u0437\u0430 = max(\u043f\u0440\u043e\u0435\u043a\u0442\u043d\u0430\u044f ${rub(breakdown.projectWorkBase)}, floor \u043f\u043e \u0441\u0442\u0430\u0432\u043a\u0430\u043c ${rub(marketFloorBaseByRates)}, floor \u043f\u043e \u043c\u0430\u0440\u043a\u0435\u0440\u0443 ${rub(marketFloorBaseByMarker)}, AI floor ${rub(neuralFloorBase)}) = ${rub(workBase)}.`}</span>
        <span>{`7) \u041f\u043e\u0441\u043b\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u0439 \u043c\u043e\u043d\u0442\u0430\u0436\u0430 = ${rub(workBase)} x ${num(breakdown.conditionFactor, 2)} x ${num(breakdown.exploitedFactor, 2)} = ${rub(workAfterConditions)}.`}</span>
        <span>{`8) \u041d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u044f = \u043d\u0430\u043a\u043b\u0430\u0434\u043d\u044b\u0435 ${num(chargePercents.overhead, 0)}% (${rub(charges.overhead)}) + \u043d\u0430\u043b\u043e\u0433\u0438 \u0424\u041e\u0422 ${num(chargePercents.payrollTaxes, 0)}% (${rub(charges.payrollTaxes)}) + \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442/\u0438\u0437\u043d\u043e\u0441 ${num(chargePercents.utilization, 0)}% (${rub(charges.utilization)}) + \u0421\u0418\u0417 ${num(chargePercents.ppe, 0)}% (${rub(charges.ppe)}) + \u0430\u0434\u043c\u0438\u043d ${num(chargePercents.admin, 0)}% (${rub(charges.admin)}) = ${rub(chargesTotal)}.`}</span>
        <span>{`9) \u0414\u043e \u0440\u0435\u0433\u0438\u043e\u043d\u0430 = ${rub(workAfterConditions)} + ${rub(chargesTotal)} = ${rub(laborDetails.workTotalBeforeRegion || 0)}; \u043f\u043e\u0441\u043b\u0435 \u0440\u0435\u0433\u0438\u043e\u043d\u0430 = ${rub(laborDetails.workTotalBeforeRegion || 0)} x ${num(breakdown.regionalFactor, 2)} = ${rub(result?.workTotal || 0)}.`}</span>
      </span>

      <span className="work-cost-popover__section">
        <strong>{"\u0417\u0430\u0449\u0438\u0442\u0430 \u043e\u0442 \u043d\u0435\u0434\u043e\u043e\u0446\u0435\u043d\u043a\u0438"}</strong>
        <span>{`\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u0430\u044f \u0431\u0430\u0437\u0430 \u043f\u043e \u0441\u0442\u0430\u0432\u043a\u0430\u043c = ${rub(breakdown.computedWorkBase)} x ${num(marketGuard.minBaseFactor, 2)} = ${rub(marketFloorBaseByRates)}.`}</span>
        <span>{`\u041c\u0438\u043d\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u0440\u044b\u043d\u043e\u0447\u043d\u044b\u0439 \u0438\u0442\u043e\u0433 \u043f\u043e \u043c\u0430\u0440\u043a\u0435\u0440\u0443 = ${rub(marketGuard.minFinalPerMarker || 0)} x ${num(markerUnits, 0)} \u043c\u0430\u0440\u043a\u0435\u0440\u043e\u0432 = ${rub(marketGuard.marketFloorTotal || 0)} \u043f\u043e\u0441\u043b\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u0439 \u0438 \u0440\u0435\u0433\u0438\u043e\u043d\u0430.`}</span>
        <span>{`AI-\u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0440\u0438\u0441\u043a\u0430 \u043d\u0435\u0434\u043e\u043e\u0446\u0435\u043d\u043a\u0438 = ${num(toNumber(neuralCheck.underestimationRisk, 0) * 100, 0)}%; \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u0435 \u0431\u0430\u0437\u044b = x${num(neuralCheck.neuralUpliftMultiplier || 1, 2)}; AI floor = ${rub(neuralFloorBase)}.`}</span>
        <span>{"\u0412 \u0438\u0442\u043e\u0433 \u0431\u0435\u0440\u0435\u0442\u0441\u044f \u043d\u0435 \u043c\u0438\u043d\u0438\u043c\u0443\u043c, \u0430 \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0438\u0437 \u0432\u0441\u0435\u0445 \u0437\u0430\u0449\u0438\u0442\u043d\u044b\u0445 \u043f\u043e\u0440\u043e\u0433\u043e\u0432, \u0447\u0442\u043e\u0431\u044b \u0441\u043c\u0435\u0442\u0430 \u043d\u0435 \u043f\u0440\u043e\u0432\u0430\u043b\u0438\u0432\u0430\u043b\u0430\u0441\u044c \u043d\u0438\u0436\u0435 \u0440\u0430\u0431\u043e\u0447\u0435\u0433\u043e \u043c\u0438\u043d\u0438\u043c\u0443\u043c\u0430."}</span>
      </span>

      <span className="work-cost-popover__section work-cost-popover__section--accent">
        <strong>{"\u0418\u0442\u043e\u0433 \u0434\u043b\u044f \u0444\u0438\u043d\u0441\u043b\u0443\u0436\u0431\u044b"}</strong>
        <span>{`\u0418\u0442\u043e\u0433\u043e\u0432\u0430\u044f \u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c \u0440\u0430\u0431\u043e\u0442 (\u0421\u041c\u0420+\u041f\u041d\u0420) = ${rub(result?.workTotal || 0)}.`}</span>
        <span>{`\u042d\u0442\u0430 \u0441\u0443\u043c\u043c\u0430 \u043f\u0440\u043e\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u043e\u0442 \u043a\u043e\u043d\u043a\u0440\u0435\u0442\u043d\u044b\u0445 \u0441\u0442\u0430\u0432\u043e\u043a, \u043e\u0431\u044a\u0435\u043c\u043e\u0432, \u043d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u0438\u0439 \u0438 \u043a\u043e\u044d\u0444\u0444\u0438\u0446\u0438\u0435\u043d\u0442\u043e\u0432, \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u043d\u044b\u0445 \u0432\u044b\u0448\u0435.`}</span>
      </span>
    </span>
  );
}

function renderVendorMetricPopover(kind, result) {
  const unitPrice = toNumber(result?.equipmentData?.unitPrice, 0);
  const equipmentCost = toNumber(result?.equipmentCost, 0);
  const markerLabel = result?.unitWorkMarker?.label || "вЂ”";
  const costPerUnit = toNumber(result?.unitWorkMarker?.costPerUnit, 0);
  const selectionKey = result?.equipmentData?.selectionKey || "fallback";
  const modeLabel = result?.estimateMode === "project_pdf" ? "по PDF-проекту" : "по внутренней модели";

  if (kind === "unitPrice") {
    return (
      <span className="pricing-chip-popover work-cost-popover">
        <span className="work-cost-popover__section">
          <strong>Что такое «Ед. цена»</strong>
          <span>Это расчетная стоимость одной базовой единицы оборудования для текущей системы.</span>
        </span>
        <span className="work-cost-popover__section">
          <strong>Как рассчитано сейчас</strong>
          <span>
            Значение {rub(unitPrice)} получено из блока оборудования системы: общий бюджет оборудования {rub(equipmentCost)} сведен к
            базовой единице расчета по текущему профилю вендора, типу системы и найденным рыночным источникам.
          </span>
          <span>
            Ключ выбора: {selectionKey}. Режим расчета: {modeLabel}.
          </span>
        </span>
      </span>
    );
  }

  if (kind === "marker") {
    return (
      <span className="pricing-chip-popover work-cost-popover">
        <span className="work-cost-popover__section">
          <strong>Что такое «Маркер»</strong>
          <span>
            Это опорная единица трудозатрат, по которой система нормирует стоимость работ на одну условную единицу текущей системы.
          </span>
        </span>
        <span className="work-cost-popover__section">
          <strong>Как рассчитано сейчас</strong>
          <span>
            Для этой системы выбран маркер «{markerLabel}». Он определяется алгоритмом по типу системы, составу оборудования и режиму
            расчета, чтобы привести работы к единой сравнимой базе.
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className="pricing-chip-popover work-cost-popover">
      <span className="work-cost-popover__section">
        <strong>Что такое «За единицу»</strong>
        <span>Это стоимость работ в пересчете на один выбранный маркер трудоемкости.</span>
      </span>
      <span className="work-cost-popover__section">
        <strong>Как рассчитано сейчас</strong>
        <span>
          Сейчас показатель равен {num(costPerUnit, 0)} и отражает, сколько рублей работ приходится на один маркер «{markerLabel}».
        </span>
        <span>
          Значение формируется из общей стоимости СМР+ПНР, внутренней модели единичных расценок, поправок условий монтажа и проверки
          рыночным floor.
        </span>
      </span>
    </span>
  );
}

export default function SystemsStep({
  systems,
  addSystem,
  removeSystem,
  updateSystem,
  systemResults,
  refreshVendorPricing,
  refreshAllVendorPricing,
  compareVendorPrices,
  clearVendorComparison,
  vendorPriceSnapshots,
  vendorPricingProgressBySystem,
  vendorComparisonsBySystem,
  canAddMoreSystems,
  importApsProjectPdf,
  cancelApsProjectPdfImport,
  clearApsProjectPdf,
  updateApsProjectItem,
  addApsProjectItem,
  removeApsProjectItemById,
  apsProjectSnapshots,
  apsImportStatuses,
  technicalRecommendations,
  updateTechnicalSpecOverride,
  exportSystemSpecification,
  exportAllSystemsSpecification,
}) {
  const usedTypeMap = new Map(systems.map((item) => [item.id, item.type]));
  const [manualDraftBySystem, setManualDraftBySystem] = useState({});
  const [showUnitAuditBySystem, setShowUnitAuditBySystem] = useState({});
  const [showRecheckBySystem, setShowRecheckBySystem] = useState({});
  const [showCoefficientsBySystem, setShowCoefficientsBySystem] = useState({});
  const [refreshingBySystem, setRefreshingBySystem] = useState({});
  const [comparingBySystem, setComparingBySystem] = useState({});
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [statusNow, setStatusNow] = useState(Date.now());

  useEffect(() => {
    const hasLoading = Object.values(apsImportStatuses || {}).some((status) => status?.state === "loading");
    if (!hasLoading) return undefined;
    const timer = setInterval(() => setStatusNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [apsImportStatuses]);

  const getManualDraft = (systemId) => manualDraftBySystem[systemId] || defaultManualDraft();

  const updateManualDraft = (systemId, key, value) => {
    setManualDraftBySystem((prev) => ({
      ...prev,
      [systemId]: {
        ...(prev[systemId] || defaultManualDraft()),
        [key]: value,
      },
    }));
  };

  const resetManualDraft = (systemId) => {
    setManualDraftBySystem((prev) => ({ ...prev, [systemId]: defaultManualDraft() }));
  };

  const toggleUnitAudit = (systemId) => {
    setShowUnitAuditBySystem((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  };

  const toggleRecheckRows = (systemId) => {
    setShowRecheckBySystem((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  };

  const toggleCoefficients = (systemId) => {
    setShowCoefficientsBySystem((prev) => ({ ...prev, [systemId]: !prev[systemId] }));
  };

  const handleRefresh = async (system) => {
    if (!system?.id || refreshingBySystem[system.id]) return;
    setRefreshingBySystem((prev) => ({ ...prev, [system.id]: true }));
    try {
      await refreshVendorPricing(system);
    } finally {
      setRefreshingBySystem((prev) => ({ ...prev, [system.id]: false }));
    }
  };

  const handleCompare = async (system) => {
    if (!system?.id || comparingBySystem[system.id]) return;
    setComparingBySystem((prev) => ({ ...prev, [system.id]: true }));
    try {
      await compareVendorPrices?.(system.id);
    } finally {
      setComparingBySystem((prev) => ({ ...prev, [system.id]: false }));
    }
  };

  const handleRefreshAll = async () => {
    if (refreshingAll) return;
    setRefreshingAll(true);
    try {
      await refreshAllVendorPricing?.();
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleExportAll = async () => {
    if (exportingAll) return;
    setExportingAll(true);
    try {
      await exportAllSystemsSpecification?.();
    } finally {
      setExportingAll(false);
    }
  };

  const content = (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Системы</h2>
          <p>На одном объекте может быть только одна система каждого вида.</p>
        </div>
        <div className="action-cell" style={{ justifyContent: "flex-end", flexWrap: "wrap", gap: 10 }}>
          <button className="ghost-btn" onClick={handleRefreshAll} type="button" disabled={refreshingAll || !systems.length}>
            <RefreshCcw size={16} /> {refreshingAll ? "Обновляем цены..." : "Обновить цены"}
          </button>
          <button className="ghost-btn" onClick={handleExportAll} type="button" disabled={exportingAll || !systems.length}>
            <Download size={16} /> {exportingAll ? "Готовим файл..." : "Выгрузить спецификацию"}
          </button>
          <button className="primary-btn" onClick={addSystem} type="button" disabled={!canAddMoreSystems}>
            <Plus size={16} /> + Система
          </button>
        </div>
      </div>

      <div className="stack">
        {systems.map((system, index) => {
          const typeMeta = SYSTEM_TYPES.find((item) => item.code === system.type);
          const Icon = typeMeta?.icon || Shield;
          const vendorList = VENDORS[system.type] || ["Базовый"];
          const selectedVendor = getVendorByName(system.type, system.vendor);
          const apsSnapshot = apsProjectSnapshots?.[system.id];
          const result = systemResults[index];
          const keyEquipment = result?.equipmentData?.keyEquipment || [];
          const apsStatus = apsImportStatuses?.[system.id];
          const technicalRecommendation = (technicalRecommendations || []).find((item) => item.systemId === system.id);
          const projectBasedMode = Boolean(apsSnapshot?.active || result?.projectInPlace);
          const snapshot = projectBasedMode ? apsSnapshot?.priceSnapshot || vendorPriceSnapshots?.[system.id] : vendorPriceSnapshots?.[system.id];
          const unitAuditRows = (apsSnapshot?.items || []).filter((item) => (item?.unitAudit?.status || "unknown") !== "match");
          const manufacturerSource = getManufacturerSource(system.type, system.vendor);
            const manufacturerWebsite = manufacturerSource?.website || "";
            const manufacturerHost = toHost(manufacturerWebsite);
            const isRefreshing = Boolean(refreshingBySystem[system.id]);
            const isComparing = Boolean(comparingBySystem[system.id]);
            const isApsImportLoading = apsStatus?.state === "loading";
            const displaySnapshot = isApsImportLoading && !projectBasedMode ? null : snapshot;
            const importElapsedSeconds =
              apsStatus?.startedAt && isApsImportLoading
                ? Math.max(Math.floor((statusNow - new Date(apsStatus.startedAt).getTime()) / 1000), 0)
                : 0;
          const showUnitAudit = Boolean(showUnitAuditBySystem[system.id]);
          const showRecheck = Boolean(showRecheckBySystem[system.id]);
          const showCoefficients = Boolean(showCoefficientsBySystem[system.id]);
          const comparison = vendorComparisonsBySystem?.[system.id];
          const pricingProgress = vendorPricingProgressBySystem?.[system.id];

          const marketMetrics = summarizePriceSnapshot(displaySnapshot);
          const pricedSourceCount = marketMetrics.pricedSourceCount;
          const checkedSourceCount = marketMetrics.checkedSourceCount;
          const checkedSourceHosts = marketMetrics.checkedSourceHosts.slice(0, 10);
          const recheckRequiredCount = marketMetrics.recheckRequiredCount;
          const avgConfidence = marketMetrics.confidencePercent;
          const strategy =
            displaySnapshot?.entries && displaySnapshot.entries.length
              ? displaySnapshot.entries.map((item) => item.selectionStrategy).filter(Boolean).slice(0, 1)[0] || "average_all_sources"
              : "average_all_sources";
          const manufacturerChecked = manufacturerHost ? checkedSourceHosts.includes(manufacturerHost) : false;
          const manufacturerMatchedUrls = manufacturerHost
            ? [
                ...new Set(
                  (displaySnapshot?.entries || [])
                    .flatMap((item) => item.matchedSources || item.usedSources || [])
                    .filter((url) => toHost(url) === manufacturerHost)
                ),
              ]
            : [];
          const manufacturerSuccess = manufacturerMatchedUrls.length > 0;
          const recheckRows = (displaySnapshot?.entries || []).filter((item) => item.recheckRequired);
          const detectedVendor = apsSnapshot?.detectedVendor || apsSnapshot?.vendorName || system.vendor;
          const vendorLockedByProject = Boolean(projectBasedMode && detectedVendor);

          return (
            <div className={`system-card ${projectBasedMode ? "project-based-mode" : ""}`} key={system.id}>
              {/* TOP BLOCK */}
              <div className="system-title">
                <div className="system-badge">
                  <Icon size={16} />
                </div>
                <div>
                  <h3>
                    Система {index + 1}: {typeMeta?.name}
                  </h3>
                  <p>{selectedVendor.description}</p>
                </div>
              </div>

              {/* BODY BLOCK */}
              <div className="system-main-grid system-main-grid-wide">
                <div className="input-card system-control-card">
                  <div className="system-control-grid">
                    <div className="input-card compact">
                      <label>Тип системы</label>
                      <select value={system.type} onChange={(event) => updateSystem(system.id, "type", event.target.value)}>
                        {SYSTEM_TYPES.map((item) => {
                          const usedByOther = [...usedTypeMap.entries()].some(([id, code]) => id !== system.id && code === item.code);
                          return (
                            <option key={item.code} value={item.code} disabled={usedByOther}>
                              {item.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="input-card compact">
                      <label>Вендор</label>
                      {vendorLockedByProject ? (
                        <>
                          <input type="text" value={detectedVendor} readOnly disabled title="Вендор определен автоматически по спецификации из проекта." />
                          <small className="hint-inline">Определен автоматически по спецификации проекта</small>
                        </>
                      ) : null}
                      <select
                        value={system.vendor}
                        onChange={(event) => updateSystem(system.id, "vendor", event.target.value)}
                        disabled={projectBasedMode}
                        style={vendorLockedByProject ? { display: "none" } : undefined}
                        title="Вендор влияет на ценовой профиль, коэффициенты и итог системы. Базовый вендор применяйте, если бренд еще не выбран и нужна нейтральная рыночная оценка."
                      >
                        {vendorList.map((vendor) => (
                          <option key={vendor} value={vendor}>
                            {vendor}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="input-card compact">
                      <div className="label-with-tooltip">
                        <label>Кастомный индекс</label>
                        <span className="label-tooltip-help">?</span>
                        <div className="label-tooltip-popover">
                          <p>
                            Кастомный индекс корректирует ценовой профиль выбранного вендора для конкретного объекта. Значение больше
                            1.00 повышает стоимость, меньше 1.00 снижает.
                          </p>
                          <p>Параметр учитывается при расчёте стоимости оборудования и зависящих от него работ этой системы.</p>
                        </div>
                      </div>
                      <input
                        type="number"
                        min="0.5"
                        max="3"
                        step="0.01"
                        value={system.customVendorIndex}
                        onChange={(event) => updateSystem(system.id, "customVendorIndex", toNumber(event.target.value, 1))}
                      />
                    </div>
                  </div>
                  <div className="comparison-trigger-row">
                    <div className="input-card compact comparison-trigger-card">
                        <label>Сравнение цен</label>
                      <button className="ghost-btn comparison-trigger-btn" type="button" onClick={() => handleCompare(system)} disabled={isComparing}>
                        <BarChart3 size={16} />
                        {isComparing ? "Собираем цены..." : "Сравнить 3 вендора"}
                      </button>
                      <small className="hint-inline">Сравниваются текущий вендор и две реальные альтернативы без базового профиля.</small>
                    </div>
                  </div>
                </div>

                <div className="vendor-hint vendor-hint-lg">
                  <div className="vendor-hint-top">
                    <p className="vendor-kpi">
                      <span className="pricing-chip-tooltip">
                        <span>Ед. цена:</span>
                        {renderVendorMetricPopover("unitPrice", result)}
                      </span>{" "}
                      <strong>{rub(result?.equipmentData?.unitPrice || 0)}</strong>
                    </p>
                    <p className="vendor-kpi">
                      <span className="pricing-chip-tooltip">
                        <span>Маркер:</span>
                        {renderVendorMetricPopover("marker", result)}
                      </span>{" "}
                      <strong>{result?.unitWorkMarker?.label || "вЂ”"}</strong>
                    </p>
                    <p className="vendor-kpi">
                      <span className="pricing-chip-tooltip">
                        <span>За единицу:</span>
                        {renderVendorMetricPopover("costPerUnit", result)}
                      </span>{" "}
                      <strong>{num(result?.unitWorkMarker?.costPerUnit || 0, 0)}</strong>
                    </p>
                  </div>

                  <div className="vendor-hint-mid">
                    <div>
                      <span>Оборудование</span>
                      <strong>{rub(result?.equipmentCost || 0)}</strong>
                    </div>
                    <div>
                      <span className="pricing-chip-tooltip">
                        <span>Стоимость работ (СМР+ПНР)</span>
                        {renderWorkCostPopover(result)}
                      </span>
                      <strong>{rub(result?.workTotal || 0)}</strong>
                    </div>
                    <div>
                      <span>Материалы</span>
                      <strong>{rub(result?.materialCost || 0)}</strong>
                    </div>
                  </div>

                  <div className="vendor-hint-footer">
                    <p>Ключ выбора: {result?.equipmentData?.selectionKey || "fallback"}</p>
                    <p>Режим: {result?.estimateMode === "project_pdf" ? "по PDF-проекту" : "по внутренней модели"}</p>
                    <button className="ghost-btn" type="button" onClick={() => handleRefresh(system)} disabled={isRefreshing}>
                      <RefreshCcw size={14} className={isRefreshing ? "spin" : ""} /> {isRefreshing ? "Обновление..." : "Обновить цены"}
                    </button>
                  </div>
                </div>
              </div>

              {pricingProgress ? renderVendorPricingProgress(pricingProgress) : null}
              {comparison?.state === "loading" ? renderComparisonProgress(comparison) : null}

              {comparison ? (
                <div className="subpanel comparison-panel">
                  <div className="subpanel-header">
                    <div>
                      <h3>Сравнение цен по вендорам</h3>
                      <p>Сравнение учитывает цены оборудования, материалы, работы, проектирование и итог по системе.</p>
                    </div>
                  </div>

                  {comparison.state === "loading" ? <p className="hint-inline">{comparison.message}</p> : null}
                  {comparison.state === "error" ? <p className="warn-inline">{comparison.message}</p> : null}

                  {comparison.state === "success" && comparison.rows?.length ? (
                    <>
                      <div className="pricing-source-row comparison-summary-row">
                        <span className="pricing-source-chip ok">
                          <strong>Текущий вендор:</strong> {comparison.currentVendor}
                        </span>
                        <span className="pricing-source-chip">
                          <strong>Строк в сравнении:</strong> {comparison.rows.length}
                        </span>
                        <span className="pricing-source-chip muted">
                          <strong>PPTX:</strong> таблица будет включена в выгрузку
                        </span>
                        <button className="ghost-btn" type="button" onClick={() => clearVendorComparison(system.id)}>
                          Скрыть сравнение цен
                        </button>
                      </div>

                      <div className="table-wrap compact comparison-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Роль</th>
                              <th>Вендор</th>
                              <th>Оборудование</th>
                              <th>Материалы</th>
                              <th>Итог</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparison.rows.map((row) => (
                              <tr key={`${system.id}-${row.vendor}`}>
                                <td>{row.role}</td>
                                <td>{row.vendor}</td>
                                <td>{rub(row.equipmentCost)}</td>
                                <td>{rub(row.materialCost)}</td>
                                <td>
                                  <strong>{rub(row.total)}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {displaySnapshot ? (
                <div className="pricing-caption">
                  <div className="pricing-source-row">
                    <span className="pricing-chip-tooltip">
                      <span className="pricing-source-chip">
                      <strong>Проверено источников:</strong> {checkedSourceCount}
                      </span>
                      <span className="pricing-chip-popover">
                        Это число источников, которые система реально опросила при поиске стоимости по текущей системе:
                        поставщики, торговые площадки и сайт выбранного производителя. Метрика показывает ширину
                        проверки рынка по текущему запросу.
                      </span>
                    </span>
                    <span className="pricing-chip-tooltip">
                      <span className={`pricing-source-chip ${pricedSourceCount > 0 ? "ok" : "warn"}`}>
                        <strong>Источники с найденной ценой:</strong> {pricedSourceCount}
                      </span>
                      <span className="pricing-chip-popover">
                        Это число источников, где удалось найти пригодную цену по сопоставленной позиции. Чем больше
                        таких источников, тем устойчивее средняя рыночная цена и тем меньше риск опоры на единичное
                        значение.
                      </span>
                    </span>
                    <span className="pricing-chip-tooltip">
                      <span className={`pricing-source-chip ${manufacturerSuccess ? "ok" : manufacturerChecked ? "warn" : "muted"}`}>
                        <strong>Сайт производителя:</strong> {manufacturerHost || "не задан"} ·{" "}
                        {manufacturerSuccess ? "цены найдены" : manufacturerChecked ? "сайт опрошен, цен нет" : "не опрошен"}
                      </span>
                      <span className="pricing-chip-popover">
                        Здесь показывается статус опроса сайта производителя выбранного вендора. Если цена найдена,
                        она участвует в рыночной выборке. Если сайт только опрошен, но цена не получена, система
                        использует найденные значения у поставщиков и fallback-логику.
                      </span>
                    </span>
                    <span className="pricing-chip-tooltip">
                      <span className={`pricing-source-chip ${recheckRequiredCount ? "warn" : "ok"}`}>
                        <strong>Требуют перепроверки:</strong> {recheckRequiredCount}
                      </span>
                      <span className="pricing-chip-popover">
                        Это количество позиций, по которым система нашла признаки неточного сопоставления:
                        спорная модель, расхождение единиц измерения, несколько возможных совпадений или низкая
                        уверенность в распознавании. Такие позиции лучше вручную проверить перед финальным расчётом.
                      </span>
                    </span>
                    <span className="pricing-chip-tooltip">
                      <span className="pricing-source-chip muted">
                        <strong>Стратегия:</strong> {formatSelectionStrategy(strategy)}
                      </span>
                      <span className="pricing-chip-popover">
                        Это правило, по которому система выбрала итоговую цену: среднее по рынку, опора на PDF-проект,
                        fallback по базовой модели или смешанный сценарий. Метрика помогает понять, из какого режима
                        получена текущая стоимость.
                      </span>
                    </span>
                    <span className="pricing-chip-tooltip">
                      <span className="pricing-source-chip muted">
                        <strong>Уверенность:</strong> {num(avgConfidence * 100, 0)}%
                      </span>
                      <span className="pricing-chip-popover">
                        Это сводная оценка того, насколько надёжно система распознала позиции и сопоставила их с
                        рыночными источниками. Чем выше процент, тем меньше спорных мест в наименованиях, моделях,
                        единицах измерения и найденных ценах.
                      </span>
                    </span>
                  </div>
                  {snapshot.warning ? <span className="warn-inline"> {formatPricingWarning(snapshot)}</span> : null}
                  {!snapshot.warning && snapshot.error ? <span className="warn-inline"> Ошибка API: {snapshot.error}</span> : null}
                </div>
              ) : null}

              {recheckRequiredCount ? (
                <div className="calc-explain">
                  <div className="aps-ops-header">
                  <h4>Спорные позиции</h4>
                    <button className="ghost-btn" type="button" onClick={() => toggleRecheckRows(system.id)}>
                      {showRecheck ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showRecheck ? "Скрыть спорные позиции" : "Показать спорные позиции"}
                    </button>
                  </div>
                  {showRecheck ? (
                    <div className="table-wrap compact">
                      <table>
                        <thead>
                          <tr>
                              <th>Позиция</th>
                              <th>Наименование</th>
                              <th>Цена</th>
                              <th>Уверенность</th>
                              <th>Причина</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recheckRows.map((item) => (
                            <tr key={`${system.id}-recheck-${item.key}`}>
                              <td>{item.position || item.key || "—"}</td>
                              <td>{item.equipmentLabel || item.model || item.name || "Позиция"}</td>
                              <td>{rub(item.price || 0)}</td>
                              <td>{num((item.priceConfidence || 0) * 100, 0)}%</td>
                              <td>{item.recheckReason || "Нужна ручная перепроверка сопоставления и цены"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {true ? (
                <div className="calc-explain aps-import-card">
                  <h4>Импорт проектной спецификации системы (PDF)</h4>
                  <p className="hint-inline">
                    Если PDF-проект загружен, расчёт по этой системе выполняется по спецификации проекта. Внутренние алгоритмы подбора объёмов для этой системы больше не формируют состав оборудования и материалов, а используются только как резервный контур там, где проектных данных нет.
                  </p>
                  <p className="hint-inline">Для АПС дополнительно применяется профиль СПДС/ГОСТ 21.110-2013 и AI-уточнение строк. Для остальных систем загруженная PDF-спецификация также получает приоритет над алгоритмическим расчётом.</p>

                  <div className="aps-import-actions">
                    <label
                      className="ghost-btn file-upload-btn"
                      htmlFor={isApsImportLoading ? undefined : `aps-pdf-${system.id}`}
                      style={isApsImportLoading ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                      aria-disabled={isApsImportLoading}
                    >
                      <FileUp size={14} /> Загрузить PDF
                    </label>
                    <input
                      id={`aps-pdf-${system.id}`}
                      className="file-upload-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={isApsImportLoading}
                      onChange={async (event) => {
                        if (isApsImportLoading) {
                          event.target.value = "";
                          return;
                        }
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          await importApsProjectPdf(system.id, file);
                        } catch {
                          // Ошибка отображается через apsImportStatuses.
                        } finally {
                          event.target.value = "";
                        }
                      }}
                    />
                    {apsSnapshot ? (
                      <button className="danger-btn" type="button" onClick={() => clearApsProjectPdf(system.id)} disabled={isApsImportLoading}>
                        Очистить проект
                      </button>
                    ) : null}
                    {isApsImportLoading ? (
                      <button className="ghost-btn" type="button" onClick={() => cancelApsProjectPdfImport(system.id)}>
                        Отменить обработку
                      </button>
                    ) : null}
                  </div>

                  {renderApsImportProgress(apsStatus, importElapsedSeconds)}
                  {renderApsImportStatus(apsStatus)}
                  {apsStatus?.state === "warning" && !apsStatus?.cancelled ? (
                    <p className="hint-inline">
                      Обработка завершена в резервном режиме: PDF распознан, но часть или все цены подставлены из fallback-логики.
                    </p>
                  ) : null}
                  {apsSnapshot?.gostStandard ? <p className="hint-inline">Стандарт PDF: {apsSnapshot.gostStandard}</p> : null}

                  {apsSnapshot ? (
                    <>
                      <div className="summary-grid breakdown-metrics">
                        <div className="metric-card">
                          <span>Файл проекта</span>
                          <strong>{apsSnapshot.fileName}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Позиции в спецификации</span>
                          <strong>{num(apsSnapshot.items.length, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Позиции с ценой поставщика</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithSupplierPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Позиции без цены</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithoutPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Нераспознанные строки</span>
                          <strong>{num(apsSnapshot.sourceStats.unresolvedPositions, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Точность распознавания</span>
                          <strong>{num((apsSnapshot.sourceStats.recognitionRate || 0) * 100, 1)}%</strong>
                        </div>
                        <div className="metric-card">
                          <span>Кабель (из проекта/модели)</span>
                          <strong>{num(apsSnapshot.metrics?.cableLengthM || 0, 1)} м</strong>
                        </div>
                        <div className="metric-card">
                          <span>Крепеж (из проекта/модели)</span>
                          <strong>{num(apsSnapshot.metrics?.fastenerQty || 0, 0)} шт</strong>
                        </div>
                      </div>

                      <div className="calc-explain">
                        <h4>РџРѕР»РЅС‹Р№ РїРµСЂРµС‡РµРЅСЊ СЂР°СЃРїРѕР·РЅР°РЅРЅРѕРіРѕ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Рё РјР°С‚РµСЂРёР°Р»РѕРІ РёР· СЃРїРµС†РёС„РёРєР°С†РёРё</h4>
                        <p className="hint-inline">
                          Р’ С‚Р°Р±Р»РёС†Рµ РЅРёР¶Рµ РІС‹РІРѕРґСЏС‚СЃСЏ РІСЃРµ РїРѕР·РёС†РёРё, РєРѕС‚РѕСЂС‹Рµ AI-РјРѕРґСѓР»СЊ СЂР°СЃРїРѕР·РЅР°Р» РїРѕ Р·Р°РіСЂСѓР¶РµРЅРЅРѕР№ СЃРїРµС†РёС„РёРєР°С†РёРё, РІРєР»СЋС‡Р°СЏ
                          РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ, РјР°С‚РµСЂРёР°Р»С‹, РєР°Р±РµР»СЊРЅС‹Рµ РїРѕР·РёС†РёРё Рё РІСЂСѓС‡РЅСѓСЋ РґРѕР±Р°РІР»РµРЅРЅС‹Рµ СЃС‚СЂРѕРєРё.
                        </p>
                      </div>

                      <div className="table-wrap compact">
                        <table>
                          <thead>
                            <tr>
                              <th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th>
                              <th>РњР°СЂРєР°/РјРѕРґРµР»СЊ</th>
                              <th>РљР°С‚РµРіРѕСЂРёСЏ</th>
                              <th>РљРѕР»-РІРѕ</th>
                              <th>Р¦РµРЅР°, в‚Ѕ</th>
                              <th>Р•Рґ. РїСЂРѕРµРєС‚/РїРѕСЃС‚Р°РІС‰РёРє</th>
                              <th>РЎСѓРјРјР°</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {apsSnapshot.items.map((item) => (
                              <tr key={`${system.id}-aps-item-${item.id}`}>
                                <td>
                                  <div className="aps-item-title">
                                    <span>{item.name}</span>
                                    {item.position ? <small>РџСѓРЅРєС‚ СЃРїРµС†РёС„РёРєР°С†РёРё {item.position}</small> : null}
                                  </div>
                                </td>
                                <td>{item.model || item.brand || "вЂ”"}</td>
                                <td>{item.category}</td>
                                <td>
                                  <div className="table-edit-cell">
                                    <input
                                      className="table-number-input"
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={item.qty}
                                      onChange={(event) => updateApsProjectItem(system.id, item.id, { qty: event.target.value })}
                                    />
                                    <span>{item.unit}</span>
                                  </div>
                                </td>
                                <td>
                                  <input
                                    className="table-number-input"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={item.unitPrice}
                                    onChange={(event) => updateApsProjectItem(system.id, item.id, { unitPrice: event.target.value })}
                                  />
                                </td>
                                <td>
                                  <span className={`unit-audit-badge ${item?.unitAudit?.status || "unknown"}`}>
                                    {item?.unitAudit?.message || "РЅРµС‚ РґР°РЅРЅС‹С…"}
                                  </span>
                                </td>
                                <td>{rub(item.total)}</td>
                                <td>
                                  <button
                                    className="table-action-btn"
                                    type="button"
                                    onClick={() => removeApsProjectItemById(system.id, item.id)}
                                    title="РЈРґР°Р»РёС‚СЊ РїРѕР·РёС†РёСЋ"
                                  >
                                    РЈРґР°Р»РёС‚СЊ
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="calc-explain">
                        <h4>Р”РѕР±Р°РІРёС‚СЊ РїРѕР·РёС†РёСЋ РІСЂСѓС‡РЅСѓСЋ</h4>
                        <div className="manual-item-grid">
                          <div className="input-card">
                            <label>РўРёРї</label>
                            <select
                              value={getManualDraft(system.id).kind}
                              onChange={(event) => updateManualDraft(system.id, "kind", event.target.value)}
                            >
                              <option value="equipment">РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ</option>
                              <option value="material">РњР°С‚РµСЂРёР°Р»</option>
                            </select>
                          </div>
                          <div className="input-card">
                            <label>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</label>
                            <input
                              type="text"
                              value={getManualDraft(system.id).name}
                              onChange={(event) => updateManualDraft(system.id, "name", event.target.value)}
                              placeholder="Р’РІРµРґРёС‚Рµ РїРѕР·РёС†РёСЋ"
                            />
                          </div>
                          <div className="input-card">
                            <label>РњР°СЂРєР°/РјРѕРґРµР»СЊ</label>
                            <input
                              type="text"
                              value={getManualDraft(system.id).model}
                              onChange={(event) => updateManualDraft(system.id, "model", event.target.value)}
                              placeholder="РњРѕРґРµР»СЊ"
                            />
                          </div>
                          <div className="input-card">
                            <label>Р•Рґ. РёР·Рј</label>
                            <select
                              value={getManualDraft(system.id).unit}
                              onChange={(event) => updateManualDraft(system.id, "unit", event.target.value)}
                            >
                              {APS_MANUAL_UNIT_OPTIONS.map((unitValue) => (
                                <option key={`${system.id}-manual-unit-${unitValue}`} value={unitValue}>
                                  {unitValue}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="input-card">
                            <label>РљРѕР»РёС‡РµСЃС‚РІРѕ</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={getManualDraft(system.id).qty}
                              onChange={(event) => updateManualDraft(system.id, "qty", event.target.value)}
                            />
                          </div>
                          <div className="input-card">
                            <label>Р¦РµРЅР°, в‚Ѕ</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={getManualDraft(system.id).unitPrice}
                              onChange={(event) => updateManualDraft(system.id, "unitPrice", event.target.value)}
                            />
                          </div>
                          <div className="manual-item-actions">
                            <button
                              className="primary-btn"
                              type="button"
                              onClick={() => {
                                const draft = getManualDraft(system.id);
                                if (!String(draft.name || "").trim()) return;
                                addApsProjectItem(system.id, draft);
                                resetManualDraft(system.id);
                              }}
                            >
                              Р”РѕР±Р°РІРёС‚СЊ РїРѕР·РёС†РёСЋ
                            </button>
                          </div>
                        </div>
                      </div>

                      {apsSnapshot.itemsWithoutPrice?.length ? (
                        <div className="calc-explain">
                          <h4>РџРѕР·РёС†РёРё Р±РµР· РЅР°Р№РґРµРЅРЅРѕР№ С†РµРЅС‹ РїРѕСЃС‚Р°РІС‰РёРєР°</h4>
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>РџРѕР·.</th>
                                  <th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th>
                                  <th>РњР°СЂРєР°/РјРѕРґРµР»СЊ</th>
                                  <th>РљРѕР»-РІРѕ</th>
                                  <th>РџСЂРёС‡РёРЅР°</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apsSnapshot.itemsWithoutPrice.map((item) => (
                                  <tr key={`${system.id}-no-price-${item.id}`}>
                                    <td>{item.position || "вЂ”"}</td>
                                    <td>{item.name}</td>
                                    <td>{item.model || "вЂ”"}</td>
                                    <td>
                                      {num(item.qty, 0)} {item.unit}
                                    </td>
                                    <td>{item.reason}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      {apsSnapshot.unrecognizedRows?.length ? (
                        <div className="calc-explain">
                          <h4>РќРµСЂР°СЃРїРѕР·РЅР°РЅРЅС‹Рµ РїРѕР·РёС†РёРё PDF (С‚СЂРµР±СѓСЋС‚ РїСЂРѕРІРµСЂРєРё)</h4>
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>РџРѕР·.</th>
                                  <th>РЎС‚СЂРѕРєР° РёР· PDF</th>
                                  <th>РџСЂРёС‡РёРЅР°</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apsSnapshot.unrecognizedRows.map((row) => (
                                  <tr key={`${system.id}-unrecognized-${row.id}`}>
                                    <td>{row.position || "вЂ”"}</td>
                                    <td>{row.rawLine}</td>
                                    <td>{resolveUnrecognizedReason(row.reason)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}

                      <div className="calc-explain aps-ops-card">
                        <div className="aps-ops-header">
                          <h4>РўСЂСѓРґРѕРµРјРєРѕСЃС‚СЊ, РїСЂРѕРІРµСЂРєР° РµРґРёРЅРёС†, РєР°Р±РµР»СЊ Рё РєСЂРµРїРµР¶</h4>
                          <button className="ghost-btn" type="button" onClick={() => toggleUnitAudit(system.id)}>
                            {showUnitAudit ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showUnitAudit ? "РЎРєСЂС‹С‚СЊ РїСЂРѕРІРµСЂРєСѓ РµРґРёРЅРёС†" : "РџРѕРєР°Р·Р°С‚СЊ РїСЂРѕРІРµСЂРєСѓ РµРґРёРЅРёС†"}
                          </button>
                        </div>

                        <div className="equipment-principles">
                          <p>
                            <strong>РўСЂСѓРґРѕРµРјРєРѕСЃС‚СЊ РЎРњР +РџРќР :</strong> {num(apsSnapshot.labor.executionHoursBase, 1)} С‡; Р±СЂРёРіР°РґР°{" "}
                            {num(apsSnapshot.labor.crewSize, 0)} С‡РµР».; СЃСЂРѕРє {num(apsSnapshot.labor.executionDays, 0)} СЂР°Р±. РґРЅРµР№.
                          </p>
                          <p>
                            <strong>РўСЂСѓРґРѕРµРјРєРѕСЃС‚СЊ РїСЂРѕРµРєС‚РёСЂРѕРІР°РЅРёСЏ:</strong> {num(apsSnapshot.labor.designHoursBase, 1)} С‡; РіСЂСѓРїРїР°{" "}
                            {num(apsSnapshot.labor.designTeamSize, 0)} С‡РµР».; СЃСЂРѕРє {num(apsSnapshot.labor.designMonths, 0)} РјРµСЃ.
                          </p>
                          <p>
                            <strong>РџСЂРѕРІРµСЂРєР° РµРґРёРЅРёС†:</strong> СЃРѕРІРїР°Р»Рѕ {num(apsSnapshot.sourceStats.unitMatch, 0)}, С‚СЂРµР±СѓРµС‚СЃСЏ РїСЂРѕРІРµСЂРєР°{" "}
                            {num(apsSnapshot.sourceStats.unitMismatch, 0)}, Р±РµР· РґР°РЅРЅС‹С… {num(apsSnapshot.sourceStats.unitUnknown, 0)}.
                          </p>
                          <p>
                            <strong>РљР°Р±РµР»СЊ Рё РєСЂРµРїРµР¶:</strong> РєР°Р±РµР»СЊ {num(apsSnapshot.metrics?.cableLengthM || 0, 1)} Рј, Р»РёРЅРёР№{" "}
                            {num(apsSnapshot.metrics?.cableLines || 0, 0)}; РєСЂРµРїРµР¶ {num(apsSnapshot.metrics?.fastenerQty || 0, 0)} С€С‚, РїРѕР·РёС†РёР№{" "}
                            {num(apsSnapshot.metrics?.fastenerLines || 0, 0)}.
                          </p>
                        </div>

                        {showUnitAudit && unitAuditRows.length ? (
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>РџРѕР·.</th>
                                  <th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th>
                                  <th>Р•Рґ. РїСЂРѕРµРєС‚Р°</th>
                                  <th>Р•Рґ. РїРѕСЃС‚Р°РІС‰РёРєР°</th>
                                  <th>РЎС‚Р°С‚СѓСЃ</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unitAuditRows.map((item) => (
                                  <tr key={`${system.id}-unit-audit-${item.id}`}>
                                    <td>{item.position || "вЂ”"}</td>
                                    <td>{item.name}</td>
                                    <td>{item?.unitAudit?.projectUnit || item.unit || "вЂ”"}</td>
                                    <td>{item?.unitAudit?.supplierUnits?.join(", ") || "РЅРµС‚ РґР°РЅРЅС‹С…"}</td>
                                    <td>
                                      <span className={`unit-audit-badge ${item?.unitAudit?.status || "unknown"}`}>
                                        {item?.unitAudit?.message || "С‚СЂРµР±СѓРµС‚СЃСЏ РїСЂРѕРІРµСЂРєР°"}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {!projectBasedMode ? (
                <VendorConfigurator
                  system={system}
                  projectBasedMode={false}
                  onChange={(key, value) =>
                    updateSystem(system.id, "selectedEquipmentParams", {
                      ...(system.selectedEquipmentParams || {}),
                      [key]: value,
                    })
                  }
                />
              ) : null}

              <div className="system-subgrid">
                <div className="calc-explain">
                  <div className="aps-ops-header">
                    <h4>РљРѕСЌС„С„РёС†РёРµРЅС‚С‹ СЃРёСЃС‚РµРјС‹</h4>
                    <button className="ghost-btn" type="button" onClick={() => toggleCoefficients(system.id)}>
                      {showCoefficients ? "РЎРєСЂС‹С‚СЊ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹" : "РџРѕРєР°Р·Р°С‚СЊ РєРѕСЌС„С„РёС†РёРµРЅС‚С‹"}
                    </button>
                  </div>
                  {showCoefficients ? (
                    <div className="coeff-list">
                      {(result?.coefficientInsights || []).map((item) => (
                        <div className="coeff-item" key={`${system.id}-${item.key}`}>
                          <div className="coeff-head">
                            <strong>{item.label}</strong>
                            <span>x{num(item.value, 2)}</span>
                          </div>
                          <p>{item.useCase}</p>
                          <small>{item.recommended}</small>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="hint-inline">РљРѕСЌС„С„РёС†РёРµРЅС‚С‹ СЃРєСЂС‹С‚С‹ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ. РќР°Р¶РјРёС‚Рµ РєРЅРѕРїРєСѓ РІС‹С€Рµ, С‡С‚РѕР±С‹ СЂР°СЃРєСЂС‹С‚СЊ СЂР°СЃС‡РµС‚РЅС‹Рµ РїРѕРїСЂР°РІРєРё СЃРёСЃС‚РµРјС‹.</p>
                  )}
                </div>

                {!projectBasedMode && keyEquipment.length ? (
                <div className="calc-explain">
                  <h4>РљР»СЋС‡РµРІРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ, РѕРїСЂРµРґРµР»СЏСЋС‰РµРµ С†РµРЅСѓ</h4>
                  <div className="table-wrap compact">
                    <table>
                      <thead>
                        <tr>
                          <th>{"\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435"}</th>
                          <th>{"\u041c\u043e\u0434\u0435\u043b\u044c"}</th>
                          <th>{"\u041a\u043e\u043b-\u0432\u043e"}</th>
                          <th>{"\u0426\u0435\u043d\u0430"}</th>
                          <th>{"\u0421\u0443\u043c\u043c\u0430"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keyEquipment.map((item) => (
                          <tr key={`${system.id}-key-${item.code}`}>
                            <td>{item.name}</td>
                            <td>{resolveKeyEquipmentModel(system, item)}</td>
                            <td>{num(item.qty, 0)}</td>
                            <td>{rub(item.unitPrice)}</td>
                            <td>{rub(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="equipment-principles">
                    {keyEquipment.map((item) => (
                      <p key={`${system.id}-${item.code}-basis`}>
                        <strong>{item.name}:</strong> {item.basis}
                      </p>
                    ))}
                    <p>
                      <strong>РљР°Р±РµР»СЊ:</strong> {num(result?.cable || 0, 1)} Рј; <strong>РљСЂРµРїРµР¶:</strong>{" "}
                      {num(apsSnapshot?.metrics?.fastenerQty ?? result?.fastenerUnits ?? 0, 0)} С€С‚; <strong>РљРќРЎ:</strong>{" "}
                      {num(result?.knsLength || result?.trace?.knsLengthM || 0, 1)} Рј.
                    </p>
                  </div>
                </div>
                ) : null}
              </div>

              {technicalRecommendation ? (
                <div className="calc-explain ai-configurator-card">
                  <div className="ai-configurator-card__head">
                    <div>
                      <h4>AI-РљРѕРЅС„РёРіСѓСЂР°С‚РѕСЂ С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ СЂРµС€РµРЅРёСЏ</h4>
                      <p className="hint-inline">
                        РЎРїРµС†РёС„РёРєР°С†РёСЏ СЃРѕР±СЂР°РЅР° РїРѕ РґР°РЅРЅС‹Рј РІРєР»Р°РґРєРё "РћР±СЉРµРєС‚", Р·РѕРЅРёСЂРѕРІР°РЅРёСЋ, СЌС‚Р°Р¶РЅРѕСЃС‚Рё, СЃС‚Р°С‚СѓСЃСѓ Р·РґР°РЅРёСЏ, РѕС‚РІРµС‚Р°Рј РѕР±СЃР»РµРґРѕРІР°РЅРёСЏ Рё РїСЂРѕРµРєС‚РЅС‹Рј РґР°РЅРЅС‹Рј.
                      </p>
                      <p className="hint-inline">
                        Р¤РѕС‚Рѕ РєРѕСЂРёРґРѕСЂРѕРІ Рё РѕС‚РІРµС‚С‹ Рѕ Р»РѕС‚РєР°С…, С„Р°Р»СЊС€-РїРѕР»Р°С… Рё Р·Р°РїРѕС‚РѕР»РѕС‡РЅРѕРј РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРµ СѓС‡РёС‚С‹РІР°СЋС‚СЃСЏ РІ С‚РµС…РЅРёС‡РµСЃРєРѕРј СЂРµС€РµРЅРёРё, РјР°С‚РµСЂРёР°Р»Р°С…, РЎРњР  Рё РёС‚РѕРіРѕРІРѕР№ СЃС‚РѕРёРјРѕСЃС‚Рё СЃРёСЃС‚РµРјС‹.
                      </p>
                    </div>
                    <div className="ai-configurator-badges">
                      <span className="pricing-source-chip ok">Р“РѕС‚РѕРІРЅРѕСЃС‚СЊ: {num(technicalRecommendation.readinessScore, 0)}%</span>
                      <span className={`pricing-source-chip ${technicalRecommendation.hasWorkingDocs ? "muted" : "warn"}`}>
                        {technicalRecommendation.hasWorkingDocs ? "Р•СЃС‚СЊ Р Р”" : "Р‘РµР· Р Р”"}
                      </span>
                    </div>
                  </div>

                  <div className="ai-configurator-influences">
                    {(technicalRecommendation.influences || []).map((item) => (
                      <div className="metric-card" key={`${system.id}-${item.label}`}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="ai-summary-list">
                    {(technicalRecommendation.summary || []).map((item) => (
                      <div key={`${system.id}-${item}`}>
                        <CheckCircle2 size={16} />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {technicalRecommendation.recognizedPlanData?.zoneNames?.length ? (
                    <div className="ai-summary-list">
                      {technicalRecommendation.recognizedPlanData.zoneNames.slice(0, 6).map((item) => (
                        <div key={`${system.id}-recognized-zone-${item}`}>
                          <CheckCircle2 size={16} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="table-wrap compact ai-configurator-table">
                    <table>
                      <thead>
                        <tr>
                          <th>РџРѕР·РёС†РёСЏ</th>
                          <th>РљР°С‚РµРіРѕСЂРёСЏ</th>
                          <th>РСЃС‚РѕС‡РЅРёРє</th>
                          <th>РћСЃРЅРѕРІР°РЅРёРµ</th>
                          <th>РљРѕР»-РІРѕ</th>
                          <th>Р•Рґ. РёР·Рј</th>
                          <th>Р¦РµРЅР°</th>
                          <th>РЎСѓРјРјР°</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(technicalRecommendation.specRows || []).map((row) => {
                          const modelOptions = buildSpecModelOptions(system, row);
                          const canEditModel = modelOptions.length > 0 && row.source !== "project_pdf";
                          return (
                          <tr key={`${system.id}-${row.key}`}>
                            <td>
                              <div style={{ display: "grid", gap: 6 }}>
                                <span>{formatTechnicalSpecPosition(row)}</span>
                                {canEditModel ? (
                                  <select
                                    value={row.model || ""}
                                    onChange={(event) => {
                                      const nextOverride = resolveModelPriceOverride(
                                        system.type,
                                        system.vendor,
                                        row.itemCode,
                                        event.target.value,
                                        row.model,
                                        row.unitPrice
                                      );
                                      updateTechnicalSpecOverride(system.id, row.key, nextOverride);
                                    }}
                                  >
                                    {modelOptions.map((option) => (
                                      <option key={`${row.key}-${option.optionKey || option.model}`} value={option.model}>
                                        {option.model}
                                      </option>
                                    ))}
                                  </select>
                                ) : null}
                              </div>
                            </td>
                            <td>{row.category === "equipment" ? "РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ" : "РњР°С‚РµСЂРёР°Р»С‹"}</td>
                            <td>
                              {(() => {
                                const sourceMeta = buildTechnicalSpecSourceMeta(row, result, system, manufacturerWebsite);
                                return sourceMeta.url ? (
                                  <a href={sourceMeta.url} target="_blank" rel="noreferrer" className="hint-inline">
                                    {sourceMeta.label}
                                  </a>
                                ) : (
                                  <span className="hint-inline">{sourceMeta.label}</span>
                                );
                              })()}
                            </td>
                            <td>{row.basis}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={row.qty}
                                onChange={(event) =>
                                  updateTechnicalSpecOverride(system.id, row.key, {
                                    qty: Math.max(toNumber(event.target.value, row.qty), 0),
                                  })
                                }
                              />
                            </td>
                            <td>{row.unit}</td>
                            <td>{rub(row.unitPrice || 0)}</td>
                            <td>{rub(row.total || 0)}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                </div>
              ) : null}

              <div className="action-cell">
                <button className="ghost-btn" type="button" onClick={() => exportSystemSpecification?.(system.id)}>
                  <Download size={16} /> Excel-спецификация
                </button>
                <button className="danger-btn" type="button" onClick={() => removeSystem(system.id)} disabled={systems.length <= 1}>
                  <Trash2 size={16} /> Удалить систему
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  return repairReactTextTree(content);
}





