import { BASE_RATES, SYSTEM_TYPES } from "../config/estimateConfig";
import { getVendorByName } from "../config/vendorsConfig";
import { getEquipmentForSystem } from "../config/equipmentCatalog";
import { getZoneRateProfile } from "../config/zonesConfig";

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

  const vendorProfile = getVendorByName(system.type, system.vendor);
  const baseVendorProfile = getVendorByName(system.type, system.baseVendor);
  const vendorCostRatio = (vendorProfile.equipmentPriceIndex || 1) / (baseVendorProfile.equipmentPriceIndex || 1);
  const technicalComplexityFactor =
    (vendorProfile.technicalParameters?.integrationComplexity || 1) /
    (baseVendorProfile.technicalParameters?.integrationComplexity || 1);
  const vendorFactor = vendorCostRatio * technicalComplexityFactor * toNumber(system.customVendorIndex, 1);

  let cable = 0;
  let units = 0;
  const equipmentProfileFactor = calculateEquipmentProfileFactor(system.type, system.equipmentProfiles);
  const conditionLaborFactor =
    toNumber(budget.heightCoef, 1) *
    toNumber(budget.constrainedCoef, 1) *
    toNumber(budget.operatingFacilityCoef, 1) *
    toNumber(budget.nightWorkCoef, 1) *
    toNumber(budget.routingCoef, 1) *
    toNumber(budget.finishCoef, 1);

  zones.forEach((zone) => {
    const area = Math.max(toNumber(zone.area), 0);
    const floors = Math.max(toNumber(zone.floors, 1), 1);
    const zoneType = getZoneRateProfile(zone.type || "office");
    const cableReserve = 1 + (floors - 1) * 0.012 + (toNumber(zone.ceilingHeight, 3) > 3 ? 0.04 : 0);

    cable += area * (rates.cablePerM2[zoneType] || rates.cablePerM2.office) * cableReserve;
    units += (area / 1000) * (rates.unitsPer1000[zoneType] || rates.unitsPer1000.office);
  });

  cable *= toNumber(budget.cableCoef, 1) * toNumber(budget.complexityCoef, 1) * (vendorProfile.cableCoefficient || 1);
  units *= toNumber(budget.equipmentCoef, 1) * (vendorProfile.qualityCoefficient || 1);

  const equipCost = units * rates.equipUnit * vendorFactor * equipmentProfileFactor;
  const cableMaterials = cable * 92;
  const trayAndFasteners = cable * 51;
  const materialsBase = equipCost + cableMaterials + trayAndFasteners;

  const speedFactor = 1 / (vendorProfile.installationSpeed || 1);
  const laborCable =
    cable *
    rates.laborPerCableM *
    toNumber(budget.laborCoef, 1) *
    toNumber(budget.complexityCoef, 1) *
    conditionLaborFactor *
    speedFactor;
  const laborInstall =
    units *
    rates.installPerUnit *
    toNumber(budget.laborCoef, 1) *
    toNumber(budget.complexityCoef, 1) *
    conditionLaborFactor *
    speedFactor;
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
    vendorDescription: vendorProfile.description,
    vendorSpeed: vendorProfile.installationSpeed || 1,
    vendorPriceIndex: vendorProfile.equipmentPriceIndex || 1,
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
    trace: {
      vendorFactor,
      equipmentProfileFactor,
      speedFactor,
      cableCoef: toNumber(budget.cableCoef, 1),
      equipmentCoef: toNumber(budget.equipmentCoef, 1),
      laborCoef: toNumber(budget.laborCoef, 1),
      complexityCoef: toNumber(budget.complexityCoef, 1),
      heightCoef: toNumber(budget.heightCoef, 1),
      constrainedCoef: toNumber(budget.constrainedCoef, 1),
      operatingFacilityCoef: toNumber(budget.operatingFacilityCoef, 1),
      nightWorkCoef: toNumber(budget.nightWorkCoef, 1),
      routingCoef: toNumber(budget.routingCoef, 1),
      finishCoef: toNumber(budget.finishCoef, 1),
      conditionLaborFactor,
      overheadPercent: toNumber(budget.overheadPercent),
      ppePercent: toNumber(budget.ppePercent),
      payrollTaxesPercent: toNumber(budget.payrollTaxesPercent),
      profitabilityPercent: toNumber(budget.profitabilityPercent),
      vatPercent: toNumber(budget.vatPercent),
    },
  };
}

export function calculateEquipmentProfileFactor(systemType, equipmentProfiles = {}) {
  const equipment = getEquipmentForSystem(systemType);
  if (!equipment.length) return 1;
  return equipment.reduce((acc, item) => {
    const selectedProfileKey = equipmentProfiles[item.key] || "standard";
    const profile = item.profiles[selectedProfileKey] || item.profiles.standard;
    return acc + item.influenceWeight * ((profile?.coef || 1) - 1);
  }, 1);
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

export function rebalanceZoneAreas(zones, changedZoneId, nextPercent, totalArea) {
  const safeTotalArea = Math.max(toNumber(totalArea), 0);
  if (zones.length === 0 || safeTotalArea <= 0) return zones;

  const clampedPercent = Math.min(Math.max(toNumber(nextPercent), 0), 100);
  const currentShares = zones.map((zone) => ({
    id: zone.id,
    percent: safeTotalArea > 0 ? (toNumber(zone.area) / safeTotalArea) * 100 : 0,
  }));

  const others = currentShares.filter((entry) => entry.id !== changedZoneId);
  const remainingPercent = Math.max(0, 100 - clampedPercent);
  const othersCurrentTotal = others.reduce((sum, entry) => sum + entry.percent, 0);

  const nextShares = currentShares.map((entry) => {
    if (entry.id === changedZoneId) return { ...entry, percent: clampedPercent };
    if (others.length === 0) return { ...entry, percent: remainingPercent };
    if (othersCurrentTotal <= 0) return { ...entry, percent: remainingPercent / others.length };
    return { ...entry, percent: (entry.percent / othersCurrentTotal) * remainingPercent };
  });

  let remainingArea = safeTotalArea;
  const areasById = new Map();
  nextShares.forEach((entry, index) => {
    if (index === nextShares.length - 1) {
      areasById.set(entry.id, remainingArea);
      return;
    }
    const area = Math.max(Math.round((entry.percent / 100) * safeTotalArea), 0);
    remainingArea -= area;
    areasById.set(entry.id, area);
  });

  return zones.map((zone) => ({ ...zone, area: Math.max(areasById.get(zone.id) || 0, 0) }));
}
