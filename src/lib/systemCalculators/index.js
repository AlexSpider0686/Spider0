import { getSystemResourceModel, getSystemRules } from "../../config/systemsConfig";
import { getZoneCalcProfile, getZoneRateProfile } from "../../config/zonesConfig";
import { calculateSystem, toNumber } from "../estimate";

export function calculateSystemWithBreakdown(system, zones, budget) {
  const base = calculateSystem(system, zones, budget);
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
  const directCost = materialsBase + laborBaseRecalculated + overhead + ppe + payrollTaxes;
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
    `Состав системы сгенерирован по зонам и плотностям ресурсов: рассчитано ${Math.round(totalUnits)} устройств и ${Math.round(totalCable)} м кабеля.`,
    `Труд рассчитан ресурсно по операциям (монтаж/подключение/настройка/ПНР/проектирование), затем свёрнут в СМР/ПНР/проектирование ${Math.round(rules.laborSplit.smr * 100)}%/${Math.round(rules.laborSplit.pnr * 100)}%/${Math.round(rules.laborSplit.design * 100)}%.`,
  ];

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
    formulaRows: [
      { label: "Коэф. вендора", value: base.trace?.vendorFactor ?? 1 },
      { label: "Коэф. профиля оборудования", value: base.trace?.equipmentProfileFactor ?? 1 },
      { label: "Коэф. скорости монтажа", value: base.trace?.speedFactor ?? 1 },
      { label: "Коэф. кабеля", value: base.trace?.cableCoef ?? 1 },
      { label: "Коэф. оборудования", value: base.trace?.equipmentCoef ?? 1 },
      { label: "Коэф. труда", value: base.trace?.laborCoef ?? 1 },
      { label: "Коэф. сложности", value: base.trace?.complexityCoef ?? 1 },
      { label: "Коэф. высотности", value: base.trace?.heightCoef ?? 1 },
      { label: "Коэф. стеснённости", value: base.trace?.constrainedCoef ?? 1 },
      { label: "Коэф. действующего объекта", value: base.trace?.operatingFacilityCoef ?? 1 },
      { label: "Коэф. ночных работ", value: base.trace?.nightWorkCoef ?? 1 },
      { label: "Коэф. трассировки", value: base.trace?.routingCoef ?? 1 },
      { label: "Коэф. чистовой отделки", value: base.trace?.finishCoef ?? 1 },
      { label: "Сводный коэф. условий", value: base.trace?.conditionLaborFactor ?? 1 },
    ],
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
