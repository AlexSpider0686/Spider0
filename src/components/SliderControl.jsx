import React from "react";
import { toNumber } from "../lib/estimate";

export default function SliderControl({ label, value, min, max, step = 0.01, tooltip, onChange, warning }) {
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
      {warning ? <small className="warn-inline">{warning}</small> : null}
    </div>
  );
}
