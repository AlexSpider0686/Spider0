import { getManufacturerSource } from "../config/vendorsConfig";
import { toNumber } from "./estimate";

const LABOR_RATE_PER_HOUR = 1850;
const DESIGN_RATE_PER_HOUR = 2100;

const UNIT = {
  piece: "\u0448\u0442",
  set: "\u043a\u043e\u043c\u043f\u043b",
  meter: "\u043c",
  meter2: "\u043c2",
  kg: "\u043a\u0433",
  liter: "\u043b",
  pack: "\u0443\u043f",
  sheet: "\u043b\u0438\u0441\u0442",
};

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
  [UNIT.meter]: 0.028,
  [UNIT.meter2]: 0.02,
  [UNIT.kg]: 0.015,
  [UNIT.liter]: 0.02,
  [UNIT.pack]: 0.2,
  [UNIT.sheet]: 0.35,
  [UNIT.piece]: 0.08,
  [UNIT.set]: 0.45,
};

const DESIGN_HOURS_BY_MATERIAL_UNIT = {
  [UNIT.meter]: 0.004,
  [UNIT.meter2]: 0.003,
  [UNIT.kg]: 0.002,
  [UNIT.liter]: 0.003,
  [UNIT.pack]: 0.02,
  [UNIT.sheet]: 0.03,
  [UNIT.piece]: 0.015,
  [UNIT.set]: 0.06,
};

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildTinkoSearchUrl(query) {
  return `https://www.tinko.ru/search/?q=${encodeURIComponent(query)}`;
}

function buildLuisSearchUrl(query) {
  return `https://luis.ru/search/?q=${encodeURIComponent(query)}`;
}

function buildGarantSearchUrl(query) {
  return `https://garantgroup.com/search/?q=${encodeURIComponent(query)}`;
}

function buildGanimedSearchUrl(query) {
  return `https://ganimedsb.ru/rezultatyi-poiska.html?query=${encodeURIComponent(query)}`;
}

