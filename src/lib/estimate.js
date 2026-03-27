import { BASE_RATES, OBJECT_TYPES, SYSTEM_TYPES } from "../config/estimateConfig";
import { getVendorByName } from "../config/vendorsConfig";
import { getEquipmentForSystem } from "../config/equipmentCatalog";
import { getZoneRateProfile } from "../config/zonesConfig";
import { calculateEquipment } from "./equipment";
import { getRegionCoef } from "../config/regionsConfig";

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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getMarketSnapshotFactor(snapshot) {
  const entries = snapshot?.entries || [];
  let weightedRatio = 0;
  let weightSum = 0;

  for (const entry of entries) {
    const fallback = toNumber(entry.fallbackPrice, 0);
    const price = toNumber(entry.price, 0);
    const weight = Math.max(toNumber(entry.influenceWeight, 0), 0.001);
    if (fallback > 0 && price > 0) {
      weightedRatio += (price / fallback) * weight;
      weightSum += weight;
    }
  }

  if (weightSum <= 0) return 1;
  return clamp(weightedRatio / weightSum, 0.7, 1.8);
}

export function calculateSystem(system, zones, budget, objectData = {}, marketSnapshot = null) {
  const rates = BASE_RATES[system.type];
  if (!rates) {
    return {
      systemType: system.type,
      systemName: system.type,
      vendor: system.vendor,
      cable: 0,
      units: 0,
      equipCost: 0,
      equipmentCost: 0,
      materialCost: 0,
      materialsBase: 0,
      laborBase: 0,
      workBase: 0,
      workCharges: 0,
      workTotal: 0,
      overhead: 0,
      ppe: 0,
      payrollTaxes: 0,
      utilization: 0,
      admin: 0,
      profit: 0,
      vat: 0,
      total: 0,
      equipmentData: { details: [] },
      trace: {},
    };
  }

  const vendorProfile = getVendorByName(system.type, system.vendor);
  const baseVendorProfile = getVendorByName(system.type, system.baseVendor);
  const regionCoef = toNumber(objectData.regionCoef, getRegionCoef(objectData.regionName));
  const vendorCostRatio = (vendorProfile.equipmentPriceIndex || 1) / (baseVendorProfile.equipmentPriceIndex || 1);
  const technicalComplexityFactor =
    (vendorProfile.technicalParameters?.integrationComplexity || 1) /
    (baseVendorProfile.technicalParameters?.integrationComplexity || 1);
  const vendorFactor = vendorCostRatio * technicalComplexityFactor * toNumber(system.customVendorIndex, 1);
  const marketSnapshotFactor = getMarketSnapshotFactor(marketSnapshot);

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

  const fallbackUnitPrice = rates.equipUnit * vendorFactor * equipmentProfileFactor;
  const equipmentData = calculateEquipment(system, zones, system.selectedEquipmentParams, fallbackUnitPrice, marketSnapshot?.entries || []);
  const equipmentCost = equipmentData.totalEquipmentCost;
  const cableMaterials = cable * 92;
  const trayAndFasteners = cable * 51;
  const materialCost = cableMaterials + trayAndFasteners;
  const materialsBase = equipmentCost + materialCost;

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
  const workBaseRaw = laborCable + laborInstall;

  const overheadRaw = workBaseRaw * (toNumber(budget.overheadPercent) / 100);
  const payrollTaxesRaw = workBaseRaw * (toNumber(budget.payrollTaxesPercent) / 100);
  const utilizationRaw = workBaseRaw * (toNumber(budget.utilizationPercent) / 100);
  const ppeRaw = workBaseRaw * (toNumber(budget.ppePercent) / 100);
  const adminRaw = (workBaseRaw + overheadRaw + payrollTaxesRaw + utilizationRaw + ppeRaw) * (toNumber(budget.adminPercent) / 100);

  const laborBase = workBaseRaw * regionCoef;
  const overhead = overheadRaw * regionCoef;
  const payrollTaxes = payrollTaxesRaw * regionCoef;
  const utilization = utilizationRaw * regionCoef;
  const ppe = ppeRaw * regionCoef;
  const admin = adminRaw * regionCoef;
  const workCharges = overhead + payrollTaxes + utilization + ppe + admin;
  const workTotal = laborBase + workCharges;

  const directCost = materialsBase + workTotal;
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
    equipCost: equipmentCost,
    equipmentCost,
    cableMaterials,
    trayAndFasteners,
    materialCost,
    materialsBase,
    laborBase,
    workBase: workBaseRaw,
    workCharges,
    workTotal,
    overhead,
    ppe,
    payrollTaxes,
    utilization,
    admin,
    profit,
    vat,
    total,
    equipmentData: {
      ...equipmentData,
      marketSnapshotFactor,
      marketEntries: marketSnapshot?.entries || [],
    },
    trace: {
      vendorFactor,
      marketSnapshotFactor,
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
      regionCoef,
      overheadPercent: toNumber(budget.overheadPercent),
      ppePercent: toNumber(budget.ppePercent),
      payrollTaxesPercent: toNumber(budget.payrollTaxesPercent),
      utilizationPercent: toNumber(budget.utilizationPercent),
      adminPercent: toNumber(budget.adminPercent),
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
    totalEquipment: systemResults.reduce((sum, item) => sum + item.equipmentCost, 0),
    totalMaterials: systemResults.reduce((sum, item) => sum + item.materialCost, 0),
    totalMaterialsWithEquipment: systemResults.reduce((sum, item) => sum + item.materialsBase, 0),
    totalLabor: systemResults.reduce((sum, item) => sum + item.laborBase, 0),
    totalWorkCharges: systemResults.reduce((sum, item) => sum + item.workCharges + (item.designCharges || 0), 0),
    totalWork: systemResults.reduce((sum, item) => sum + item.workTotal, 0),
    totalDesign: systemResults.reduce((sum, item) => sum + (item.designTotal || 0), 0),
    totalOverhead: systemResults.reduce(
      (sum, item) =>
        sum +
        item.overhead +
        item.ppe +
        item.payrollTaxes +
        item.utilization +
        item.admin +
        (item.designOverhead || 0) +
        (item.designPpe || 0) +
        (item.designPayrollTaxes || 0) +
        (item.designUtilization || 0) +
        (item.designAdmin || 0),
      0
    ),
    totalAdmin: systemResults.reduce((sum, item) => sum + item.admin + (item.designAdmin || 0), 0),
    totalProfit: systemResults.reduce((sum, item) => sum + item.profit, 0),
    totalVat: systemResults.reduce((sum, item) => sum + item.vat, 0),
    total: systemResults.reduce((sum, item) => sum + item.total, 0),
  };
}

