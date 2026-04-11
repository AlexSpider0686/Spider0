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

function manualNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CostBreakdownStep({
  systems = [],
  updateSystem,
  systemResults = [],
  totals = {},
  objectData = {},
  effectiveObjectData = null,
  travelEstimate = {},
  updateTravelField,
  setTravelEstimateEnabled,
  runTravelEstimate,
  resetTravelEstimate,
}) {
  const resultById = new Map(systemResults.map((item) => [item.systemId, item]));
  const calcObjectData = effectiveObjectData || objectData;
  const crewPlan = useMemo(() => buildProjectCrewPlan(systemResults, calcObjectData, totals), [systemResults, calcObjectData, totals]);
  const activeResults = systemResults.filter((item) => (item.executionHours || 0) > 0);
  const totalExecutionHours = activeResults.reduce((total, item) => total + (item.executionHours || 0), 0);
  const avgTeamSize = activeResults.length ? activeResults.reduce((total, item) => total + (item.executionTeamSize || 0), 0) / activeResults.length : 0;
  const maxDurationDays = Math.max(...activeResults.map((item) => item.executionDurationDays || 0), 0);
  const travelEnabled = Boolean(travelEstimate?.enabled);
  const handleActivateTravel = async () => {
    setTravelEstimateEnabled?.(true);
    await runTravelEstimate?.();
  };
  const handleDeactivateTravel = () => {
    setTravelEstimateEnabled?.(false);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Расчет ресурса</h2>
          <p>
            Вкладка управляет составом монтажной бригады по каждой системе. Численность рассчитывается по трудоемкости, кабельной насыщенности,
            интеграционным точкам и роли в технологической цепочке; при изменении состава срок и стоимость СМР/ПНР пересчитываются сразу.
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
        <h3>Логика численности бригад</h3>
        <p className="hint-inline">{crewPlan.methodology}</p>

        <div className="grid-two" style={{ marginTop: 12 }}>
          <div className="input-card">
            <label>Монтажная бригада и ПНР</label>
            <div className="ai-summary-list" style={{ marginTop: 10 }}>
              {crewPlan.summaryLines.slice(0, 4).map((line) => (
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

      <div className="calc-explain" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h3>Командировочный выезд</h3>
            <p className="hint-inline">
              Умный алгоритм предлагает маршрут туда и обратно, длительность в пути, проживание и суточные. После расчета все параметры доступны для ручной корректировки.
            </p>
          </div>
          <div className="travel-toggle-row">
            <button className={`ghost-btn travel-toggle-btn ${travelEnabled ? "is-active" : ""}`} type="button" onClick={handleActivateTravel}>
              Активировать умный алгоритм
            </button>
            <button className={`ghost-btn travel-toggle-btn ${!travelEnabled ? "is-active is-inactive" : ""}`} type="button" onClick={handleDeactivateTravel}>
              Деактивировать умный алгоритм
            </button>
            {travelEnabled ? (
              <button className="ghost-btn" type="button" onClick={resetTravelEstimate}>
                Сбросить
              </button>
            ) : null}
          </div>
        </div>

        <div className={`travel-panel-body ${travelEnabled ? "" : "is-hidden"}`}>

        <div className="grid-two" style={{ marginTop: 12 }}>
          <div className="input-card">
            <label>Начальная точка маршрута</label>
            <input
              value={travelEstimate.originAddress || ""}
              placeholder="Откуда выезжает бригада"
              onChange={(event) => updateTravelField?.("originAddress", event.target.value)}
            />
            <small className="hint-inline">Например: адрес офиса, склада или базы выезда.</small>
          </div>

          <div className="input-card">
            <label>Конечная точка маршрута</label>
            <input
              value={travelEstimate.destinationAddress || objectData.address || ""}
              placeholder="Куда едет бригада"
              onChange={(event) => updateTravelField?.("destinationAddress", event.target.value)}
            />
            <small className="hint-inline">По умолчанию можно использовать адрес объекта.</small>
          </div>
        </div>

        {(travelEstimate.alerts || []).length ? (
          <div className="address-status error" style={{ marginTop: 12 }}>
            {(travelEstimate.alerts || []).join(" ")}
          </div>
        ) : null}

        <div className="grid-two" style={{ marginTop: 12 }}>
          <div className="input-card">
            <label>Транспорт и маршрут</label>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <small className="hint-inline">Режим</small>
                  <input value={travelEstimate.modeLabel || "Не рассчитан"} readOnly className="readonly-field" />
                </div>
                <div>
                  <small className="hint-inline">Источник</small>
                  <input value={travelEstimate.sourceLabel || "tutu.ru"} readOnly className="readonly-field" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <small className="hint-inline">Плечо маршрута, км</small>
                  <input
                    type="number"
                    value={travelEstimate.oneWayDistanceKm || 0}
                    onChange={(event) => updateTravelField?.("oneWayDistanceKm", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Круговой маршрут, км</small>
                  <input value={travelEstimate.roundTripDistanceKm || 0} readOnly className="readonly-field" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <small className="hint-inline">Путь в одну сторону, ч</small>
                  <input
                    type="number"
                    value={travelEstimate.oneWayDurationHours || 0}
                    onChange={(event) => updateTravelField?.("oneWayDurationHours", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Путь туда-обратно, ч</small>
                  <input
                    type="number"
                    value={travelEstimate.roundTripDurationHours || 0}
                    onChange={(event) => updateTravelField?.("roundTripDurationHours", manualNumber(event.target.value))}
                  />
                </div>
              </div>
              <div>
                <small className="hint-inline">РњР°СЂС€СЂСѓС‚ СЃ РєР»СЋС‡РµРІС‹РјРё С‚РѕС‡РєР°РјРё</small>
                <input value={travelEstimate.routeSummary || ""} readOnly className="readonly-field" />
              </div>
              {travelEstimate.airportComment ? <small className="hint-inline">{travelEstimate.airportComment}</small> : null}
              {travelEstimate.transportSourceUrl ? (
                <a href={travelEstimate.transportSourceUrl} target="_blank" rel="noreferrer" className="hint-inline">
                  Открыть транспортный источник на tutu.ru
                </a>
              ) : null}
            </div>
          </div>

          <div className="input-card">
            <label>Проживание и суточные</label>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <small className="hint-inline">Численность бригады</small>
                  <input
                    type="number"
                    min="1"
                    value={travelEstimate.crewSize || 1}
                    onChange={(event) => updateTravelField?.("crewSize", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Срок работ из плана, дн.</small>
                  <input
                    type="number"
                    min="1"
                    value={travelEstimate.workDurationDays || 1}
                    onChange={(event) => updateTravelField?.("workDurationDays", manualNumber(event.target.value))}
                  />
                </div>
              </div>
              <div className="travel-stay-grid travel-stay-grid--days">
                <div>
                  <small className="hint-inline">Комнат</small>
                  <input
                    type="number"
                    min="1"
                    value={travelEstimate.hotelRooms || 1}
                    onChange={(event) => updateTravelField?.("hotelRooms", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Ночей</small>
                  <input
                    type="number"
                    min="1"
                    value={travelEstimate.hotelNights || 1}
                    onChange={(event) => updateTravelField?.("hotelNights", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Суточных дней</small>
                  <input
                    type="number"
                    min="1"
                    value={travelEstimate.perDiemDays || 1}
                    onChange={(event) => updateTravelField?.("perDiemDays", manualNumber(event.target.value))}
                  />
                </div>
              </div>
              <div className="travel-stay-grid travel-stay-grid--costs">
                <div>
                  <small className="hint-inline">Билет на 1 чел. в одну сторону, ₽</small>
                  <input
                    type="number"
                    min="0"
                    value={travelEstimate.perPersonOneWayCost || 0}
                    onChange={(event) => updateTravelField?.("perPersonOneWayCost", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Гостиница за номер/ночь, ₽</small>
                  <input
                    type="number"
                    min="0"
                    value={travelEstimate.hotelRatePerRoomNight || 0}
                    onChange={(event) => updateTravelField?.("hotelRatePerRoomNight", manualNumber(event.target.value))}
                  />
                </div>
                <div>
                  <small className="hint-inline">Суточные на 1 чел./день ₽</small>
                  <input
                    type="number"
                    min="0"
                    value={travelEstimate.perDiemPerPersonDay || 1000}
                    onChange={(event) => updateTravelField?.("perDiemPerPersonDay", manualNumber(event.target.value))}
                  />
                </div>
              </div>
              {travelEstimate.hotelSourceUrl ? (
                <a href={travelEstimate.hotelSourceUrl} target="_blank" rel="noreferrer" className="hint-inline">
                  Открыть гостиницы на tutu.ru
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="summary-grid breakdown-metrics" style={{ marginTop: 16 }}>
          <div className="metric-card">
            <span>Транспорт</span>
            <strong>{rub(travelEstimate.totalTransportCost || 0)}</strong>
          </div>
          <div className="metric-card">
            <span>Гостиница</span>
            <strong>{rub(travelEstimate.totalHotelCost || 0)}</strong>
          </div>
          <div className="metric-card">
            <span>Суточные</span>
            <strong>{rub(travelEstimate.totalPerDiemCost || 0)}</strong>
          </div>
          <div className="metric-card">
            <span>Добавка к сроку</span>
            <strong>{num(travelEstimate.roundTripTravelDays || 0, 0)} раб. дн.</strong>
          </div>
          <div className="metric-card total">
            <span>Командировка всего</span>
            <strong>{rub(travelEstimate.totalCost || 0)}</strong>
          </div>
        </div>

        {travelEstimate.totalCost > 0 ? (
          <small className="hint-inline" style={{ display: "block", marginTop: 10 }}>
            Общая стоимость командировочного выезда добавляется к стоимости работ после расчета коэффициентов и надбавок и распределяется по системам равномерно:
            {` ${rub(travelEstimate.perSystemCost || 0)} на систему.`}
          </small>
        ) : null}
        </div>
        {!travelEnabled ? (
          <div className="travel-collapsed-note">Раздел командировочного выезда свернут. Нажмите «Активировать умный алгоритм», чтобы развернуть блок и сразу запустить расчет.</div>
        ) : null}
      </div>

      <div className="table-wrap" style={{ marginTop: 18 }}>
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Часы</th>
              <th>Рекомендовано</th>
              <th>Выбрано</th>
              <th>Срок</th>
              <th>Командировка</th>
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
                  <td>{rub(result.tripCostAllocation || 0)}</td>
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
                {result.tripCostAllocation ? ` В том числе распределенная командировка ${rub(result.tripCostAllocation)}.` : ""}
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
                  Добавление прорабов, старших монтажников и инженеров ПНР повышает координационную стоимость, но может ускорить критические фазы.
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
