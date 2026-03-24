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

const EXECUTION_HOURS_BY_CATEGORY = {
  detector: 0.36,
  panel: 2.1,
  notification: 0.48,
  power: 0.95,
  equipment: 0.75,
};

const DESIGN_HOURS_BY_CATEGORY = {
  detector: 0.07,
  panel: 0.52,
  notification: 0.1,
  power: 0.22,
  equipment: 0.15,
};

const EXECUTION_HOURS_BY_MATERIAL_UNIT = {
  м: 0.028,
  м2: 0.02,
  кг: 0.015,
  л: 0.02,
  уп: 0.2,
  лист: 0.35,
  шт: 0.08,
  компл: 0.45,
};

const DESIGN_HOURS_BY_MATERIAL_UNIT = {
  м: 0.004,
  м2: 0.003,
  кг: 0.002,
  л: 0.003,
  уп: 0.02,
  лист: 0.03,
  шт: 0.015,
  компл: 0.06,
};

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildTinkoSearchUrl(query) {
  return `https://www.tinko.ru/search/?q=${encodeURIComponent(query)}`;
}

function toSafeQty(value) {
  return Math.max(toNumber(value, 0), 0);
}

function normalizeSearchText(value) {
  return String(value || "")
    .replace(/[«»"'`]/g, " ")
    .replace(/[(){}\[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenSearchText(value, max = 120) {
  return normalizeSearchText(value).slice(0, max).trim();
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function fallbackPriceForItem(item) {
  const title = normalizeSearchText(`${item.name || ""} ${item.model || ""} ${item.mark || item.brand || ""}`).toLowerCase();

  if (item.kind === "material") {
    if (item.unit === "м") {
      if (/(кабел|utp|cat\d|ввг|кпс|провод)/iu.test(title)) return 95;
      if (/(труб|гофр)/iu.test(title)) return 70;
      if (/(короб|лоток)/iu.test(title)) return 180;
      return 120;
    }
    if (item.unit === "шт") {
      if (/(дюбел|саморез|хомут|скоб)/iu.test(title)) return 8;
      if (/(коробка огнестойк|огнестойк[а-я]* короб)/iu.test(title)) return 4500;
      if (/(пен[аы])/iu.test(title)) return 1200;
      return 220;
    }
  }

  return FALLBACK_PRICE_BY_CATEGORY[item.category] || FALLBACK_PRICE_BY_CATEGORY[item.kind] || 1000;
}

function buildSearchQueries(item, defaultVendor) {
  const vendor = shortenSearchText(item.mark || item.brand || defaultVendor || "", 48);
  const model = shortenSearchText(item.model || "", 72);
  const name = shortenSearchText(item.name || "", 96);
  const nameStart = shortenSearchText(name.split(/\s+/).slice(0, 10).join(" "), 72);

  return dedupe([
    model,
    `${vendor} ${model}`.trim(),
    `${nameStart} ${model}`.trim(),
    `${vendor} ${nameStart}`.trim(),
    nameStart,
  ]).slice(0, 5);
}

function buildSourceUrls(source, queries) {
  const base = trimSlash(source?.website || "");
  const urls = [];

  for (const query of queries) {
    urls.push(buildTinkoSearchUrl(query));
  }

  if (base) {
    for (const query of queries.slice(0, 2)) {
      urls.push(`${base}/search?q=${encodeURIComponent(query)}`);
    }
  }

  return dedupe(urls).slice(0, 6);
}

function buildRequestKey(index, item) {
  const model = (item.model || item.name || "item").slice(0, 40).replace(/\s+/g, "_");
  return `aps_pdf_${item.position || "row"}_${index}_${model}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildApsProjectPriceRequests(items = [], defaultVendor = "Базовый") {
  return items.map((item, index) => {
    const queries = buildSearchQueries(item, defaultVendor);
    const searchQuery = queries[0] || shortenSearchText(item.name || item.model || "", 72);
    const manufacturerName = item.mark || item.brand || defaultVendor;
    const source = getManufacturerSource("aps", manufacturerName);
    const sourceUrls = buildSourceUrls(source, queries);

    return {
      key: buildRequestKey(index, item),
      equipmentKey: item.category || item.kind,
      equipmentLabel: item.name,
      sourceUrls,
      unit: item.unit || "шт",
      kind: item.kind || "equipment",
      fallbackPrice: fallbackPriceForItem(item),
      influenceWeight: INFLUENCE_WEIGHT_BY_CATEGORY[item.category] || INFLUENCE_WEIGHT_BY_CATEGORY[item.kind] || 0.1,
      searchQuery,
      itemIndex: index,
      itemId: item.id,
    };
  });
}

function estimateLaborByProjectItems(items = [], metrics = {}, objectData = {}) {
  const floors = Math.max(toSafeQty(objectData.floors), 1);
  const basementFloors = toSafeQty(objectData.basementFloors);
  const cableLengthM = toSafeQty(metrics.cableLengthM);

  let executionHours = 0;
  let designHours = 0;
  let materialLines = 0;
  let devicesQty = 0;

  for (const item of items) {
    const qty = toSafeQty(item.qty);
    if (qty <= 0) continue;

    if (item.kind === "material") {
      materialLines += 1;
      executionHours += qty * (EXECUTION_HOURS_BY_MATERIAL_UNIT[item.unit] || 0.08);
      designHours += qty * (DESIGN_HOURS_BY_MATERIAL_UNIT[item.unit] || 0.015);
      continue;
    }

    devicesQty += qty;
    const executionNorm = EXECUTION_HOURS_BY_CATEGORY[item.category] || EXECUTION_HOURS_BY_CATEGORY.equipment;
    const designNorm = DESIGN_HOURS_BY_CATEGORY[item.category] || DESIGN_HOURS_BY_CATEGORY.equipment;
    executionHours += qty * executionNorm;
    designHours += qty * designNorm;
  }

  executionHours += cableLengthM * 0.032;
  designHours += cableLengthM * 0.004;

  const objectComplexity = 1 + Math.max(floors - 1, 0) * 0.02 + basementFloors * 0.03;
  const sectionComplexity = 1 + Math.max(materialLines - 10, 0) * 0.004;
  executionHours = executionHours * objectComplexity * sectionComplexity;
  designHours = designHours * (1 + Math.max(objectComplexity - 1, 0) * 0.65);

  executionHours = Math.max(executionHours, 24);
  designHours = Math.max(designHours, 8);

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
    materialLines,
    devicesQty,
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
      basis: `Наименование ${item.position || "без номера"} загружено из PDF-спецификации (${item.unit}).`,
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
  const labor = estimateLaborByProjectItems(pricedItems, parsedProject.metrics, objectData);
  const sourceChecked = pricedItems.reduce((sum, item) => sum + item.checkedSources, 0);
  const sourceWithPrice = pricedItems.reduce((sum, item) => sum + (item.sourceCount > 0 ? 1 : 0), 0);

  return {
    active: true,
    source: "project_pdf",
    systemType: "aps",
    vendorName,
    fileName,
    parsedAt: parsedProject.parsedAt,
    gostStandard: parsedProject.gostStandard || "ГОСТ 21.110-2013",
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
      equipmentLabel: item.model ? `${item.name} (${item.model})` : item.name,
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
