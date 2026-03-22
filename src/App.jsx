import React, { useMemo, useState } from "react";
import { Building2, Layers, Wallet, Plus, Trash2, ChevronLeft, ChevronRight, Shield, Download, Info } from "lucide-react";
import {
  SYSTEM_TYPES,
  VENDORS,
  OBJECT_TYPES,
  ZONE_TYPES,
  DEFAULT_BUDGET,
  DEFAULT_ZONE,
  DEFAULT_SYSTEM,
  COEFFICIENT_GUIDE,
} from "./config/estimateConfig";
import { rub, num, calculateSystem, calculateTotals, buildEstimateRows, downloadCsv, toNumber } from "./lib/estimate";

export default function App() {
  const [step, setStep] = useState(0);
  const [objectData, setObjectData] = useState({
    projectName: "Объект 1",
    objectType: "tower",
    totalArea: 120804,
    floors: 18,
    basementFloors: 5,
    ceilingHeight: 3.2,
    notes: "",
  });

  const [zones, setZones] = useState([
    DEFAULT_ZONE(1, "Офисные этажи", "office", 82147, 17),
    DEFAULT_ZONE(2, "Паркинг", "parking", 24161, 5),
    DEFAULT_ZONE(3, "Общие зоны", "public", 14496, 6),
  ]);

  const [systems, setSystems] = useState([
    DEFAULT_SYSTEM(1, "sot"),
    DEFAULT_SYSTEM(2, "sots"),
    DEFAULT_SYSTEM(3, "skud"),
    DEFAULT_SYSTEM(4, "ssoi"),
    DEFAULT_SYSTEM(5, "aps"),
    DEFAULT_SYSTEM(6, "soue"),
  ]);

  const [budget, setBudget] = useState(DEFAULT_BUDGET);

  const recalculatedArea = useMemo(() => zones.reduce((sum, z) => sum + toNumber(z.area), 0), [zones]);

  const systemResults = useMemo(() => systems.map((sys) => calculateSystem(sys, zones, budget)), [systems, zones, budget]);

  const totals = useMemo(() => calculateTotals(systemResults), [systemResults]);

  function updateObject(key, value) {
    setObjectData((prev) => ({ ...prev, [key]: value }));
  }

  function updateZone(id, key, value) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, [key]: value } : z)));
  }

  function addZone() {
    setZones((prev) => [...prev, DEFAULT_ZONE(Date.now(), `Зона ${prev.length + 1}`, "office", 1000, 1)]);
  }

  function removeZone(id) {
    setZones((prev) => (prev.length <= 1 ? prev : prev.filter((z) => z.id !== id)));
  }

  function updateSystem(id, key, value) {
    setSystems((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (key === "type") {
          const vendorList = VENDORS[value] || ["Базовый"];
          return {
            ...s,
            type: value,
            vendor: vendorList[0],
            baseVendor: "Базовый",
            customVendorIndex: 1,
          };
        }
        return { ...s, [key]: value };
      })
    );
  }

  function addSystem() {
    setSystems((prev) => [...prev, DEFAULT_SYSTEM(Date.now(), "sot")]);
  }

  function removeSystem(id) {
    setSystems((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== id)));
  }

  function updateBudget(key, value) {
    setBudget((prev) => ({ ...prev, [key]: value }));
  }

  function exportEstimate() {
    const objectTypeLabel = OBJECT_TYPES.find((x) => x.value === objectData.objectType)?.label || objectData.objectType;
    const rows = buildEstimateRows({ objectData: { ...objectData, objectTypeLabel }, recalculatedArea, systemResults, totals });
    downloadCsv(`${objectData.projectName || "estimate"}.csv`, rows);
  }

  const steps = [
    { key: "object", label: "Объект", icon: Building2 },
    { key: "systems", label: "Системы", icon: Layers },
    { key: "budget", label: "Бюджет", icon: Wallet },
  ];

  return (
    <div className="page-shell">
      <div className="app-wrap">
        <header className="hero-card">
          <div>
            <div className="hero-kicker">Security Estimation Suite</div>
            <h1>Калькулятор сметы систем безопасности</h1>
            <p>
              Интерфейс собран по шагам: объект → системы → характеристики бюджета.
              Светлый high-tech стиль, объёмные карточки и удобная структура под пресейл.
            </p>
          </div>
          <button className="primary-btn" onClick={exportEstimate}>
            <Download size={18} />
            Экспорт CSV
          </button>
        </header>

        <section className="stepper-card">
          <div className="stepper">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = index === step;
              const done = index < step;
              return (
                <button
                  key={item.key}
                  className={`step-chip ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => setStep(index)}
                  type="button"
                >
                  <span className="step-icon"><Icon size={18} /></span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="step-actions">
            <button className="ghost-btn" type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft size={16} />
              Назад
            </button>
            <button className="primary-btn" type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}>
              Далее
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {step === 0 && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Объект</h2>
                <p>Тип, площадь, характеристики объекта и зональная структура.</p>
              </div>
            </div>

            <div className="grid-two">
              <div className="input-card"><label>Название проекта</label><input value={objectData.projectName} onChange={(e) => updateObject("projectName", e.target.value)} /></div>
              <div className="input-card"><label>Тип объекта</label><select value={objectData.objectType} onChange={(e) => updateObject("objectType", e.target.value)}>{OBJECT_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
              <div className="input-card"><label>Площадь по объекту, м²</label><input type="number" value={objectData.totalArea} onChange={(e) => updateObject("totalArea", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Площадь по зонам, м²</label><input type="number" value={recalculatedArea} readOnly /></div>
              <div className="input-card"><label>Надземные этажи</label><input type="number" value={objectData.floors} onChange={(e) => updateObject("floors", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Подземные этажи</label><input type="number" value={objectData.basementFloors} onChange={(e) => updateObject("basementFloors", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Средняя высота, м</label><input type="number" step="0.1" value={objectData.ceilingHeight} onChange={(e) => updateObject("ceilingHeight", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Примечание</label><input value={objectData.notes} onChange={(e) => updateObject("notes", e.target.value)} /></div>
            </div>

            <div className="subpanel">
              <div className="subpanel-header">
                <div>
                  <h3>Зоны объекта</h3>
                  <p>Раздели объект на функциональные зоны — это влияет на расчёт систем.</p>
                </div>
                <button className="primary-btn" onClick={addZone} type="button"><Plus size={16} />Добавить зону</button>
              </div>

              <div className="stack">
                {zones.map((zone) => (
                  <div className="zone-card" key={zone.id}>
                    <div className="zone-grid">
                      <div className="input-card"><label>Название зоны</label><input value={zone.name} onChange={(e) => updateZone(zone.id, "name", e.target.value)} /></div>
                      <div className="input-card"><label>Тип зоны</label><select value={zone.type} onChange={(e) => updateZone(zone.id, "type", e.target.value)}>{ZONE_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
                      <div className="input-card"><label>Площадь, м²</label><input type="number" value={zone.area} onChange={(e) => updateZone(zone.id, "area", toNumber(e.target.value))} /></div>
                      <div className="input-card"><label>Этажей</label><input type="number" value={zone.floors} onChange={(e) => updateZone(zone.id, "floors", toNumber(e.target.value))} /></div>
                      <div className="input-card"><label>Высота, м</label><input type="number" step="0.1" value={zone.ceilingHeight} onChange={(e) => updateZone(zone.id, "ceilingHeight", toNumber(e.target.value))} /></div>
                      <div className="action-cell">
                        <button className="danger-btn" type="button" onClick={() => removeZone(zone.id)} disabled={zones.length <= 1}><Trash2 size={16} />Удалить</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Системы</h2>
                <p>Добавляй системы, выбирай тип, вендора и индивидуальные настройки.</p>
              </div>
              <button className="primary-btn" onClick={addSystem} type="button"><Plus size={16} />+ Система</button>
            </div>

            <div className="stack">
              {systems.map((system, index) => {
                const typeMeta = SYSTEM_TYPES.find((x) => x.code === system.type);
                const Icon = typeMeta?.icon || Shield;
                const vendorList = VENDORS[system.type] || ["Базовый"];
                return (
                  <div className="system-card" key={system.id}>
                    <div className="system-title">
                      <div className="system-badge"><Icon size={18} /></div>
                      <div>
                        <h3>Система {index + 1}</h3>
                        <p>{typeMeta?.name || "Система"}</p>
                      </div>
                    </div>

                    <div className="zone-grid">
                      <div className="input-card"><label>Тип системы</label><select value={system.type} onChange={(e) => updateSystem(system.id, "type", e.target.value)}>{SYSTEM_TYPES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select></div>
                      <div className="input-card"><label>Вендор</label><select value={system.vendor} onChange={(e) => updateSystem(system.id, "vendor", e.target.value)}>{vendorList.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></div>
                      <div className="input-card"><label>Базовый вендор</label><select value={system.baseVendor} onChange={(e) => updateSystem(system.id, "baseVendor", e.target.value)}>{vendorList.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></div>
                      <div className="input-card"><label>Кастомный индекс</label><input type="number" step="0.01" value={system.customVendorIndex} onChange={(e) => updateSystem(system.id, "customVendorIndex", toNumber(e.target.value, 1))} /></div>
                      <div className="input-card full"><label>Комментарий</label><input value={system.note} onChange={(e) => updateSystem(system.id, "note", e.target.value)} /></div>
                      <div className="action-cell full">
                        <button className="danger-btn" type="button" onClick={() => removeSystem(system.id)} disabled={systems.length <= 1}><Trash2 size={16} />Удалить систему</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Характеристики бюджета</h2>
                <p>Коэффициенты, накладные, СИЗ, отчисления, рентабельность и НДС.</p>
              </div>
            </div>

            <div className="grid-three">
              <div className="input-card"><label>Коэффициент кабеля</label><input type="number" step="0.01" value={budget.cableCoef} onChange={(e) => updateBudget("cableCoef", toNumber(e.target.value, 1))} /></div>
              <div className="input-card"><label>Коэффициент оборудования</label><input type="number" step="0.01" value={budget.equipmentCoef} onChange={(e) => updateBudget("equipmentCoef", toNumber(e.target.value, 1))} /></div>
              <div className="input-card"><label>Коэффициент труда</label><input type="number" step="0.01" value={budget.laborCoef} onChange={(e) => updateBudget("laborCoef", toNumber(e.target.value, 1))} /></div>
              <div className="input-card"><label>Коэффициент сложности</label><input type="number" step="0.01" value={budget.complexityCoef} onChange={(e) => updateBudget("complexityCoef", toNumber(e.target.value, 1))} /></div>
              <div className="input-card"><label>Накладные, %</label><input type="number" step="0.1" value={budget.overheadPercent} onChange={(e) => updateBudget("overheadPercent", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Расходка / СИЗ, %</label><input type="number" step="0.1" value={budget.ppePercent} onChange={(e) => updateBudget("ppePercent", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Отчисления ФОТ, %</label><input type="number" step="0.1" value={budget.payrollTaxesPercent} onChange={(e) => updateBudget("payrollTaxesPercent", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>Рентабельность, %</label><input type="number" step="0.1" value={budget.profitabilityPercent} onChange={(e) => updateBudget("profitabilityPercent", toNumber(e.target.value))} /></div>
              <div className="input-card"><label>НДС, %</label><input type="number" step="0.1" value={budget.vatPercent} onChange={(e) => updateBudget("vatPercent", toNumber(e.target.value))} /></div>
              <div className="input-card">
                <label>Налоговый режим</label>
                <select value={budget.taxMode} onChange={(e) => updateBudget("taxMode", e.target.value)}>
                  <option value="osno">ОСНО</option>
                  <option value="usn">УСН</option>
                </select>
              </div>
            </div>

            <div className="coef-guide">
              <div className="coef-guide-title"><Info size={16} />Справка по коэффициентам</div>
              <div className="coef-guide-grid">
                {COEFFICIENT_GUIDE.map((item) => (
                  <article key={item.key} className="coef-tip">
                    <h4>{item.title}</h4>
                    <p className="range">Рекомендуемый диапазон: {item.range}</p>
                    <p>{item.tip}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Итоги</h2>
              <p>Сводный результат по всем добавленным системам.</p>
            </div>
          </div>

          <div className="summary-grid">
            <div className="metric-card"><span>Материалы</span><strong>{rub(totals.totalMaterials)}</strong></div>
            <div className="metric-card"><span>Труд</span><strong>{rub(totals.totalLabor)}</strong></div>
            <div className="metric-card"><span>Накладные + СИЗ + отчисления</span><strong>{rub(totals.totalOverhead)}</strong></div>
            <div className="metric-card"><span>Рентабельность</span><strong>{rub(totals.totalProfit)}</strong></div>
            <div className="metric-card"><span>НДС</span><strong>{rub(totals.totalVat)}</strong></div>
            <div className="metric-card total"><span>Итоговая стоимость</span><strong>{rub(totals.total)}</strong></div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Система</th><th>Вендор</th><th>Кабель, м</th><th>Ед.</th><th>Материалы</th><th>Труд</th><th>Итого</th>
                </tr>
              </thead>
              <tbody>
                {systemResults.map((r, idx) => (
                  <tr key={`${r.systemType}-${idx}`}>
                    <td>{r.systemName}</td><td>{r.vendor}</td><td>{num(r.cable, 0)}</td><td>{num(r.units, 0)}</td><td>{rub(r.materialsBase)}</td><td>{rub(r.laborBase)}</td><td>{rub(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
