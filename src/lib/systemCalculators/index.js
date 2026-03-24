import { getSystemResourceModel, getSystemRules } from "../../config/systemsConfig";
import { getZoneCalcProfile, getZoneRateProfile } from "../../config/zonesConfig";
import { calculateSystem, toNumber } from "../estimate";

const DESIGN_RATE_PER_HOUR = 2100;
const SYSTEM_MARKERS = {
  sots: { resourceKey: "sensor", label: "Монтаж+ПНР 1 охранного датчика" },
  sot: { resourceKey: "camera", label: "Монтаж+ПНР 1 камеры" },
  skud: { resourceKey: "reader", label: "Монтаж+ПНР 1 точки прохода" },
  ssoi: { resourceKey: "gateway", label: "Интеграция 1 элемента" },
  aps: { resourceKey: "detector", label: "Монтаж+ПНР 1 извещателя" },
  soue: { resourceKey: "speaker", label: "Монтаж+ПНР 1 оповещателя" },
};

function pickOptimalCoefficient({ key, value, objectData, zones }) {
  const maxFloors = Math.max(...zones.map((zone) => toNumber(zone.floors, 1)), 1);
  const parkingShare =
    zones.filter((zone) => zone.type === "parking").reduce((sum, zone) => sum + toNumber(zone.area), 0) /
    Math.max(zones.reduce((sum, zone) => sum + toNumber(zone.area), 0), 1);

  const recommendations = {
    vendorFactor:
      value > 1.15
        ? "Премиальный вендор оправдан для сложной интеграции и повышенных требований к надежности."
        : "Для типового объекта обычно достаточно диапазона 0.95–1.10.",
    marketSnapshotFactor:
      value > 1.08
        ? "Рынок выше базового уровня; для закупки лучше закладывать запас."
        : "Рыночный индекс близок к базе; можно работать в стандартном ценовом коридоре.",
    regionCoef:
      value > 1.1
        ? "Для удаленных и северных регионов коэффициент >1.1 обычно обоснован."
        : "Для центральной части РФ обычно достаточно диапазона 0.98–1.08.",
    cableCoef:
      parkingShare > 0.25
        ? "При большой доле парковки и сложной трассировке рекомендуется 1.05–1.20."
        : "Для стандартного объекта обычно достаточно 0.95–1.05.",
    laborCoef:
      maxFloors > 8
        ? "На высотных объектах обычно применяют 1.05–1.20 по трудозатратам."
        : "Для типовых объектов обычно достаточно 0.95–1.05.",
    complexityCoef:
      objectData.objectType === "transport" || objectData.objectType === "energy"
        ? "Для транспортных и энергетических объектов чаще применяют 1.10–1.30."
        : "Для стандартных объектов обычно 1.00–1.10.",
    conditionLaborFactor:
      value > 1.2
        ? "Сложные условия подтверждают повышенный совокупный коэффициент."
        : "Совокупный коэффициент условий в районе 1.00–1.15 обычно достаточен.",
    designComplexityFactor:
      value > 1.2
        ? "Проектирование сильно усложнено (интеграция, этажность, тип объекта)."
        : "Уровень сложности проектирования близок к базовому.",
  };

  return recommendations[key] || "Рекомендуемое значение зависит от сложности объекта и условий выполнения работ.";
}

function calcDesignComplexityFactor(system, objectData, zones) {
  const maxFloors = Math.max(...zones.map((zone) => toNumber(zone.floors, 1)), 1);
  const objectTypeBoost =
    objectData.objectType === "transport" || objectData.objectType === "energy"
      ? 0.16
      : objectData.objectType === "production"
        ? 0.1
        : 0.05;

  const systemBoost = system.type === "ssoi" ? 0.14 : system.type === "aps" || system.type === "soue" ? 0.1 : 0.07;
  const floorsBoost = Math.max(0, maxFloors - 3) * 0.018;

  return 1 + objectTypeBoost + systemBoost + floorsBoost;
}

