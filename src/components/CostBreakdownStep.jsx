import React from "react";
import { num, rub } from "../lib/estimate";

export default function CostBreakdownStep({ systemResults, totals }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Стоимость проекта</h2>
          <p>Разложение стоимости по системам: оборудование, материалы, СМР/ПНР, проектирование и итог.</p>
        </div>
      </div>

      <div className="summary-grid breakdown-metrics">
        <div className="metric-card">
          <span>Оборудование</span>
          <strong>{rub(totals.totalEquipment)}</strong>
        </div>
        <div className="metric-card">
          <span>Материалы</span>
          <strong>{rub(totals.totalMaterials)}</strong>
        </div>
        <div className="metric-card">
          <span>СМР + ПНР</span>
          <strong>{rub(totals.totalWork)}</strong>
        </div>
        <div className="metric-card">
          <span>Проектирование</span>
          <strong>{rub(totals.totalDesign || 0)}</strong>
        </div>
        <div className="metric-card total">
          <span>Общий бюджет</span>
          <strong>{rub(totals.total)}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Оборудование</th>
              <th>Материалы</th>
              <th>СМР+ПНР</th>
              <th>Проектирование</th>
              <th>Итог</th>
              <th>Доля в бюджете</th>
            </tr>
          </thead>
          <tbody>
            {systemResults.map((item, index) => (
              <tr key={`${item.systemType}-${index}`}>
                <td>{item.systemName}</td>
                <td>{rub(item.equipmentCost)}</td>
                <td>{rub(item.materialCost)}</td>
                <td>{rub(item.workTotal)}</td>
                <td>{rub(item.designTotal || 0)}</td>
                <td>{rub(item.total)}</td>
                <td>{num((item.total / Math.max(totals.total, 1)) * 100, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

