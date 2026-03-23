import React from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import { SYSTEM_TYPES, VENDORS } from "../config/estimateConfig";
import { getVendorByName } from "../config/vendorsConfig";
import { num, rub, toNumber } from "../lib/estimate";
import { buildHowCalculated } from "../lib/estimateEngine";
import VendorConfigurator from "./VendorConfigurator";

export default function SystemsStep({ systems, addSystem, removeSystem, updateSystem, updateSystemEquipmentProfile, systemResults, refreshVendorPricing, vendorPriceSnapshots }) {
  return (
    <section className="panel">
      <div className="panel-header"><div><h2>Системы</h2></div><button className="primary-btn" onClick={addSystem} type="button"><Plus size={16} />+ Система</button></div>
      <div className="stack">
        {systems.map((system, index) => {
          const typeMeta = SYSTEM_TYPES.find((x) => x.code === system.type);
          const Icon = typeMeta?.icon || Shield;
          const vendorList = VENDORS[system.type] || ["Базовый"];
          const selectedVendor = getVendorByName(system.type, system.vendor);
          const snapshot = vendorPriceSnapshots?.[system.id];
          const result = systemResults[index];
          const fetchedCount = (snapshot?.entries || []).filter((entry) => entry.status === "fetched").length;
          const fallbackCount = Math.max((snapshot?.entries || []).length - fetchedCount, 0);
          const modeLabelMap = {
            "vendor-parametric": "Прайс-карта вендора",
            "vendor-parametric+market": "Прайс-карта + онлайн-индексация рынка",
            fallback: "Расчётная fallback-цена",
            "fallback+market": "Fallback-цена + онлайн-индексация рынка",
          };
          const modeLabel = modeLabelMap[result?.equipmentData?.mode] || "Расчётная цена";

          return (
            <div className="system-card" key={system.id}>
              <div className="system-title"><div className="system-badge"><Icon size={18} /></div><div><h3>Система {index + 1}</h3><p>{typeMeta?.name}</p></div></div>
              <div className="zone-grid">
                <div className="input-card"><label>Тип системы</label><select value={system.type} onChange={(e) => updateSystem(system.id, "type", e.target.value)}>{SYSTEM_TYPES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
                <div className="input-card"><label>Вендор</label><select value={system.vendor} onChange={(e) => updateSystem(system.id, "vendor", e.target.value)}>{vendorList.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></div>
                <div className="input-card"><label title="Ручной множитель цены вендора. 1.00 = без корректировки; 1.10 = +10%; 0.90 = -10%.">Кастомный индекс</label><input type="number" step="0.01" value={system.customVendorIndex} onChange={(e) => updateSystem(system.id, "customVendorIndex", toNumber(e.target.value, 1))} /></div>
                <div className="vendor-hint full"><p>{selectedVendor.description}</p><button className="ghost-btn" type="button" title="Запросить актуальные цены с сайтов производителей и учесть их как рыночный индекс в расчёте." onClick={() => refreshVendorPricing(system)}>Обновить цены вендора</button></div>
                <VendorConfigurator
                  system={{ ...system, estimatedUnits: result?.units || 0 }}
                  onChange={(key, value) => updateSystem(system.id, "selectedEquipmentParams", { ...(system.selectedEquipmentParams || {}), [key]: value })}
                />

                {snapshot && (
                  <div className="pricing-caption full">
                    Актуализация: {snapshot.fetchedAt ? new Date(snapshot.fetchedAt).toLocaleString("ru-RU") : "—"}.
                    {snapshot.status === "error"
                      ? ` Ошибка обновления: ${snapshot.message || "не удалось получить цены"}.`
                      : ` Найдено онлайн: ${fetchedCount}, fallback: ${fallbackCount}.`}
                  </div>
                )}

                <div className="calc-explain full">
                  <h4>Как это рассчитано</h4>
                  <ul>{buildHowCalculated(result).map((line, idx) => <li key={`${system.id}-${idx}`}>{line}</li>)}</ul>
                  <div className="formula-table-wrap">
                    <table className="formula-table"><thead><tr><th>Параметр</th><th>Значение</th></tr></thead><tbody>{(result?.formulaRows || []).map((row, idx) => <tr key={idx}><td>{row.label}</td><td>x{num(row.value, 2)}</td></tr>)}</tbody></table>
                  </div>
                </div>

                <div className="action-cell full"><button className="danger-btn" type="button" onClick={() => removeSystem(system.id)} disabled={systems.length <= 1}><Trash2 size={16} />Удалить</button></div>
                <div className="vendor-hint full" title="Ключ выбора показывает, по каким параметрам подобрана цена (например, разрешение/уличная/PTZ/каналы/HDD).">
                  Ед. цена: {rub(result?.equipmentData?.unitPrice || 0)} ({modeLabel}) | Параметры цены: {result?.equipmentData?.selectionKey || "fallback"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
