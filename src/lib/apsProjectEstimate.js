import { getManufacturerSource } from "../config/vendorsConfig";
import { toNumber } from "./estimate";

const LABOR_RATE_PER_HOUR = 1850;
const DESIGN_RATE_PER_HOUR = 2100;

const FALLBACK_PRICE_BY_CATEGORY = {
  detector: 2800,
  panel: 152000,
  notification: 3500,
  power: 9000,
  material: 120,
  equipment: 12000,
};

const INFLUENCE_WEIGHT_BY_CATEGORY = {
  detector: 0.42,
  panel: 0.25,
  notification: 0.2,
  power: 0.13,
  material: 0.08,
  equipment: 0.15,
};

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildTinkoSearchUrl(query) {
  return `https://www.tinko.ru/search/?q=${encodeURIComponent(query)}`;
}

function buildManufacturerSearchUrl(website, query) {
  const base = trimSlash(website);
  if (!base) return "";
  return `${base}/search?q=${encodeURIComponent(query)}`;
}

function toSafeQty(value) {
  return Math.max(toNumber(value, 0), 0);
}

function fallbackPriceForItem(item) {
  if (item.category === "material" && item.unit === "м") return 95;
  return FALLBACK_PRICE_BY_CATEGORY[item.category] || FALLBACK_PRICE_BY_CATEGORY[item.kind] || 1000;
}

function buildSearchQuery(item, defaultVendor) {
  const brand = item.brand || defaultVendor || "";
  const modelOrName = item.model || item.name;
  return `${brand} ${modelOrName}`.trim();
}

