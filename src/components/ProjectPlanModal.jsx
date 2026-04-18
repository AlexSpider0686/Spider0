import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarRange, FileSpreadsheet, Presentation, X } from "lucide-react";
import {
  formatLocalProjectBridgeStatus,
  getLocalProjectBridgeInstallerUrl,
  getLocalProjectBridgeStatus,
  isHostedWebContour,
  isLocalProjectBridgeAvailable,
} from "../lib/localProjectBridge";

export default function ProjectPlanModal({ open, onClose, onSelectFormat }) {
  const hostedContour = useMemo(() => isHostedWebContour(), []);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [bridgeBusy, setBridgeBusy] = useState(false);
  const [bridgeHint, setBridgeHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!open || !hostedContour) return undefined;

    isLocalProjectBridgeAvailable()
      .then((ready) => {
        if (!cancelled) setBridgeReady(Boolean(ready));
      })
      .catch(() => {
        if (!cancelled) setBridgeReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, hostedContour]);

  const handleBridgeCheck = async () => {
    setBridgeBusy(true);
    const status = await getLocalProjectBridgeStatus();
    setBridgeBusy(false);
    setBridgeReady(status.ok === true);
    setBridgeHint(
      status.ok
        ? formatLocalProjectBridgeStatus(status)
        : `${formatLocalProjectBridgeStatus(status)} Установщик: ${getLocalProjectBridgeInstallerUrl()}`
    );
  };

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

          <button
            className="project-plan-option"
            type="button"
            onClick={() => onSelectFormat("mpp")}
            title={
              hostedContour
                ? bridgeReady
                  ? "Сформировать план проекта в формате Microsoft Project через локальный агент на этом ПК"
                  : "Если локальный агент еще не установлен, платформа скачает EXE-файл агента и подскажет дальнейшие шаги"
                : "Сформировать план проекта в формате Microsoft Project"
            }
          >
            <span className="project-plan-option__icon">
              <FileSpreadsheet size={20} />
            </span>
            <strong>MS Project (.mpp)</strong>
            <span>Файл Microsoft Project для календарного планирования и ведения графика проекта.</span>
            {hostedContour ? (
              <span className="project-plan-option__warning">
                <AlertCircle size={14} />
                {bridgeReady
                  ? "Локальный агент найден на этом ПК: экспорт .mpp пойдет через него, с выбором папки и открытием плана в Microsoft Project."
                  : "Web-версия использует локальный EXE-агент на этом ПК. Если мост еще не установлен, по нажатию будет скачан EXE-файл и показана инструкция."}
              </span>
            ) : null}
          </button>
        </div>

        {hostedContour ? (
          <div className="project-plan-modal__note" style={{ marginTop: 12, alignItems: "flex-start" }}>
            <AlertCircle size={16} />
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="ghost-btn" type="button" onClick={handleBridgeCheck} disabled={bridgeBusy}>
                  {bridgeBusy ? "Проверка агента..." : "Проверить локальный агент"}
                </button>
                <a className="ghost-btn" href={getLocalProjectBridgeInstallerUrl()} download="ProjectCoreLocalBridgeAgent.exe">
                  Скачать EXE агента
                </a>
              </div>
              {bridgeHint ? <span>{bridgeHint}</span> : <span>Для web-контура экспорт .mpp идет через локальный EXE-агент на этом ПК.</span>}
            </div>
          </div>
        ) : null}

        <div className="project-plan-modal__note">
          <CalendarRange size={16} />
          <span>Сроки в плане выводятся в рабочих днях и синхронизированы с верхнеуровневым таймлайном проекта.</span>
        </div>
      </div>
    </div>
  );
}
