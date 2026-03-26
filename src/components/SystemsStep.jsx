import React, { useState } from "react";
import { Plus, Trash2, Shield, FileUp, RefreshCcw } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getManufacturerSource, getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import VendorConfigurator from "./VendorConfigurator";

function renderApsImportStatus(status) {
  if (!status) return null;
  if (status.state === "loading") {
    return <p className="hint-inline">Статус: {status.message}</p>;
  }
  if (status.state === "error") {
    return <p className="warn-inline">Статус: {status.message}</p>;
  }
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
    not_parsed: "строка не распознана",
  };
  return map[reason] || "строка требует ручной проверки";
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
          const unitAuditRows = (apsSnapshot?.items || []).filter((item) => (item?.unitAudit?.status || "unknown") !== "match");
          const manufacturerSource = getManufacturerSource(system.type, system.vendor);
          const manufacturerWebsite = manufacturerSource?.website || "";
          const manufacturerHost = toHost(manufacturerWebsite);

          const pricedSourceCount =
            snapshot?.entries
              ?.filter((item) => (item.sourceCount || 0) > 0)
              .reduce((sum, item) => sum + (item.sourceCount || 0), 0) || 0;
          const checkedSourceCount =
            snapshot?.entries?.reduce((sum, item) => sum + (item.checkedSources || item.sourceUrls?.length || 0), 0) || 0;
          const checkedSourceHosts = [...new Set((snapshot?.entries || []).flatMap((item) => item.checkedSourceHosts || []))].slice(0, 10);
          const usedSourceHosts = [...new Set((snapshot?.entries || []).flatMap((item) => item.usedSourceHosts || []))].slice(0, 10);
          const manufacturerChecked = manufacturerHost ? checkedSourceHosts.includes(manufacturerHost) : false;
          const manufacturerUsedUrls = manufacturerHost
            ? [...new Set((snapshot?.entries || []).flatMap((item) => item.usedSources || []).filter((url) => toHost(url) === manufacturerHost))]
            : [];
          const manufacturerSuccess = manufacturerUsedUrls.length > 0;

          return (
            <div className="system-card" key={system.id}>
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

              <div className="system-main-grid">
                <div className="input-card">
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
                <div className="input-card">
                  <label>Вендор</label>
                  <select value={system.vendor} onChange={(event) => updateSystem(system.id, "vendor", event.target.value)}>
                    {vendorList.map((vendor) => (
                      <option key={vendor} value={vendor}>
                        {vendor}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-card">
                  <label>Кастомный индекс</label>
                  <input
                    type="number"
                    step="0.01"
                    value={system.customVendorIndex}
                    onChange={(event) => updateSystem(system.id, "customVendorIndex", toNumber(event.target.value, 1))}
                  />
                </div>
                <div className="vendor-hint">
                  <p>
                    Ед. цена: <strong>{rub(result?.equipmentData?.unitPrice || 0)}</strong>
                  </p>
                  <p>
                    Маркер: <strong>{result?.unitWorkMarker?.label || "—"}</strong>
                  </p>
                  <p>
                    За единицу: <strong>{rub(result?.unitWorkMarker?.costPerUnit || 0)}</strong>
                  </p>
                  <p>
                    Оборудование: <strong>{rub(result?.equipmentCost || 0)}</strong>
                  </p>
                  <p>
                    Работы (СМР+ПНР): <strong>{rub(result?.workTotal || 0)}</strong>
                  </p>
                  <p>
                    Материалы: <strong>{rub(result?.materialCost || 0)}</strong>
                  </p>
                  <p>Ключ выбора: {result?.equipmentData?.selectionKey || "fallback"}</p>
                  <p>Режим расчета: {result?.estimateMode === "project_pdf" ? "по PDF-проекту" : "по внутренней модели"}</p>
                  <button className="ghost-btn" type="button" onClick={() => refreshVendorPricing(system)}>
                    <RefreshCcw size={14} /> Обновить цены
                  </button>
                </div>
              </div>

              {snapshot ? (
                <div className="pricing-caption">
                  Актуализация цен: {snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ru-RU") : "—"}. Успешных ценовых ответов:{" "}
                  {pricedSourceCount} из {checkedSourceCount} проверенных источников.
                  {snapshot.error ? <span className="warn-inline"> Ошибка API: {snapshot.error}</span> : null}
                  <div className="pricing-source-row">
                    <span className="pricing-source-chip">
                      <strong>Проверено</strong>: {checkedSourceCount}
                    </span>
                    <span className={`pricing-source-chip ${pricedSourceCount > 0 ? "ok" : "warn"}`}>
                      <strong>Дали цену</strong>: {pricedSourceCount}
                    </span>
                    <span className={`pricing-source-chip ${manufacturerSuccess ? "ok" : manufacturerChecked ? "warn" : "muted"}`}>
                      <strong>Производитель</strong>: {manufacturerHost || "не задан"} ·{" "}
                      {manufacturerSuccess ? "цены найдены" : manufacturerChecked ? "сайт опрошен, цены не найдены" : "сайт не опрошен"}
                    </span>
                  </div>
                  {checkedSourceHosts.length ? (
                    <div className="pricing-source-row">
                      <span className="pricing-source-chip muted">
                        <strong>Опрос:</strong> {checkedSourceHosts.join(", ")}
                      </span>
                      {usedSourceHosts.length ? (
                        <span className="pricing-source-chip ok">
                          <strong>С ценой:</strong> {usedSourceHosts.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {system.type === "aps" ? (
                <div className="calc-explain aps-import-card">
                  <h4>Импорт проекта АПС (PDF по ГОСТ 21.110-2013)</h4>
                  <p className="hint-inline">
                    Если проект загружен, расчет АПС выполняется по спецификации (оборудование, материалы, трудозатраты и сроки). Если
                    проект не загружен, используется внутренняя модель.
                  </p>
                  <p className="hint-inline">Норматив: СПДС, ГОСТ Р 21.101-2020 и ГОСТ 21.110-2013 (спецификация оборудования, изделий и материалов).</p>
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
                        } catch (error) {
                          // Ошибка уже отображается через apsImportStatuses.
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
                          <span>Позиции с ценой от поставщиков</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithSupplierPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Позиции без цены поставщика</span>
                          <strong>{num(apsSnapshot.sourceStats.itemsWithoutPrice, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Нераспознанные строки PDF</span>
                          <strong>{num(apsSnapshot.sourceStats.unresolvedPositions, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Точность распознавания</span>
                          <strong>{num((apsSnapshot.sourceStats.recognitionRate || 0) * 100, 1)}%</strong>
                        </div>
                        <div className="metric-card">
                          <span>Исправлено ИИ-сверкой</span>
                          <strong>{num(apsSnapshot.sourceStats.aiCorrectedItems || 0, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Низкая уверенность ИИ</span>
                          <strong>{num(apsSnapshot.sourceStats.aiLowConfidenceItems || 0, 0)}</strong>
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
                                <td>{item.name}</td>
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

                      {unitAuditRows.length ? (
                        <div className="calc-explain">
                          <h4>Проверка единиц измерения (проект ↔ поставщик)</h4>
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
                        </div>
                      ) : null}

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
                          <strong>Проверка единиц измерения:</strong> совпало {num(apsSnapshot.sourceStats.unitMatch, 0)}, требуется проверка{" "}
                          {num(apsSnapshot.sourceStats.unitMismatch, 0)}, без данных {num(apsSnapshot.sourceStats.unitUnknown, 0)}.
                        </p>
                        <p>
                          <strong>Кабель и крепеж по системе:</strong> кабель {num(apsSnapshot.metrics?.cableLengthM || 0, 1)} м, линий{" "}
                          {num(apsSnapshot.metrics?.cableLines || 0, 0)}; крепеж {num(apsSnapshot.metrics?.fastenerQty || 0, 0)} шт, позиций{" "}
                          {num(apsSnapshot.metrics?.fastenerLines || 0, 0)}.
                        </p>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <VendorConfigurator
                system={system}
                onChange={(key, value) =>
                  updateSystem(system.id, "selectedEquipmentParams", {
                    ...(system.selectedEquipmentParams || {}),
                    [key]: value,
                  })
                }
              />

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

              <div className="action-cell">
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
