import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Scale } from "lucide-react";
import { rub, toNumber } from "../lib/estimate";

function badgeTone(status) {
  if (status === "mandatory") return "warn";
  if (status === "recommended") return "muted";
  return "ok";
}

function estimateBudgetImpact(row, result) {
  if (!result || !row?.appliedImpact) return 0;

  const equipmentBase = toNumber(result.equipmentCost, 0) + toNumber(result.materialCost, 0);
  const workBase = toNumber(result.workTotal, 0);
  const designBase = toNumber(result.designTotal, 0);
  let impact = 0;

  if (row.appliedImpact.minPrimaryReserveFactor > 1) {
    impact += equipmentBase * (row.appliedImpact.minPrimaryReserveFactor - 1);
  }
  if (row.appliedImpact.zoneBroadcastReserve > 1) {
    impact += equipmentBase * 0.35 * (row.appliedImpact.zoneBroadcastReserve - 1);
  }
  if (row.appliedImpact.controllerCapacityHeadroom > 0) {
    impact += equipmentBase * 0.22 * row.appliedImpact.controllerCapacityHeadroom;
  }
  if (row.appliedImpact.designFactor > 1) {
    impact += designBase * (row.appliedImpact.designFactor - 1);
    impact += workBase * 0.08 * (row.appliedImpact.designFactor - 1);
  }
  if (row.appliedImpact.minControllerReserve > 0) {
    impact += equipmentBase * 0.03 * row.appliedImpact.minControllerReserve;
  }
  if (row.appliedImpact.minManagementMode === "server") {
    impact += equipmentBase * 0.05 + workBase * 0.01;
  }
  if (row.appliedImpact.oklCostPerMeter > 0) {
    impact += toNumber(result.cable, 0) * row.appliedImpact.oklCostPerMeter;
  }
  if (row.appliedImpact.oklWorkFactor > 0) {
    impact += workBase * row.appliedImpact.oklWorkFactor;
  }

  return Math.round(impact);
}

export default function NormativeRequirementsStep({
  systems = [],
  normativeProfile,
  normativeRequirementsApplied,
  applyNormativeRequirements,
  excludeNormativeRequirements,
  systemResults = [],
}) {
  const rowsBySystem = useMemo(
    () =>
      (systems || []).map((system) => ({
        system,
        rows: normativeProfile?.systemRows?.[system.type] || [],
      })),
    [systems, normativeProfile]
  );

  const resultBySystem = useMemo(
    () => new Map((systemResults || []).map((row) => [row.systemType, row])),
    [systemResults]
  );

  const missingMandatorySystems = normativeProfile?.missingMandatorySystems || [];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Нормативные требования</h2>
          <p>
            Требования собраны под текущий объект и актуализированы на <strong>{normativeProfile?.asOfDate || "текущую дату"}</strong>.
            Кнопка применения включает их влияние в расчетах, но не добавляет системы автоматически без вашего решения.
          </p>
          {normativeProfile?.actualization?.summary ? <p>{normativeProfile.actualization.summary}</p> : null}
        </div>
        <div className="hero-actions">
          <button className={normativeRequirementsApplied ? "primary-btn" : "ghost-btn"} type="button" onClick={applyNormativeRequirements}>
            <CheckCircle2 size={16} /> Применить требования
          </button>
          <button
            className={!normativeRequirementsApplied ? "primary-btn" : "ghost-btn"}
            type="button"
            onClick={excludeNormativeRequirements}
            style={!normativeRequirementsApplied ? { background: "#3AA3FF", borderColor: "#3AA3FF" } : undefined}
          >
            {!normativeRequirementsApplied ? <CheckCircle2 size={16} /> : <Scale size={16} />}
            Исключить требования
          </button>
        </div>
      </div>

      {normativeProfile?.actualization?.steps?.length ? (
        <div className="calc-explain">
          <strong>{normativeProfile.actualization.algorithmTitle}:</strong>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {normativeProfile.actualization.steps.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="calc-explain">
        <strong>Статус слоя:</strong>{" "}
        {normativeRequirementsApplied ? "нормативные требования применяются в расчётах" : "нормативные требования показаны справочно и не влияют на расчёты"}.
      </div>

      {missingMandatorySystems.length ? (
        <div className="calc-explain" style={{ borderColor: "#E07A5F", background: "rgba(224, 122, 95, 0.08)" }}>
          <strong>Обязательные системы вне расчёта:</strong>
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            {missingMandatorySystems.map((item) => (
              <div key={item.systemType}>
                <strong>{item.systemName}</strong>: {item.reason}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="logic-grid">
        {rowsBySystem.map(({ system, rows }) => (
          <article className="logic-card" key={system.id}>
            <h3>{rows[0]?.systemName || system.type}</h3>
            {rows.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {rows.map((row, index) => {
                  const budgetImpact = estimateBudgetImpact(row, resultBySystem.get(row.systemType));
                  return (
                    <div key={`${system.id}-${index}`} className="calc-explain">
                      <div className="pricing-source-row" style={{ marginBottom: 8 }}>
                        <span className={`pricing-source-chip ${badgeTone(row.status)}`}>
                          {row.mandatory ? "Обязательно" : row.status === "recommended" ? "Рекомендуется" : "Справочно"}
                        </span>
                        <span className="pricing-source-chip muted">{row.reference}</span>
                        <span className="pricing-source-chip ok">
                          <strong>Влияние на бюджет:</strong> {budgetImpact > 0 ? rub(budgetImpact) : "без прямой добавки"}
                        </span>
                      </div>
                      <strong>{row.title}</strong>
                      <p style={{ marginTop: 8 }}>{row.summary}</p>
                      <p style={{ marginTop: 8 }}>
                        <strong>Основание:</strong> {row.sourceAct}, {row.reference}. {row.sourceTitle}
                      </p>
                      <p style={{ marginTop: 8 }}>
                        <strong>Для этого объекта:</strong> {row.rationale}
                      </p>
                      {row.appliedImpact ? (
                        <p style={{ marginTop: 8 }}>
                          <strong>Что меняется при применении:</strong> нормативный минимум влияет на объемы, приборы управления, резерв емкости и серверную/АРМ архитектуру системы.
                        </p>
                      ) : null}
                      {row.sourceNote ? (
                        <p style={{ marginTop: 8 }}>
                          <strong>Примечание:</strong> {row.sourceNote}
                        </p>
                      ) : null}
                      <div className="pricing-source-row" style={{ marginTop: 10 }}>
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ghost-btn"
                          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <ExternalLink size={14} /> Открыть источник
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="calc-explain">
                <AlertTriangle size={16} />
                <span style={{ marginLeft: 8 }}>Для системы пока не сформирован отдельный нормативный профиль.</span>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
