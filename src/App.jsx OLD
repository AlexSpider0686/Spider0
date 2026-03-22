import React, { useMemo, useState } from "react";
import {
  Building2,
  Layers3,
  Wallet,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Camera,
  Lock,
  Bell,
  Cpu,
  Siren,
  Download,
} from "lucide-react";

const SYSTEM_TYPES = [
  { code: "sot", name: "СОТ", icon: Camera },
  { code: "sots", name: "СОТС", icon: Shield },
  { code: "skud", name: "СКУД", icon: Lock },
  { code: "ssoi", name: "ССОИ", icon: Cpu },
  { code: "aps", name: "АПС", icon: Bell },
  { code: "soue", name: "СОУЭ", icon: Siren },
];

const VENDORS = {
  sot: ["Hikvision", "Dahua", "TRASSIR", "Flow", "Базовый"],
  sots: ["Бастион", "Рубеж", "Болид", "Базовый"],
  skud: ["Бастион", "Sigur", "Parsec", "Базовый"],
  ssoi: ["Huawei", "TRASSIR", "Интеграция", "Базовый"],
  aps: ["Болид", "Рубеж", "Simplex", "Базовый"],
  soue: ["Болид", "Рубеж", "Roxton", "Базовый"],
};

const OBJECT_TYPES = [
  { value: "office", label: "Офисный" },
  { value: "mixed", label: "Смешанный" },
  { value: "tower", label: "Высотный / башня" },
];

const ZONE_TYPES = [
  { value: "office", label: "Офис" },
  { value: "parking", label: "Паркинг" },
  { value: "public", label: "Общие зоны" },
  { value: "technical", label: "Техпомещения" },
];

const DEFAULT_BUDGET = {
  cableCoef: 1.0,
  equipmentCoef: 1.0,
  laborCoef: 1.0,
  complexityCoef: 1.0,
  overheadPercent: 16,
  ppePercent: 3,
  payrollTaxesPercent: 30,
  profitabilityPercent: 18,
  vatPercent: 20,
  taxMode: "osno",
};

const DEFAULT_ZONE = (id, name, type = "office", area = 1000, floors = 1) => ({
  id,
  name,
  type,
  area,
  floors,
  ceilingHeight: 3,
});

const DEFAULT_SYSTEM = (id, type = "sot") => ({
  id,
  type,
  vendor: VENDORS[type][0],
  baseVendor: "Базовый",
  customVendorIndex: 1,
  note: "",
});

const BASE_RATES = {
  sot: {
    cablePerM2: { office: 0.95, parking: 0.62, public: 1.15, technical: 0.7 },
    unitsPer1000: { office: 6.5, parking: 4.2, public: 10, technical: 5 },
    equipUnit: 24000,
    laborPerCableM: 210,
    installPerUnit: 2200,
  },
  sots: {
    cablePerM2: { office: 0.52, parking: 0.34, public: 0.74, technical: 0.48 },
    unitsPer1000: { office: 8, parking: 5, public: 12, technical: 7 },
    equipUnit: 6500,
    laborPerCableM: 185,
    installPerUnit: 950,
  },
  skud: {
    cablePerM2: { office: 0.38, parking: 0.18, public: 0.58, technical: 0.22 },
    unitsPer1000: { office: 1.6, parking: 0.6, public: 2.8, technical: 0.8 },
    equipUnit: 28000,
    laborPerCableM: 185,
    installPerUnit: 4800,
  },
  ssoi: {
    cablePerM2: { office: 0.16, parking: 0.1, public: 0.22, technical: 0.18 },
    unitsPer1000: { office: 1.1, parking: 0.5, public: 1.7, technical: 1.0 },
    equipUnit: 52000,
    laborPerCableM: 155,
    installPerUnit: 6500,
  },
  aps: {
    cablePerM2: { office: 0.64, parking: 0.42, public: 0.86, technical: 0.58 },
    unitsPer1000: { office: 26, parking: 14, public: 30, technical: 18 },
    equipUnit: 4200,
    laborPerCableM: 195,
    installPerUnit: 850,
  },
  soue: {
    cablePerM2: { office: 0.36, parking: 0.28, public: 0.48, technical: 0.24 },
    unitsPer1000: { office: 7, parking: 5, public: 10, technical: 4 },
    equipUnit: 7800,
    laborPerCableM: 180,
    installPerUnit: 740,
  },
};

