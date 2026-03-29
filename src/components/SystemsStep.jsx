import React, { useState } from "react";
import { Plus, Trash2, Shield, FileUp, RefreshCcw, Eye, EyeOff, CheckCircle2, Download, BarChart3 } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getManufacturerSource, getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import VendorConfigurator from "./VendorConfigurator";

function renderApsImportStatus(status) {
  if (!status) return null;
  if (status.state === "loading") return <p className="hint-inline">Статус: {status.message}</p>;
  if (status.state === "error") return <p className="warn-inline">Статус: {status.message}</p>;
  return <p className="hint-inline">Статус: {status.message}</p>;
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
    return <span className="pricing-chip-popover">Детализация расчета работ появится после формирования итогового расчета системы.</span>;
  }

  const rates = laborDetails.unitRates;
  const breakdown = laborDetails.workBreakdown;
  const charges = laborDetails.workChargesBeforeRegion || {};
  const marketGuard = laborDetails.marketGuard || {};
  const neuralCheck = laborDetails.neuralCheck || {};
  const regionalFactor = Math.max(toNumber(breakdown.regionalFactor, 1), 0.0001);
  const workAfterConditions = toNumber(result?.laborBase, 0) / regionalFactor;
  const chargesTotal =
    toNumber(charges.overhead, 0) +
    toNumber(charges.payrollTaxes, 0) +
    toNumber(charges.utilization, 0) +
    toNumber(charges.ppe, 0) +
    toNumber(charges.admin, 0);

  return (
    <span className="pricing-chip-popover work-cost-popover">
      <span className="work-cost-popover__section">
        <strong>Как считается стоимость работ</strong>
        <span>
          СМР+ПНР считаются по внутренней модели единичных расценок, затем проверяются рыночным полом и AI-анализом риска
          недооценки. Для APS с PDF итог не может быть ниже базы по единичным расценкам.
        </span>
      </span>

      <span className="work-cost-popover__section">
        <strong>Базовые единичные расценки</strong>
        <span>
          Осн. элемент: {rub(rates.mountPrimary)} монтаж / {rub(rates.pnrPrimary)} ПНР; контроллер: {rub(rates.controllerMount)};
          активный элемент ПНР: {rub(rates.pnrActiveElement)}; кабель: {rub(rates.cablePerMeter)}/м; КНС: {rub(rates.knsPerMeter)}/м;
          интеграция: {rub(rates.integrationPoint)}/точку.
        </span>
      </span>

      <span className="work-cost-popover__section">
        <strong>Объемы</strong>
        <span>
          {num(breakdown.primaryUnits, 0)} осн. элементов, {num(breakdown.controllerUnits, 0)} контроллеров, {num(breakdown.activeElements, 0)}
          {" "}активных элементов, {num(breakdown.integrationPoints, 0)} точек интеграции, {num(breakdown.cableLengthM, 0)} м кабеля,
          {` ${num(breakdown.knsLengthM, 0)} м КНС.`}
        </span>
      </span>

      <span className="work-cost-popover__section">
        <strong>Формула</strong>
        <span>
          База: {rub(result?.workBase || breakdown.computedWorkBase)} = СМР {rub(breakdown.smrBase)} + ПНР {rub(breakdown.pnrBase)} +
          интеграция {rub(breakdown.integrationBase)} + КНС {rub(breakdown.knsBase)}.
        </span>
        <span>
          После условий: {rub(workAfterConditions)} = база {formatMultiplier(breakdown.conditionFactor)} x эксплуатируемое здание{" "}
          {formatMultiplier(breakdown.exploitedFactor)}.
        </span>
        <span>
          Начисления: {rub(chargesTotal)}; до региона {rub(laborDetails.workTotalBeforeRegion || 0)}; регион {formatMultiplier(breakdown.regionalFactor)}.
        </span>
        <span>
          Рыночный пол: {rub(marketGuard.marketFloorTotal || 0)}; AI uplift {formatMultiplier(neuralCheck.neuralUpliftMultiplier || 1)}; риск
          недооценки {num(toNumber(neuralCheck.underestimationRisk, 0) * 100, 0)}%.
        </span>
      </span>

      <span className="work-cost-popover__section work-cost-popover__section--accent">
        <strong>Итог</strong>
        <span>Итоговая стоимость работ (СМР+ПНР): {rub(result?.workTotal || 0)}</span>
      </span>
    </span>
  );
}

