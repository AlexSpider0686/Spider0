import React, { useMemo } from "react";
import { num, rub, toNumber } from "../lib/estimate";

function percent(value) {
  return `${num(toNumber(value, 0), 1)}%`;
}

function coef(value) {
  return `x${num(toNumber(value, 1), 2)}`;
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

  const exploitedBuildingCoef = objectData?.buildingStatus === "operational" ? 1.2 : 1;
  const regionalCoef = toNumber(objectData?.regionCoef, 1);
  const totalDesignHours = systemResults.reduce((sum, row) => sum + toNumber(row.designHours, 0), 0);
  const avgDesignTeam =
    systemResults.length > 0
      ? systemResults.reduce((sum, row) => sum + toNumber(row.designTeamSize, 1), 0) / systemResults.length
      : 1;
  const maxDesignMonths = Math.max(...systemResults.map((row) => row.designDurationMonths || 1), 1);

  const totalWorkBase = systemResults.reduce((sum, row) => sum + toNumber(row.workBase, 0), 0);
  const totalWorkWithCharges = systemResults.reduce((sum, row) => sum + toNumber(row.workTotal, 0), 0);
  const totalEquipment = toNumber(totals.totalEquipment, 0);
  const totalMaterials = toNumber(totals.totalMaterials, 0);
  const totalDesign = toNumber(totals.totalDesign, 0);
  const totalProject = toNumber(totals.total, 0);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Логика расчета</h2>
          <p>Пошагово: откуда берутся базовые стоимости, как считается стоимость работ и как формируется итоговый бюджет.</p>
        </div>
      </div>

      <div className="logic-grid">
        <article className="logic-card">
          <h3>1. С чего начинается расчет</h3>
          <p>
            Расчет стартует с параметров объекта: тип, площадь, защищаемая площадь зон, этажность, регион, статус здания и выбранные системы. Эти данные
            формируют расчетные объемы по каждой системе.
          </p>
          <p>
            Сейчас: площадь <strong>{num(objectData.totalArea, 0)} м²</strong>, систем <strong>{num(systems.length, 0)}</strong>, регион{" "}
            <strong>{objectData.regionName}</strong> ({coef(regionalCoef)}), статус здания{" "}
            <strong>{objectData.buildingStatus === "operational" ? "действующее" : "строящееся"}</strong> ({coef(exploitedBuildingCoef)}).
          </p>
        </article>

        <article className="logic-card">
          <h3>2. Как система сама определяет объемы</h3>
          <p>
            Для каждой системы движок рассчитывает количество основных элементов, контроллеров, кабеля, КНС и объем ПНР по зонам. Основа: профиль зоны,
            плотность насыщения, этажность, маршрутная сложность и тип объекта.
          </p>
          <p>
            Если загружен PDF-проект АПС, приоритет у спецификации проекта. Если PDF не загружен, применяется внутренняя расчетная модель.
          </p>
        </article>

        <article className="logic-card">
          <h3>3. Откуда берется стоимость оборудования и материалов</h3>
          <p>
            Базовые стоимостные показатели берутся из внутренних справочников (укрупненные модели и fallback-цены), затем система делает рыночный опрос
            источников и корректирует цену.
          </p>
          <p>
            Источники цен: сайт производителя выбранного вендора + Tinko + Luis + Garant + Ganimed. По каждому источнику фиксируется факт опроса и факт
            успешного получения цены.
          </p>
        </article>

        <article className="logic-card">
          <h3>4. Откуда берется стоимость работ</h3>
          <p>
            Базовая стоимость работ считается не по «руб/м²», а по составу работ: монтаж, ПНР, интеграция, КНС и проектирование. Для каждой системы
            сначала определяется трудоемкость (часы и объемы), затем применяется укрупненная ставка.
          </p>
          <p>
            Ставки берутся из встроенных справочников расчетного ядра: нормы по типам работ, маркерам системы, кабельным операциям и проектированию.
          </p>
          <p>
            <strong>База работ:</strong> Σ(объем работ по типу × базовая ставка типа работ).
          </p>
          <p>
            База работ по текущему расчету: <strong>{rub(totalWorkBase)}</strong>. После начислений и коэффициентов:{" "}
            <strong>{rub(totalWorkWithCharges)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>5. Коэффициенты и начисления</h3>
          <p>
            После расчета базы работ система применяет коэффициенты условий выполнения и начисления. Далее отдельно применяются коэффициент работ в
            эксплуатируемом здании и региональный коэффициент.
          </p>
          <p>
            Сводный коэффициент условий: <strong>{coef(conditionFactor)}</strong>. Начисления: ФОТ {percent(budget.payrollTaxesPercent)}, утилизация{" "}
            {percent(budget.utilizationPercent)}, СИЗ {percent(budget.ppePercent)}, АХР {percent(budget.adminPercent)}.
          </p>
          <p>
            Формула трудозависимой части: <strong>Работы = База × Коэфф. условий × Коэфф. эксплуатируемого здания × Региональный коэффициент + начисления</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>6. Как считается проектирование</h3>
          <p>
            По каждой системе отдельно считаются проектные часы от объема системы, затем применяется ставка проектирования и коэффициенты сложности.
            Проектирование включается в общий бюджет отдельной строкой.
          </p>
          <p>
            Суммарно: <strong>{num(totalDesignHours, 1)} ч</strong>, средняя группа <strong>{num(avgDesignTeam, 1)} чел.</strong>, максимальный срок{" "}
            <strong>{num(maxDesignMonths, 0)} мес.</strong>, стоимость <strong>{rub(totalDesign)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>7. Как формируется итоговый бюджет</h3>
          <p>
            Итог складывается из блоков: оборудование + материалы + работы + проектирование. Далее добавляется рентабельность и НДС (если выбран режим
            ОСНО).
          </p>
          <p>
            Формула:{" "}
            <strong>
              Итог = [Оборудование + Материалы + (Работы × Коэфф. условий × Коэфф. эксплуатируемого здания × Региональный коэфф.)] + Проектирование +
              Рентабельность + НДС
            </strong>
            .
          </p>
          <p>
            Сейчас: оборудование <strong>{rub(totalEquipment)}</strong>, материалы <strong>{rub(totalMaterials)}</strong>, работы{" "}
            <strong>{rub(totals.totalWorks || 0)}</strong>, проектирование <strong>{rub(totalDesign)}</strong>, итог проекта{" "}
            <strong>{rub(totalProject)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>8. Что происходит при изменении параметров</h3>
          <p>
            При изменении параметров системы/объекта, вендора, профиля оборудования, позиций из PDF (кол-во/цена) автоматически запускается новый расчет:
            пересчет объемов, повторный опрос цен, обновление работ и общего бюджета.
          </p>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-logic-${index}`}>
                <strong>{row.systemName}:</strong> кабель {num(row.cable || 0, 1)} м, работы {rub(row.workTotal || 0)}, проектирование{" "}
                {rub(row.designTotal || 0)}, итог {rub(row.total || 0)}.
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
