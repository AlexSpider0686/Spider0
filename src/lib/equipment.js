import { toNumber } from "./estimate";
import { getVendorEquipment } from "../config/vendorConfig";

function buildDefaultKey(systemType) {
  if (systemType === "ssoi") return "24_true";
  return "4_false_false";
}

export function calculateEquipment(system, zones, selectedParams = {}, fallbackUnitPrice = 0) {
  const safeUnits = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0) / 1000;
  const units = Math.max(safeUnits, 1);

  const vendorMeta = getVendorEquipment(system.type, system.vendor);
  const cameraMeta = vendorMeta?.camera;
  const switchMeta = vendorMeta?.switch;

  if (cameraMeta) {
    const key = `${selectedParams.resolution || 4}_${Boolean(selectedParams.outdoor)}_${Boolean(selectedParams.ptz)}`;
    const unitPrice = cameraMeta.basePrices[key] || cameraMeta.basePrices[buildDefaultKey(system.type)] || fallbackUnitPrice;
    return {
      units,
      unitPrice,
      totalEquipmentCost: unitPrice * units,
      selectionKey: key,
      mode: "vendor-parametric",
    };
  }

  if (switchMeta) {
    const key = `${selectedParams.ports || 24}_${Boolean(selectedParams.poe)}`;
    const unitPrice = switchMeta.basePrices[key] || switchMeta.basePrices[buildDefaultKey(system.type)] || fallbackUnitPrice;
    return {
      units,
      unitPrice,
      totalEquipmentCost: unitPrice * units,
      selectionKey: key,
      mode: "vendor-parametric",
    };
  }

  return {
    units,
    unitPrice: fallbackUnitPrice,
    totalEquipmentCost: fallbackUnitPrice * units,
    selectionKey: "fallback",
    mode: "fallback",
  };
}
