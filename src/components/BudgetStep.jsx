import React from "react";
import SliderControl from "./SliderControl";
import { COEFFICIENT_GUIDE } from "../config/estimateConfig";
import { validateBudgetCoefficients } from "../lib/validation";
import { num, toNumber } from "../lib/estimate";

const sliderFields = [
  { key: "cableCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "equipmentCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "laborCoef", min: 0.7, max: 1.6, step: 0.01 },
  { key: "complexityCoef", min: 0.8, max: 1.6, step: 0.01 },
  { key: "heightCoef", min: 1, max: 1.3, step: 0.01 },
  { key: "constrainedCoef", min: 1, max: 1.3, step: 0.01 },
  { key: "operatingFacilityCoef", min: 1, max: 1.25, step: 0.01 },
  { key: "nightWorkCoef", min: 1, max: 1.4, step: 0.01 },
  { key: "routingCoef", min: 1, max: 1.25, step: 0.01 },
  { key: "finishCoef", min: 1, max: 1.2, step: 0.01 },
];

export default function BudgetStep({ budget, updateBudget, objectData }) {
  const validations = validateBudgetCoefficients(budget).reduce((acc, item) => ({ ...acc, [item.key]: item }), {});

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Характеристики бюджета</h2>
          <p>
            Формула работ: базовая стоимость работ × коэффициенты условий + отчисления ФОТ + утилизация + СИЗ + АХР; затем
            применяется региональный коэффициент.
          </p>
        </div>
      </div>
      <div className="grid-three">
        {sliderFields.map((field) => {
          const meta = COEFFICIENT_GUIDE.find((item) => item.key === field.key);
          const validation = validations[field.key];
          return (
            <SliderControl
              key={field.key}
              label={meta?.title || field.key}
              value={budget[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              tooltip={meta?.tip || ""}
              warning={validation?.warning}
              onChange={(next) => updateBudget(field.key, toNumber(next, budget[field.key]))}
            />
          );
        })}
        <div className="input-card">
          <label>ОПР (накладные расходы), %</label>
          <input type="number" step="0.1" value={budget.overheadPercent} onChange={(event) => updateBudget("overheadPercent", toNumber(event.target.value))} />
          <small className="hint-inline">Применяется к базовой стоимости работ.</small>
        </div>
        <div className="input-card">
          <label>СИЗ и расходники, %</label>
          <input type="number" step="0.1" value={budget.ppePercent} onChange={(event) => updateBudget("ppePercent", toNumber(event.target.value))} />
          <small className="hint-inline">Добавляется к стоимости работ до регионального коэффициента.</small>
        </div>
        <div className="input-card">
          <label>Отчисления ФОТ, %</label>
          <input
            type="number"
            step="0.1"
            value={budget.payrollTaxesPercent}
            onChange={(event) => updateBudget("payrollTaxesPercent", toNumber(event.target.value))}
          />
          <small className="hint-inline">Начисляются на базовую стоимость работ.</small>
        </div>
        <div className="input-card">
          <label>Утилизация (отпуска, больничные), %</label>
          <input
            type="number"
            step="0.1"
            value={budget.utilizationPercent}
            onChange={(event) => updateBudget("utilizationPercent", toNumber(event.target.value))}
          />
          <small className="hint-inline">Учитывает нерабочее время персонала в фонде проекта.</small>
        </div>
        <div className="input-card">
          <label>Административно-хозяйственные расходы (АХР), %</label>
          <input type="number" step="0.1" value={budget.adminPercent} onChange={(event) => updateBudget("adminPercent", toNumber(event.target.value))} />
          <small className="hint-inline">Применяются к работам после начисления ФОТ, ОПР, утилизации и СИЗ.</small>
        </div>
        <div className="input-card">
          <label>Рентабельность, %</label>
          <input
            type="number"
            step="0.1"
            value={budget.profitabilityPercent}
            onChange={(event) => updateBudget("profitabilityPercent", toNumber(event.target.value))}
          />
        </div>
        <div className="input-card">
          <label>НДС, %</label>
          <input type="number" step="0.1" value={budget.vatPercent} onChange={(event) => updateBudget("vatPercent", toNumber(event.target.value))} />
        </div>
        <div className="input-card">
          <label>Региональный коэффициент (из карточки объекта)</label>
          <input value={`x${num(objectData?.regionCoef || 1, 2)}`} readOnly />
        </div>
      </div>
    </section>
  );
}