function calcDesignDurationMonths(designHours, totalUnits) {
  const teamSize = Math.max(1, Math.min(5, Math.ceil(totalUnits / 120)));
  const monthlyCapacity = teamSize * 150;
  const months = Math.max(1, Math.ceil(designHours / Math.max(monthlyCapacity, 1)));
  return { months, teamSize };
}

function calcCharges(baseRaw, budget, regionCoef) {
  const overheadRaw = baseRaw * (toNumber(budget.overheadPercent) / 100);
  const ppeRaw = baseRaw * (toNumber(budget.ppePercent) / 100);
  const payrollTaxesRaw = baseRaw * (toNumber(budget.payrollTaxesPercent) / 100);
  const utilizationRaw = baseRaw * (toNumber(budget.utilizationPercent) / 100);
  const adminRaw = (baseRaw + overheadRaw + ppeRaw + payrollTaxesRaw + utilizationRaw) * (toNumber(budget.adminPercent) / 100);

  const base = baseRaw * regionCoef;
  const overhead = overheadRaw * regionCoef;
  const ppe = ppeRaw * regionCoef;
  const payrollTaxes = payrollTaxesRaw * regionCoef;
  const utilization = utilizationRaw * regionCoef;
  const admin = adminRaw * regionCoef;
  const charges = overhead + ppe + payrollTaxes + utilization + admin;

  return {
    base,
    overhead,
    ppe,
    payrollTaxes,
    utilization,
    admin,
    charges,
    total: base + charges,
  };
}

function buildSystemMarker(systemType, resourceRows, workTotal, totalUnits) {
  const markerMeta = SYSTEM_MARKERS[systemType] || { resourceKey: "", label: "Стоимость 1 единицы" };
  const markerRow = resourceRows.find((row) => row.key === markerMeta.resourceKey);
  const markerQty = Math.max(toNumber(markerRow?.qty, 0) || toNumber(totalUnits, 0) || 1, 1);
  const costPerUnit = toNumber(workTotal, 0) / markerQty;

  return {
    key: markerMeta.resourceKey || "generic",
    label: markerMeta.label,
    qty: markerQty,
    costPerUnit,
  };
}