function buildRequestKey(index, item) {
  const model = (item.model || item.name || "item").slice(0, 24).replace(/\s+/g, "_");
  return `aps_pdf_${index}_${model}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildApsProjectPriceRequests(items = [], defaultVendor = "Базовый") {
  return items.map((item, index) => {
    const searchQuery = buildSearchQuery(item, defaultVendor);
    const manufacturerName = item.brand || defaultVendor;
    const source = getManufacturerSource("aps", manufacturerName);
    const manufacturerSearch = buildManufacturerSearchUrl(source?.website, searchQuery);
    const sourceUrls = [manufacturerSearch, buildTinkoSearchUrl(searchQuery)].filter(Boolean);

    return {
      key: buildRequestKey(index, item),
      equipmentKey: item.category || item.kind,
      equipmentLabel: item.name,
      sourceUrls,
      fallbackPrice: fallbackPriceForItem(item),
      influenceWeight: INFLUENCE_WEIGHT_BY_CATEGORY[item.category] || INFLUENCE_WEIGHT_BY_CATEGORY[item.kind] || 0.1,
      searchQuery,
      itemIndex: index,
      itemId: item.id,
    };
  });
}

function estimateLaborByProjectMetrics(metrics = {}, objectData = {}) {
  const detectorsQty = toSafeQty(metrics.detectorsQty);
  const notificationQty = toSafeQty(metrics.notificationQty);
  const panelQty = toSafeQty(metrics.panelQty);
  const powerQty = toSafeQty(metrics.powerQty);
  const cableLengthM = toSafeQty(metrics.cableLengthM);
  const materialLines = toSafeQty(metrics.materialLines);
  const floors = Math.max(toSafeQty(objectData.floors), 1);
  const basementFloors = toSafeQty(objectData.basementFloors);

  const baseExecutionHours =
    detectorsQty * 0.35 +
    notificationQty * 0.42 +
    panelQty * 1.7 +
    powerQty * 0.9 +
    cableLengthM * 0.028 +
    materialLines * 0.4;

  const baseDesignHours =
    detectorsQty * 0.07 +
    notificationQty * 0.08 +
    panelQty * 1.25 +
    powerQty * 0.5 +
    cableLengthM * 0.004 +
    Math.max(6, materialLines * 0.35);

  const objectComplexity = 1 + Math.max(floors - 1, 0) * 0.02 + basementFloors * 0.03;
  const executionHours = baseExecutionHours * objectComplexity;
  const designHours = baseDesignHours * (1 + Math.max(objectComplexity - 1, 0) * 0.65);

  const crewSize = clamp(Math.ceil(executionHours / 176), 2, 18);
  const executionDays = Math.max(5, Math.ceil(executionHours / (crewSize * 8)));
  const executionMonths = Math.max(1, Math.ceil(executionDays / 22));

  const designTeamSize = clamp(Math.ceil(designHours / 150), 1, 6);
  const designMonths = Math.max(1, Math.ceil(designHours / (designTeamSize * 150)));

  return {
    executionHoursBase: executionHours,
    designHoursBase: designHours,
    crewSize,
    designTeamSize,
    executionDays,
    executionMonths,
    designMonths,
    baseExecutionCost: executionHours * LABOR_RATE_PER_HOUR,
    baseDesignCost: designHours * DESIGN_RATE_PER_HOUR,
  };
}

function mapPricesToItems(items, requests, priceSnapshot) {
  const requestByItemId = new Map(requests.map((request) => [request.itemId, request]));
  const resultByKey = new Map((priceSnapshot?.entries || []).map((entry) => [entry.key, entry]));

  return items.map((item) => {
    const request = requestByItemId.get(item.id);
    const apiResult = request ? resultByKey.get(request.key) : null;
    const unitPrice = toNumber(apiResult?.price, toNumber(request?.fallbackPrice, 0));
    const qty = toSafeQty(item.qty);

    return {
      ...item,
      unitPrice,
      total: unitPrice * qty,
      sourceCount: toNumber(apiResult?.sourceCount, 0),
      checkedSources: toNumber(apiResult?.checkedSources, request?.sourceUrls?.length || 0),
      usedSources: apiResult?.usedSources || [],
      status: apiResult?.status || "fallback",
    };
  });
}

function splitTotals(items) {
  return items.reduce(
    (acc, item) => {
      if (item.kind === "material") {
        acc.materials += item.total;
      } else {
        acc.equipment += item.total;
      }
      return acc;
    },
    { equipment: 0, materials: 0 }
  );
}

function buildKeyEquipment(pricedItems) {
  return pricedItems
    .filter((item) => item.kind === "equipment")
    .sort((a, b) => b.total - a.total)
    .slice(0, 12)
    .map((item, index) => ({
      code: `aps-pdf-key-${index + 1}`,
      name: item.model ? `${item.name} (${item.model})` : item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      total: item.total,
      basis: `Позиция загружена из PDF-спецификации (${item.unit}).`,
    }));
}

export function buildApsProjectSnapshot({
  fileName,
  parsedProject,
  requests,
  priceSnapshot,
  objectData,
  vendorName = "Базовый",
}) {
  const pricedItems = mapPricesToItems(parsedProject.items, requests, priceSnapshot);
  const totals = splitTotals(pricedItems);
  const labor = estimateLaborByProjectMetrics(parsedProject.metrics, objectData);
  const sourceChecked = pricedItems.reduce((sum, item) => sum + item.checkedSources, 0);
  const sourceWithPrice = pricedItems.reduce((sum, item) => sum + (item.sourceCount > 0 ? 1 : 0), 0);

  return {
    active: true,
    source: "project_pdf",
    systemType: "aps",
    vendorName,
    fileName,
    parsedAt: parsedProject.parsedAt,
    linesScanned: parsedProject.linesScanned,
    pages: parsedProject.pages,
    metrics: parsedProject.metrics,
    items: pricedItems,
    keyEquipment: buildKeyEquipment(pricedItems),
    totals: {
      equipment: totals.equipment,
      materials: totals.materials,
      overall: totals.equipment + totals.materials,
    },
    labor,
    sourceStats: {
      sourceChecked,
      sourceWithPrice,
    },
    priceEntries: pricedItems.map((item, index) => ({
      key: `aps-pdf-price-${index + 1}`,
      equipmentLabel: item.name,
      price: item.unitPrice,
      fallbackPrice: fallbackPriceForItem(item),
      influenceWeight: INFLUENCE_WEIGHT_BY_CATEGORY[item.category] || 0.1,
      sourceCount: item.sourceCount,
      checkedSources: item.checkedSources,
      usedSources: item.usedSources,
      status: item.status,
    })),
  };
}
