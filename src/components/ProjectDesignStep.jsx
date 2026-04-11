import React from "react";
import { num, rub } from "../lib/estimate";
import { repairReactTextTree } from "../lib/repairReactTree";

const DESIGN_METRIC_HINTS = {
  totalHours:
    "Сумма проектных часов по всем системам без готовой РД. Формируется из расчетного объема системы, сложности объекта, этажности, зональности, трасс и состава проектной группы.",
  baseCost:
    "Базовая стоимость проектирования до финального итога. Считается из трудоемкости и ставок проектной группы по системам, которые реально проектируются в этом проекте.",
  totalDesign:
    "Итоговая стоимость проектирования по текущему проекту. Системы с готовым проектом или загруженной проектной спецификацией сюда не добавляются.",
  duration:
    "Максимальный срок проектирования по системам. Зависит от трудоемкости и выбранного размера проектной группы.",
  team:
    "Средний выбранный состав проектной группы. При изменении состава команды срок и стоимость пересчитываются сразу.",
  skipped:
    "Количество систем, по которым стоимость проектирования не начисляется, потому что по ним уже есть готовый проект.",
};

function sum(array, getter) {
  return (array || []).reduce((acc, item) => acc + getter(item), 0);
}

function resolveSliderMax(result) {
  return Math.max((result?.designRecommendedTeamSize || 1) + 3, 6);
}

function formatDesignDuration(result) {
  const exactMonths = Number(result?.designMonthsExact ?? result?.designDurationMonths ?? 0);
  if (!Number.isFinite(exactMonths) || exactMonths <= 0) return "0 мес.";
  if (exactMonths < 1) return `${num(Math.max(exactMonths * 22, 1), 0)} раб. дн.`;
  return `${num(exactMonths, 1)} мес.`;
}

