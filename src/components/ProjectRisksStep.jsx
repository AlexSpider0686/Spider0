import React from "react";

function severityLabel(value) {
  if (value === "high") return "Критичный";
  return "Повышенный";
}

export default function ProjectRisksStep({ projectRisks = [] }) {
  const hasRisks = Array.isArray(projectRisks) && projectRisks.length > 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>AI-риски проекта</h2>
          <p>Модуль в реальном времени анализирует параметры объекта, состав систем, обследование, распознанные проектные данные и рыночные сигналы, чтобы выделить до пяти самых критичных рисков.</p>
        </div>
      </div>

      {hasRisks ? (
        <div className="logic-grid">
          {projectRisks.map((risk, index) => (
            <article className="logic-card" key={risk.id || index}>
              <div className="summary-row">
                <strong>{index + 1}. {risk.title}</strong>
                <span className={`status-pill ${risk.severity === "high" ? "warn" : ""}`}>{severityLabel(risk.severity)}</span>
              </div>
              <p>{risk.summary}</p>
              <p><strong>Что это значит:</strong> {risk.impact}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-note">
          На текущем наборе данных модуль не видит выраженных критичных рисков. По мере изменения объекта, систем, обследования и цен этот список обновляется автоматически.
        </div>
      )}
    </section>
  );
}
