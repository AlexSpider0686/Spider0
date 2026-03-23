import React from "react";
import { num, rub } from "../lib/estimate";

export default function Summary({ totals, systemResults }) {
  return (
    <section className="panel">
      <div className="panel-header"><div><h2>Итоги</h2></div></div>
      <div className="summary-grid">
        <div className="metric-card"><span>Материалы</span><strong>{rub(totals.totalMaterials)}</strong></div>
        <div className="metric-card"><span>Труд</span><strong>{rub(totals.totalLabor)}</strong></div>
        <div className="metric-card"><span>Накладные+СИЗ+отчисления</span><strong>{rub(totals.totalOverhead)}</strong></div>
        <div className="metric-card total"><span>Итог</span><strong>{rub(totals.total)}</strong></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Система</th><th>Вендор</th><th>Ключ оборудования</th><th>Цена за ед.</th><th>Кабель, м</th><th>Ед.</th><th>Итого</th></tr></thead>
          <tbody>
            {systemResults.map((r, idx) => (
              <tr key={`${r.systemType}-${idx}`}>
                <td>{r.systemName}</td><td>{r.vendor}</td><td>{r.equipmentData?.selectionKey || "fallback"}</td><td>{rub(r.equipmentData?.unitPrice || 0)}</td><td>{num(r.cable, 0)}</td><td>{num(r.units, 0)}</td><td>{rub(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
