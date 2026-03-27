import React, { useMemo } from "react";
import { num, rub, toNumber } from "../lib/estimate";

function percent(value) {
  return `${num(toNumber(value, 0), 1)}%`;
}

function coef(value) {
  return `x${num(toNumber(value, 1), 2)}`;
}

function summarizeAiGuard(systemResults) {
  const rows = systemResults
    .map((row) => row?.laborDetails)
    .filter(Boolean);

  const maxRisk = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.underestimationRisk, 0)), 0);
  const maxUplift = rows.reduce((max, item) => Math.max(max, toNumber(item?.neuralCheck?.neuralUpliftMultiplier, 1)), 1);
  const totalMarketFloor = rows.reduce((sum, item) => sum + toNumber(item?.marketGuard?.marketFloorTotal, 0), 0);

  return { maxRisk, maxUplift, totalMarketFloor };
}

export default function CalculationLogicStep({ objectData, systems, systemResults, budget, totals, projectRisks = [] }) {
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
  const regionalCoef = Math.max(toNumber(objectData?.regionCoef, 1), 1);
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
  const aiGuard = summarizeAiGuard(systemResults);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Логика расчета</h2>
          <p>Пошагово: как платформа собирает объемы, проводит AI-аудит цен, оценивает критичные риски проекта и защищает бюджет от недооценки.</p>
        </div>
      </div>

      <div className="logic-grid">
        <article className="logic-card">
          <h3>1. Входные параметры объекта</h3>
          <p>Расчет начинается с типа объекта, площади, защищаемой площади, этажности, региона, статуса здания и выбранных систем. Эти данные формируют профиль сложности и стартовые объемы по каждой системе.</p>
          <p>Сейчас: площадь <strong>{num(objectData.totalArea, 0)} м²</strong>, систем <strong>{num(systems.length, 0)}</strong>, регион <strong>{objectData.regionName}</strong> ({coef(regionalCoef)}), статус здания <strong>{objectData.buildingStatus === "operational" ? "действующее" : "строящееся"}</strong> ({coef(exploitedBuildingCoef)}).</p>
        </article>

        <article className="logic-card">
          <h3>2. Автоматическое определение объемов</h3>
          <p>Для каждой системы движок рассчитывает количество основных элементов, контроллеров, кабеля, КНС, объем ПНР и проектных часов. Основа расчета: профиль зон, насыщенность объекта, этажность, маршруты и тип эксплуатации.</p>
          <p>Если загружен PDF-проект АПС, система использует спецификацию проекта как приоритетный источник фактических объемов, а не только внутреннюю модель.</p>
        </article>

        <article className="logic-card">
          <h3>3. AI-Техническое решение</h3>
          <p>После заполнения объекта можно запустить AI-обследование. Платформа строит адаптивный чек-лист по объекту, зонам и системам без РД и сохраняет его внутри текущей сессии.</p>
          <p>Фотоанализ помогает подтвердить материал стен, тип потолка и, если качество снимка позволяет, оценить высоту помещения. При недостаточной уверенности высота остается обязательной для ручного ввода.</p>
          <p>В модуль встроена защита от ложной фотоинформации: схемы, документы и нерелевантные снимки не попадают в чек-лист и не искажают обследование.</p>
        </article>

        <article className="logic-card">
          <h3>4. Откуда берутся цены оборудования</h3>
          <p>Базовые ориентиры берутся из внутренних справочников, после чего запускается AI-аудит цен: система ищет сопоставимые предложения у поставщиков и на сайте производителя выбранного вендора.</p>
          <p>По каждой позиции фиксируются найденные источники, стратегия выбора, уровень уверенности и необходимость ручной перепроверки. Это снижает риск опоры на единичную или случайно заниженную цену.</p>
        </article>

        <article className="logic-card">
          <h3>5. Как считается стоимость работ</h3>
          <p>СМР+ПНР считаются по составу работ, а не по рублям за квадратный метр. База складывается из монтажа основных элементов, ПНР, контроллеров, кабельных работ, КНС и точек интеграции.</p>
          <p>Единичные расценки откалиброваны в консервативном диапазоне по рынку РФ. Для защиты бюджета система применяет рыночный пол и не позволяет опустить итоговую трудовую часть ниже безопасного диапазона.</p>
          <p>База работ по текущему расчету: <strong>{rub(totalWorkBase)}</strong>. После начислений и коэффициентов: <strong>{rub(totalWorkWithCharges)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>6. AI-проверка недооценки работ</h3>
          <p>В расчете есть отдельный AI-контур, который оценивает риск недооценки СМР+ПНР. Он анализирует PDF-override, кабельную насыщенность, КНС, плотность узлов, набор оборудования, регион и условия работ.</p>
          <p>Если риск повышен, система автоматически применяет консервативный uplift и удерживает трудовую часть не ниже безопасного рыночного floor.</p>
          <p>По текущему расчету максимальный риск: <strong>{num(aiGuard.maxRisk * 100, 0)}%</strong>, максимальный AI uplift: <strong>{coef(aiGuard.maxUplift)}</strong>, суммарный рыночный floor: <strong>{rub(aiGuard.totalMarketFloor)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>7. AI-риски проекта</h3>
          <p>Отдельный модуль AI-рисков проекта в реальном времени анализирует весь собранный контур: объект, зонирование, системы, обследование, проектные PDF-данные, рыночные сигналы и ограничения монтажа.</p>
          <p>На выходе он показывает не общий список замечаний, а до пяти самых критичных индивидуальных рисков именно для текущего проекта, чтобы заранее увидеть возможные точки удорожания, сдвига сроков и корректировок спецификации.</p>
          <p>Сейчас в модуле зафиксировано <strong>{projectRisks.length}</strong> критичных/повышенных риска(ов).</p>
        </article>

        <article className="logic-card">
          <h3>8. Коэффициенты и начисления</h3>
          <p>После расчета базы работ система применяет коэффициенты условий выполнения, коэффициент действующего здания и региональный коэффициент. Региональная часть ограничена floor-логикой и не может искусственно удешевить труд ниже базы.</p>
          <p>Сводный коэффициент условий: <strong>{coef(conditionFactor)}</strong>. Начисления: ФОТ {percent(budget.payrollTaxesPercent)}, утилизация {percent(budget.utilizationPercent)}, СИЗ {percent(budget.ppePercent)}, АХР {percent(budget.adminPercent)}.</p>
        </article>

        <article className="logic-card">
          <h3>9. Проектирование</h3>
          <p>Проектирование считается отдельно по каждой системе от расчетного объема и сложности. Затем применяется ставка проектирования и коэффициенты сложности, после чего проектные работы попадают в общий бюджет отдельной строкой.</p>
          <p>Суммарно: <strong>{num(totalDesignHours, 1)} ч</strong>, средняя группа <strong>{num(avgDesignTeam, 1)} чел.</strong>, максимальный срок <strong>{num(maxDesignMonths, 0)} мес.</strong>, стоимость <strong>{rub(totalDesign)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>10. Итоговая формула бюджета</h3>
          <p><strong>Итог = Оборудование + Материалы + Работы + Проектирование + Рентабельность + НДС</strong></p>
          <p>Сейчас: оборудование <strong>{rub(totalEquipment)}</strong>, материалы <strong>{rub(totalMaterials)}</strong>, работы <strong>{rub(totals.totalWorks || totals.totalWork || 0)}</strong>, проектирование <strong>{rub(totalDesign)}</strong>, итог проекта <strong>{rub(totalProject)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>11. Что происходит при изменении параметров</h3>
          <p>Любое изменение объекта, систем, вендора, PDF-спецификации, цен, обследования или бюджета запускает пересчет: обновляются объемы, AI-аудит цен, контур рисков проекта, анти-недооценочный блок по работам и общий бюджет проекта.</p>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-logic-${index}`}>
                <strong>{row.systemName}:</strong> кабель {num(row.cable || 0, 1)} м, работы {rub(row.workTotal || 0)}, проектирование {rub(row.designTotal || 0)}, итог {rub(row.total || 0)}.
              </p>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
