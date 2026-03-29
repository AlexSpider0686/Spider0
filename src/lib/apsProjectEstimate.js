import { getManufacturerSource } from "../config/vendorsConfig";
import { toNumber } from "./estimate";
import { buildApsProjectMetrics } from "./apsProjectParser";

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

const UNIT_ALIAS_MAP = {
  "шт": UNIT.piece,
  "штук": UNIT.piece,
  "ед": UNIT.piece,
  "ед.": UNIT.piece,
  "компл": UNIT.set,
  "комплект": UNIT.set,
  "м": UNIT.meter,
  "мп": UNIT.meter,
  "п.м": UNIT.meter,
  "м2": UNIT.meter2,
  "м²": UNIT.meter2,
  "кг": UNIT.kg,
  "л": UNIT.liter,
  "уп": UNIT.pack,
  "упак": UNIT.pack,
  "лист": UNIT.sheet,
};

const CABLE_KEYWORDS = /(?:кабел|провод|utp|ftp|sftp|cat\d|rg-?\d|coax|кпс|ввг|пвс|wire|cable)/iu;
const FASTENER_KEYWORDS = /(?:крепеж|дюбел|саморез|скоб|хомут|анкер|шпильк|зажим|метиз|fastener|anchor|clamp|screw)/iu;

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

const FASTENER_EXECUTION_HOURS_PER_PIECE = 0.0025;
const FASTENER_DESIGN_HOURS_PER_PIECE = 0.0004;

const MODEL_FALLBACK_PRICE_HINTS = [
  {
    pattern: /(?:1[-/.]?520[-/.]?887[-/.]?052|сириус)/iu,
    price: 36160.8,
  },
  {
    pattern: /(?:1[-/.]?471[-/.]?949[-/.]?829|с2000\s*кдл|c2000\s*kdl)/iu,
    price: 5598.58,
  },
  {
    pattern: /(?:1[-/.]?844[-/.]?634[-/.]?134|с2000\s*бки|c2000\s*bki)/iu,
    price: 8578.67,
  },
  {
    pattern: /(?:92[-/.]?197[-/.]?010|с2000\s*сп2|c2000\s*sp2)/iu,
    price: 2115.72,
  },
  {
    pattern: /(?:409[-/.]?248[-/.]?491|с2000\s*пп|c2000\s*pp)/iu,
    price: 1758.87,
  },
  {
    pattern: /(?:408[-/.]?120[-/.]?194|мпн|mpn)/iu,
    price: 103.09,
  },
];

const ARTICLE_TOKEN_REGEX = /\d{1,4}(?:[-/.]\d{2,4}){2,}/gu;

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

const KNOWN_UNITS = new Set(Object.values(UNIT));

function normalizeManualItemKind(value) {
  return String(value || "").toLowerCase() === "material" ? "material" : "equipment";
}

