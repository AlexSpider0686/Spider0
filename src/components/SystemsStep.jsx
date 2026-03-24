import React from "react";
import { Plus, Trash2, Shield, FileUp, RefreshCcw } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getVendorByName } from "../config/vendorsConfig";
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
  apsProjectSnapshots,
  apsImportStatuses,
}) {
  const usedTypeMap = new Map(systems.map((item) => [item.id, item.type]));

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

          const pricedSourceCount =
            snapshot?.entries
              ?.filter((item) => item.status?.startsWith("fetched"))
              .reduce((sum, item) => sum + (item.sourceCount || 0), 0) || 0;
          const checkedSourceCount =
            snapshot?.entries?.reduce((sum, item) => sum + (item.checkedSources || item.sourceUrls?.length || 0), 0) || 0;
          const sourcePreview = (snapshot?.entries || [])
            .flatMap((item) => item.usedSources || [])
            .slice(0, 4);

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
                  <p>Ключ выбора: {result?.equipmentData?.selectionKey || "fallback"}</p>
                  <p>Режим расчета: {result?.estimateMode === "project_pdf" ? "по PDF-проекту" : "по внутренней модели"}</p>
                  <button className="ghost-btn" type="button" onClick={() => refreshVendorPricing(system)}>
                    <RefreshCcw size={14} /> Обновить цены
                  </button>
                </div>
              </div>

              {snapshot ? (
                <div className="pricing-caption">
                  Актуализация цен: {snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ru-RU") : "—"}. Источников с ценой:{" "}
                  {pricedSourceCount} из {checkedSourceCount}.
                  {snapshot.error ? <span className="warn-inline"> Ошибка API: {snapshot.error}</span> : null}
                  {sourcePreview.length ? (
                    <div className="pricing-source-list">
                      {sourcePreview.map((url) => (
                        <span key={`${system.id}-${url}`}>{url}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {system.type === "aps" ? (
                <div className="calc-explain aps-import-card">
                  <h4>Импорт проекта АПС (PDF по ГОСТ)</h4>
                  <p className="hint-inline">
                    Если проект загружен, расчет АПС выполняется по спецификации (оборудование, материалы, трудозатраты и сроки). Если
                    проект не загружен, используется внутренняя модель.
                  </p>
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

                  {apsSnapshot ? (
                    <>
                      <div className="summary-grid breakdown-metrics">
                        <div className="metric-card">
                          <span>Файл проекта</span>
                          <strong>{apsSnapshot.fileName}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Позиции спецификации</span>
                          <strong>{num(apsSnapshot.items.length, 0)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Оборудование (по проекту)</span>
                          <strong>{rub(apsSnapshot.totals.equipment)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Материалы (по проекту)</span>
                          <strong>{rub(apsSnapshot.totals.materials)}</strong>
                        </div>
                        <div className="metric-card">
                          <span>Источников с ценой</span>
                          <strong>{num(apsSnapshot.sourceStats.sourceWithPrice, 0)}</strong>
                        </div>
                      </div>

                      <div className="table-wrap compact">
                        <table>
                          <thead>
                            <tr>
                              <th>Позиция</th>
                              <th>Марка/модель</th>
                              <th>Категория</th>
                              <th>Кол-во</th>
                              <th>Цена</th>
                              <th>Сумма</th>
                            </tr>
                          </thead>
                          <tbody>
                            {apsSnapshot.items.slice(0, 14).map((item) => (
                              <tr key={`${system.id}-aps-item-${item.id}`}>
                                <td>{item.name}</td>
                                <td>{item.model || item.brand || "—"}</td>
                                <td>{item.category}</td>
                                <td>
                                  {num(item.qty, 0)} {item.unit}
                                </td>
                                <td>{rub(item.unitPrice)}</td>
                                <td>{rub(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
                          <th>Позиция</th>
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
