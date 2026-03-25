import { num, toNumber } from "./estimate";

function recommendationByKey(key, value) {
  const safe = toNumber(value, 1);
  if (key === "conditionLaborFactor") {
    if (safe > 1.35) return "Высокая совокупная сложность условий. Проверьте обоснование ночных/стесненных работ.";
    if (safe > 1.15) return "Условия работ сложные, коэффициент выглядит реалистично для действующего объекта.";
    return "Условия работ в типовом диапазоне.";
  }
  if (key === "exploitedBuildingCoefficient") {
    return safe > 1.01
      ? "Объект действующий: коэффициент 1.2 применен только к трудозависимой части."
      : "Объект строящийся: коэффициент работ в эксплуатируемом здании не применяется.";
  }
  if (key === "regionalCoefficient") {
    if (safe > 1.15) return "Повышенный региональный коэффициент: заложены региональные трудовые и логистические риски.";
    if (safe < 0.95) return "Пониженный региональный коэффициент.";
    return "Региональный коэффициент в базовом диапазоне.";
  }
  if (key === "designComplexityFactor") {
    if (safe > 1.25) return "Проектирование сложное: высокая этажность/распределенность/интеграция.";
    return "Сложность проектирования умеренная.";
  }
  return "Коэффициент применен в рамках расчетной модели.";
}

export function buildSystemExplainability({
  systemResult,
  input,
  objectClassification,
  coefficients,
  quantities,
  cableModel,
  knsModel,
}) {
  const formulaRows = [
    {
      key: "conditionLaborFactor",
      label: "Сводный коэффициент условий работ",
      value: coefficients.conditionLaborFactor,
      useCase:
        "Агрегирует ночные, стесненность, доступ, маршруты и высотность. Для защиты от завышения применяется демпфирование.",
    },
    {
      key: "exploitedBuildingCoefficient",
      label: "Коэффициент работ в эксплуатируемых зданиях",
      value: coefficients.exploitedBuildingCoefficient,
      useCase: "1.2 для действующего здания, 1.0 для строящегося. Применяется только к трудозависимой части.",
    },
    {
      key: "regionalCoefficient",
      label: "Региональный коэффициент",
      value: coefficients.regionalCoefficient,
      useCase:
        "Берется из словаря субъектов РФ и применяется к СМР, ПНР, интеграции, КНС-работам и проектированию.",
    },
    {
      key: "designComplexityFactor",
      label: "Коэффициент сложности проектирования",
      value: objectClassification.designComplexityIndex,
      useCase: "Учитывает тип объекта, этажность, инженерную насыщенность и распределенность архитектуры.",
    },
    {
      key: "architectureComplexityIndex",
      label: "Индекс архитектурной сложности",
      value: objectClassification.architectureComplexityIndex,
      useCase: "Влияет на монтажную и проектную трудоемкость.",
    },
  ];

  const coefficientInsights = formulaRows.map((row) => ({
    ...row,
    recommended: recommendationByKey(row.key, row.value),
  }));

  const explanation = [
    `Система: ${systemResult.systemName}.`,
    `Объект: ${input.objectData.projectName}, тип ${input.objectData.objectType}.`,
    `Регион: ${input.objectData.regionSubject}, коэффициент x${num(coefficients.regionalCoefficient, 2)}.`,
    `Статус здания: ${coefficients.exploited.buildingStatusLabel}, коэффициент x${num(coefficients.exploitedBuildingCoefficient, 2)}.`,
    `Автообъем: ${num(quantities.primaryUnits, 0)} ${quantities.primaryUnitLabel.toLowerCase()}(ов), контроллеры/узлы ${num(
      quantities.controllerUnits,
      0
    )}, точки интеграции ${num(quantities.integrationPoints, 0)}.`,
    `Кабельный фонд: ${num(cableModel.cableLengthM, 0)} м (локальный ${num(cableModel.localCableM, 0)} м, магистраль ${num(
      cableModel.trunkCableM,
      0
    )} м, стояки ${num(cableModel.riserCableM, 0)} м).`,
    `КНС: ${num(knsModel.knsLengthM, 0)} м (лоток ${num(knsModel.trayLengthM, 0)} м, труба ${num(knsModel.conduitLengthM, 0)} м).`,
    `Формула труда: base × conditions × exploited × regional = ${num(systemResult.workBase, 0)} × ${num(
      coefficients.conditionLaborFactor,
      2
    )} × ${num(coefficients.exploitedBuildingCoefficient, 2)} × ${num(coefficients.regionalCoefficient, 2)}.`,
  ];

  return {
    formulaRows,
    coefficientInsights,
    explanation,
  };
}