function renderVendorMetricPopover(kind, result) {
  const unitPrice = toNumber(result?.equipmentData?.unitPrice, 0);
  const equipmentCost = toNumber(result?.equipmentCost, 0);
  const markerLabel = result?.unitWorkMarker?.label || "—";
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
  compareVendorPrices,
  vendorPriceSnapshots,
  vendorComparisonsBySystem,
  canAddMoreSystems,
  importApsProjectPdf,
  clearApsProjectPdf,
  updateApsProjectItem,
  addApsProjectItem,
  removeApsProjectItemById,
  apsProjectSnapshots,
  apsImportStatuses,
  technicalRecommendations,
  updateTechnicalSpecOverride,
  exportSystemSpecification,
}) {
  const usedTypeMap = new Map(systems.map((item) => [item.id, item.type]));
  const [manualDraftBySystem, setManualDraftBySystem] = useState({});
  const [showUnitAuditBySystem, setShowUnitAuditBySystem] = useState({});
  const [showRecheckBySystem, setShowRecheckBySystem] = useState({});
  const [refreshingBySystem, setRefreshingBySystem] = useState({});
  const [comparingBySystem, setComparingBySystem] = useState({});

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

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Системы</h2>
          <p>На одном объекте может быть только одна система каждого вида.</p>
        </div>
        <button className="primary-btn" onClick={addSystem} type="button" disabled={!canAddMoreSystems}>
          <Plus size={16} /> + Система
        </button>
      </div>

      <div className="stack">
        {systems.map((system, index) => {
          const typeMeta = SYSTEM_TYPES.find((item) => item.code === system.type);
          const Icon = typeMeta?.icon || Shield;
          const vendorList = VENDORS[system.type] || ["Базовый"];
          const selectedVendor = getVendorByName(system.type, system.vendor);
          const snapshot = vendorPriceSnapshots?.[system.id];
          const result = systemResults[index];
          const keyEquipment = result?.equipmentData?.keyEquipment || [];
          const apsSnapshot = apsProjectSnapshots?.[system.id];
          const apsStatus = apsImportStatuses?.[system.id];
          const technicalRecommendation = (technicalRecommendations || []).find((item) => item.systemId === system.id);
          const projectBasedMode = Boolean(apsSnapshot?.active || result?.projectInPlace);
          const unitAuditRows = (apsSnapshot?.items || []).filter((item) => (item?.unitAudit?.status || "unknown") !== "match");
          const manufacturerSource = getManufacturerSource(system.type, system.vendor);
          const manufacturerWebsite = manufacturerSource?.website || "";
          const manufacturerHost = toHost(manufacturerWebsite);
          const isRefreshing = Boolean(refreshingBySystem[system.id]);
          const isComparing = Boolean(comparingBySystem[system.id]);
          const showUnitAudit = Boolean(showUnitAuditBySystem[system.id]);
          const showRecheck = Boolean(showRecheckBySystem[system.id]);
          const comparison = vendorComparisonsBySystem?.[system.id];

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
          const manufacturerMatchedUrls = manufacturerHost
            ? [
                ...new Set(
                  (snapshot?.entries || [])
                    .flatMap((item) => item.matchedSources || item.usedSources || [])
                    .filter((url) => toHost(url) === manufacturerHost)
                ),
              ]
            : [];
          const manufacturerSuccess = manufacturerMatchedUrls.length > 0;
          const recheckRows = (snapshot?.entries || []).filter((item) => item.recheckRequired);
          const detectedVendor = apsSnapshot?.detectedVendor || system.vendor;
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
                    <div className="input-card compact comparison-trigger-card">
                      <label>Сравнение цен</label>
                      <button className="ghost-btn comparison-trigger-btn" type="button" onClick={() => handleCompare(system)} disabled={isComparing}>
                        <BarChart3 size={16} />
                        {isComparing ? "Собираем цены..." : "Сравнить 3 вендора"}
                      </button>
                      <small className="hint-inline">Текущий вендор и две альтернативы с пересчетом итоговой стоимости системы.</small>
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
                      <strong>{result?.unitWorkMarker?.label || "—"}</strong>
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
                      </div>

                      <div className="table-wrap compact comparison-table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Роль</th>
                              <th>Вендор</th>
                              <th>Ед. цена</th>
                              <th>Оборудование</th>
                              <th>Материалы</th>
                              <th>СМР+ПНР</th>
                              <th>Проектир.</th>
                              <th>Итог</th>
                              <th>Источники</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparison.rows.map((row) => (
                              <tr key={`${system.id}-${row.vendor}`}>
                                <td>{row.role}</td>
                                <td>{row.vendor}</td>
                                <td>{rub(row.unitPrice)}</td>
                                <td>{rub(row.equipmentCost)}</td>
                                <td>{rub(row.materialCost)}</td>
                                <td>{rub(row.workTotal)}</td>
                                <td>{rub(row.designTotal)}</td>
                                <td>
                                  <strong>{rub(row.total)}</strong>
                                </td>
                                <td>
                                  {row.pricedSourceCount}/{row.checkedSourceCount}
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

              {system.type === "aps" ? (
                <div className="calc-explain aps-import-card">
                  <h4>Импорт проекта АПС (PDF по ГОСТ 21.110-2013)</h4>
                  <p className="hint-inline">
                    Если проект загружен, расчет АПС выполняется по спецификации проекта. AI-модуль распознает строки, валидирует единицы,
                    проверяет риск цен и защищает итог от недооценки работ. Если проект не загружен, используется внутренняя расчетная модель.
                  </p>
                  <p className="hint-inline">Норматив: СПДС, ГОСТ Р 21.101-2020 и ГОСТ 21.110-2013. Итог по СМР+ПНР дополнительно защищается рыночным полом и AI-проверкой.</p>

                  <div className="aps-import-actions">
                    <label className="ghost-btn file-upload-btn" htmlFor={`aps-pdf-${system.id}`}>
                      <FileUp size={14} /> Загрузить PDF
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
                          // Ошибка отображается через apsImportStatuses.
                        } finally {
                          event.target.value = "";
                        }
                      }}
                    />
                    {apsSnapshot ? (
                      <button className="danger-btn" type="button" onClick={() => clearApsProjectPdf(system.id)}>
                        Очистить проект
                      </button>
                    ) : null}
                  </div>

                  {renderApsImportStatus(apsStatus)}
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
                        <h4>Полный перечень распознанного оборудования и материалов из спецификации</h4>
                        <p className="hint-inline">
                          В таблице ниже выводятся все позиции, которые AI-модуль распознал по загруженной спецификации, включая
                          оборудование, материалы, кабельные позиции и вручную добавленные строки.
                        </p>
                      </div>

                      <div className="table-wrap compact">
                        <table>
                          <thead>
                            <tr>
                              <th>Наименование</th>
                              <th>Марка/модель</th>
                              <th>Категория</th>
                              <th>Кол-во</th>
                              <th>Цена, ₽</th>
                              <th>Ед. проект/поставщик</th>
                              <th>Сумма</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {apsSnapshot.items.map((item) => (
                              <tr key={`${system.id}-aps-item-${item.id}`}>
                                <td>
                                  <div className="aps-item-title">
                                    <span>{item.name}</span>
                                    {item.position ? <small>Пункт спецификации {item.position}</small> : null}
                                  </div>
                                </td>
                                <td>{item.model || item.brand || "—"}</td>
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
                                    {item?.unitAudit?.message || "нет данных"}
                                  </span>
                                </td>
                                <td>{rub(item.total)}</td>
                                <td>
                                  <button
                                    className="table-action-btn"
                                    type="button"
                                    onClick={() => removeApsProjectItemById(system.id, item.id)}
                                    title="Удалить позицию"
                                  >
                                    Удалить
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="calc-explain">
                        <h4>Добавить позицию вручную</h4>
                        <div className="manual-item-grid">
                          <div className="input-card">
                            <label>Тип</label>
                            <select
                              value={getManualDraft(system.id).kind}
                              onChange={(event) => updateManualDraft(system.id, "kind", event.target.value)}
                            >
                              <option value="equipment">Оборудование</option>
                              <option value="material">Материал</option>
                            </select>
                          </div>
                          <div className="input-card">
                            <label>Наименование</label>
                            <input
                              type="text"
                              value={getManualDraft(system.id).name}
                              onChange={(event) => updateManualDraft(system.id, "name", event.target.value)}
                              placeholder="Введите позицию"
                            />
                          </div>
                          <div className="input-card">
                            <label>Марка/модель</label>
                            <input
                              type="text"
                              value={getManualDraft(system.id).model}
                              onChange={(event) => updateManualDraft(system.id, "model", event.target.value)}
                              placeholder="Модель"
                            />
                          </div>
                          <div className="input-card">
                            <label>Ед. изм</label>
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
                            <label>Количество</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={getManualDraft(system.id).qty}
                              onChange={(event) => updateManualDraft(system.id, "qty", event.target.value)}
                            />
                          </div>
                          <div className="input-card">
                            <label>Цена, ₽</label>
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
                              Добавить позицию
                            </button>
                          </div>
                        </div>
                      </div>

                      {apsSnapshot.itemsWithoutPrice?.length ? (
                        <div className="calc-explain">
                          <h4>Позиции без найденной цены поставщика</h4>
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>Поз.</th>
                                  <th>Наименование</th>
                                  <th>Марка/модель</th>
                                  <th>Кол-во</th>
                                  <th>Причина</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apsSnapshot.itemsWithoutPrice.map((item) => (
                                  <tr key={`${system.id}-no-price-${item.id}`}>
                                    <td>{item.position || "—"}</td>
                                    <td>{item.name}</td>
                                    <td>{item.model || "—"}</td>
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
                          <h4>Нераспознанные позиции PDF (требуют проверки)</h4>
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>Поз.</th>
                                  <th>Строка из PDF</th>
                                  <th>Причина</th>
                                </tr>
                              </thead>
                              <tbody>
                                {apsSnapshot.unrecognizedRows.map((row) => (
                                  <tr key={`${system.id}-unrecognized-${row.id}`}>
                                    <td>{row.position || "—"}</td>
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
                          <h4>Трудоемкость, проверка единиц, кабель и крепеж</h4>
                          <button className="ghost-btn" type="button" onClick={() => toggleUnitAudit(system.id)}>
                            {showUnitAudit ? <EyeOff size={14} /> : <Eye size={14} />}
                            {showUnitAudit ? "Скрыть проверку единиц" : "Показать проверку единиц"}
                          </button>
                        </div>

                        <div className="equipment-principles">
                          <p>
                            <strong>Трудоемкость СМР+ПНР:</strong> {num(apsSnapshot.labor.executionHoursBase, 1)} ч; бригада{" "}
                            {num(apsSnapshot.labor.crewSize, 0)} чел.; срок {num(apsSnapshot.labor.executionDays, 0)} раб. дней.
                          </p>
                          <p>
                            <strong>Трудоемкость проектирования:</strong> {num(apsSnapshot.labor.designHoursBase, 1)} ч; группа{" "}
                            {num(apsSnapshot.labor.designTeamSize, 0)} чел.; срок {num(apsSnapshot.labor.designMonths, 0)} мес.
                          </p>
                          <p>
                            <strong>Проверка единиц:</strong> совпало {num(apsSnapshot.sourceStats.unitMatch, 0)}, требуется проверка{" "}
                            {num(apsSnapshot.sourceStats.unitMismatch, 0)}, без данных {num(apsSnapshot.sourceStats.unitUnknown, 0)}.
                          </p>
                          <p>
                            <strong>Кабель и крепеж:</strong> кабель {num(apsSnapshot.metrics?.cableLengthM || 0, 1)} м, линий{" "}
                            {num(apsSnapshot.metrics?.cableLines || 0, 0)}; крепеж {num(apsSnapshot.metrics?.fastenerQty || 0, 0)} шт, позиций{" "}
                            {num(apsSnapshot.metrics?.fastenerLines || 0, 0)}.
                          </p>
                        </div>

                        {showUnitAudit && unitAuditRows.length ? (
                          <div className="table-wrap compact">
                            <table>
                              <thead>
                                <tr>
                                  <th>Поз.</th>
                                  <th>Наименование</th>
                                  <th>Ед. проекта</th>
                                  <th>Ед. поставщика</th>
                                  <th>Статус</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unitAuditRows.map((item) => (
                                  <tr key={`${system.id}-unit-audit-${item.id}`}>
                                    <td>{item.position || "—"}</td>
                                    <td>{item.name}</td>
                                    <td>{item?.unitAudit?.projectUnit || item.unit || "—"}</td>
                                    <td>{item?.unitAudit?.supplierUnits?.join(", ") || "нет данных"}</td>
                                    <td>
                                      <span className={`unit-audit-badge ${item?.unitAudit?.status || "unknown"}`}>
                                        {item?.unitAudit?.message || "требуется проверка"}
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
                  <h4>Коэффициенты системы</h4>
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
                  <h4>Ключевое оборудование, определяющее цену</h4>
                  <div className="table-wrap compact">
                    <table>
                      <thead>
                        <tr>
                          <th>Наименование</th>
                          <th>Кол-во</th>
                          <th>Цена</th>
                          <th>Сумма</th>
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
                      <strong>Кабель:</strong> {num(result?.cable || 0, 1)} м; <strong>Крепеж:</strong>{" "}
                      {num(apsSnapshot?.metrics?.fastenerQty ?? result?.fastenerUnits ?? 0, 0)} шт; <strong>КНС:</strong>{" "}
                      {num(result?.knsLength || result?.trace?.knsLengthM || 0, 1)} м.
                    </p>
                  </div>
                </div>
              </div>

              {technicalRecommendation ? (
                <div className="calc-explain ai-configurator-card">
                  <div className="ai-configurator-card__head">
                    <div>
                      <h4>AI-Конфигуратор технического решения</h4>
                      <p className="hint-inline">
                        Спецификация собрана по данным вкладки "Объект", зонированию, этажности, статусу здания, ответам обследования и проектным данным.
                      </p>
                      <p className="hint-inline">
                        Фото коридоров и ответы о лотках, фальш-полах и запотолочном пространстве учитываются в техническом решении, материалах, СМР и итоговой стоимости системы.
                      </p>
                    </div>
                    <div className="ai-configurator-badges">
                      <span className="pricing-source-chip ok">Готовность: {num(technicalRecommendation.readinessScore, 0)}%</span>
                      <span className={`pricing-source-chip ${technicalRecommendation.hasWorkingDocs ? "muted" : "warn"}`}>
                        {technicalRecommendation.hasWorkingDocs ? "Есть РД" : "Без РД"}
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
                          <th>Позиция</th>
                          <th>Категория</th>
                          <th>Источник</th>
                          <th>Основание</th>
                          <th>Кол-во</th>
                          <th>Ед. изм</th>
                          <th>Цена</th>
                          <th>Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(technicalRecommendation.specRows || []).map((row) => (
                          <tr key={`${system.id}-${row.key}`}>
                            <td>{row.name}</td>
                            <td>{row.category === "equipment" ? "Оборудование" : "Материалы"}</td>
                            <td>{row.source || "algorithm"}</td>
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
                        ))}
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
}
