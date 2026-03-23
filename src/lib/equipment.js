import { toNumber } from "./estimate";
import { getVendorEquipment } from "../config/vendorConfig";

function buildDefaultKey(systemType) {
  if (systemType === "ssoi") return "24_true";
  return "4_false_false";
}

export function calculateEquipment(system, zones, selectedParams = {}, fallbackUnitPrice = 0, options = {}) {
  const safeUnits = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0) / 1000;
  const units = Math.max(safeUnits, 1);
  const snapshotFactor = Number(options.snapshotFactor || 1);
  const hasSnapshot = Boolean(options.hasSnapshot);

  const vendorMeta = getVendorEquipment(system.type, system.vendor);
  const cameraMeta = vendorMeta?.camera;
  const switchMeta = vendorMeta?.switch;

  if (cameraMeta) {
    const resolution = Number(selectedParams.resolution || 4);
    const outdoor = Boolean(selectedParams.outdoor);
    const ptz = Boolean(selectedParams.ptz);
    const recorderChannels = Number(selectedParams.recorderChannels || 16);
    const hddTb = Number(selectedParams.hddTb || 8);
    const key = `${resolution}_${outdoor}_${ptz}`;
    const cameraUnitPriceRaw = cameraMeta.basePrices[key] || cameraMeta.basePrices[buildDefaultKey(system.type)] || fallbackUnitPrice;
    const cameraUnitPrice = cameraUnitPriceRaw * snapshotFactor;
    const recordersNeeded = Math.max(Math.ceil(units / Math.max(recorderChannels, 1)), 1);
    const nvrCost = recordersNeeded * (30000 + recorderChannels * 900);
    const storageCost = recordersNeeded * hddTb * 2300;
    const totalEquipmentCost = cameraUnitPrice * units + nvrCost + storageCost;
    const unitPrice = totalEquipmentCost / units;

    return {
      units,
      unitPrice,
      totalEquipmentCost,
      selectionKey: `${key}_rec${recorderChannels}_hdd${hddTb}`,
      mode: hasSnapshot ? "vendor-parametric+market" : "vendor-parametric",
      details: { recorderChannels, hddTb, recordersNeeded },
    };
  }

  if (switchMeta) {
    const key = `${selectedParams.ports || 24}_${Boolean(selectedParams.poe)}`;
    const unitPriceRaw = switchMeta.basePrices[key] || switchMeta.basePrices[buildDefaultKey(system.type)] || fallbackUnitPrice;
    const unitPrice = unitPriceRaw * snapshotFactor;
    return {
      units,
      unitPrice,
      totalEquipmentCost: unitPrice * units,
      selectionKey: key,
      mode: hasSnapshot ? "vendor-parametric+market" : "vendor-parametric",
    };
  }

  const fallbackPrice = fallbackUnitPrice * snapshotFactor;
  return {
    units,
    unitPrice: fallbackPrice,
    totalEquipmentCost: fallbackPrice * units,
    selectionKey: "fallback",
    mode: hasSnapshot ? "fallback+market" : "fallback",
  };
}
