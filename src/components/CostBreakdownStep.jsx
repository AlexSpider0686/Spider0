import React, { useMemo } from "react";
import { num, rub } from "../lib/estimate";
import { buildProjectCrewPlan } from "../lib/crewPlan";

function formatExecutionDuration(result) {
  const exactDays = Number(result?.executionDaysExact ?? result?.executionDurationDays ?? 0);
  if (!Number.isFinite(exactDays) || exactDays <= 0) return "0 раб. дн.";
  if (exactDays <= 22) return `${num(exactDays, 1)} раб. дн.`;
  return `${num(exactDays / 22, 1)} мес.`;
}

function resolveRoleValue(system, role) {
  const override = system?.executionRoleOverrides?.[role.role];
  if (override === null || override === undefined || override === "") return role.count;
  return Number(override);
}

function buildNextRoleOverrides(system, roleKey, nextValue) {
  const normalizedValue = Math.max(Math.round(Number(nextValue) || 0), 0);
  const next = {
    ...(system?.executionRoleOverrides || {}),
    [roleKey]: normalizedValue,
  };

  Object.keys(next).forEach((key) => {
    if (!Number.isFinite(Number(next[key])) || Number(next[key]) < 0) {
      delete next[key];
    }
  });

  return next;
}

export default function CostBreakdownStep({
  systems = [],
  updateSystem,
  systemResults = [],
  totals = {},
  objectData = {},
  effectiveObjectData = null,
}) {
  const resultById = new Map(systemResults.map((item) => [item.systemId, item]));
  const calcObjectData = effectiveObjectData || objectData;
  const crewPlan = useMemo(() => buildProjectCrewPlan(systemResults, calcObjectData, totals), [systemResults, calcObjectData, totals]);
  const activeResults = systemResults.filter((item) => (item.executionHours || 0) > 0);
  const totalExecutionHours = activeResults.reduce((total, item) => total + (item.executionHours || 0), 0);
  const avgTeamSize = activeResults.length ? activeResults.reduce((total, item) => total + (item.executionTeamSize || 0), 0) / activeResults.length : 0;
  const maxDurationDays = Math.max(...activeResults.map((item) => item.executionDurationDays || 0), 0);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Расчет ресурса</h2>
          <p>
            Вкладка управляет составом монтажной бригады по каждой системе. Рекомендуемый состав рассчитывается по трудоемкости,
            кабельной насыщенности, интеграционным точкам и роли в технологической цепочке. Изменение численности по позициям сразу
            пересчитывает срок и стоимость СМР/ПНР.
          </p>
        </div>
      </div>

      <div className="summary-grid breakdown-metrics">
        <div className="metric-card">
          <span>Трудоемкость работ</span>
          <strong>{num(totalExecutionHours, 1)} ч</strong>
        </div>
        <div className="metric-card">
          <span>Средний состав бригады</span>
          <strong>{num(avgTeamSize, 1)} чел.</strong>
        </div>
        <div className="metric-card">
          <span>Пиковая бригада</span>
          <strong>{num(crewPlan.field.peakHeadcount, 0)} чел.</strong>
        </div>
        <div className="metric-card">
          <span>Максимальный срок</span>
          <strong>{maxDurationDays > 0 ? `${num(maxDurationDays, 0)} раб. дн.` : "—"}</strong>
        </div>
        <div className="metric-card total">
          <span>СМР + ПНР</span>
          <strong>{rub(totals.totalWork)}</strong>
        </div>
      </div>

      <div className="calc-explain" style={{ marginTop: 18 }}>
        <h3>Характеристика ресурса</h3>
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
            <label>Сводный состав монтажного ресурса</label>
            <div className="ai-detection-list" style={{ marginTop: 10 }}>
              {crewPlan.field.roles.map((role) => (
                <span className="pricing-source-chip ok" key={role.role}>
                  {role.label}: {role.count} чел. ({num(role.sharePercent, 0)}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Часы</th>
              <th>Рекомендуемо</th>
              <th>Выбрано</th>
              <th>Срок</th>
              <th>СМР+ПНР</th>
              <th>Состав</th>
            </tr>
          </thead>
          <tbody>
            {systems.map((system) => {
              const result = resultById.get(system.id);
              if (!result) return null;
              const selectedTeam = (result.executionRoles || []).reduce((total, role) => total + Number(role.count || 0), 0);
              return (
                <tr key={`resource-${system.id}`}>
                  <td>{result.systemName}</td>
                  <td>{num(result.executionHours || 0, 1)} ч</td>
                  <td>{num(result.executionRecommendedTeamSize || 0, 0)}</td>
                  <td>{num(selectedTeam || result.executionTeamSize || 0, 0)}</td>
                  <td>{formatExecutionDuration(result)}</td>
                  <td>{rub(result.workTotal || 0)}</td>
                  <td>{(result.executionRoles || []).map((role) => `${role.label} ${role.count}`).join(", ") || "—"}</td>
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

          return (
            <article className="logic-card" key={`resource-staffing-${system.id}`}>
              <h3>{result.systemName}</h3>
              <p>
                Рекомендуемый состав бригады: <strong>{num(result.executionRecommendedTeamSize || 0, 0)} чел.</strong>. Сейчас выбрано{" "}
                <strong>{num(result.executionTeamSize || 0, 0)} чел.</strong>, срок составляет <strong>{formatExecutionDuration(result)}</strong>,
                стоимость работ <strong>{rub(result.workTotal || 0)}</strong>.
              </p>

              <div className="input-card" style={{ marginTop: 12 }}>
                <label>Роли бригады</label>
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  {(result.executionRoles || []).map((role) => (
                    <div
                      key={`${system.id}-${role.role}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.3fr) 110px 96px",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{role.label}</strong>
                        <div className="hint-inline">Рекомендуемо: {num(role.recommendedCount || 0, 0)} чел.</div>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="12"
                        step="1"
                        value={resolveRoleValue(system, role)}
                        onChange={(event) =>
                          updateSystem?.(system.id, "executionRoleOverrides", buildNextRoleOverrides(system, role.role, event.target.value))
                        }
                      />
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() =>
                          updateSystem?.(system.id, "executionRoleOverrides", {
                            ...(system.executionRoleOverrides || {}),
                            [role.role]: null,
                          })
                        }
                      >
                        Авто
                      </button>
                    </div>
                  ))}
                </div>
                <small className="hint-inline">
                  Добавление прорабов, старших монтажников и инженеров ПНР повышает координационную стоимость, но может ускорить прохождение критических фаз. Недобор ключевых ролей снижает суточную производительность и увеличивает календарный срок.
                </small>
                <small className="hint-inline">
                  Производительность: {num(result.laborDetails?.executionDailyCapacity || 0, 1)} ч/день на бригаду, {num(result.laborDetails?.executionProductiveHoursPerPersonDay || 0, 1)} ч/чел.
                </small>
              </div>
            </article>
          );
        })}
      </div>

      <div className="input-card" style={{ marginTop: 18 }}>
        <label>Распределение по системам</label>
        <div className="ai-summary-list" style={{ marginTop: 10 }}>
          {crewPlan.systemCrewRows.slice(0, 8).map((row) => (
            <div key={row.systemName}>
              <span>
                {row.systemName}: пик {row.peakCrew} чел., {row.durationDays} раб. дн., состав {row.leadRoles}. {row.complexityNote}.
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
