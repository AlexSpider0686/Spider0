import React from "react";
import { num, rub } from "../lib/estimate";
import { repairReactTextTree } from "../lib/repairReactTree";

function sum(array, getter) {
  return (array || []).reduce((acc, item) => acc + getter(item), 0);
}

function resolveSliderMax(result) {
  return Math.max((result?.designRecommendedTeamSize || 1) + 3, 6);
}

export default function ProjectDesignStep({ systems = [], updateSystem, systemResults = [], totals = {} }) {
  const resultById = new Map(systemResults.map((item) => [item.systemId, item]));
  const calculatedSystems = systemResults.filter((item) => !item.designSkipped);
  const skippedSystems = systemResults.filter((item) => item.designSkipped);
  const totalDesignHours = sum(calculatedSystems, (item) => item.designHours || 0);
  const totalDesignMonths = Math.max(...calculatedSystems.map((item) => item.designDurationMonths || 1), calculatedSystems.length ? 1 : 0);
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
        <div className="metric-card">
          <span>Трудоемкость проектирования</span>
          <strong>{num(totalDesignHours, 1)} ч</strong>
        </div>
        <div className="metric-card">
          <span>Базовая стоимость проектирования</span>
          <strong>{rub(sum(calculatedSystems, (item) => item.designBase || 0))}</strong>
        </div>
        <div className="metric-card">
          <span>Итого проектирование</span>
          <strong>{rub(totals.totalDesign || 0)}</strong>
        </div>
        <div className="metric-card">
          <span>Срок проектирования</span>
          <strong>{num(totalDesignMonths, 0)} мес.</strong>
        </div>
        <div className="metric-card total">
          <span>Средний состав группы</span>
          <strong>{num(avgTeamSize, 1)} чел.</strong>
        </div>
        <div className="metric-card">
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
                  <td>{result.designSkipped ? "Проект загружен" : `${num(result.designDurationMonths || 1, 0)} мес.`}</td>
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
                    <strong>{num(currentTeam, 0)} чел.</strong>, срок составляет <strong>{num(result.designDurationMonths || 1, 0)} мес.</strong>,
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