export function calculateSystemWithBreakdown(system, zones, budget, objectData = {}, marketSnapshot = null) {
  const base = calculateSystem(system, zones, budget, objectData, marketSnapshot);
  const rules = getSystemRules(system.type);
  const resourceModel = getSystemResourceModel(system.type);
  const budgetComplexity = toNumber(budget.complexityCoef, 1);
  const budgetLabor = toNumber(budget.laborCoef, 1);

  const resourceRows = resourceModel.elements.map((element) => {
    const row = zones.reduce(
      (acc, zone) => {
        const zoneArea = Math.max(toNumber(zone.area), 0);
        const floors = Math.max(toNumber(zone.floors, 1), 1);
        const zoneProfileKey = getZoneRateProfile(zone.type || "office");
        const zoneCalc = getZoneCalcProfile(zone.type || "office");
        const density = element.densityPer1000[zoneProfileKey] || element.densityPer1000.office || 0;
        const floorReserve = 1 + (floors - 1) * 0.012;
        const qty = (zoneArea / 1000) * density * zoneCalc.densityCoef;
        const cable = qty * element.cablePerUnit * zoneCalc.cableCoef * floorReserve;
        const material = qty * element.materialPerUnit;
        const mountHours = qty * element.mountHours * zoneCalc.laborCoef;
        const connectHours = qty * element.connectHours * zoneCalc.laborCoef;
        const setupHours = qty * element.setupHours * zoneCalc.laborCoef;
        const pnrHours = qty * element.pnrHours * zoneCalc.laborCoef;
        const designHours = qty * element.designHours * zoneCalc.laborCoef;

        acc.qty += qty;
        acc.cable += cable;
        acc.materials += material;
        acc.mountHours += mountHours;
        acc.connectHours += connectHours;
        acc.setupHours += setupHours;
        acc.pnrHours += pnrHours;
        acc.designHours += designHours;
        return acc;
      },
      {
        key: element.key,
        label: element.label,
        qty: 0,
        cable: 0,
        materials: 0,
        mountHours: 0,
        connectHours: 0,
        setupHours: 0,
        pnrHours: 0,
        designHours: 0,
        priceShare: element.priceShare || 0,
      }
    );
    return row;
  });

  const totalUnits = resourceRows.reduce((sum, row) => sum + row.qty, 0);
  const totalCable = resourceRows.reduce((sum, row) => sum + row.cable, 0);
  const totalMaterialsByRows = resourceRows.reduce((sum, row) => sum + row.materials, 0);
  const totalExecutionHours = resourceRows.reduce((sum, row) => sum + row.mountHours + row.connectHours + row.setupHours + row.pnrHours, 0);
  const totalDesignHours = resourceRows.reduce((sum, row) => sum + row.designHours, 0);

  const executionRate = totalExecutionHours > 0 ? base.workBase / totalExecutionHours : DESIGN_RATE_PER_HOUR;
  const executionBaseRaw = totalExecutionHours * executionRate * budgetLabor * budgetComplexity;
  const designComplexityFactor = calcDesignComplexityFactor(system, objectData, zones);
  const designBaseRaw = totalDesignHours * DESIGN_RATE_PER_HOUR * budgetComplexity * designComplexityFactor;

  const cableMaterials = totalCable * 92;
  const trayAndFasteners = totalCable * 51;
  const equipmentFromRows = resourceRows.reduce((sum, row) => sum + base.equipmentCost * row.priceShare, 0);
  const equipmentCost = equipmentFromRows > 0 ? equipmentFromRows : base.equipmentCost;
  const materialCost = cableMaterials + trayAndFasteners + totalMaterialsByRows;
  const materialsBase = equipmentCost + materialCost;

  const regionCoef = toNumber(base.trace?.regionCoef, 1);
  const execution = calcCharges(executionBaseRaw, budget, regionCoef);
  const design = calcCharges(designBaseRaw, budget, regionCoef);

  const workTotal = execution.total;
  const designTotal = design.total;
  const directCost = materialsBase + workTotal + designTotal;
  const profit = directCost * (toNumber(budget.profitabilityPercent) / 100);
  const subtotal = directCost + profit;
  const vat = budget.taxMode === "osno" ? subtotal * (toNumber(budget.vatPercent) / 100) : 0;
  const total = subtotal + vat;

  const equipment = rules.equipmentMix.map((item) => {
    const matchingRow = resourceRows.find((row) => row.key === item.key);
    return {
      key: item.key,
      label: item.label,
      cost: matchingRow ? (matchingRow.priceShare || item.share) * equipmentCost : equipmentCost * item.share,
    };
  });

  const smrWeight = toNumber(rules.laborSplit.smr, 0.6);
  const pnrWeight = toNumber(rules.laborSplit.pnr, 0.25);
  const splitSum = Math.max(smrWeight + pnrWeight, 0.001);
  const works = {
    smr: execution.base * (smrWeight / splitSum),
    pnr: execution.base * (pnrWeight / splitSum),
    design: design.base,
  };
  const unitWorkMarker = buildSystemMarker(system.type, resourceRows, workTotal, totalUnits);

  const timeline = calcDesignDurationMonths(totalDesignHours, totalUnits);

  const explanation = [
    `Система рассчитана по зонам и плотностям ресурсов: ${Math.round(totalUnits)} единиц и ${Math.round(totalCable)} м кабеля.`,
    `Проектирование выделено в отдельный контур: ${totalDesignHours.toFixed(1)} ч, команда ~${timeline.teamSize} чел., срок ${timeline.months} мес.`,
    `${unitWorkMarker.label}: ${unitWorkMarker.costPerUnit.toFixed(0)} ₽/ед.`,
    `Блок работ считается по формуле: база × коэффициенты условий + ФОТ + утилизация + СИЗ + АХР; далее применяется региональный коэффициент.`,
  ];

  const formulaRows = [
    {
      key: "vendorFactor",
      label: "Коэфф. вендора",
      value: base.trace?.vendorFactor ?? 1,
      useCase: "Учитывает ценовой и технологический профиль выбранного производителя.",
    },
    {
      key: "marketSnapshotFactor",
      label: "Коэфф. рынка (производитель + Tinko)",
      value: base.trace?.marketSnapshotFactor ?? 1,
      useCase: "Показывает влияние средней рыночной цены по результатам опроса источников.",
    },
    {
      key: "regionCoef",
      label: "Региональный коэфф.",
      value: base.trace?.regionCoef ?? 1,
      useCase: "Учитывает географию выполнения работ: логистику, климат и доступность ресурсов.",
    },
    {
      key: "cableCoef",
      label: "Коэфф. кабельных работ",
      value: base.trace?.cableCoef ?? 1,
      useCase: "Применяется при усложненной трассировке и повышенном резерве линий.",
    },
    {
      key: "laborCoef",
      label: "Коэфф. трудозатрат",
      value: base.trace?.laborCoef ?? 1,
      useCase: "Корректирует трудоемкость монтажа, пусконаладки и интеграции.",
    },
    {
      key: "complexityCoef",
      label: "Коэфф. сложности",
      value: base.trace?.complexityCoef ?? 1,
      useCase: "Учитывает интеграционную сложность и специальные требования проекта.",
    },
    {
      key: "conditionLaborFactor",
      label: "Сводный коэфф. условий",
      value: base.trace?.conditionLaborFactor ?? 1,
      useCase: "Высота, стесненность, ночные смены и работы на действующем объекте.",
    },
    {
      key: "designComplexityFactor",
      label: "Коэфф. сложности проектирования",
      value: designComplexityFactor,
      useCase: "Учитывает этажность, тип объекта и сложность конкретной системы.",
    },
  ];

  const coefficientInsights = formulaRows.map((row) => ({
    ...row,
    recommended: pickOptimalCoefficient({ key: row.key, value: toNumber(row.value, 1), objectData, zones }),
  }));

  return {
    ...base,
    cable: totalCable,
    units: totalUnits,
    equipmentCost,
    equipCost: equipmentCost,
    cableMaterials,
    trayAndFasteners,
    materialCost,
    materialsBase,
    laborBase: execution.base,
    workBase: executionBaseRaw,
    workCharges: execution.charges,
    workTotal,
    designHours: totalDesignHours,
    designBase: design.base,
    designCharges: design.charges,
    designTotal,
    designDurationMonths: timeline.months,
    designTeamSize: timeline.teamSize,
    unitWorkMarker,
    overhead: execution.overhead,
    ppe: execution.ppe,
    payrollTaxes: execution.payrollTaxes,
    utilization: execution.utilization,
    admin: execution.admin,
    designOverhead: design.overhead,
    designPpe: design.ppe,
    designPayrollTaxes: design.payrollTaxes,
    designUtilization: design.utilization,
    designAdmin: design.admin,
    profit,
    vat,
    total,
    bom: equipment.map((item) => ({
      code: `${system.type.toUpperCase()}-${item.key}`,
      name: item.label,
      qty: Math.max(Math.round(totalUnits * (item.cost / (equipmentCost || 1))), 1),
      unitPrice: item.cost / Math.max(Math.round(totalUnits * (item.cost / (equipmentCost || 1))), 1),
      total: item.cost,
    })),
    formulaRows,
    coefficientInsights,
    breakdown: {
      equipment,
      works,
      materials: {
        cable: cableMaterials,
        trayAndFasteners,
        resourceMaterials: totalMaterialsByRows,
      },
      resources: resourceRows,
    },
    explanation,
  };
}