function buildLuisApiRequest(query) {
  return {
    url: "https://luis.ru/luisapi/catalog/search",
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/plain, */*",
      origin: "https://luis.ru",
      referer: "https://luis.ru/",
    },
    body: {
      query,
      pagination: { page: 1, perPage: 12 },
    },
    sourceName: "luis_api",
  };
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

function dedupeSourceRequests(entries = []) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    if (!entry) continue;
    const key =
      typeof entry === "string"
        ? `GET:${entry}`
        : `${String(entry.method || "GET").toUpperCase()}:${String(entry.url || "")}:${JSON.stringify(entry.body || {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function fallbackPriceForItem(item) {
  const title = normalizeSearchText(`${item.name || ""} ${item.model || ""} ${item.mark || item.brand || ""}`).toLowerCase();

  if (item.kind === "material") {
    if (item.unit === UNIT.meter) {
      if (/(?:\u043a\u0430\u0431\u0435\u043b|utp|cat\d|\u0432\u0432\u0433|\u043a\u043f\u0441|\u043f\u0440\u043e\u0432\u043e\u0434)/iu.test(title)) return 95;
      if (/(?:\u0442\u0440\u0443\u0431|\u0433\u043e\u0444\u0440)/iu.test(title)) return 70;
      if (/(?:\u043a\u043e\u0440\u043e\u0431|\u043b\u043e\u0442\u043e\u043a)/iu.test(title)) return 180;
      return 120;
    }
    if (item.unit === UNIT.piece) {
      if (/(?:\u0434\u044e\u0431\u0435\u043b|\u0441\u0430\u043c\u043e\u0440\u0435\u0437|\u0445\u043e\u043c\u0443\u0442|\u0441\u043a\u043e\u0431)/iu.test(title)) return 8;
      if (
        /(?:\u043a\u043e\u0440\u043e\u0431\u043a\u0430 \u043e\u0433\u043d\u0435\u0441\u0442\u043e\u0439\u043a|\u043e\u0433\u043d\u0435\u0441\u0442\u043e\u0439\u043a[\u0430-\u044f]* \u043a\u043e\u0440\u043e\u0431)/iu.test(
          title
        )
      )
        return 4500;
      if (/(?:\u043f\u0435\u043d[\u0430\u044b])/iu.test(title)) return 1200;
      return 220;
    }
  }

  return FALLBACK_PRICE_BY_CATEGORY[item.category] || FALLBACK_PRICE_BY_CATEGORY[item.kind] || 1000;
}

function buildSearchQueries(item, defaultVendor) {
  const vendor = shortenSearchText(item.mark || item.brand || defaultVendor || "", 48);
  const model = shortenSearchText(item.model || "", 72);
  const name = shortenSearchText(item.name || "", 96);
  const nameStart = shortenSearchText(name.split(/\s+/u).slice(0, 10).join(" "), 72);
  const article = shortenSearchText(
    (item.model || "").match(/[A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9]+(?:[-/.][A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9]+)+/u)?.[0] || "",
    64
  );

  return dedupe([
    article,
    model,
    `${vendor} ${model}`.trim(),
    `${vendor} ${article}`.trim(),
    `${nameStart} ${model}`.trim(),
    `${vendor} ${nameStart}`.trim(),
    nameStart,
  ]).slice(0, 6);
}

function buildSourceUrls(source, queries, item) {
  const base = trimSlash(source?.website || "");
  const urlTargets = [];
  const apiRequests = [];
  const queryPool = dedupe(queries).slice(0, 4);

  for (const query of queryPool) {
    urlTargets.push(buildTinkoSearchUrl(query));
    urlTargets.push(buildLuisSearchUrl(query));
    urlTargets.push(buildGarantSearchUrl(query));
    urlTargets.push(buildGanimedSearchUrl(query));
    if (query && query.length >= 3) {
      apiRequests.push(buildLuisApiRequest(query));
    }
  }

  if (base) {
    for (const query of queryPool.slice(0, 2)) {
      urlTargets.push(`${base}/search?q=${encodeURIComponent(query)}`);
    }
  }

  if (item?.model) {
    const modelOnly = shortenSearchText(item.model, 72);
    if (modelOnly) {
      apiRequests.unshift(buildLuisApiRequest(modelOnly));
    }
  }

  return dedupeSourceRequests([...apiRequests, ...urlTargets]).slice(0, 16);
}

function buildRequestKey(index, item) {
  const model = (item.model || item.name || "item").slice(0, 40).replace(/\s+/g, "_");
  return `aps_pdf_${item.position || "row"}_${index}_${model}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildApsProjectPriceRequests(items = [], defaultVendor = "\u0411\u0430\u0437\u043e\u0432\u044b\u0439") {
  return items.map((item, index) => {
    const queries = buildSearchQueries(item, defaultVendor);
    const searchQuery = queries[0] || shortenSearchText(item.name || item.model || "", 72);
    const manufacturerName = item.mark || item.brand || defaultVendor;
    const source = getManufacturerSource("aps", manufacturerName);
    const sourceUrls = buildSourceUrls(source, queries, item);

    return {
      key: buildRequestKey(index, item),
      equipmentKey: item.category || item.kind,
      equipmentLabel: item.name,
      sourceUrls,
      unit: item.unit || UNIT.piece,
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
      basis: `\u041d\u0430\u0438\u043c\u0435\u043d\u043e\u0432\u0430\u043d\u0438\u0435 ${item.position || "\u0431\u0435\u0437 \u043d\u043e\u043c\u0435\u0440\u0430"} \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e \u0438\u0437 PDF-\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438 (${item.unit}).`,
    }));
}

export function buildApsProjectSnapshot({
  fileName,
  parsedProject,
  requests,
  priceSnapshot,
  objectData,
  vendorName = "\u0411\u0430\u0437\u043e\u0432\u044b\u0439",
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
    gostStandard: parsedProject.gostStandard || "\u0413\u041e\u0421\u0422 21.110-2013",
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
