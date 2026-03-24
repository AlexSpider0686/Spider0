import React from "react";
import { num, rub } from "../lib/estimate";

function sum(array, getter) {
  return array.reduce((acc, item) => acc + getter(item), 0);
}

export default function ProjectDesignStep({ systemResults, totals }) {
  const totalDesignHours = sum(systemResults, (item) => item.designHours || 0);
  const totalDesignMonths = Math.max(...systemResults.map((item) => item.designDurationMonths || 1), 1);
  const avgTeamSize = systemResults.length ? sum(systemResults, (item) => item.designTeamSize || 1) / systemResults.length : 1;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Проектирование</h2>
          <p>
            Стоимость и сроки проектирования считаются по каждой системе по фактическому объему, сложности объекта, этажности и
            региональному коэффициенту.
          </p>
        </div>
      </div>

      <div className="summary-grid breakdown-metrics">
        <div className="metric-card">
          <span>Трудоемкость проектирования</span>
          <strong>{num(totalDesignHours, 1)} ч</strong>
        </div>
        <div className="metric-card">
          <span>Стоимость проектирования</span>
          <strong>{rub(totals.totalDesign || 0)}</strong>
        </div>
        <div className="metric-card">
          <span>Срок проектирования (макс.)</span>
          <strong>{num(totalDesignMonths, 0)} мес.</strong>
        </div>
        <div className="metric-card total">
          <span>Средний состав группы</span>
          <strong>{num(avgTeamSize, 1)} чел.</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Часы проектирования</th>
              <th>Срок, мес.</th>
              <th>Группа, чел.</th>
              <th>База, ₽</th>
              <th>Начисления, ₽</th>
              <th>Итого проектирование, ₽</th>
            </tr>
          </thead>
          <tbody>
            {systemResults.map((item, index) => (
              <tr key={`${item.systemType}-design-${index}`}>
                <td>{item.systemName}</td>
                <td>{num(item.designHours || 0, 1)}</td>
                <td>{num(item.designDurationMonths || 1, 0)}</td>
                <td>{num(item.designTeamSize || 1, 0)}</td>
                <td>{rub(item.designBase || 0)}</td>
                <td>{rub(item.designCharges || 0)}</td>
                <td>{rub(item.designTotal || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="calc-explain design-note">
        <h4>Алгоритм расчета проектирования</h4>
        <p>1. Для каждой системы рассчитываются проектные часы по зонам и плотности элементов.</p>
        <p>2. Проектные часы умножаются на базовую ставку проектирования и коэффициент сложности проектирования.</p>
        <p>3. Далее начисляются ФОТ, утилизация, СИЗ, АХР и применяется региональный коэффициент.</p>
        <p>4. Срок определяется по проектным часам и расчетной численности проектной группы.</p>
      </div>
    </section>
  );
}

