import { BASE_RATES, SYSTEM_TYPES, VENDOR_INDEX } from "../config/estimateConfig";

export function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function rub(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function num(value, digits = 0) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function calculateSystem(system, zones, budget) {
  const rates = BASE_RATES[system.type];
  if (!rates) {
    return {
      systemType: system.type,
      systemName: system.type,
      vendor: system.vendor,
      cable: 0,
      units: 0,
      equipCost: 0,
      cableMaterials: 0,
      trayAndFasteners: 0,
      materialsBase: 0,
      laborBase: 0,
      overhead: 0,
      ppe: 0,
      payrollTaxes: 0,
      profit: 0,
      vat: 0,
      total: 0,
    };
  }

  const vendorMatrix = VENDOR_INDEX[system.type] || {};
  const vendorIndex = vendorMatrix[system.vendor] || 1;
  const baseVendorIndex = vendorMatrix[system.baseVendor] || 1;
  const vendorFactor = (vendorIndex / baseVendorIndex) * toNumber(system.customVendorIndex, 1);

  let cable = 0;
  let units = 0;

  zones.forEach((zone) => {
    const area = Math.max(toNumber(zone.area), 0);
    const floors = Math.max(toNumber(zone.floors, 1), 1);
    const zoneType = zone.type || "office";
    const cableReserve = 1 + (floors - 1) * 0.012 + (toNumber(zone.ceilingHeight, 3) > 3 ? 0.04 : 0);

    cable += area * (rates.cablePerM2[zoneType] || rates.cablePerM2.office) * cableReserve;
    units += (area / 1000) * (rates.unitsPer1000[zoneType] || rates.unitsPer1000.office);
  });

  cable *= toNumber(budget.cableCoef, 1) * toNumber(budget.complexityCoef, 1);
  units *= toNumber(budget.equipmentCoef, 1);

  const equipCost = units * rates.equipUnit * vendorFactor;
  const cableMaterials = cable * 92;
  const trayAndFasteners = cable * 51;
  const materialsBase = equipCost + cableMaterials + trayAndFasteners;

  const laborCable = cable * rates.laborPerCableM * toNumber(budget.laborCoef, 1) * toNumber(budget.complexityCoef, 1);
  const laborInstall = units * rates.installPerUnit * toNumber(budget.laborCoef, 1) * toNumber(budget.complexityCoef, 1);
  const laborBase = laborCable + laborInstall;

  const overhead = laborBase * (toNumber(budget.overheadPercent) / 100);
  const ppe = laborBase * (toNumber(budget.ppePercent) / 100);
  const payrollTaxes = laborBase * (toNumber(budget.payrollTaxesPercent) / 100);

  const directCost = materialsBase + laborBase + overhead + ppe + payrollTaxes;
  const profit = directCost * (toNumber(budget.profitabilityPercent) / 100);
  const subtotal = directCost + profit;
  const vat = budget.taxMode === "osno" ? subtotal * (toNumber(budget.vatPercent) / 100) : 0;
  const total = subtotal + vat;

  return {
    systemType: system.type,
    systemName: SYSTEM_TYPES.find((entry) => entry.code === system.type)?.name || system.type,
    vendor: system.vendor,
    cable,
    units,
    equipCost,
    cableMaterials,
    trayAndFasteners,
    materialsBase,
    laborBase,
    overhead,
    ppe,
    payrollTaxes,
    profit,
    vat,
    total,
  };
}

export function calculateTotals(systemResults) {
  return {
    totalMaterials: systemResults.reduce((sum, item) => sum + item.materialsBase, 0),
    totalLabor: systemResults.reduce((sum, item) => sum + item.laborBase, 0),
    totalOverhead: systemResults.reduce((sum, item) => sum + item.overhead + item.ppe + item.payrollTaxes, 0),
    totalProfit: systemResults.reduce((sum, item) => sum + item.profit, 0),
    totalVat: systemResults.reduce((sum, item) => sum + item.vat, 0),
    total: systemResults.reduce((sum, item) => sum + item.total, 0),
  };
}

export function buildEstimateRows({ objectData, recalculatedArea, systemResults, totals }) {
  return [
    ["Проект", objectData.projectName],
    ["Тип объекта", objectData.objectTypeLabel],
    ["Площадь, м²", recalculatedArea],
    [],
    ["Система", "Вендор", "Кабель, м", "Ед. оборудования", "Материалы, ₽", "Труд, ₽", "Накладные+СИЗ+отчисления, ₽", "Прибыль, ₽", "НДС, ₽", "Итого, ₽"],
    ...systemResults.map((row) => [
      row.systemName,
      row.vendor,
      num(row.cable, 0),
      num(row.units, 0),
      num(row.materialsBase, 0),
      num(row.laborBase, 0),
      num(row.overhead + row.ppe + row.payrollTaxes, 0),
      num(row.profit, 0),
      num(row.vat, 0),
      num(row.total, 0),
    ]),
    [],
    ["ИТОГО", "", "", "", num(totals.totalMaterials, 0), num(totals.totalLabor, 0), num(totals.totalOverhead, 0), num(totals.totalProfit, 0), num(totals.totalVat, 0), num(totals.total, 0)],
  ];
}

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