const VENDOR_INDEX = {
  sot: { "Базовый": 1.0, Hikvision: 1.04, Dahua: 1.0, TRASSIR: 1.12, Flow: 1.08 },
  sots: { "Базовый": 1.0, Бастион: 1.0, Рубеж: 1.03, Болид: 1.05 },
  skud: { "Базовый": 1.0, Бастион: 1.0, Sigur: 1.08, Parsec: 1.1 },
  ssoi: { "Базовый": 1.0, Huawei: 1.12, TRASSIR: 1.08, Интеграция: 1.15 },
  aps: { "Базовый": 1.0, Болид: 1.0, Рубеж: 1.02, Simplex: 1.35 },
  soue: { "Базовый": 1.0, Болид: 1.0, Рубеж: 1.03, Roxton: 1.14 },
};

function rub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function num(value, digits = 0) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function calculateSystem(system, zones, budget) {
  const rates = BASE_RATES[system.type];
  const vendorFactor = (VENDOR_INDEX[system.type]?.[system.vendor] || 1) * Number(system.customVendorIndex || 1);

  let cable = 0;
  let units = 0;

  zones.forEach((z) => {
    const area = Number(z.area || 0);
    const floors = Math.max(Number(z.floors || 1), 1);
    const cableReserve = 1 + (floors - 1) * 0.012 + (Number(z.ceilingHeight || 3) > 3 ? 0.04 : 0);
    cable += area * (rates.cablePerM2[z.type] || rates.cablePerM2.office) * cableReserve;
    units += (area / 1000) * (rates.unitsPer1000[z.type] || rates.unitsPer1000.office);
  });

  cable *= Number(budget.cableCoef || 1) * Number(budget.complexityCoef || 1);
  units *= Number(budget.equipmentCoef || 1);

  const equipCost = units * rates.equipUnit * vendorFactor;
  const cableMaterials = cable * 92;
  const trayAndFasteners = cable * 51;
  const materialsBase = equipCost + cableMaterials + trayAndFasteners;

  const laborCable = cable * rates.laborPerCableM * Number(budget.laborCoef || 1) * Number(budget.complexityCoef || 1);
  const laborInstall = units * rates.installPerUnit * Number(budget.laborCoef || 1) * Number(budget.complexityCoef || 1);
  const laborBase = laborCable + laborInstall;

  const overhead = laborBase * (Number(budget.overheadPercent || 0) / 100);
  const ppe = laborBase * (Number(budget.ppePercent || 0) / 100);
  const payrollTaxes = laborBase * (Number(budget.payrollTaxesPercent || 0) / 100);

  const directCost = materialsBase + laborBase + overhead + ppe + payrollTaxes;
  const profit = directCost * (Number(budget.profitabilityPercent || 0) / 100);
  const subtotal = directCost + profit;
  const vat = budget.taxMode === "osno" ? subtotal * (Number(budget.vatPercent || 0) / 100) : 0;
  const total = subtotal + vat;

  return {
    systemType: system.type,
    systemName: SYSTEM_TYPES.find((x) => x.code === system.type)?.name || system.type,
    vendor: system.vendor,
    cable,
    units,
    equipCost,
    cableMaterials,
    trayAndFasteners,
    materialsBase,
    laborBase,
    overhead,
    ppe,
    payrollTaxes,
    profit,
    vat,
    total,
  };
}

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

  const recalculatedArea = useMemo(
    () => zones.reduce((sum, z) => sum + Number(z.area || 0), 0),
    [zones]
  );

  const systemResults = useMemo(
    () => systems.map((sys) => calculateSystem(sys, zones, budget)),
    [systems, zones, budget]
  );

  const totals = useMemo(() => {
    const totalMaterials = systemResults.reduce((s, x) => s + x.materialsBase, 0);
    const totalLabor = systemResults.reduce((s, x) => s + x.laborBase, 0);
    const totalOverhead = systemResults.reduce((s, x) => s + x.overhead + x.ppe + x.payrollTaxes, 0);
    const totalProfit = systemResults.reduce((s, x) => s + x.profit, 0);
    const totalVat = systemResults.reduce((s, x) => s + x.vat, 0);
    const total = systemResults.reduce((s, x) => s + x.total, 0);
    return { totalMaterials, totalLabor, totalOverhead, totalProfit, totalVat, total };
  }, [systemResults]);

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
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  function updateSystem(id, key, value) {
    setSystems((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (key === "type") {
          return { ...s, type: value, vendor: VENDORS[value][0] };
        }
        return { ...s, [key]: value };
      })
    );
  }

  function addSystem() {
    setSystems((prev) => [...prev, DEFAULT_SYSTEM(Date.now(), "sot")]);
  }

  function removeSystem(id) {
    setSystems((prev) => prev.filter((s) => s.id !== id));
  }

  function updateBudget(key, value) {
    setBudget((prev) => ({ ...prev, [key]: value }));
  }

  function exportEstimate() {
    const rows = [
      ["Проект", objectData.projectName],
      ["Тип объекта", OBJECT_TYPES.find((x) => x.value === objectData.objectType)?.label || objectData.objectType],
      ["Площадь, м²", recalculatedArea],
      [],
      ["Система", "Вендор", "Кабель, м", "Ед. оборудования", "Материалы, ₽", "Труд, ₽", "Накладные+СИЗ+отчисления, ₽", "Прибыль, ₽", "НДС, ₽", "Итого, ₽"],
      ...systemResults.map((r) => [
        r.systemName,
        r.vendor,
        num(r.cable, 0),
        num(r.units, 0),
        num(r.materialsBase, 0),
        num(r.laborBase, 0),
        num(r.overhead + r.ppe + r.payrollTaxes, 0),
        num(r.profit, 0),
        num(r.vat, 0),
        num(r.total, 0),
      ]),
      [],
      ["ИТОГО", "", "", "", num(totals.totalMaterials, 0), num(totals.totalLabor, 0), num(totals.totalOverhead, 0), num(totals.totalProfit, 0), num(totals.totalVat, 0), num(totals.total, 0)],
    ];
    downloadCsv(`${objectData.projectName || "estimate"}.csv`, rows);
  }

  const steps = [
    { key: "object", label: "Объект", icon: Building2 },
    { key: "systems", label: "Системы", icon: Layers3 },
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
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronLeft size={16} />
              Назад
            </button>
            <button
              className="primary-btn"
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              disabled={step === steps.length - 1}
            >
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
              <div className="input-card">
                <label>Название проекта</label>
                <input value={objectData.projectName} onChange={(e) => updateObject("projectName", e.target.value)} />
              </div>
              <div className="input-card">
                <label>Тип объекта</label>
                <select value={objectData.objectType} onChange={(e) => updateObject("objectType", e.target.value)}>
                  {OBJECT_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </div>
              <div className="input-card">
                <label>Площадь по объекту, м²</label>
                <input type="number" value={objectData.totalArea} onChange={(e) => updateObject("totalArea", Number(e.target.value))} />
              </div>
              <div className="input-card">
                <label>Площадь по зонам, м²</label>
                <input type="number" value={recalculatedArea} readOnly />
              </div>
              <div className="input-card">
                <label>Надземные этажи</label>
                <input type="number" value={objectData.floors} onChange={(e) => updateObject("floors", Number(e.target.value))} />
              </div>
              <div className="input-card">
                <label>Подземные этажи</label>
                <input type="number" value={objectData.basementFloors} onChange={(e) => updateObject("basementFloors", Number(e.target.value))} />
              </div>
              <div className="input-card">
                <label>Средняя высота, м</label>
                <input type="number" step="0.1" value={objectData.ceilingHeight} onChange={(e) => updateObject("ceilingHeight", Number(e.target.value))} />
              </div>
              <div className="input-card">
                <label>Примечание</label>
                <input value={objectData.notes} onChange={(e) => updateObject("notes", e.target.value)} />
              </div>
            </div>

            <div className="subpanel">
              <div className="subpanel-header">
                <div>
                  <h3>Зоны объекта</h3>
                  <p>Раздели объект на функциональные зоны — это влияет на расчёт систем.</p>
                </div>
                <button className="primary-btn" onClick={addZone} type="button">
                  <Plus size={16} />
                  Добавить зону
                </button>
              </div>

              <div className="stack">
                {zones.map((zone) => (
                  <div className="zone-card" key={zone.id}>
                    <div className="zone-grid">
                      <div className="input-card">
                        <label>Название зоны</label>
                        <input value={zone.name} onChange={(e) => updateZone(zone.id, "name", e.target.value)} />
                      </div>
                      <div className="input-card">
                        <label>Тип зоны</label>
                        <select value={zone.type} onChange={(e) => updateZone(zone.id, "type", e.target.value)}>
                          {ZONE_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                      </div>
                      <div className="input-card">
                        <label>Площадь, м²</label>
                        <input type="number" value={zone.area} onChange={(e) => updateZone(zone.id, "area", Number(e.target.value))} />
                      </div>
                      <div className="input-card">
                        <label>Этажей</label>
                        <input type="number" value={zone.floors} onChange={(e) => updateZone(zone.id, "floors", Number(e.target.value))} />
                      </div>
                      <div className="input-card">
                        <label>Высота, м</label>
                        <input type="number" step="0.1" value={zone.ceilingHeight} onChange={(e) => updateZone(zone.id, "ceilingHeight", Number(e.target.value))} />
                      </div>
                      <div className="action-cell">
                        <button className="danger-btn" type="button" onClick={() => removeZone(zone.id)}>
                          <Trash2 size={16} />
                          Удалить
                        </button>
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
              <button className="primary-btn" onClick={addSystem} type="button">
                <Plus size={16} />
                + Система
              </button>
            </div>

            <div className="stack">
              {systems.map((system, index) => {
                const typeMeta = SYSTEM_TYPES.find((x) => x.code === system.type);
                const Icon = typeMeta?.icon || Shield;
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
                      <div className="input-card">
                        <label>Тип системы</label>
                        <select value={system.type} onChange={(e) => updateSystem(system.id, "type", e.target.value)}>
                          {SYSTEM_TYPES.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                        </select>
                      </div>

                      <div className="input-card">
                        <label>Вендор</label>
                        <select value={system.vendor} onChange={(e) => updateSystem(system.id, "vendor", e.target.value)}>
                          {VENDORS[system.type].map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}
                        </select>
                      </div>

                      <div className="input-card">
                        <label>Базовый вендор</label>
                        <input value={system.baseVendor} onChange={(e) => updateSystem(system.id, "baseVendor", e.target.value)} />
                      </div>

                      <div className="input-card">
                        <label>Кастомный индекс</label>
                        <input type="number" step="0.01" value={system.customVendorIndex} onChange={(e) => updateSystem(system.id, "customVendorIndex", Number(e.target.value))} />
                      </div>

                      <div className="input-card full">
                        <label>Комментарий</label>
                        <input value={system.note} onChange={(e) => updateSystem(system.id, "note", e.target.value)} />
                      </div>

                      <div className="action-cell full">
                        <button className="danger-btn" type="button" onClick={() => removeSystem(system.id)}>
                          <Trash2 size={16} />
                          Удалить систему
                        </button>
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
              <div className="input-card"><label>Коэффициент кабеля</label><input type="number" step="0.01" value={budget.cableCoef} onChange={(e) => updateBudget("cableCoef", Number(e.target.value))} /></div>
              <div className="input-card"><label>Коэффициент оборудования</label><input type="number" step="0.01" value={budget.equipmentCoef} onChange={(e) => updateBudget("equipmentCoef", Number(e.target.value))} /></div>
              <div className="input-card"><label>Коэффициент труда</label><input type="number" step="0.01" value={budget.laborCoef} onChange={(e) => updateBudget("laborCoef", Number(e.target.value))} /></div>
              <div className="input-card"><label>Коэффициент сложности</label><input type="number" step="0.01" value={budget.complexityCoef} onChange={(e) => updateBudget("complexityCoef", Number(e.target.value))} /></div>
              <div className="input-card"><label>Накладные, %</label><input type="number" step="0.1" value={budget.overheadPercent} onChange={(e) => updateBudget("overheadPercent", Number(e.target.value))} /></div>
              <div className="input-card"><label>Расходка / СИЗ, %</label><input type="number" step="0.1" value={budget.ppePercent} onChange={(e) => updateBudget("ppePercent", Number(e.target.value))} /></div>
              <div className="input-card"><label>Отчисления ФОТ, %</label><input type="number" step="0.1" value={budget.payrollTaxesPercent} onChange={(e) => updateBudget("payrollTaxesPercent", Number(e.target.value))} /></div>
              <div className="input-card"><label>Рентабельность, %</label><input type="number" step="0.1" value={budget.profitabilityPercent} onChange={(e) => updateBudget("profitabilityPercent", Number(e.target.value))} /></div>
              <div className="input-card"><label>НДС, %</label><input type="number" step="0.1" value={budget.vatPercent} onChange={(e) => updateBudget("vatPercent", Number(e.target.value))} /></div>
              <div className="input-card">
                <label>Налоговый режим</label>
                <select value={budget.taxMode} onChange={(e) => updateBudget("taxMode", e.target.value)}>
                  <option value="osno">ОСНО</option>
                  <option value="usn">УСН</option>
                </select>
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
                  <th>Система</th>
                  <th>Вендор</th>
                  <th>Кабель, м</th>
                  <th>Ед.</th>
                  <th>Материалы</th>
                  <th>Труд</th>
                  <th>Итого</th>
                </tr>
              </thead>
              <tbody>
                {systemResults.map((r, idx) => (
                  <tr key={`${r.systemType}-${idx}`}>
                    <td>{r.systemName}</td>
                    <td>{r.vendor}</td>
                    <td>{num(r.cable, 0)}</td>
                    <td>{num(r.units, 0)}</td>
                    <td>{rub(r.materialsBase)}</td>
                    <td>{rub(r.laborBase)}</td>
                    <td>{rub(r.total)}</td>
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
