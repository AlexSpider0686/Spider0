import React from "react";
import { num, rub } from "../lib/estimate";

function sum(array, getter) {
  return array.reduce((acc, item) => acc + getter(item), 0);
}

export default function ProjectDesignStep({ systemResults, totals }) {
  const calculatedSystems = systemResults.filter((item) => !item.designSkipped);
  const skippedSystems = systemResults.filter((item) => item.designSkipped);
  const totalDesignHours = sum(calculatedSystems, (item) => item.designHours || 0);
  const totalDesignMonths = Math.max(...calculatedSystems.map((item) => item.designDurationMonths || 1), calculatedSystems.length ? 1 : 0);
  const avgTeamSize = calculatedSystems.length ? sum(calculatedSystems, (item) => item.designTeamSize || 1) / calculatedSystems.length : 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Проектирование</h2>
          <p>
            Стоимость и сроки проектирования считаются по каждой системе с учетом параметров объекта и данных AI-обследования.
            Если по системе проект уже в наличии, стоимость проектирования не рассчитывается.
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
        <div className="metric-card">
          <span>Не рассчитывается</span>
          <strong>{num(skippedSystems.length, 0)} сист.</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Система</th>
              <th>Часы проектирования</th>
              <th>Срок</th>
              <th>Группа</th>
              <th>База, ₽</th>
              <th>Начисления, ₽</th>
              <th>Итого проектирование, ₽</th>
            </tr>
          </thead>
          <tbody>
            {systemResults.map((item, index) => (
              <tr key={`${item.systemType}-design-${index}`}>
                <td>{item.systemName}</td>
                <td>{item.designSkipped ? "Не рассчитывается" : `${num(item.designHours || 0, 1)} ч`}</td>
                <td>{item.designSkipped ? "Проект в наличии" : `${num(item.designDurationMonths || 1, 0)} мес.`}</td>
                <td>{item.designSkipped ? "—" : num(item.designTeamSize || 1, 0)}</td>
                <td>{item.designSkipped ? "—" : rub(item.designBase || 0)}</td>
                <td>{item.designSkipped ? "—" : rub(item.designCharges || 0)}</td>
                <td>{item.designSkipped ? "Стоимость не рассчитывается" : rub(item.designTotal || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {skippedSystems.length ? (
        <div className="calc-explain design-note">
          <h4>Системы с проектом</h4>
          {skippedSystems.map((item) => (
            <p key={`${item.systemType}-${item.systemName}`}>{item.systemName}: {item.designStatusNote}</p>
          ))}
        </div>
      ) : null}

      <div className="calc-explain design-note">
        <h4>Алгоритм расчета проектирования</h4>
        <p>1. Для каждой системы рассчитываются проектные часы по объемам, зонам, этажности и базовой конфигурации системы.</p>
        <p>2. Данные объекта и AI-обследования корректируют трудоемкость: учитываются трассы, высоты, отделка, интеграции, ограничения доступа и состав зон.</p>
        <p>3. Проектные часы умножаются на ставку проектирования и коэффициент сложности, затем начисляются ФОТ, СИЗ, АХР, утилизация и региональный коэффициент.</p>
        <p>4. Если по системе отмечено наличие проекта или загружен проект, стоимость проектирования по этой системе не рассчитывается.</p>
      </div>
    </section>
  );
}
