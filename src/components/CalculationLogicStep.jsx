import React, { useMemo } from "react";
import { num, rub, toNumber } from "../lib/estimate";

function percent(value) {
  return `${num(toNumber(value, 0), 1)}%`;
}

export default function CalculationLogicStep({ objectData, systems, systemResults, budget, totals }) {
  const conditionFactor = useMemo(
    () =>
      toNumber(budget.heightCoef, 1) *
      toNumber(budget.constrainedCoef, 1) *
      toNumber(budget.operatingFacilityCoef, 1) *
      toNumber(budget.nightWorkCoef, 1) *
      toNumber(budget.routingCoef, 1) *
      toNumber(budget.finishCoef, 1),
    [budget]
  );

  const totalDesignHours = systemResults.reduce((sum, row) => sum + toNumber(row.designHours, 0), 0);
  const avgDesignTeam =
    systemResults.length > 0
      ? systemResults.reduce((sum, row) => sum + toNumber(row.designTeamSize, 1), 0) / systemResults.length
      : 1;
  const maxDesignMonths = Math.max(...systemResults.map((row) => row.designDurationMonths || 1), 1);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Логика расчета</h2>
          <p>Пошаговое описание: как входные параметры влияют на стоимость и сроки реализации.</p>
        </div>
      </div>

      <div className="logic-grid">
        <article className="logic-card">
          <h3>1. Влияние параметров объекта</h3>
          <p>
            В расчете участвуют тип объекта, площадь, этажность, зонирование и субъект РФ. Площадь и зоны определяют объем
            систем, а региональный коэффициент влияет на стоимость работ и проектирования.
          </p>
          <p>
            Сейчас: площадь объекта <strong>{num(objectData.totalArea, 0)} м²</strong>, активных систем{" "}
            <strong>{num(systems.length, 0)}</strong>, регион <strong>{objectData.regionName}</strong>, коэффициент{" "}
            <strong>x{num(objectData.regionCoef, 2)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>2. Объем оборудования по системам</h3>
          <p>
            Количество оборудования считается по плотностям на 1000 м², типам зон, этажности и выбранным параметрам ключевого
            оборудования. Для каждой системы выводится состав ключевых позиций и обоснование количества.
          </p>
        </article>

        <article className="logic-card">
          <h3>3. Источники стоимости оборудования</h3>
          <p>
            Базовая цена берется из параметрического каталога вендора. Затем выполняется запрос по внешним источникам
            (производитель + Tinko), рассчитывается усредненная рыночная цена и корректируется итоговая стоимость оборудования.
          </p>
          <p>При изменении параметров оборудования автоматически выполняется новый запрос цен и полный пересчет сметы.</p>
        </article>

        <article className="logic-card">
          <h3>4. Стоимость СМР и ПНР</h3>
          <p>
            Базовая стоимость работ формируется из трудоемкости монтажа и пусконаладки. Далее применяются коэффициенты условий
            выполнения и начисления: ФОТ, утилизация, СИЗ, АХР. После этого к блоку работ применяется региональный коэффициент.
          </p>
          <p>
            Сводный коэффициент условий: <strong>x{num(conditionFactor, 2)}</strong>. Начисления: ФОТ{" "}
            <strong>{percent(budget.payrollTaxesPercent)}</strong>, утилизация <strong>{percent(budget.utilizationPercent)}</strong>, СИЗ{" "}
            <strong>{percent(budget.ppePercent)}</strong>, АХР <strong>{percent(budget.adminPercent)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>5. Стоимость проектирования</h3>
          <p>
            Проектирование считается по каждой системе отдельно: проектные часы рассчитываются по составу элементов, далее
            умножаются на ставку проектирования и коэффициенты сложности. После этого начисляются ФОТ, утилизация, СИЗ, АХР и
            применяется региональный коэффициент.
          </p>
          <p>
            Стоимость проектирования включается в общий бюджет проекта и учитывается отдельно по каждой системе.
          </p>
        </article>

        <article className="logic-card">
          <h3>6. Сроки проектирования</h3>
          <p>
            Срок проектирования каждой системы рассчитывается как проектные часы, деленные на расчетную месячную выработку
            проектной группы. Размер группы зависит от объема системы.
          </p>
          <p>
            Итоговый срок проектирования проекта берется по максимальному сроку среди всех выбранных систем.
          </p>
        </article>

        <article className="logic-card">
          <h3>7. Лог расчета проектирования (стоимость и сроки)</h3>
          <div className="logic-totals">
            <div>
              <span>Проектные часы (суммарно)</span>
              <strong>{num(totalDesignHours, 1)} ч</strong>
            </div>
            <div>
              <span>Средняя группа проектирования</span>
              <strong>{num(avgDesignTeam, 1)} чел.</strong>
            </div>
            <div>
              <span>Стоимость проектирования</span>
              <strong>{rub(totals.totalDesign || 0)}</strong>
            </div>
            <div>
              <span>Срок проектирования (макс.)</span>
              <strong>{num(maxDesignMonths, 0)} мес.</strong>
            </div>
          </div>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-design-log-${index}`}>
                <strong>{row.systemName}:</strong> {num(row.designHours || 0, 1)} ч, группа {num(row.designTeamSize || 1, 0)} чел., срок{" "}
                {num(row.designDurationMonths || 1, 0)} мес., стоимость {rub(row.designTotal || 0)}.
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

