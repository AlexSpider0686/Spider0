import React, { useMemo } from "react";
import SliderControl from "./SliderControl";
import { COEFFICIENT_GUIDE } from "../config/estimateConfig";
import { validateBudgetCoefficients } from "../lib/validation";
import { num, rub, toNumber } from "../lib/estimate";
import { buildCoefficientLayer } from "../lib/coefficient-engine";
import { buildRiskGuardInsight, getCoefficientShareLabel, getCoefficientSharePercent } from "../lib/budget-risk-guard";
import { repairTextTree } from "../lib/textEncoding";
import { buildProjectCrewPlan } from "../lib/crewPlan";

const sliderFields = [
  { key: "cableCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "equipmentCoef", min: 0.7, max: 1.5, step: 0.01 },
  { key: "laborCoef", min: 0.7, max: 1.6, step: 0.01 },
  { key: "complexityCoef", min: 0.8, max: 1.6, step: 0.01 },
  { key: "heightCoef", min: 1, max: 1.3, step: 0.01 },
  { key: "constrainedCoef", min: 1, max: 1.3, step: 0.01 },
  { key: "operatingFacilityCoef", min: 1, max: 1.25, step: 0.01 },
  { key: "nightWorkCoef", min: 1, max: 1.4, step: 0.01 },
  { key: "weekendWorkCoef", min: 1, max: 1.3, step: 0.01 },
  { key: "routingCoef", min: 1, max: 1.25, step: 0.01 },
  { key: "finishCoef", min: 1, max: 1.2, step: 0.01 },
];

const percentFields = repairTextTree([
  {
    key: "overheadPercent",
    label: "ОПР (накладные расходы), %",
    hint: "Применяется к стоимости работ после условий монтажа и до регионального коэффициента.",
    amountKey: "overhead",
  },
  {
    key: "ppePercent",
    label: "СИЗ и расходники, %",
    hint: "Добавляется к стоимости работ до регионального коэффициента.",
    amountKey: "ppe",
  },
  {
    key: "payrollTaxesPercent",
    label: "Отчисления ФОТ, %",
    hint: "Начисляются на стоимость работ после условий монтажа.",
    amountKey: "payrollTaxes",
  },
  {
    key: "utilizationPercent",
    label: "Утилизация (отпуска, больничные), %",
    hint: "Учитывает нерабочее время персонала в фонде проекта.",
    amountKey: "utilization",
  },
  {
    key: "adminPercent",
    label: "Административно-хозяйственные расходы, %",
    hint: "Начисляются после ФОТ, ОПР, утилизации и СИЗ.",
    amountKey: "admin",
  },
]);

const shareFields = repairTextTree([
  {
    key: "heightCoef",
    shareKey: "heightWorkSharePercent",
    label: "Доля высотных работ, %",
    hint: "Показывает, на какой процент работ реально действует коэффициент высотности.",
  },
  {
    key: "nightWorkCoef",
    shareKey: "nightWorkSharePercent",
    label: "Доля ночных работ, %",
    hint: "Показывает, какая часть работ выполняется в ночные смены.",
  },
  {
    key: "weekendWorkCoef",
    shareKey: "weekendWorkSharePercent",
    label: "Доля работ в выходные, %",
    hint: "Показывает, на какой объем работ распространяется коэффициент выходных дней.",
  },
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return Math.max(toNumber(value, 0), 0) / 100;
}

function computeCharges(baseValue, budget) {
  const overhead = baseValue * pct(budget.overheadPercent);
  const payrollTaxes = baseValue * pct(budget.payrollTaxesPercent);
  const utilization = baseValue * pct(budget.utilizationPercent);
  const ppe = baseValue * pct(budget.ppePercent);
  const adminBase = baseValue + overhead + payrollTaxes + utilization + ppe;
  const admin = adminBase * pct(budget.adminPercent);

  return {
    overhead,
    payrollTaxes,
    utilization,
    ppe,
    admin,
  };
}

function computeAggregateWorkBudget({ workBase, budget, buildingStatus, regionSubject, regionCoef }) {
  const coefficientLayer = buildCoefficientLayer({ budget, buildingStatus, regionSubject, regionCoef });
  const exploitedFactor = Math.max(toNumber(coefficientLayer.exploitedBuildingCoefficient, 1), 0.0001);
  const conditionFactor = Math.max(toNumber(coefficientLayer.conditionLaborFactor, 1), 0.0001);
  const regionalFactor = Math.max(toNumber(coefficientLayer.regionalCoefficient, 1), 0.0001);

  const workAfterConditions = workBase * conditionFactor * exploitedFactor;
  const charges = computeCharges(workAfterConditions, budget);
  const chargesTotal = Object.values(charges).reduce((sum, value) => sum + toNumber(value, 0), 0);
  const workTotalBeforeRegion = workAfterConditions + chargesTotal;
  const workTotal = workTotalBeforeRegion * regionalFactor;

  return {
    coefficientLayer,
    workAfterConditions,
    charges,
    chargesTotal,
    workTotalBeforeRegion,
    workTotal,
  };
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + toNumber(value, 0), 0) / values.length;
}

function buildBudgetRecommendations({ objectData, zones, systems, systemResults }) {
  const activeSystems = systems || [];
  const activeZones = zones || [];
  const routeSamples = (systemResults || []).map((row) => row?.routeComplexityAverage).filter((value) => Number.isFinite(toNumber(value, NaN)));
  const riskSamples = (systemResults || [])
    .map((row) => row?.laborDetails?.neuralCheck?.imbalanceRisk ?? row?.laborDetails?.neuralCheck?.underestimationRisk)
    .filter((value) => Number.isFinite(toNumber(value, NaN)));
  const sourceConfidence = (systemResults || [])
    .map((row) => row?.vendorSnapshotMetrics?.confidencePercent || row?.priceConfidencePercent || 0)
    .filter((value) => Number.isFinite(toNumber(value, NaN)));

  const avgRouteComplexity = average(routeSamples) || 1;
  const avgRisk = average(riskSamples);
  const avgConfidence = average(sourceConfidence);
  const maxZoneCeiling = Math.max(...activeZones.map((zone) => toNumber(zone?.ceilingHeight, 0)), toNumber(objectData?.ceilingHeight, 0), 0);
  const maxFloors = Math.max(...activeZones.map((zone) => toNumber(zone?.floors, 0)), toNumber(objectData?.floors, 0), 1);
  const objectType = objectData?.objectType;
  const buildingStatus = objectData?.buildingStatus;
  const systemCount = Math.max(activeSystems.length, 1);
  const operationalSensitiveObject = buildingStatus === "operational" && ["public", "transport", "energy"].includes(objectType);

  const recommendations = {
    cableCoef: {
      value: clamp(avgRouteComplexity * (systemCount > 2 ? 1.03 : 1), 0.9, 1.25),
      reason: `Опирается на среднюю сложность трасс по системам (${num(avgRouteComplexity, 2)}) и число подсистем (${systemCount}).`,
    },
    equipmentCoef: {
      value: clamp(avgConfidence > 75 ? 1 : avgConfidence > 55 ? 1.03 : 1.06, 0.95, 1.12),
      reason: `Опирается на качество найденных рыночных цен: средняя уверенность ${num(avgConfidence, 0)}%.`,
    },
    laborCoef: {
      value: clamp(1 + avgRisk * 0.14 + Math.max(systemCount - 2, 0) * 0.02, 0.95, 1.22),
      reason: `Опирается на сигнал дисбаланса по трудовой части (${num(avgRisk * 100, 0)}%) и число систем.`,
    },
    complexityCoef: {
      value: clamp(
        1 +
          Math.max(systemCount - 1, 0) * 0.03 +
          (["production", "transport", "energy"].includes(objectType) ? 0.08 : 0) +
          (objectType === "public" ? 0.04 : 0),
        1,
        1.28
      ),
      reason: `Опирается на тип объекта (${objectType || "не задан"}) и число инженерных подсистем.`,
    },
    heightCoef: {
      value: clamp(maxZoneCeiling >= 6 ? 1.18 : maxZoneCeiling >= 4.5 ? 1.1 : maxZoneCeiling >= 3.6 ? 1.04 : 1, 1, 1.25),
      reason: `Опирается на максимальную высоту зон ${num(maxZoneCeiling, 1)} м.`,
    },
    constrainedCoef: {
      value: clamp(
        1 +
          (avgRouteComplexity > 1.1 ? 0.05 : 0) +
          (maxFloors > 3 ? 0.03 : 0) +
          (["production", "transport", "public"].includes(objectType) ? 0.04 : 0),
        1,
        1.18
      ),
      reason: `Опирается на трассировку, этажность (${num(maxFloors, 0)}) и плотность инженерной среды.`,
    },
    operatingFacilityCoef: {
      value: buildingStatus === "operational" ? 1 : 1,
      reason:
        buildingStatus === "operational"
          ? "Для действующего здания отдельный ручной коэффициент обычно держат на x1.00, так как автоматическая поправка уже применяется отдельно."
          : "Для строящегося объекта дополнительная надбавка по действующему режиму не требуется.",
    },
    nightWorkCoef: {
      value: clamp(operationalSensitiveObject ? 1.08 : 1, 1, 1.12),
      reason: "Рекомендуется только если монтаж действительно выполняется в ночные смены или технологические окна.",
    },
    weekendWorkCoef: {
      value: clamp(operationalSensitiveObject ? 1.06 : 1, 1, 1.1),
      reason: "Оправдан только если часть фронта работ реально переносится на выходные или праздничные дни.",
    },
    routingCoef: {
      value: clamp(avgRouteComplexity, 1, 1.2),
      reason: `Опирается на среднюю сложность маршрутов прокладки (${num(avgRouteComplexity, 2)}).`,
    },
    finishCoef: {
      value: clamp(["public", "residential"].includes(objectType) ? 1.06 : objectType === "transport" ? 1.04 : 1, 1, 1.1),
      reason: "Опирается на вероятность чистовой отделки и требования к аккуратному монтажу.",
    },
  };

  return Object.fromEntries(
    Object.entries(recommendations).map(([key, item]) => [key, { ...item, value: Number(item.value.toFixed(2)) }])
  );
}

function getCurrentCoefficientCost({ fieldKey, budget, totals, systemResults, objectData }) {
  const safeTotals = totals || {};
  const safeObject = objectData || {};
  const workBase = (systemResults || []).reduce((sum, row) => sum + toNumber(row?.workBase, 0), 0);
  const currentAggregate = computeAggregateWorkBudget({
    workBase,
    budget,
    buildingStatus: safeObject.buildingStatus,
    regionSubject: safeObject.regionSubject,
    regionCoef: safeObject.regionCoef,
  });

  const currentValue = Math.max(toNumber(budget?.[fieldKey], 1), 0.0001);
  const currentEquipment = toNumber(safeTotals.totalEquipment, 0);
  const currentMaterials = toNumber(safeTotals.totalMaterials, 0);
  const cableMaterials = (systemResults || []).reduce(
    (sum, row) =>
      sum +
      toNumber(row?.breakdown?.materials?.cable, 0) +
      toNumber(row?.breakdown?.materials?.trayAndFasteners, 0),
    0
  );

  if (fieldKey === "equipmentCoef") {
    return currentValue === 1 ? 0 : currentEquipment - currentEquipment / currentValue;
  }
  if (fieldKey === "cableCoef") {
    return currentValue === 1 ? 0 : cableMaterials - cableMaterials / currentValue;
  }
  if (fieldKey === "laborCoef") {
    return currentValue === 1 ? 0 : currentAggregate.workTotal - currentAggregate.workTotal / currentValue;
  }
  if (fieldKey === "complexityCoef") {
    const directCost = currentEquipment + currentMaterials + currentAggregate.workTotal;
    return currentValue === 1 ? 0 : directCost - directCost / currentValue;
  }

  const nextBudget = { ...budget, [fieldKey]: 1 };
  const baselineAggregate = computeAggregateWorkBudget({
    workBase,
    budget: nextBudget,
    buildingStatus: safeObject.buildingStatus,
    regionSubject: safeObject.regionSubject,
    regionCoef: safeObject.regionCoef,
  });

  return currentAggregate.workTotal - baselineAggregate.workTotal;
}

function buildShareInput(field, budget, updateBudget) {
  return (
    <div className="budget-share-input">
      <label>{field.label}</label>
      <input
        type="number"
        min="0"
        max="100"
        step="1"
        value={toNumber(budget?.[field.shareKey], 100)}
        onChange={(event) => updateBudget(field.shareKey, clamp(toNumber(event.target.value, 100), 0, 100))}
      />
      <small className="hint-inline">{field.hint}</small>
    </div>
  );
}

export default function BudgetStep({ budget, updateBudget, objectData, effectiveObjectData, zones = [], systems = [], systemResults = [], totals = {} }) {
  const calcObjectData = effectiveObjectData || objectData;
  const validations = validateBudgetCoefficients(budget).reduce((acc, item) => ({ ...acc, [item.key]: item }), {});

  const recommendations = useMemo(
    () =>
      buildBudgetRecommendations({
        objectData: calcObjectData,
        zones,
        systems,
        systemResults,
      }),
    [calcObjectData, zones, systems, systemResults]
  );

  const aggregateWork = useMemo(
    () =>
      computeAggregateWorkBudget({
        workBase: systemResults.reduce((sum, row) => sum + toNumber(row?.workBase, 0), 0),
        budget,
        buildingStatus: calcObjectData?.buildingStatus,
        regionSubject: calcObjectData?.regionSubject,
        regionCoef: calcObjectData?.regionCoef,
      }),
    [systemResults, budget, calcObjectData]
  );

  const profitabilityRub = toNumber(totals.totalProfit, 0);
  const vatRub = toNumber(totals.totalVat, 0);
  const crewPlan = useMemo(() => buildProjectCrewPlan(systemResults, calcObjectData, totals), [systemResults, calcObjectData, totals]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Характеристики бюджета</h2>
          <p>
            Формула работ: базовая стоимость работ × коэффициенты условий + отчисления ФОТ + утилизация + СИЗ + АХР; затем применяется региональный коэффициент.
            Для ночных, высотных и выходных работ коэффициент можно применять только к нужной доле объема, а не ко всем 100% работ.
          </p>
        </div>
      </div>
      <div className="grid-three">
        {sliderFields.map((field) => {
          const meta = COEFFICIENT_GUIDE.find((item) => item.key === field.key);
          const validation = validations[field.key];
          const recommendation = recommendations[field.key];
          const coefficientRub = getCurrentCoefficientCost({
            fieldKey: field.key,
            budget,
            totals,
            systemResults,
            objectData: calcObjectData,
          });
          const shareField = shareFields.find((item) => item.key === field.key);
          const shareLabel = shareField ? getCoefficientShareLabel(budget, field.key) : "";
          const helperLines = [
            recommendation ? `Рекомендуемо для этого объекта: x${num(recommendation.value, 2)}.` : null,
            recommendation?.reason || null,
            shareField ? `Сейчас коэффициент действует на ${shareLabel}.` : null,
            `Вклад коэффициента в текущем расчете: ${rub(coefficientRub)}.`,
          ].filter(Boolean);
          const insight = buildRiskGuardInsight({
            fieldKey: field.key,
            budget,
            recommendation,
            coefficientRub,
          });

          return (
            <SliderControl
              key={field.key}
              label={meta?.title || field.key}
              value={budget[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              tooltip={`${meta?.tip || ""}${recommendation ? ` Рекомендуемо сейчас: x${num(recommendation.value, 2)}. ${recommendation.reason}` : ""}`}
              warning={validation?.warning}
              helperLines={helperLines}
              extraContent={shareField ? buildShareInput(shareField, budget, updateBudget) : null}
              insight={insight}
              onChange={(next) => updateBudget(field.key, toNumber(next, budget[field.key]))}
            />
          );
        })}

        {percentFields.map((field) => {
          const amount = toNumber(aggregateWork.charges?.[field.amountKey], 0);
          return (
            <div className="input-card" key={field.key}>
              <label>
                {field.label} <span className="hint-inline">({rub(amount)})</span>
              </label>
              <input type="number" step="0.1" value={budget[field.key]} onChange={(event) => updateBudget(field.key, toNumber(event.target.value))} />
              <small className="hint-inline">{field.hint}</small>
            </div>
          );
        })}

        <div className="input-card">
          <label>
            Рентабельность, % <span className="hint-inline">({rub(profitabilityRub)})</span>
          </label>
          <input
            type="number"
            step="0.1"
            value={budget.profitabilityPercent}
            onChange={(event) => updateBudget("profitabilityPercent", toNumber(event.target.value))}
          />
          <small className="hint-inline">Показывает текущую маржинальную часть проекта в рублях.</small>
        </div>

        <div className="input-card">
          <label>
            НДС, % <span className="hint-inline">({rub(vatRub)})</span>
          </label>
          <input type="number" step="0.1" value={budget.vatPercent} onChange={(event) => updateBudget("vatPercent", toNumber(event.target.value))} />
          <small className="hint-inline">Показывает сумму НДС по текущему составу бюджета.</small>
        </div>

        <div className="input-card">
          <label>Региональный коэффициент (из карточки объекта)</label>
          <input value={`x${num(calcObjectData?.regionCoef || 1, 2)}`} readOnly />
          <small className="hint-inline">
            Вклад регионального коэффициента в работах: {rub(toNumber(aggregateWork.workTotal, 0) - toNumber(aggregateWork.workTotalBeforeRegion, 0))}.
          </small>
        </div>
      </div>

      <div className="calc-explain" style={{ marginTop: 18 }}>
        <h3>Характеристика бюджета</h3>
        <p className="hint-inline">{crewPlan.methodology}</p>

        <div className="grid-two" style={{ marginTop: 12 }}>
          <div className="input-card">
            <label>Монтажная бригада и ПНР</label>
            <div className="ai-summary-list" style={{ marginTop: 10 }}>
              {crewPlan.summaryLines.slice(0, 3).map((line) => (
                <div key={line}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <small className="hint-inline">
              Фаза СМР: {num(crewPlan.field.durationDays, 0)} раб. дн., средняя загрузка {num(crewPlan.field.loadPerPersonDay, 1)} продуктивных ч/чел. в день.
            </small>
          </div>

          <div className="input-card">
            <label>Проектная группа</label>
            <div className="ai-summary-list" style={{ marginTop: 10 }}>
              {crewPlan.summaryLines.slice(3).map((line) => (
                <div key={line}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <small className="hint-inline">
              Фаза проектирования: {num(crewPlan.design.durationDays, 0)} раб. дн., средняя загрузка {num(crewPlan.design.loadPerPersonDay, 1)} продуктивных ч/чел. в день.
            </small>
          </div>
        </div>

        <div className="grid-two" style={{ marginTop: 12 }}>
          <div className="input-card">
            <label>Состав монтажного ресурса</label>
            <div className="ai-detection-list" style={{ marginTop: 10 }}>
              {crewPlan.field.roles.map((role) => (
                <span className="pricing-source-chip ok" key={role.role}>
                  {role.label}: {role.count} чел. ({num(role.sharePercent, 0)}%)
                </span>
              ))}
            </div>
          </div>

          <div className="input-card">
            <label>Состав проектного ресурса</label>
            <div className="ai-detection-list" style={{ marginTop: 10 }}>
              {crewPlan.design.roles.map((role) => (
                <span className="pricing-source-chip ok" key={role.role}>
                  {role.label}: {role.count} чел. ({num(role.sharePercent, 0)}%)
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="input-card" style={{ marginTop: 12 }}>
          <label>Распределение по системам</label>
          <div className="ai-summary-list" style={{ marginTop: 10 }}>
            {crewPlan.systemCrewRows.slice(0, 6).map((row) => (
              <div key={row.systemName}>
                <span>
                  {row.systemName}: пик {row.peakCrew} чел., {row.durationDays} раб. дн., состав {row.leadRoles}. {row.complexityNote}.
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
