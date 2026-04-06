import React, { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";

function badgeTone(status) {
  if (status === "mandatory") return "warn";
  if (status === "recommended") return "muted";
  return "ok";
}

export default function NormativeRequirementsStep({
  systems = [],
  normativeProfile,
  normativeRequirementsApplied,
  applyNormativeRequirements,
  excludeNormativeRequirements,
}) {
  const rowsBySystem = useMemo(
    () =>
      (systems || []).map((system) => ({
        system,
        rows: normativeProfile?.systemRows?.[system.type] || [],
      })),
    [systems, normativeProfile]
  );

  const missingMandatorySystems = normativeProfile?.missingMandatorySystems || [];

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Нормативные требования</h2>
          <p>
            Требования собраны под текущий объект и актуализированы на <strong>{normativeProfile?.asOfDate || "текущую дату"}</strong>. Кнопка
            применения включает их влияние в расчётах, но не добавляет системы автоматически без вашего решения.
          </p>
        </div>
        <div className="hero-actions">
          <button className="primary-btn" type="button" onClick={applyNormativeRequirements}>
            <CheckCircle2 size={16} /> Применить требования
          </button>
          <button className="ghost-btn" type="button" onClick={excludeNormativeRequirements}>
            <Scale size={16} /> Исключить требования
          </button>
        </div>
      </div>

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
                {rows.map((row, index) => (
                  <div key={`${system.id}-${index}`} className="calc-explain">
                    <div className="pricing-source-row" style={{ marginBottom: 8 }}>
                      <span className={`pricing-source-chip ${badgeTone(row.status)}`}>
                        {row.mandatory ? "Обязательно" : row.status === "recommended" ? "Рекомендуется" : "Справочно"}
                      </span>
                      <span className="pricing-source-chip muted">{row.reference}</span>
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
                        <strong>Что меняется при применении:</strong> нормативный минимум влияет на объёмы, приборы управления, резерв ёмкости и
                        серверную/АРМ архитектуру системы.
                      </p>
                    ) : null}
                    {row.sourceNote ? (
                      <p style={{ marginTop: 8 }}>
                        <strong>Примечание:</strong> {row.sourceNote}
                      </p>
                    ) : null}
                    <p style={{ marginTop: 8 }}>
                      <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                        Открыть источник
                      </a>
                    </p>
                  </div>
                ))}
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
