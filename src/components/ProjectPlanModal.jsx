import React from "react";
import { CalendarRange, FileSpreadsheet, Presentation, X } from "lucide-react";

export default function ProjectPlanModal({ open, onClose, onSelectFormat }) {
  if (!open) return null;

  return (
    <div className="project-plan-modal" role="dialog" aria-modal="true" aria-labelledby="project-plan-modal-title">
      <button className="project-plan-modal__backdrop" type="button" aria-label="Закрыть" onClick={onClose} />
      <div className="project-plan-modal__card">
        <div className="project-plan-modal__header">
          <div>
            <div className="project-plan-modal__eyebrow">AI-планирование</div>
            <h3 id="project-plan-modal-title">Сгенерировать план проекта</h3>
            <p>
              Платформа соберет верхнеуровневый план реализации систем по данным объекта, составу систем, AI-аналитике,
              рискам и расчетным срокам ТКП.
            </p>
          </div>
          <button className="ghost-btn project-plan-modal__close" type="button" onClick={onClose}>
            <X size={16} /> Закрыть
          </button>
        </div>

        <div className="project-plan-modal__grid">
          <button className="project-plan-option" type="button" onClick={() => onSelectFormat("pptx")}>
            <span className="project-plan-option__icon">
              <Presentation size={20} />
            </span>
            <strong>PowerPoint (.pptx)</strong>
            <span>Оформленная презентация с титульным листом, дорожной картой, графиками, диаграммами и инфослайдами.</span>
          </button>

          <button className="project-plan-option" type="button" onClick={() => onSelectFormat("mpp")}>
            <span className="project-plan-option__icon">
              <FileSpreadsheet size={20} />
            </span>
            <strong>MS Project (.mpp)</strong>
            <span>Файл Microsoft Project для календарного планирования и ведения графика проекта.</span>
          </button>
        </div>

        <div className="project-plan-modal__note">
          <CalendarRange size={16} />
          <span>Сроки в плане выводятся в рабочих днях и синхронизированы с верхнеуровневым таймлайном проекта.</span>
        </div>
      </div>
    </div>
  );
}
