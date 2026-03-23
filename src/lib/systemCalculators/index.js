import { getSystemResourceModel, getSystemRules } from "../../config/systemsConfig";
import { getZoneCalcProfile, getZoneRateProfile } from "../../config/zonesConfig";
import { calculateSystem, toNumber } from "../estimate";

function pickOptimalCoefficient({ key, value, objectData, zones }) {
  const maxFloors = Math.max(...zones.map((zone) => toNumber(zone.floors, 1)), 1);
  const parkingShare = zones
    .filter((zone) => zone.type === "parking")
    .reduce((sum, zone) => sum + toNumber(zone.area), 0) /
    Math.max(zones.reduce((sum, zone) => sum + toNumber(zone.area), 0), 1);

  const recommendations = {
    vendorFactor: value > 1.15 ? "Высокотехнологичный или премиальный вендор оправдан для сложной интеграции." : "Для базового пресейла чаще достаточно диапазона 0.95–1.10.",
    regionCoef: value > 1.1 ? "Для удалённого/северного региона коэффициент >1.1 обычно оправдан." : "Для центральной части РФ обычно достаточно диапазона 0.98–1.08.",
    cableCoef: parkingShare > 0.25 ? "При большой доле паркинга и сложной прокладке используйте 1.05–1.20." : "Для стандартного объекта обычно 0.95–1.05.",
    laborCoef: maxFloors > 8 ? "На высотных объектах обычно 1.05–1.20 по трудозатратам." : "Для типовых объектов обычно 0.95–1.05.",
    complexityCoef: objectData.objectType === "transport" || objectData.objectType === "energy" ? "Для транспортных/энергетических объектов чаще 1.10–1.30." : "Для стандартных объектов обычно 1.00–1.10.",
    conditionLaborFactor: value > 1.2 ? "Сложные условия подтверждают повышенный совокупный коэффициент." : "Совокупный коэффициент условий в районе 1.00–1.15 обычно достаточен.",
  };

  return recommendations[key] || "Рекомендуемое значение зависит от сложности объекта и условий работ.";
}

export function calculateSystemWithBreakdown(system, zones, budget, objectData = {}) {
  const base = calculateSystem(system, zones, budget, objectData);
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
  const totalLaborHours = resourceRows.reduce(
    (sum, row) => sum + row.mountHours + row.connectHours + row.setupHours + row.pnrHours + row.designHours,
    0
  );

  const blendedLaborCostPerHour = totalLaborHours > 0 ? base.laborBase / totalLaborHours : 0;
  const laborBaseRecalculated = totalLaborHours * blendedLaborCostPerHour * budgetLabor * budgetComplexity;
  const cableMaterials = totalCable * 92;
  const trayAndFasteners = totalCable * 51;
  const equipmentFromRows = resourceRows.reduce((sum, row) => sum + base.equipCost * row.priceShare, 0);
  const equipCost = equipmentFromRows > 0 ? equipmentFromRows : base.equipCost;
  const materialsBase = equipCost + cableMaterials + trayAndFasteners + totalMaterialsByRows;
  const overhead = laborBaseRecalculated * (toNumber(budget.overheadPercent) / 100);
  const ppe = laborBaseRecalculated * (toNumber(budget.ppePercent) / 100);
  const payrollTaxes = laborBaseRecalculated * (toNumber(budget.payrollTaxesPercent) / 100);
  const admin = (laborBaseRecalculated + payrollTaxes) * (toNumber(budget.adminPercent) / 100);
  const directCost = materialsBase + laborBaseRecalculated + overhead + ppe + payrollTaxes + admin;
  const profit = directCost * (toNumber(budget.profitabilityPercent) / 100);
  const subtotal = directCost + profit;
  const vat = budget.taxMode === "osno" ? subtotal * (toNumber(budget.vatPercent) / 100) : 0;
  const total = subtotal + vat;

  const equipment = rules.equipmentMix.map((item) => {
    const matchingRow = resourceRows.find((row) => row.key === item.key);
    return {
      key: item.key,
      label: item.label,
      cost: matchingRow ? (matchingRow.priceShare || item.share) * equipCost : equipCost * item.share,
    };
  });

  const works = {
    smr: laborBaseRecalculated * rules.laborSplit.smr,
    pnr: laborBaseRecalculated * rules.laborSplit.pnr,
    design: laborBaseRecalculated * rules.laborSplit.design,
  };

  const explanation = [
    `Система рассчитана по зонам и плотностям ресурсов: ${Math.round(totalUnits)} единиц и ${Math.round(totalCable)} м кабеля.`,
    `Труд рассчитан ресурсно по операциям (монтаж/подключение/настройка/ПНР/проектирование), затем свёрнут в СМР/ПНР/проектирование ${Math.round(rules.laborSplit.smr * 100)}%/${Math.round(rules.laborSplit.pnr * 100)}%/${Math.round(rules.laborSplit.design * 100)}%.`,
    `Региональный коэффициент ${toNumber(base.trace?.regionCoef, 1).toFixed(2)} влияет на трудовые затраты и все производные начисления.`,
  ];

  const formulaRows = [
    { key: "vendorFactor", label: "Коэф. вендора", value: base.trace?.vendorFactor ?? 1, useCase: "Применяется для учёта ценового и технологического профиля выбранного вендора." },
    { key: "regionCoef", label: "Региональный коэф.", value: base.trace?.regionCoef ?? 1, useCase: "Учитывает географию выполнения работ (логистика, климат, доступность ресурсов)." },
    { key: "cableCoef", label: "Коэф. кабеля", value: base.trace?.cableCoef ?? 1, useCase: "Применяется при усложнённой трассировке и повышенном резерве линий." },
    { key: "laborCoef", label: "Коэф. труда", value: base.trace?.laborCoef ?? 1, useCase: "Применяется для коррекции трудоёмкости монтажа и пусконаладки." },
    { key: "complexityCoef", label: "Коэф. сложности", value: base.trace?.complexityCoef ?? 1, useCase: "Учитывает интеграционную сложность и специальные требования заказчика." },
    { key: "conditionLaborFactor", label: "Сводный коэф. условий", value: base.trace?.conditionLaborFactor ?? 1, useCase: "Итоговый коэффициент условий (высота, стеснённость, ночные работы и т.д.)." },
  ];

  const coefficientInsights = formulaRows.map((row) => ({
    ...row,
    recommended: pickOptimalCoefficient({ key: row.key, value: toNumber(row.value, 1), objectData, zones }),
  }));

  return {
    ...base,
    cable: totalCable,
    units: totalUnits,
    equipCost,
    cableMaterials,
    trayAndFasteners,
    materialsBase,
    laborBase: laborBaseRecalculated,
    overhead,
    ppe,
    payrollTaxes,
    admin,
    profit,
    vat,
    total,
    bom: equipment.map((item) => ({
      code: `${system.type.toUpperCase()}-${item.key}`,
      name: item.label,
      qty: Math.max(Math.round(totalUnits * (item.cost / (equipCost || 1))), 1),
      unitPrice: item.cost / Math.max(Math.round(totalUnits * (item.cost / (equipCost || 1))), 1),
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
