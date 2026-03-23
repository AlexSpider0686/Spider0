import React from "react";
import { num, rub } from "../lib/estimate";

export default function Summary({ totals, systemResults, objectData }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Итоги</h2>
          <p>
            Регион: {objectData?.regionName || "—"} | Региональный коэффициент: <strong>x{num(objectData?.regionCoef || 1, 2)}</strong>
          </p>
        </div>
      </div>
      <div className="summary-grid">
        <div className="metric-card">
          <span>Материалы</span>
          <strong>{rub(totals.totalMaterials)}</strong>
        </div>
        <div className="metric-card">
          <span>Труд</span>
          <strong>{rub(totals.totalLabor)}</strong>
        </div>
        <div className="metric-card">
          <span>Накладные+СИЗ+ФОТ+АХР</span>
          <strong>{rub(totals.totalOverhead)}</strong>
        </div>
        <div className="metric-card total">
          <span>Итог</span>
          <strong>{rub(totals.total)}</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Вендор</th>
              <th>Ключ оборудования</th>
              <th>Цена за ед.</th>
              <th>Кабель, м</th>
              <th>Ед.</th>
              <th>Регион. коэф.</th>
              <th>Итого</th>
            </tr>
          </thead>
          <tbody>
            {systemResults.map((item, index) => (
              <tr key={`${item.systemType}-${index}`}>
                <td>{item.systemName}</td>
                <td>{item.vendor}</td>
                <td>{item.equipmentData?.selectionKey || "fallback"}</td>
                <td>{rub(item.equipmentData?.unitPrice || 0)}</td>
                <td>{num(item.cable, 0)}</td>
                <td>{num(item.units, 0)}</td>
                <td>x{num(item.trace?.regionCoef || objectData?.regionCoef || 1, 2)}</td>
                <td>{rub(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
