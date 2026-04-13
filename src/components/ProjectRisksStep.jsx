import React from "react";
import { rub } from "../lib/estimate";

function severityLabel(value) {
  if (value === "high") return "Критичный";
  if (value === "low") return "Низкий";
  return "Повышенный";
}

export default function ProjectRisksStep({ projectRisks = [] }) {
  const hasRisks = Array.isArray(projectRisks) && projectRisks.length > 0;
  const totalRiskBudget = projectRisks.reduce((sum, risk) => sum + Number(risk?.budgetImpact || 0), 0);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>AI-риски проекта</h2>
          <p>
            Модуль анализирует не абстрактные риски, а именно текущий объект: ограничения монтажа, результаты обследования, проектные данные,
            рыночные сигналы, состав систем и трудовую модель. Для каждого риска показано, почему он сработал, что он означает именно здесь и
            на какую сумму он потенциально может повлиять.
          </p>
        </div>
      </div>

      {hasRisks ? (
        <>
          <div className="calc-explain" style={{ marginBottom: 16 }}>
            <p>
              Сейчас зафиксировано <strong>{projectRisks.length}</strong> повышенных/критичных риска(ов). Совокупный потенциальный диапазон
              влияния по текущему объекту: <strong>{rub(totalRiskBudget)}</strong>.
            </p>
          </div>

          <div className="logic-grid">
            {projectRisks.map((risk, index) => (
              <article className="logic-card" key={risk.id || index}>
                <div className="summary-row">
                  <strong>
                    {index + 1}. {risk.title}
                  </strong>
                  <span className={`status-pill risk-severity-pill risk-severity-pill--${risk.severity || "medium"}`}>
                    {severityLabel(risk.severity)}
                  </span>
                </div>

                <p>
                  <strong>Оценка риска:</strong> {risk.score || 0} / 100
                </p>
                <p>
                  <strong>Потенциальное влияние на бюджет:</strong> {rub(risk.budgetImpact || 0)}
                </p>
                <p>
                  <strong>Почему риск поднят:</strong> {risk.summary}
                </p>
                <p>
                  <strong>Что это означает по объекту:</strong> {risk.impact}
                </p>
                <p>
                  <strong>Что рекомендуется сделать:</strong> {risk.mitigation}
                </p>

                {Array.isArray(risk.basis) && risk.basis.length ? (
                  <div className="logic-equipment-list">
                    {risk.basis.map((item) => (
                      <p key={`${risk.id}-${item}`}>
                        <strong>Основание:</strong> {item}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-note">
          По текущему набору данных модуль не видит выраженных повышенных рисков. При изменении объекта, состава систем, обследования,
          проектных данных и цен эта оценка пересчитывается автоматически.
        </div>
      )}
    </section>
  );
}
