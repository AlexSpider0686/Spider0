import React, { useState } from "react";
import { toNumber } from "../lib/estimate";

export default function SliderControl({
  label,
  value,
  min,
  max,
  step = 0.01,
  tooltip,
  onChange,
  warning,
  helperLines = [],
  extraContent = null,
  insight = null,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="input-card">
      <label title={tooltip}>{label}</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 10, alignItems: "center" }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={toNumber(value, min)}
          onChange={(e) => onChange(toNumber(e.target.value, min))}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={toNumber(value, min)}
          onChange={(e) => onChange(toNumber(e.target.value, min))}
        />
      </div>
      {extraContent}
      {helperLines.map((line, index) => (
        <small key={`${label}-${index}`} className="hint-inline">
          {line}
        </small>
      ))}
      {insight ? (
        <div className="risk-guard-inline">
          <small className="hint-inline risk-guard-inline__text">{insight.shortHint}</small>
          <button type="button" className="risk-guard-inline__button" onClick={() => setDetailsOpen((prev) => !prev)}>
            {detailsOpen ? "Скрыть" : "Пояснить"}
          </button>
          {detailsOpen ? (
            <div className="calc-explain risk-guard-inline__details">
              <h4>{insight.detailsTitle}</h4>
              {insight.details.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {warning ? <small className="warn-inline">{warning}</small> : null}
    </div>
  );
}
