import React, { useState } from "react";
import { Plus, Trash2, Shield, FileUp, RefreshCcw, Eye, EyeOff } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getManufacturerSource, getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import VendorConfigurator from "./VendorConfigurator";

function renderApsImportStatus(status) {
  if (!status) return null;
  if (status.state === "loading") return <p className="hint-inline">РЎС‚Р°С‚СѓСЃ: {status.message}</p>;
  if (status.state === "error") return <p className="warn-inline">РЎС‚Р°С‚СѓСЃ: {status.message}</p>;
  return <p className="hint-inline">РЎС‚Р°С‚СѓСЃ: {status.message}</p>;
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

function resolveUnrecognizedReason(reason) {
  const map = {
    position_not_found: "РЅРµ РЅР°Р№РґРµРЅ РЅРѕРјРµСЂ РїРѕР·РёС†РёРё",
    descriptor_missing: "РЅРµС‚ РѕРїРёСЃР°РЅРёСЏ РїРѕР·РёС†РёРё",
    qty_or_unit_not_found: "РЅРµ РѕРїСЂРµРґРµР»РµРЅС‹ РєРѕР»РёС‡РµСЃС‚РІРѕ РёР»Рё РµРґРёРЅРёС†Р° РёР·РјРµСЂРµРЅРёСЏ",
    validation_failed: "РЅРµ РїСЂРѕР№РґРµРЅР° РІР°Р»РёРґР°С†РёСЏ СЃС‚СЂРѕРєРё",
    not_parsed: "СЃС‚СЂРѕРєР° С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ РїСЂРѕРІРµСЂРєРё",
  };
  return map[reason] || "СЃС‚СЂРѕРєР° С‚СЂРµР±СѓРµС‚ СЂСѓС‡РЅРѕР№ РїСЂРѕРІРµСЂРєРё";
}

function formatSelectionStrategy(strategy) {
  const value = String(strategy || "");
  if (value.includes("article_exact_match")) return "С‚РѕС‡РЅРѕРµ СЃРѕРІРїР°РґРµРЅРёРµ Р°СЂС‚РёРєСѓР»Р°";
  if (value.includes("model_token_match")) return "СЃРѕРІРїР°РґРµРЅРёРµ Р°СЂС‚РёРєСѓР»Р°/РјРѕРґРµР»Рё";
  if (value.includes("luis_api_exact_model")) return "С‚РѕС‡РЅРѕРµ СЃРѕРІРїР°РґРµРЅРёРµ РјРѕРґРµР»Рё (LUIS+ API)";
  if (value.includes("luis_api_model_bias")) return "РїСЂРёРѕСЂРёС‚РµС‚ РїРѕ РјРѕРґРµР»Рё (LUIS+ API)";
  if (value.includes("manufacturer_source_bias")) return "РїСЂРёРѕСЂРёС‚РµС‚ РёСЃС‚РѕС‡РЅРёРєР° РїСЂРѕРёР·РІРѕРґРёС‚РµР»СЏ";
  if (value.includes("average_all_sources")) return "СЃСЂРµРґРЅРµРµ РїРѕ РґРѕСЃС‚СѓРїРЅС‹Рј РёСЃС‚РѕС‡РЅРёРєР°Рј";
  return "Р°Р»РіРѕСЂРёС‚Рј РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ";
}

const APS_MANUAL_UNIT_OPTIONS = ["С€С‚", "РєРѕРјРїР»", "Рј", "Рј2", "РєРі", "Р»", "СѓРї", "Р»РёСЃС‚"];

function defaultManualDraft() {
  return {
    kind: "equipment",
    name: "",
    model: "",
    unit: "С€С‚",
    qty: 1,
    unitPrice: 0,
  };
}

export default function SystemsStep({
  systems,
  addSystem,
  removeSystem,
  updateSystem,
  systemResults,
  refreshVendorPricing,
  vendorPriceSnapshots,
  canAddMoreSystems,
  importApsProjectPdf,
  clearApsProjectPdf,
  updateApsProjectItem,
  addApsProjectItem,
  removeApsProjectItemById,
  apsProjectSnapshots,
  apsImportStatuses,
}) {
  const usedTypeMap = new Map(systems.map((item) => [item.id, item.type]));
  const [manualDraftBySystem, setManualDraftBySystem] = useState({});
  const [showUnitAuditBySystem, setShowUnitAuditBySystem] = useState({});
  const [refreshingBySystem, setRefreshingBySystem] = useState({});

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

  const handleRefresh = async (system) => {
    if (!system?.id || refreshingBySystem[system.id]) return;
    setRefreshingBySystem((prev) => ({ ...prev, [system.id]: true }));
    try {
      await refreshVendorPricing(system);
    } finally {
      setRefreshingBySystem((prev) => ({ ...prev, [system.id]: false }));
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>РЎРёСЃС‚РµРјС‹</h2>
          <p>РќР° РѕРґРЅРѕРј РѕР±СЉРµРєС‚Рµ РјРѕР¶РµС‚ Р±С‹С‚СЊ С‚РѕР»СЊРєРѕ РѕРґРЅР° СЃРёСЃС‚РµРјР° РєР°Р¶РґРѕРіРѕ РІРёРґР°.</p>
        </div>
        <button className="primary-btn" onClick={addSystem} type="button" disabled={!canAddMoreSystems}>
          <Plus size={16} /> + РЎРёСЃС‚РµРјР°
        </button>
      </div>

      <div className="stack">
        {systems.map((system, index) => {
          const typeMeta = SYSTEM_TYPES.find((item) => item.code === system.type);
          const Icon = typeMeta?.icon || Shield;
          const vendorList = VENDORS[system.type] || ["Р‘Р°Р·РѕРІС‹Р№"];
          const selectedVendor = getVendorByName(system.type, system.vendor);
          const snapshot = vendorPriceSnapshots?.[system.id];
          const result = systemResults[index];
          const keyEquipment = result?.equipmentData?.keyEquipment || [];
          const apsSnapshot = apsProjectSnapshots?.[system.id];
          const apsStatus = apsImportStatuses?.[system.id];
          const unitAuditRows = (apsSnapshot?.items || []).filter((item) => (item?.unitAudit?.status || "unknown") !== "match");
          const manufacturerSource = getManufacturerSource(system.type, system.vendor);
          const manufacturerWebsite = manufacturerSource?.website || "";
          const manufacturerHost = toHost(manufacturerWebsite);
          const isRefreshing = Boolean(refreshingBySystem[system.id]);
          const showUnitAudit = Boolean(showUnitAuditBySystem[system.id]);

          const pricedSourceCount =
            snapshot?.entries
              ?.filter((item) => (item.sourceCount || 0) > 0)
              .reduce((sum, item) => sum + (item.sourceCount || 0), 0) || 0;
          const checkedSourceCount =
            snapshot?.entries?.reduce((sum, item) => sum + (item.checkedSources || item.sourceUrls?.length || 0), 0) || 0;
          const checkedSourceHosts = [...new Set((snapshot?.entries || []).flatMap((item) => item.checkedSourceHosts || []))].slice(0, 10);
          const recheckRequiredCount = (snapshot?.entries || []).filter((item) => item.recheckRequired).length;
          const avgConfidence = snapshot?.entries?.length
            ? snapshot.entries.reduce((sum, item) => sum + Number(item.priceConfidence || 0), 0) / snapshot.entries.length
            : 0;
          const strategy =
            snapshot?.entries && snapshot.entries.length
              ? snapshot.entries.map((item) => item.selectionStrategy).filter(Boolean).slice(0, 1)[0] || "average_all_sources"
              : "average_all_sources";
          const manufacturerChecked = manufacturerHost ? checkedSourceHosts.includes(manufacturerHost) : false;
          const manufacturerUsedUrls = manufacturerHost
            ? [...new Set((snapshot?.entries || []).flatMap((item) => item.usedSources || []).filter((url) => toHost(url) === manufacturerHost))]
            : [];
          const manufacturerSuccess = manufacturerUsedUrls.length > 0;

          return (
            <div className="system-card" key={system.id}>
              {/* TOP BLOCK */}
              <div className="system-title">
                <div className="system-badge">
                  <Icon size={16} />
                </div>
                <div>
                  <h3>
                    РЎРёСЃС‚РµРјР° {index + 1}: {typeMeta?.name}
                  </h3>
                  <p>{selectedVendor.description}</p>
                </div>
              </div>

              {/* BODY BLOCK */}
              <div className="system-main-grid system-main-grid-wide">
                <div className="input-card system-control-card">
                  <div className="system-control-grid">
                    <div className="input-card compact">
                      <label>РўРёРї СЃРёСЃС‚РµРјС‹</label>
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
                      <label>Р’РµРЅРґРѕСЂ</label>
                      <select
                        value={system.vendor}
                        onChange={(event) => updateSystem(system.id, "vendor", event.target.value)}
                        title="Р’РµРЅРґРѕСЂ РІР»РёСЏРµС‚ РЅР° С†РµРЅРѕРІРѕР№ РїСЂРѕС„РёР»СЊ, РєРѕСЌС„С„РёС†РёРµРЅС‚С‹ Рё РёС‚РѕРі СЃРёСЃС‚РµРјС‹. Р‘Р°Р·РѕРІС‹Р№ РІРµРЅРґРѕСЂ РїСЂРёРјРµРЅСЏР№С‚Рµ, РµСЃР»Рё Р±СЂРµРЅРґ РµС‰Рµ РЅРµ РІС‹Р±СЂР°РЅ Рё РЅСѓР¶РЅР° РЅРµР№С‚СЂР°Р»СЊРЅР°СЏ СЂС‹РЅРѕС‡РЅР°СЏ РѕС†РµРЅРєР°."
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
                        <label>РљР°СЃС‚РѕРјРЅС‹Р№ РёРЅРґРµРєСЃ</label>
                        <span className="label-tooltip-help">?</span>
                        <div className="label-tooltip-popover">
                          <p>
                            РљР°СЃС‚РѕРјРЅС‹Р№ РёРЅРґРµРєСЃ РєРѕСЂСЂРµРєС‚РёСЂСѓРµС‚ С†РµРЅРѕРІРѕР№ РїСЂРѕС„РёР»СЊ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РІРµРЅРґРѕСЂР° РґР»СЏ РєРѕРЅРєСЂРµС‚РЅРѕРіРѕ РѕР±СЉРµРєС‚Р°. Р—РЅР°С‡РµРЅРёРµ Р±РѕР»СЊС€Рµ
                            1.00 РїРѕРІС‹С€Р°РµС‚ СЃС‚РѕРёРјРѕСЃС‚СЊ, РјРµРЅСЊС€Рµ 1.00 СЃРЅРёР¶Р°РµС‚.
                          </p>
                          <p>РџР°СЂР°РјРµС‚СЂ СѓС‡РёС‚С‹РІР°РµС‚СЃСЏ РїСЂРё СЂР°СЃС‡С‘С‚Рµ СЃС‚РѕРёРјРѕСЃС‚Рё РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ Рё Р·Р°РІРёСЃСЏС‰РёС… РѕС‚ РЅРµРіРѕ СЂР°Р±РѕС‚ СЌС‚РѕР№ СЃРёСЃС‚РµРјС‹.</p>
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
                </div>

                <div className="vendor-hint vendor-hint-lg">
                  <div className="vendor-hint-top">
                    <p className="vendor-kpi">
                      Р•Рґ. С†РµРЅР°: <strong>{rub(result?.equipmentData?.unitPrice || 0)}</strong>
                    </p>
                    <p className="vendor-kpi">
                      РњР°СЂРєРµСЂ: <strong>{result?.unitWorkMarker?.label || "вЂ”"}</strong>
                    </p>
                    <p className="vendor-kpi">
                      Р—Р° РµРґРёРЅРёС†Сѓ: <strong>{num(result?.unitWorkMarker?.costPerUnit || 0, 0)}</strong>
                    </p>
                  </div>

                  <div className="vendor-hint-mid">
                    <div>
                      <span>РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ</span>
                      <strong>{rub(result?.equipmentCost || 0)}</strong>
                    </div>
                    <div>
                      <span>Р Р°Р±РѕС‚С‹ (РЎРњР +РџРќР )</span>
                      <strong>{rub(result?.workTotal || 0)}</strong>
                    </div>
                    <div>
                      <span>РњР°С‚РµСЂРёР°Р»С‹</span>
                      <strong>{rub(result?.materialCost || 0)}</strong>
                    </div>
                  </div>

                  <div className="vendor-hint-footer">
                    <p>РљР»СЋС‡ РІС‹Р±РѕСЂР°: {result?.equipmentData?.selectionKey || "fallback"}</p>
                    <p>Р РµР¶РёРј: {result?.estimateMode === "project_pdf" ? "РїРѕ PDF-РїСЂРѕРµРєС‚Сѓ" : "РїРѕ РІРЅСѓС‚СЂРµРЅРЅРµР№ РјРѕРґРµР»Рё"}</p>
                    <button className="ghost-btn" type="button" onClick={() => handleRefresh(system)} disabled={isRefreshing}>
                      <RefreshCcw size={14} className={isRefreshing ? "spin" : ""} /> {isRefreshing ? "РћР±РЅРѕРІР»РµРЅРёРµ..." : "РћР±РЅРѕРІРёС‚СЊ С†РµРЅС‹"}
                    </button>
                  </div>
                </div>
              </div>

              {snapshot ? (
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
                        <strong>Источников с найденной ценой:</strong> {pricedSourceCount}
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
                        уверенность в распознавании. Такие позиции лучше вручную проверить перед финальным расчетом.
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
                        Это сводная оценка того, насколько надежно система распознала позиции и сопоставила их с
                        рыночными источниками. Чем выше процент, тем меньше спорных мест в наименованиях, моделях,
                        единицах измерения и найденных ценах.
                      </span>
                    </span>
                  </div>
                  {snapshot.error ? <span className="warn-inline"> Ошибка API: {snapshot.error}</span> : null}
                </div>
              ) : null}
              {system.type === "aps" ? (
                <div className="calc-explain aps-import-card">
                  <h4>РРјРїРѕСЂС‚ РїСЂРѕРµРєС‚Р° РђРџРЎ (PDF РїРѕ Р“РћРЎРў 21.110-2013)</h4>
                  <p className="hint-inline">
                    Р•СЃР»Рё РїСЂРѕРµРєС‚ Р·Р°РіСЂСѓР¶РµРЅ, СЂР°СЃС‡РµС‚ РђРџРЎ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РїРѕ СЃРїРµС†РёС„РёРєР°С†РёРё (РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ, РјР°С‚РµСЂРёР°Р»С‹, С‚СЂСѓРґРѕР·Р°С‚СЂР°С‚С‹ Рё СЃСЂРѕРєРё). Р•СЃР»Рё
                    РїСЂРѕРµРєС‚ РЅРµ Р·Р°РіСЂСѓР¶РµРЅ, РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РІРЅСѓС‚СЂРµРЅРЅСЏСЏ РјРѕРґРµР»СЊ.
                  </p>
                  <p className="hint-inline">РќРѕСЂРјР°С‚РёРІ: РЎРџР”РЎ, Р“РћРЎРў Р  21.101-2020 Рё Р“РћРЎРў 21.110-2013 (СЃРїРµС†РёС„РёРєР°С†РёСЏ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЏ, РёР·РґРµР»РёР№ Рё РјР°С‚РµСЂРёР°Р»РѕРІ).</p>

                  <div className="aps-import-actions">
                    <label className="ghost-btn file-upload-btn" htmlFor={`aps-pdf-${system.id}`}>
                      <FileUp size={14} /> Р—Р°РіСЂСѓР·РёС‚СЊ PDF
                    </label>
                    <input
                      id={`aps-pdf-${system.id}`}
                      className="file-upload-input"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        try {
                          await importApsProjectPdf(system.id, file);
                        } catch {
                          // РћС€РёР±РєР° РѕС‚РѕР±СЂР°Р¶Р°РµС‚СЃСЏ С‡РµСЂРµР· apsImportStatuses.
                        } finally {
                          event.target.value = "";
                        }
                      }}
                    />
                    {apsSnapshot ? (
                      <button className="danger-btn" type="button" onClick={() => clearApsProjectPdf(system.id)}>
                        РћС‡РёСЃС‚РёС‚СЊ РїСЂРѕРµРєС‚
                      </button>
                    ) : null}
                  </div>

                  {renderApsImportStatus(apsStatus)}
                  {apsSnapshot?.gostStandard ? <p className="hint-inline">РЎС‚Р°РЅРґР°СЂС‚ PDF: {apsSnapshot.gostStandard}</p> : null}

                  {apsSnapshot ? (
                    <>
                      <div className="summary-grid breakdown-metrics">
                        <div className="metric-card">
                          <span>Р¤Р°Р№Р» РїСЂРѕРµРєС‚Р°</span>
                          <strong>{apsSnapshot.fileName}</strong>
                        </div>
                        <div className="metric-card">
                          <span>РџРѕР·РёС†РёРё РІ СЃРїРµС†РёС„РёРєР°С†РёРё</span>
                          <strong>{num(apsSnapshot.items.length, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>РџРѕР·РёС†РёРё СЃ С†РµРЅРѕР№ РїРѕСЃС‚Р°РІС‰РёРєР°</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithSupplierPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>РџРѕР·РёС†РёРё Р±РµР· С†РµРЅС‹</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithoutPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>РќРµСЂР°СЃРїРѕР·РЅР°РЅРЅС‹Рµ СЃС‚СЂРѕРєРё</span>
                          <strong>{num(apsSnapshot.sourceStats.unresolvedPositions, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>РўРѕС‡РЅРѕСЃС‚СЊ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёСЏ</span>
                          <strong>{num((apsSnapshot.sourceStats.recognitionRate || 0) * 100, 1)}%</strong>
                        </div>
                        <div className="metric-card">
                          <span>РљР°Р±РµР»СЊ (РёР· РїСЂРѕРµРєС‚Р°/РјРѕРґРµР»Рё)</span>
                          <strong>{num(apsSnapshot.metrics?.cableLengthM || 0, 1)} Рј</strong>
                        </div>
                        <div className="metric-card">
                          <span>РљСЂРµРїРµР¶ (РёР· РїСЂРѕРµРєС‚Р°/РјРѕРґРµР»Рё)</span>
                          <strong>{num(apsSnapshot.metrics?.fastenerQty || 0, 0)} С€С‚</strong>
                        </div>
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

              <VendorConfigurator
                system={system}
                projectBasedMode={Boolean(apsSnapshot?.active)}
                onChange={(key, value) =>
                  updateSystem(system.id, "selectedEquipmentParams", {
                    ...(system.selectedEquipmentParams || {}),
                    [key]: value,
                  })
                }
              />

              <div className="system-subgrid">
                <div className="calc-explain">
                  <h4>РљРѕСЌС„С„РёС†РёРµРЅС‚С‹ СЃРёСЃС‚РµРјС‹</h4>
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
                </div>

                <div className="calc-explain">
                  <h4>РљР»СЋС‡РµРІРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ, РѕРїСЂРµРґРµР»СЏСЋС‰РµРµ С†РµРЅСѓ</h4>
                  <div className="table-wrap compact">
                    <table>
                      <thead>
                        <tr>
                          <th>РќР°РёРјРµРЅРѕРІР°РЅРёРµ</th>
                          <th>РљРѕР»-РІРѕ</th>
                          <th>Р¦РµРЅР°</th>
                          <th>РЎСѓРјРјР°</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keyEquipment.map((item) => (
                          <tr key={`${system.id}-key-${item.code}`}>
                            <td>{item.name}</td>
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
              </div>

              <div className="action-cell">
                <button className="danger-btn" type="button" onClick={() => removeSystem(system.id)} disabled={systems.length <= 1}>
                  <Trash2 size={16} /> РЈРґР°Р»РёС‚СЊ СЃРёСЃС‚РµРјСѓ
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

