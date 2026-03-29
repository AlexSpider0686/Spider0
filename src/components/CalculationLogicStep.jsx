import React, { useMemo } from "react";
import { COEFFICIENT_GUIDE, SYSTEM_TYPES } from "../config/estimateConfig";
import { LABOR_MARKET_GUARDRAILS, LABOR_UNIT_RATES } from "../config/costModelConfig";
import { num, rub, toNumber } from "../lib/estimate";
import { buildCoefficientLayer } from "../lib/coefficient-engine";

function percent(value) {
  return `${num(toNumber(value, 0), 1)}%`;
}

function coef(value) {
  return `x${num(toNumber(value, 1), 2)}`;
}

function getSystemLabel(systemType) {
  return SYSTEM_TYPES.find((item) => item.code === systemType)?.name || systemType;
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

export default function CalculationLogicStep({ objectData, effectiveObjectData, systems, systemResults, budget, totals, projectRisks = [] }) {
  const calcObjectData = effectiveObjectData || objectData;
  const coefficientLayer = useMemo(
    () =>
      buildCoefficientLayer({
        budget,
        buildingStatus: calcObjectData?.buildingStatus,
        regionSubject: calcObjectData?.regionSubject,
        regionCoef: calcObjectData?.regionCoef,
      }),
    [budget, calcObjectData]
  );
  const conditionFactor = toNumber(coefficientLayer.conditionLaborFactor, 1);
  const exploitedBuildingCoef = toNumber(coefficientLayer.exploitedBuildingCoefficient, 1);
  const regionalCoef = toNumber(coefficientLayer.regionalCoefficient, 1);
  const calculatedDesignRows = systemResults.filter((row) => !row.designSkipped);
  const totalDesignHours = calculatedDesignRows.reduce((sum, row) => sum + toNumber(row.designHours, 0), 0);
  const avgDesignTeam =
    calculatedDesignRows.length > 0
      ? calculatedDesignRows.reduce((sum, row) => sum + toNumber(row.designTeamSize, 1), 0) / calculatedDesignRows.length
      : 0;
  const maxDesignMonths = Math.max(...calculatedDesignRows.map((row) => row.designDurationMonths || 1), calculatedDesignRows.length ? 1 : 0);

  const totalWorkBase = systemResults.reduce((sum, row) => sum + toNumber(row.workBase, 0), 0);
  const totalWorkWithCharges = systemResults.reduce((sum, row) => sum + toNumber(row.workTotal, 0), 0);
  const totalEquipment = toNumber(totals.totalEquipment, 0);
  const totalMaterials = toNumber(totals.totalMaterials, 0);
  const totalDesign = toNumber(totals.totalDesign, 0);
  const totalProject = toNumber(totals.total, 0);
  const aiGuard = summarizeAiGuard(systemResults);
  const skippedDesignRows = systemResults.filter((row) => row.designSkipped);
  const totalWorkBeforeRegion = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workTotalBeforeRegion, 0), 0);
  const appliedObjectCoefficients = useMemo(() => {
    const entries = [];
    const guideMap = new Map(COEFFICIENT_GUIDE.map((item) => [item.key, item]));
    const budgetKeys = ["cableCoef", "equipmentCoef", "laborCoef", "complexityCoef"];

    budgetKeys.forEach((key) => {
      const value = toNumber(budget?.[key], 1);
      if (Math.abs(value - 1) < 0.001) return;
      entries.push({
        key,
        label: guideMap.get(key)?.title || key,
        value,
        reason: guideMap.get(key)?.tip || "Применен в текущем расчете бюджета.",
      });
    });

    (coefficientLayer.conditionRows || []).forEach((row) => {
      const value = toNumber(row?.value, 1);
      if (Math.abs(value - 1) < 0.001) return;
      entries.push({
        key: row.key,
        label: row.label || guideMap.get(row.key)?.title || row.key,
        value,
        reason: row.wasSuppressed
          ? "Введенное значение было нормализовано моделью, чтобы не допустить двойного учета коэффициентов."
          : guideMap.get(row.key)?.tip || "Применен в текущем расчете бюджета.",
      });
    });

    if (Math.abs(exploitedBuildingCoef - 1) > 0.001) {
      entries.push({
        key: "exploitedBuildingCoefficient",
        label: "Коэффициент действующего здания",
        value: exploitedBuildingCoef,
        reason: "Применяется автоматически к трудозависимой части работ для действующего объекта.",
      });
    }

    if (Math.abs(regionalCoef - 1) > 0.001) {
      entries.push({
        key: "regionalCoefficient",
        label: "Региональный коэффициент",
        value: regionalCoef,
        reason: `Берется из карточки объекта для региона ${calcObjectData?.regionName || calcObjectData?.regionSubject || "объекта"}.`,
      });
    }

    return entries;
  }, [budget, calcObjectData, coefficientLayer.conditionRows, exploitedBuildingCoef, regionalCoef]);
  const totalCharges = systemResults.reduce(
    (sum, row) =>
      sum +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.overhead, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.payrollTaxes, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.utilization, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.ppe, 0) +
      toNumber(row?.laborDetails?.workChargesBeforeRegion?.admin, 0),
    0
  );
  const detailedLaborBreakdown = useMemo(() => {
    const totalSmr = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.smrBase, 0), 0);
    const totalPnr = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.pnrBase, 0), 0);
    const totalIntegration = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.integrationBase, 0), 0);
    const totalKns = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workBreakdown?.knsBase, 0), 0);
    const totalWorkAfterConditions = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workAfterConditions, 0), 0);
    const totalOverhead = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.overhead, 0), 0);
    const totalPayrollTaxes = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.payrollTaxes, 0), 0);
    const totalUtilization = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.utilization, 0), 0);
    const totalPpe = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.ppe, 0), 0);
    const totalAdmin = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.workChargesBeforeRegion?.admin, 0), 0);
    const totalNeuralFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.neuralCheck?.neuralFloorBase, 0), 0);
    const totalRateFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.marketGuard?.marketFloorBaseByRates, 0), 0);
    const totalMarkerFloor = systemResults.reduce((sum, row) => sum + toNumber(row?.laborDetails?.marketGuard?.marketFloorBaseByMarker, 0), 0);

    return {
      totalSmr,
      totalPnr,
      totalIntegration,
      totalKns,
      totalWorkAfterConditions,
      totalOverhead,
      totalPayrollTaxes,
      totalUtilization,
      totalPpe,
      totalAdmin,
      totalNeuralFloor,
      totalRateFloor,
      totalMarkerFloor,
    };
  }, [systemResults]);
  const ratesDigest = useMemo(() => {
    const seen = new Set();

    return (systemResults || [])
      .map((row) => row?.systemType)
      .filter(Boolean)
      .filter((systemType) => {
        if (seen.has(systemType)) return false;
        seen.add(systemType);
        return true;
      })
      .map((systemType) => {
        const rates = LABOR_UNIT_RATES[systemType] || LABOR_UNIT_RATES.sot;
        const guard = LABOR_MARKET_GUARDRAILS[systemType] || LABOR_MARKET_GUARDRAILS.sot;
        return {
          systemType,
          systemLabel: getSystemLabel(systemType),
          rates,
          guard,
        };
      });
  }, [systemResults]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Логика расчета</h2>
          <p>Пошагово: как платформа собирает объемы, проводит AI-аудит цен, использует AI-обследование, оценивает риски проекта и защищает бюджет от недооценки.</p>
        </div>
      </div>

      <div className="logic-grid">
        <article className="logic-card">
          <h3>1. Входные параметры объекта</h3>
          <p>Расчет начинается с типа объекта, площади, защищаемой площади, этажности, региона, статуса здания и выбранных систем. Эти данные формируют профиль сложности и стартовые объемы по каждой системе.</p>
          <p>Сейчас: площадь <strong>{num(calcObjectData.totalArea, 0)} м²</strong>, систем <strong>{num(systems.length, 0)}</strong>, регион <strong>{calcObjectData.regionName}</strong> ({coef(regionalCoef)}), статус здания <strong>{calcObjectData.buildingStatus === "operational" ? "действующее" : "строящееся"}</strong> ({coef(exploitedBuildingCoef)}).</p>
        </article>

        <article className="logic-card">
          <h3>2. Автоматическое определение объемов</h3>
          <p>Для каждой системы движок рассчитывает количество основных элементов, контроллеров, кабеля, КНС, объем ПНР и проектных часов. Основа расчета: профиль зон, насыщенность объекта, этажность, маршруты и тип эксплуатации.</p>
          <p>Если загружен PDF-проект АПС, система использует спецификацию проекта как приоритетный источник фактических объемов, а не только внутреннюю модель.</p>
        </article>

        <article className="logic-card">
          <h3>3. AI-обследование</h3>
          <p>После заполнения объекта можно запустить AI-обследование. Платформа строит адаптивный чек-лист по объекту, зонам и системам без проекта, включая вопросы, необходимые для точного расчета стоимости проектирования.</p>
          <p>Для СОТС, СОУЭ и АПС чек-лист обязательно собирает планы эвакуации. Платформа подсказывает, как их фотографировать: держать камеру почти параллельно плоскости схемы, брать план целиком, избегать бликов, смаза и сильного наклона.</p>
          <p>Фотоанализ помогает подтвердить материал стен, тип потолка и, если качество снимка позволяет, оценить высоту помещения. Отдельный модуль распознавания планировок анализирует планы эвакуации, выделяет охранные зоны для СОТС, зоны оповещения для СОУЭ и ЗКСПС для АПС, а затем перепроверяет результат по данным объекта.</p>
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
          <p>Источник базовых расценок — внутренняя нормативная конфигурация платформы: ставки по видам работ берутся из модели `LABOR_UNIT_RATES`, а нижние защитные пороги — из `LABOR_MARKET_GUARDRAILS`. Это утвержденная расчетная база текущей версии платформы, а не произвольные цифры из конкретной сметы.</p>
          <p>
            Порядок расчета по формуле: <strong>База работ = СМР + ПНР + интеграция + КНС</strong>.
            СМР = первичные элементы × ставка монтажа + контроллеры × ставка монтажа контроллера + кабель × ставка за 1 м.
            ПНР = первичные элементы × ставка ПНР + активные элементы × ставка ПНР на активный элемент.
            Интеграция = точки интеграции × ставка интеграции.
            КНС = метры КНС × ставка КНС + рабочие единицы КНС × 22% этой же ставки.
          </p>
          <p>
            Далее система применяет цепочку: <strong>база работ × коэффициенты условий × коэффициент действующего здания = работы после условий</strong>,
            затем на эту величину начисляются ОПР, ФОТ, утилизация, СИЗ и АХР, после чего применяется региональный коэффициент.
            Итоговая база работ дополнительно защищается снизу тремя барьерами: минимумом по единичным ставкам, минимумом по маркеру системы и AI-floor.
          </p>
          <p>База работ по текущему расчету: <strong>{rub(totalWorkBase)}</strong>. После начислений и коэффициентов: <strong>{rub(totalWorkWithCharges)}</strong>.</p>
          <p>
            Детализация по текущему расчету: СМР <strong>{rub(detailedLaborBreakdown.totalSmr)}</strong>, ПНР <strong>{rub(detailedLaborBreakdown.totalPnr)}</strong>,
            интеграция <strong>{rub(detailedLaborBreakdown.totalIntegration)}</strong>, КНС <strong>{rub(detailedLaborBreakdown.totalKns)}</strong>.
          </p>
          <p>
            После коэффициентов условий и статуса здания: <strong>{rub(detailedLaborBreakdown.totalWorkAfterConditions)}</strong>. Начисления:
            ОПР <strong>{rub(detailedLaborBreakdown.totalOverhead)}</strong>, ФОТ <strong>{rub(detailedLaborBreakdown.totalPayrollTaxes)}</strong>,
            утилизация <strong>{rub(detailedLaborBreakdown.totalUtilization)}</strong>, СИЗ <strong>{rub(detailedLaborBreakdown.totalPpe)}</strong>,
            АХР <strong>{rub(detailedLaborBreakdown.totalAdmin)}</strong>.
          </p>
          <p>
            Защитные пороги базы: по единичным расценкам <strong>{rub(detailedLaborBreakdown.totalRateFloor)}</strong>, по маркеру
            <strong> {rub(detailedLaborBreakdown.totalMarkerFloor)}</strong>, AI floor <strong>{rub(detailedLaborBreakdown.totalNeuralFloor)}</strong>.
          </p>
          <div className="logic-equipment-list">
            {ratesDigest.map((item) => (
              <p key={`rates-${item.systemType}`}>
                <strong>{item.systemLabel}:</strong> монтаж основного элемента {rub(item.rates.mountPrimary)}, ПНР основного элемента {rub(item.rates.pnrPrimary)},
                монтаж контроллера {rub(item.rates.controllerMount)}, ПНР активного элемента {rub(item.rates.pnrActiveElement)}, кабель {rub(item.rates.cablePerMeter)}/м,
                КНС {rub(item.rates.knsPerMeter)}/м, интеграция {rub(item.rates.integrationPoint)}/точка, проектирование {rub(item.rates.designHour)}/час.
                Минимальная база по ставкам: x{num(item.guard.minBaseFactor, 2)}, минимальный итог по маркеру: {rub(item.guard.minFinalPerMarker)}.
              </p>
            ))}
          </div>
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
          {appliedObjectCoefficients.length ? (
            <div className="logic-equipment-list">
              {appliedObjectCoefficients.map((item) => (
                <p key={item.key}>
                  <strong>{item.label}:</strong> {coef(item.value)}. {item.reason}
                </p>
              ))}
            </div>
          ) : (
            <p>По текущему объекту все ручные коэффициенты стоят в базовом значении x1.00; дополнительно применяются только встроенные базовые настройки модели.</p>
          )}
          <p>
            Сумма начислений по текущему расчету: <strong>{rub(totalCharges)}</strong>. До регионального коэффициента:
            <strong> {rub(totalWorkBeforeRegion)}</strong>; после регионального коэффициента:
            <strong> {rub(totalWorkWithCharges)}</strong>.
          </p>
        </article>

        <article className="logic-card">
          <h3>9. Проектирование</h3>
          <p>Проектирование считается отдельно по каждой системе от расчетного объема и сложности. Данные объекта и AI-обследования корректируют трудоемкость: учитываются трассы, высоты, отделка, интеграции, координация по зонам и существующая инфраструктура.</p>
          <p>Если по системе есть проект или он загружен во вкладке «Системы», стоимость проектирования по этой системе не рассчитывается, а на вкладке «Проектирование» выводится пометка «стоимость не рассчитывается, проект в наличии».</p>
          <p>Суммарно по рассчитываемым системам: <strong>{num(totalDesignHours, 1)} ч</strong>, средняя группа <strong>{num(avgDesignTeam, 1)} чел.</strong>, максимальный срок <strong>{num(maxDesignMonths, 0)} мес.</strong>, стоимость <strong>{rub(totalDesign)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>10. Итоговая формула бюджета</h3>
          <p><strong>Итог = Оборудование + Материалы + Работы + Проектирование + Рентабельность + НДС</strong></p>
          <p>Сейчас: оборудование <strong>{rub(totalEquipment)}</strong>, материалы <strong>{rub(totalMaterials)}</strong>, работы <strong>{rub(totals.totalWorks || totals.totalWork || 0)}</strong>, проектирование <strong>{rub(totalDesign)}</strong>, итог проекта <strong>{rub(totalProject)}</strong>.</p>
        </article>

        <article className="logic-card">
          <h3>11. Что происходит при изменении параметров</h3>
          <p>Любое изменение объекта, систем, вендора, PDF-спецификации, цен, обследования или бюджета запускает пересчет: обновляются объемы, AI-аудит цен, контур рисков проекта, блок защиты от недооценки работ и общий бюджет проекта.</p>
          <div className="logic-equipment-list">
            {systemResults.map((row, index) => (
              <p key={`${row.systemType}-logic-${index}`}>
                <strong>{row.systemName}:</strong> кабель {num(row.cable || 0, 1)} м, работы {rub(row.workTotal || 0)}, проектирование {row.designSkipped ? "не рассчитывается" : rub(row.designTotal || 0)}, итог {rub(row.total || 0)}.
              </p>
            ))}
            {skippedDesignRows.length ? (
              <p>
                <strong>Системы с проектом:</strong> {skippedDesignRows.map((row) => row.systemName).join(", ")}.
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </section>
  );
}
