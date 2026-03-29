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
              Платформа построит детальный верхнеуровневый план реализации систем по данным объекта, составу систем,
              AI-обследованию, рискам и расчетным срокам ТКП.
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
            <strong>PowerPoint</strong>
            <span>Презентация с фазами, графиком, мероприятиями, сроками и оговоркой по допущениям.</span>
          </button>

          <button className="project-plan-option" type="button" onClick={() => onSelectFormat("msproject")}>
            <span className="project-plan-option__icon">
              <FileSpreadsheet size={20} />
            </span>
            <strong>MS Project XML</strong>
            <span>Файл для импорта в MS Project с этапами, периодами и комментариями по ограничениям.</span>
          </button>
        </div>

        <div className="project-plan-modal__note">
          <CalendarRange size={16} />
          <span>Сроки в плане синхронизированы с верхнеуровневым таймлайном, который выводится в экспортируемом ТКП.</span>
        </div>
      </div>
    </div>
  );
}