export function buildEstimateRows({ objectData, recalculatedArea, systemResults, totals }) {
  const objectTypeLabel = OBJECT_TYPES.find((item) => item.value === objectData.objectType)?.label || objectData.objectType;
  return [
    ["Проект", objectData.projectName],
    ["Адрес объекта", objectData.address || "—"],
    ["Тип объекта", objectTypeLabel],
    ["Субъект РФ", objectData.regionName || "—"],
    ["Региональный коэффициент", num(objectData.regionCoef || 1, 2)],
    ["Площадь по зонам, м²", recalculatedArea],
    [],
    ["Система", "Вендор", "Ключевое оборудование", "Оборудование, ₽", "Материалы, ₽", "Работы, ₽", "Прибыль, ₽", "НДС, ₽", "Итого, ₽"],
    ...systemResults.map((row) => [
      row.systemName,
      row.vendor,
      (row.equipmentData?.keyEquipment || []).map((item) => item.name).join("; "),
      num(row.equipmentCost, 0),
      num(row.materialCost, 0),
      num(row.workTotal, 0),
      num(row.profit, 0),
      num(row.vat, 0),
      num(row.total, 0),
    ]),
    [],
    [
      "ИТОГО",
      "",
      "",
      num(totals.totalEquipment, 0),
      num(totals.totalMaterials, 0),
      num(totals.totalWork, 0),
      num(totals.totalProfit, 0),
      num(totals.totalVat, 0),
      num(totals.total, 0),
    ],
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
