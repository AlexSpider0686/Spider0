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
          {objectData?.address ? <p>Адрес объекта: {objectData.address}</p> : null}
        </div>
      </div>
      <div className="summary-grid">
        <div className="metric-card">
          <span>Оборудование</span>
          <strong>{rub(totals.totalEquipment)}</strong>
        </div>
        <div className="metric-card">
          <span>Материалы</span>
          <strong>{rub(totals.totalMaterials)}</strong>
        </div>
        <div className="metric-card">
          <span>Работы (СМР+ПНР)</span>
          <strong>{rub(totals.totalWork)}</strong>
        </div>
        <div className="metric-card">
          <span>Проектирование</span>
          <strong>{rub(totals.totalDesign || 0)}</strong>
        </div>
        <div className="metric-card total">
          <span>Итог проекта</span>
          <strong>{rub(totals.total)}</strong>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Вендор</th>
              <th>Маркер стоимости</th>
              <th>За единицу</th>
              <th>Оборудование</th>
              <th>Материалы</th>
              <th>Работы</th>
              <th>Проектирование</th>
              <th>Итого</th>
            </tr>
          </thead>
          <tbody>
            {systemResults.map((item, index) => (
              <tr key={`${item.systemType}-${index}`}>
                <td>{item.systemName}</td>
                <td>{item.vendor}</td>
                <td>{item.unitWorkMarker?.label || "—"}</td>
                <td>{rub(item.unitWorkMarker?.costPerUnit || 0)}</td>
                <td>{rub(item.equipmentCost)}</td>
                <td>{rub(item.materialCost)}</td>
                <td>{rub(item.workTotal)}</td>
                <td>{item.designSkipped ? "Не рассчитывается" : rub(item.designTotal || 0)}</td>
                <td>{rub(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