export default function ProjectDesignStep({ systems = [], updateSystem, systemResults = [], totals = {} }) {
  const resultById = new Map(systemResults.map((item) => [item.systemId, item]));
  const calculatedSystems = systemResults.filter((item) => !item.designSkipped);
  const skippedSystems = systemResults.filter((item) => item.designSkipped);
  const totalDesignHours = sum(calculatedSystems, (item) => item.designHours || 0);
  const totalDesignMonths = Math.max(...calculatedSystems.map((item) => item.designMonthsExact || item.designDurationMonths || 0), 0);
  const avgTeamSize = calculatedSystems.length ? sum(calculatedSystems, (item) => item.designTeamSize || 1) / calculatedSystems.length : 0;

  const content = (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Проектирование</h2>
          <p>
            Для систем без загруженного проекта стоимость проектирования считается по трудоемкости, сложности объекта и составу проектной
            группы. Если по системе загружен PDF-проект или отмечено наличие РД, стоимость проектирования по ней не начисляется.
          </p>
        </div>
      </div>

      <div className="summary-grid breakdown-metrics">
        <div className="metric-card" title={DESIGN_METRIC_HINTS.totalHours}>
          <span>Трудоемкость проектирования</span>
          <strong>{num(totalDesignHours, 1)} ч</strong>
        </div>
        <div className="metric-card" title={DESIGN_METRIC_HINTS.baseCost}>
          <span>Базовая стоимость проектирования</span>
          <strong>{rub(sum(calculatedSystems, (item) => item.designBase || 0))}</strong>
        </div>
        <div className="metric-card" title={DESIGN_METRIC_HINTS.totalDesign}>
          <span>Итого проектирование</span>
          <strong>{rub(totals.totalDesign || 0)}</strong>
        </div>
        <div className="metric-card" title={DESIGN_METRIC_HINTS.duration}>
          <span>Срок проектирования</span>
          <strong>{totalDesignMonths < 1 ? `${num(Math.max(totalDesignMonths * 22, 1), 0)} раб. дн.` : `${num(totalDesignMonths, 1)} мес.`}</strong>
        </div>
        <div className="metric-card total" title={DESIGN_METRIC_HINTS.team}>
          <span>Средний состав группы</span>
          <strong>{num(avgTeamSize, 1)} чел.</strong>
        </div>
        <div className="metric-card" title={DESIGN_METRIC_HINTS.skipped}>
          <span>Системы с готовым проектом</span>
          <strong>{num(skippedSystems.length, 0)}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Часы</th>
              <th>Рекомендуемо</th>
              <th>Выбрано</th>
              <th>Срок</th>
              <th>База, ₽</th>
              <th>Начисления, ₽</th>
              <th>Итого, ₽</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => {
              const result = resultById.get(system.id);
              if (!result) return null;
              const currentTeam = result.designSkipped
                ? 0
                : Number(system.designTeamOverride ?? result.designTeamSize ?? result.designRecommendedTeamSize ?? 1);

              return (
                <tr key={`design-${system.id}`}>
                  <td>{result.systemName}</td>
                  <td>{result.designSkipped ? "Не рассчитывается" : `${num(result.designHours || 0, 1)} ч`}</td>
                  <td>{result.designSkipped ? "—" : num(result.designRecommendedTeamSize || 1, 0)}</td>
                  <td>{result.designSkipped ? "—" : num(currentTeam, 0)}</td>
                  <td>{result.designSkipped ? "Проект загружен" : formatDesignDuration(result)}</td>
                  <td>{result.designSkipped ? "—" : rub(result.designBase || 0)}</td>
                  <td>{result.designSkipped ? "—" : rub(result.designCharges || 0)}</td>
                  <td>{result.designSkipped ? "Не начисляется" : rub(result.designTotal || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="logic-grid" style={{ marginTop: 18 }}>
        {systems.map((system) => {
          const result = resultById.get(system.id);
          if (!result) return null;
          const currentTeam = result.designSkipped
            ? 0
            : Number(system.designTeamOverride ?? result.designTeamSize ?? result.designRecommendedTeamSize ?? 1);
          const sliderMax = resolveSliderMax(result);

          return (
            <article className="logic-card" key={`design-staffing-${system.id}`}>
              <h3>{result.systemName}</h3>
              {result.designSkipped ? (
                <p>{result.designStatusNote}</p>
              ) : (
                <>
                  <p>
                    Рекомендуемый состав группы: <strong>{num(result.designRecommendedTeamSize || 1, 0)} чел.</strong>. Сейчас выбрано{" "}
                    <strong>{num(currentTeam, 0)} чел.</strong>, срок составляет <strong>{formatDesignDuration(result)}</strong>,
                    базовая стоимость <strong>{rub(result.designBase || 0)}</strong>.
                  </p>
                  <div className="input-card" style={{ marginTop: 12 }}>
                    <label>Проектировщики - срок</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 88px auto", gap: 10, alignItems: "center" }}>
                      <input
                        type="range"
                        min="1"
                        max={sliderMax}
                        step="1"
                        value={currentTeam}
                        onChange={(event) => updateSystem?.(system.id, "designTeamOverride", Number(event.target.value))}
                      />
                      <input
                        type="number"
                        min="1"
                        max={sliderMax}
                        step="1"
                        value={currentTeam}
                        onChange={(event) => updateSystem?.(system.id, "designTeamOverride", Number(event.target.value))}
                      />
                      <button className="ghost-btn" type="button" onClick={() => updateSystem?.(system.id, "designTeamOverride", null)}>
                        Авто
                      </button>
                    </div>
                    <small className="hint-inline">
                      Меньше проектировщиков: дольше срок и ниже базовый ФОТ. Больше проектировщиков: короче срок, но выше стоимость из-за
                      параллельной загрузки и координации.
                    </small>
                    <small className="hint-inline">
                      Проектирование в итоге не облагается дополнительным НДС: эта стоимость считается как условно сметная, уже в составе
                      проектной цены.
                    </small>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );

  return repairReactTextTree(content);
}
