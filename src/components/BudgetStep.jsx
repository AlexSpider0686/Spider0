import React from "react";
import SliderControl from "./SliderControl";
import { COEFFICIENT_GUIDE } from "../config/estimateConfig";
import { validateBudgetCoefficients } from "../lib/validation";
import { toNumber } from "../lib/estimate";

const sliderFields = [
  { key: "cableCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "equipmentCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "laborCoef", min: 0.7, max: 1.6, step: 0.01 },
  { key: "complexityCoef", min: 0.8, max: 1.6, step: 0.01 },
  { key: "overheadPercent", min: 0, max: 40, step: 0.5 },
  { key: "profitabilityPercent", min: 0, max: 40, step: 0.5 },
  { key: "vatPercent", min: 0, max: 25, step: 0.5 },
];

export default function BudgetStep({ budget, updateBudget }) {
  const validations = validateBudgetCoefficients(budget).reduce((acc, item) => ({ ...acc, [item.key]: item }), {});

  return (
    <section className="panel">
      <div className="panel-header"><div><h2>Характеристики бюджета</h2><p>Коэффициенты только слайдерами + ручной ввод рядом.</p></div></div>
      <div className="grid-three">
        {sliderFields.map((field) => {
          const meta = COEFFICIENT_GUIDE.find((x) => x.key === field.key);
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
        <div className="input-card"><label>СИЗ, %</label><input type="number" step="0.1" value={budget.ppePercent} onChange={(e) => updateBudget("ppePercent", toNumber(e.target.value))} /></div>
        <div className="input-card"><label>Отчисления ФОТ, %</label><input type="number" step="0.1" value={budget.payrollTaxesPercent} onChange={(e) => updateBudget("payrollTaxesPercent", toNumber(e.target.value))} /></div>
      </div>
    </section>
  );
}
