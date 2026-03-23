import React from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import VendorConfigurator from "./VendorConfigurator";

export default function SystemsStep({
  systems,
  addSystem,
  removeSystem,
  updateSystem,
  systemResults,
  refreshVendorPricing,
  vendorPriceSnapshots,
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Системы</h2>
          <p>Выберите тип системы, вендора и параметры ключевого оборудования.</p>
        </div>
        <button className="primary-btn" onClick={addSystem} type="button">
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
                    {SYSTEM_TYPES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
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
                  <p>Ключ выбора: {result?.equipmentData?.selectionKey || "fallback"}</p>
                  <button className="ghost-btn" type="button" onClick={() => refreshVendorPricing(system)}>
                    Обновить цены
                  </button>
                </div>
              </div>

              {snapshot ? (
                <div className="pricing-caption">
                  Актуализация цен: {snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ru-RU") : "—"}
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
                  <h4>Оборудование в расчёте</h4>
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
                        {(result?.equipmentData?.details || []).map((item) => (
                          <tr key={`${system.id}-${item.code}`}>
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
                    {(result?.equipmentData?.details || []).map((item) => (
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