function sanitizeManualItemDraft(draft = {}, existingItems = []) {
  const fallbackPosition = `manual-${existingItems.length + 1}`;
  const name = normalizeSearchText(draft.name || "") || "Ручная позиция";
  const model = normalizeSearchText(draft.model || "");
  const mark = normalizeSearchText(draft.mark || draft.brand || "");
  const position = normalizeSearchText(draft.position || "") || fallbackPosition;
  const kind = normalizeManualItemKind(draft.kind);
  const categoryCandidate = normalizeSearchText(draft.category || "").toLowerCase();
  const category = categoryCandidate || (kind === "material" ? "material" : "equipment");
  const unitCandidate = normalizeUnitToken(draft.unit || UNIT.piece) || UNIT.piece;
  const unit = KNOWN_UNITS.has(unitCandidate) ? unitCandidate : UNIT.piece;
  const qty = Math.max(toNumber(draft.qty, 1), 0);
  const unitPrice = Math.max(toNumber(draft.unitPrice, 0), 0);
  const id = `aps-manual-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  return {
    id,
    position,
    name,
    model,
    mark,
    brand: mark,
    category,
    kind,
    qty,
    unit,
    rawLine: normalizeSearchText(`${name} ${model}`),
    reviewRequired: false,
    reviewReason: "",
    isManual: true,
    unitPrice,
  };
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

function normalizeModelToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9-]/giu, "");
}

function extractModelLikeTokens(value) {
  return dedupe(
    [...String(value || "").matchAll(/[A-Za-zА-Яа-яЁё0-9]+(?:[-/.][A-Za-zА-Яа-яЁё0-9]+)+/gu)]
      .map((match) => normalizeModelToken(match[0]))
      .filter((token) => token.length >= 5 && /\d/u.test(token))
  );
}

function extractPrimaryArticleToken(value) {
  const candidates = dedupe(
    [...String(value || "").matchAll(ARTICLE_TOKEN_REGEX)]
      .map((match) => normalizeModelToken(match[0]))
      .filter((token) => token.length >= 7)
  );
  if (!candidates.length) return "";
  return candidates.sort((left, right) => right.length - left.length)[0];
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

function normalizeUnitToken(unit) {
  const normalized = String(unit || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
  return UNIT_ALIAS_MAP[normalized] || normalized;
}

function buildUnitAudit(projectUnit, unitHints = []) {
  const normalizedProjectUnit = normalizeUnitToken(projectUnit) || UNIT.piece;
  const supplierUnits = dedupe(unitHints.map((item) => normalizeUnitToken(item)).filter(Boolean));
  if (!supplierUnits.length) {
    return {
      projectUnit: normalizedProjectUnit,
      supplierUnits: [],
      status: "unknown",
      message: "единица поставщика не определена",
    };
  }

  if (supplierUnits.includes(normalizedProjectUnit)) {
    return {
      projectUnit: normalizedProjectUnit,
      supplierUnits,
      status: "match",
      message: `совпадение (${normalizedProjectUnit})`,
    };
  }

  return {
    projectUnit: normalizedProjectUnit,
    supplierUnits,
    status: "mismatch",
    message: `поставщик: ${supplierUnits.join(", ")}, проект: ${normalizedProjectUnit}`,
  };
}

function computeLiveMetrics(items = [], fallbackMetrics = {}) {
  const metrics = buildApsProjectMetrics(items);
  return {
    ...fallbackMetrics,
    ...metrics,
    cableLengthM: toSafeQty(metrics.cableLengthM || fallbackMetrics.cableLengthM),
    cableLines: toSafeQty(metrics.cableLines || fallbackMetrics.cableLines),
    fastenerQty: toSafeQty(metrics.fastenerQty || fallbackMetrics.fastenerQty),
    fastenerLines: toSafeQty(metrics.fastenerLines || fallbackMetrics.fastenerLines),
  };
}

function fallbackPriceForItem(item) {
  const title = normalizeSearchText(`${item.name || ""} ${item.model || ""} ${item.mark || item.brand || ""}`).toLowerCase();
  const modelTokens = extractModelLikeTokens(`${item.model || ""} ${item.rawLine || ""} ${item.name || ""}`);
  const modelHint = MODEL_FALLBACK_PRICE_HINTS.find((entry) => entry.pattern.test(`${title} ${modelTokens.join(" ")}`));
  if (modelHint?.price) {
    return modelHint.price;
  }

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
  const articleToken = extractPrimaryArticleToken(`${item.model || ""} ${item.rawLine || ""} ${item.name || ""}`);
  const article = shortenSearchText(articleToken, 64);

  const modelTokens = extractModelLikeTokens(`${item.model || ""} ${item.rawLine || ""}`);
  const normalizedModel = articleToken || modelTokens[0] || "";
  const modelAlias = normalizedModel.startsWith("1-") ? normalizedModel.slice(2) : "";

  return dedupe([
    article,
    `${vendor} ${article}`.trim(),
    normalizedModel,
    modelAlias,
    model,
    `${vendor} ${model}`.trim(),
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
      if (source?.searchPathTemplate) {
        urlTargets.push(`${base}${source.searchPathTemplate.replace("{query}", encodeURIComponent(query))}`);
      } else {
        urlTargets.push(`${base}/search?q=${encodeURIComponent(query)}`);
      }
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

function buildManualRequest(item) {
  return {
    key: `aps_manual_${item.id}`,
    equipmentKey: item.category || item.kind || "equipment",
    equipmentLabel: item.name,
    sourceUrls: [],
    unit: item.unit || UNIT.piece,
    kind: item.kind || "equipment",
    fallbackPrice: Math.max(toNumber(item.unitPrice, 0), fallbackPriceForItem(item)),
    influenceWeight: INFLUENCE_WEIGHT_BY_CATEGORY[item.category] || INFLUENCE_WEIGHT_BY_CATEGORY[item.kind] || 0.1,
    searchQuery: shortenSearchText(`${item.model || ""} ${item.name || ""}`, 88),
    itemIndex: -1,
    itemId: item.id,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function buildApsProjectPriceRequests(items = [], defaultVendor = "\u0411\u0430\u0437\u043e\u0432\u044b\u0439") {
  return items.map((item, index) => {
    const primaryArticleToken = extractPrimaryArticleToken(`${item.model || ""} ${item.rawLine || ""} ${item.name || ""}`);
    const modelTokens = extractModelLikeTokens(`${item.model || ""} ${item.rawLine || ""} ${item.name || ""}`);
    const modelToken = primaryArticleToken || modelTokens[0] || "";
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
      manufacturerWebsite: source?.website || "",
      unit: item.unit || UNIT.piece,
      kind: item.kind || "equipment",
      fallbackPrice: fallbackPriceForItem(item),
      influenceWeight: INFLUENCE_WEIGHT_BY_CATEGORY[item.category] || INFLUENCE_WEIGHT_BY_CATEGORY[item.kind] || 0.1,
      searchQuery,
      modelToken,
      primaryArticleToken,
      itemIndex: index,
      itemId: item.id,
    };
  });
}

function estimateLaborByProjectItems(items = [], metrics = {}, objectData = {}) {
  const floors = Math.max(toSafeQty(objectData.floors), 1);
  const basementFloors = toSafeQty(objectData.basementFloors);
  const resolvedMetrics = computeLiveMetrics(items, metrics);
  const cableLengthM = toSafeQty(resolvedMetrics.cableLengthM);

  let executionHours = 0;
  let designHours = 0;
  let materialLines = 0;
  let devicesQty = 0;

  for (const item of items) {
    const qty = toSafeQty(item.qty);
    if (qty <= 0) continue;
    const title = normalizeSearchText(`${item.name || ""} ${item.model || ""} ${item.rawLine || ""}`).toLowerCase();

    if (item.kind === "material") {
      materialLines += 1;

      if (item.unit === UNIT.meter && CABLE_KEYWORDS.test(title)) {
        continue;
      }

      if (item.unit === UNIT.piece && FASTENER_KEYWORDS.test(title)) {
        executionHours += qty * FASTENER_EXECUTION_HOURS_PER_PIECE;
        designHours += qty * FASTENER_DESIGN_HOURS_PER_PIECE;
        continue;
      }

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

function mapPricesToItems(items, requests, priceSnapshot, itemOverrides = {}) {
  const requestByItemId = new Map(requests.map((request) => [request.itemId, request]));
  const resultByKey = new Map((priceSnapshot?.entries || []).map((entry) => [entry.key, entry]));

  return items.map((item) => {
    const request = requestByItemId.get(item.id);
    const apiResult = request ? resultByKey.get(request.key) : null;
    const override = itemOverrides?.[item.id] || {};
    const baseUnitPrice = toNumber(apiResult?.price, toNumber(request?.fallbackPrice, 0));
    const unitPrice = toNumber(override.unitPrice, baseUnitPrice);
    const qty = toSafeQty(override.qty ?? item.qty);
    const manualPrice = override.unitPrice !== undefined;
    const manualQty = override.qty !== undefined;
    const unitAudit = buildUnitAudit(item.unit, apiResult?.unitHints || []);

    return {
      ...item,
      qty,
      unitPrice,
      total: unitPrice * qty,
      sourceCount: toNumber(apiResult?.sourceCount, 0),
      checkedSources: toNumber(apiResult?.checkedSources, request?.sourceUrls?.length || 0),
      usedSources: apiResult?.usedSources || [],
      status: manualPrice ? "manual_override" : apiResult?.status || "fallback",
      unitAudit,
      manualPrice,
      manualQty,
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

function buildItemsWithoutPrice(items = []) {
  return items
    .filter((item) => item.sourceCount <= 0 && !item.manualPrice)
    .map((item) => ({
      id: item.id,
      position: item.position || "",
      name: item.name || "",
      model: item.model || "",
      unit: item.unit || UNIT.piece,
      qty: toSafeQty(item.qty),
      reason: item.status || "price_not_found",
    }));
}

function buildUnitMatchSummary(items = []) {
  return items.reduce(
    (acc, item) => {
      const status = item?.unitAudit?.status || "unknown";
      if (status === "match") acc.match += 1;
      else if (status === "mismatch") acc.mismatch += 1;
      else acc.unknown += 1;
      return acc;
    },
    { match: 0, mismatch: 0, unknown: 0 }
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
      basis: `\u041f\u0443\u043d\u043a\u0442 \u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438 ${item.position || "\u0431\u0435\u0437 \u043d\u043e\u043c\u0435\u0440\u0430"} \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d \u0438\u0437 PDF-\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a\u0430\u0446\u0438\u0438 (${item.unit}).`,
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
  const baseItems = Array.isArray(parsedProject?.items) ? parsedProject.items : [];
  const pricedItems = mapPricesToItems(baseItems, requests, priceSnapshot, {});
  return buildSnapshotPayload({
    pricedItems,
    fileName,
    parsedProject,
    requests,
    priceSnapshot,
    objectData,
    vendorName,
    itemOverrides: {},
  });
}

function buildSnapshotPayload({
  pricedItems = [],
  fileName,
  parsedProject,
  requests,
  priceSnapshot,
  objectData,
  vendorName = "\u0411\u0430\u0437\u043e\u0432\u044b\u0439",
  itemOverrides = {},
}) {
  const totals = splitTotals(pricedItems);
  const metrics = computeLiveMetrics(pricedItems, parsedProject?.metrics || {});
  const labor = estimateLaborByProjectItems(pricedItems, metrics, objectData);
  const sourceChecked = pricedItems.reduce((sum, item) => sum + item.checkedSources, 0);
  const itemsWithSupplierPrice = pricedItems.reduce((sum, item) => sum + (item.sourceCount > 0 ? 1 : 0), 0);
  const itemsWithManualPrice = pricedItems.reduce((sum, item) => sum + (item.manualPrice ? 1 : 0), 0);
  const itemsWithoutPrice = buildItemsWithoutPrice(pricedItems);
  const unrecognizedRows = parsedProject?.unrecognizedRows || [];
  const parseQuality = parsedProject?.parseQuality || {
    candidateRows: pricedItems.length + unrecognizedRows.length,
    recognizedPositions: pricedItems.length,
    unresolvedPositions: unrecognizedRows.length,
    recognitionRate: pricedItems.length / Math.max(pricedItems.length + unrecognizedRows.length, 1),
  };
  const unitMatch = buildUnitMatchSummary(pricedItems);
  const aiQuality = parsedProject?.aiQuality || null;

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
    metrics,
    items: pricedItems,
    keyEquipment: buildKeyEquipment(pricedItems),
    parseQuality,
    aiQuality,
    unrecognizedRows,
    itemsWithoutPrice,
    totals: {
      equipment: totals.equipment,
      materials: totals.materials,
      overall: totals.equipment + totals.materials,
    },
    labor,
    sourceStats: {
      sourceChecked,
      itemsWithSupplierPrice,
      itemsWithManualPrice,
      itemsWithoutPrice: itemsWithoutPrice.length,
      resolvedItems: pricedItems.length - itemsWithoutPrice.length,
      unitMatch: unitMatch.match,
      unitMismatch: unitMatch.mismatch,
      unitUnknown: unitMatch.unknown,
      candidateRows: parseQuality.candidateRows,
      recognizedPositions: parseQuality.recognizedPositions,
      unresolvedPositions: parseQuality.unresolvedPositions,
      recognitionRate: parseQuality.recognitionRate,
      aiCorrectedItems: toSafeQty(aiQuality?.correctedItems),
      aiLowConfidenceItems: toSafeQty(aiQuality?.lowConfidenceItems),
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
      unitAudit: item.unitAudit,
      manualPrice: item.manualPrice,
    })),
    requests,
    priceSnapshot,
    originalItems: baseItemsForSnapshot(pricedItems, parsedProject?.items || []),
    itemOverrides,
  };
}

function buildParsedProjectFromSnapshot(snapshot) {
  return {
    parsedAt: snapshot.parsedAt,
    gostStandard: snapshot.gostStandard,
    linesScanned: snapshot.linesScanned,
    pages: snapshot.pages,
    metrics: snapshot.metrics,
    unrecognizedRows: snapshot.unrecognizedRows || [],
    parseQuality: snapshot.parseQuality,
    aiQuality: snapshot.aiQuality || null,
  };
}

function rebuildSnapshotFromState(snapshot, { originalItems, requests, itemOverrides, objectData }) {
  const pricedItems = mapPricesToItems(originalItems, requests, snapshot.priceSnapshot || {}, itemOverrides);

  return buildSnapshotPayload({
    pricedItems,
    fileName: snapshot.fileName,
    parsedProject: buildParsedProjectFromSnapshot(snapshot),
    requests,
    priceSnapshot: snapshot.priceSnapshot || {},
    objectData,
    vendorName: snapshot.vendorName,
    itemOverrides,
  });
}

function baseItemsForSnapshot(pricedItems = [], fallbackItems = []) {
  if (fallbackItems.length) return fallbackItems;
  return pricedItems.map((item) => ({
    ...item,
    total: undefined,
    unitPrice: undefined,
    sourceCount: undefined,
    checkedSources: undefined,
    usedSources: undefined,
    status: undefined,
    unitAudit: undefined,
    manualPrice: undefined,
    manualQty: undefined,
  }));
}

export function recalculateApsProjectSnapshot(snapshot, patch = {}, objectData = {}) {
  if (!snapshot || !snapshot.active) return snapshot;

  const nextOverrides = {
    ...(snapshot.itemOverrides || {}),
    ...(patch || {}),
  };

  const originalItems = Array.isArray(snapshot.originalItems) && snapshot.originalItems.length ? snapshot.originalItems : snapshot.items;
  const requests = snapshot.requests || [];

  return rebuildSnapshotFromState(snapshot, {
    originalItems,
    requests,
    itemOverrides: nextOverrides,
    objectData,
  });
}

export function appendManualApsProjectItem(snapshot, draft = {}, objectData = {}) {
  if (!snapshot || !snapshot.active) return snapshot;

  const currentItems = Array.isArray(snapshot.originalItems) && snapshot.originalItems.length ? snapshot.originalItems : snapshot.items || [];
  const manualItem = sanitizeManualItemDraft(draft, currentItems);
  const originalItems = [...currentItems, manualItem];
  const requests = [...(snapshot.requests || []), buildManualRequest(manualItem)];
  const itemOverrides = {
    ...(snapshot.itemOverrides || {}),
    [manualItem.id]: {
      qty: manualItem.qty,
      unitPrice: manualItem.unitPrice,
    },
  };

  return rebuildSnapshotFromState(snapshot, {
    originalItems,
    requests,
    itemOverrides,
    objectData,
  });
}

export function removeApsProjectItem(snapshot, itemId, objectData = {}) {
  if (!snapshot || !snapshot.active || !itemId) return snapshot;

  const currentItems = Array.isArray(snapshot.originalItems) && snapshot.originalItems.length ? snapshot.originalItems : snapshot.items || [];
  const originalItems = currentItems.filter((item) => item.id !== itemId);
  const requests = (snapshot.requests || []).filter((request) => request.itemId !== itemId);
  const nextOverrides = { ...(snapshot.itemOverrides || {}) };
  delete nextOverrides[itemId];

  return rebuildSnapshotFromState(snapshot, {
    originalItems,
    requests,
    itemOverrides: nextOverrides,
    objectData,
  });
}
