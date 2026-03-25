const PRICE_FIELD_REGEX = /"price"\s*:\s*"?([\d\s.,]+)"?/gi;
const META_PRICE_REGEX = /itemprop=["']price["'][^>]*content=["']([\d\s.,]+)["']/gi;
const MONEY_REGEX =
  /(?:\u20BD|\u0440\u0443\u0431\.?|RUB|USD|EUR)\s*([\d\s.,]{1,})|([\d\s.,]{1,})\s*(?:\u20BD|\u0440\u0443\u0431\.?|RUB|USD|EUR)/giu;
const TINKO_PRODUCT_LINK_REGEX = /\/catalog\/product\/\d+\//gi;
const UNIT_NEAR_PRICE_REGEX =
  /(?:\u20BD|\u0440\u0443\u0431\.?|RUB)\s*(?:\/|\u0437\u0430)?\s*(\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434\.?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)/giu;
const UNIT_GENERIC_REGEX = /(?:\u0437\u0430|\/)\s*(\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434\.?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)/giu;

const UNIT_ALIAS_MAP = {
  "шт": "шт",
  "штук": "шт",
  "ед": "шт",
  "ед.": "шт",
  "компл": "компл",
  "комплект": "компл",
  "м": "м",
  "м2": "м2",
  "м²": "м2",
  "кг": "кг",
  "л": "л",
  "уп": "уп",
  "упак": "уп",
  "лист": "лист",
  "листа": "лист",
  "листов": "лист",
};

function normalizePrice(raw) {
  if (!raw) return null;
  const compact = String(raw).replace(/&nbsp;/gi, "").replace(/\s/g, "").replace(",", ".");
  const numericMatch = compact.match(/\d+(?:\.\d+)?/);
  if (!numericMatch) return null;
  const value = Number(numericMatch[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value > 10_000_000) return null;
  return value;
}

function normalizeUnitHint(raw) {
  const token = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "");
  return UNIT_ALIAS_MAP[token] || "";
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(items) {
  return [...new Set(items)];
}

function extractPricesFromJsonLike(value, collector) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => extractPricesFromJsonLike(item, collector));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (/(price|cost|amount|sum)/i.test(key)) {
        const candidate = normalizePrice(nested);
        if (candidate) collector.push(candidate);
      }
      extractPricesFromJsonLike(nested, collector);
    }
    return;
  }
  const candidate = normalizePrice(value);
  if (candidate) collector.push(candidate);
}

function extractUnitHintsFromJsonLike(value, collector) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => extractUnitHintsFromJsonLike(item, collector));
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (/(unit|measure|ед\.?\s*изм|uom)/i.test(key)) {
        const normalized = normalizeUnitHint(nested);
        if (normalized) collector.push(normalized);
      }
      extractUnitHintsFromJsonLike(nested, collector);
    }
    return;
  }
  const normalized = normalizeUnitHint(value);
  if (normalized) collector.push(normalized);
}

function extractPricesFromText(htmlOrText) {
  const text = String(htmlOrText || "");
  const prices = [];

  for (const match of text.matchAll(PRICE_FIELD_REGEX)) {
    const value = normalizePrice(match[1]);
    if (value) prices.push(value);
  }

  for (const match of text.matchAll(META_PRICE_REGEX)) {
    const value = normalizePrice(match[1]);
    if (value) prices.push(value);
  }

  for (const match of text.matchAll(MONEY_REGEX)) {
    const value = normalizePrice(match[1] || match[2]);
    if (value) prices.push(value);
  }

  return unique(prices);
}

function extractUnitHintsFromText(htmlOrText) {
  const text = String(htmlOrText || "");
  const units = [];

  for (const match of text.matchAll(UNIT_NEAR_PRICE_REGEX)) {
    const normalized = normalizeUnitHint(match[1]);
    if (normalized) units.push(normalized);
  }
  for (const match of text.matchAll(UNIT_GENERIC_REGEX)) {
    const normalized = normalizeUnitHint(match[1]);
    if (normalized) units.push(normalized);
  }

  return unique(units);
}

function selectBestPrice(prices, fallbackPrice = null) {
  const sensible = prices.filter((value) => Number.isFinite(value) && value >= 1 && value <= 5_000_000);
  if (!sensible.length) return null;

  const fallback = Number(fallbackPrice);
  if (!Number.isFinite(fallback) || fallback <= 0) {
    const filtered = sensible.filter((value) => value >= 10);
    return median(filtered.length ? filtered : sensible);
  }

  const corridor = sensible.filter((value) => value >= fallback * 0.06 && value <= fallback * 16);
  const source = corridor.length ? corridor : sensible;
  if (source.length === 1) return source[0];

  const minValue = Math.min(...source);
  const maxValue = Math.max(...source);
  const spread = maxValue / Math.max(minValue, 1);

  if (spread >= 2.5) {
    return [...source].sort((a, b) => Math.abs(Math.log(a / fallback)) - Math.abs(Math.log(b / fallback)))[0];
  }

  return median(source);
}

function selectAveragedPrice(prices, fallbackPrice = null) {
  const sensible = prices.filter((value) => Number.isFinite(value) && value >= 1 && value <= 5_000_000);
  if (!sensible.length) return null;

  const fallback = Number(fallbackPrice);
  const corridor =
    Number.isFinite(fallback) && fallback > 0
      ? sensible.filter((value) => value >= fallback * 0.06 && value <= fallback * 16)
      : sensible;

  const source = corridor.length ? corridor : sensible;
  if (!source.length) return null;
  if (source.length === 1) return source[0];

  const sorted = [...source].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const spread = max / Math.max(min, 1);
  const filtered = spread >= 4 && sorted.length > 3 ? sorted.slice(1, -1) : sorted;
  return Number((average(filtered) || average(sorted) || 0).toFixed(2));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function absoluteTinkoUrl(pathOrUrl) {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `https://www.tinko.ru${pathOrUrl}`;
}

function extractTinkoProductUrls(searchHtml) {
  const urls = [];
  const seen = new Set();

  for (const match of String(searchHtml || "").matchAll(TINKO_PRODUCT_LINK_REGEX)) {
    const url = absoluteTinkoUrl(match[0]);
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= 5) break;
  }

  return urls;
}

function normalizeSourceTarget(target) {
  if (!target) return null;
  if (typeof target === "string") {
    return {
      url: target,
      method: "GET",
      headers: {},
      body: null,
      sourceName: "",
    };
  }

  if (typeof target !== "object" || !target.url) return null;
  return {
    url: String(target.url),
    method: String(target.method || "GET").toUpperCase(),
    headers: target.headers && typeof target.headers === "object" ? target.headers : {},
    body: target.body ?? null,
    sourceName: String(target.sourceName || ""),
  };
}

function normalizeSearchQuery(value) {
  return String(value || "")
    .replace(/[«»"'`]/g, " ")
    .replace(/[(){}\[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildQueryTokens(value) {
  return normalizeSearchQuery(value)
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 10);
}

function scoreLuisItem(item, queryTokens = []) {
  const text = normalizeSearchQuery(
    `${item?.prefix || ""} ${item?.model || ""} ${item?.article || ""} ${item?.annex || ""} ${item?.description || ""}`
  );
  if (!text) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (token.length >= 5 && String(item?.article || "").toLowerCase().includes(token)) score += 7;
    if (String(item?.model || "").toLowerCase().includes(token)) score += 4;
    if (text.includes(token)) score += 1.2;
  }
  return score;
}

async function fetchLuisApiPrice(source, fallbackPrice) {
  const query = String(source?.body?.query || "").trim();
  if (!query) return { prices: [], usedSources: [] };

  const payload = {
    query,
    pagination: source?.body?.pagination || { page: 1, perPage: 12 },
  };

  const response = await fetchWithTimeout(
    source.url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/plain, */*",
        origin: "https://luis.ru",
        referer: "https://luis.ru/",
        ...source.headers,
      },
      body: JSON.stringify(payload),
    },
    20000
  );

  const json = await response.json().catch(() => ({}));
  const items = Array.isArray(json?.items) ? json.items : [];
  if (!items.length) return { prices: [], usedSources: [], unitHints: [] };

  const queryTokens = buildQueryTokens(query);
  const candidates = items
    .map((item) => ({
      score: scoreLuisItem(item, queryTokens),
      price: normalizePrice(item?.price),
      article: item?.article || "",
      model: item?.model || "",
    }))
    .filter((item) => item.price);

  if (!candidates.length) return { prices: [], usedSources: [], unitHints: [] };

  candidates.sort((a, b) => b.score - a.score || b.price - a.price);
  const topByScore = candidates.filter((item) => item.score >= Math.max(candidates[0].score - 2, 0));
  const selectedRaw = topByScore.map((item) => item.price);
  const selected = selectBestPrice(selectedRaw, fallbackPrice);
  if (!selected) return { prices: [], usedSources: [], unitHints: [] };

  const winner = topByScore.find((item) => item.price === selected) || topByScore[0];
  const hint = winner?.article || winner?.model || query;
  const unitHints = unique(
    items
      .map((item) => normalizeUnitHint(item?.unit || item?.baseUnit || item?.measure || item?.uom))
      .filter(Boolean)
  );
  return {
    prices: [selected],
    usedSources: [`${source.url}#${hint}`],
    unitHints,
  };
}

async function fetchPriceFromTinkoSearch(searchUrl, fallbackPrice) {
  const searchResponse = await fetchWithTimeout(
    searchUrl,
    {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
      },
    },
    18000
  );
  const searchHtml = await searchResponse.text();
  const productUrls = extractTinkoProductUrls(searchHtml);

  if (!productUrls.length) {
    const price = selectBestPrice(extractPricesFromText(searchHtml), fallbackPrice);
    const unitHints = extractUnitHintsFromText(searchHtml);
    return price ? { prices: [price], usedSources: [searchUrl], unitHints } : { prices: [], usedSources: [], unitHints };
  }

  const settled = await Promise.allSettled(
    productUrls.slice(0, 4).map((url) =>
      fetchWithTimeout(
        url,
        {
          method: "GET",
          headers: {
            accept: "text/html,application/xhtml+xml",
          },
        },
        16000
      ).then((response) => response.text())
    )
  );

  const prices = [];
  const usedSources = [];
  const unitHints = [];
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const price = selectBestPrice(extractPricesFromText(result.value), fallbackPrice);
    unitHints.push(...extractUnitHintsFromText(result.value));
    if (!price) return;
    prices.push(price);
    usedSources.push(productUrls[index]);
  });

  const finalPrice = selectBestPrice(prices, fallbackPrice);
  if (!finalPrice) return { prices: [], usedSources: [], unitHints: unique(unitHints) };
  return {
    prices: [finalPrice],
    usedSources: usedSources.length ? [usedSources[0]] : [searchUrl],
    unitHints: unique(unitHints),
  };
}

async function fetchPriceFromGenericSource(source, fallbackPrice) {
  const method = source.method || "GET";
  const headers = { ...source.headers };
  let body = source.body;

  if (body && typeof body === "object" && !(body instanceof ArrayBuffer)) {
    if (!headers["content-type"] && !headers["Content-Type"]) {
      headers["content-type"] = "application/json";
    }
    const contentType = String(headers["content-type"] || headers["Content-Type"] || "").toLowerCase();
    body = contentType.includes("application/json") ? JSON.stringify(body) : body;
  }

  const response = await fetchWithTimeout(
    source.url,
    {
      method,
      headers: {
        accept: "text/html,application/xhtml+xml,application/json,text/plain,*/*",
        ...headers,
      },
      body: method === "GET" ? undefined : body,
    },
    15000
  );

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const json = await response.json().catch(() => ({}));
    const prices = [];
    const unitHints = [];
    extractPricesFromJsonLike(json, prices);
    extractUnitHintsFromJsonLike(json, unitHints);
    const price = selectBestPrice(prices, fallbackPrice);
    return price
      ? { prices: [price], usedSources: [source.url], unitHints: unique(unitHints) }
      : { prices: [], usedSources: [], unitHints: unique(unitHints) };
  }

  const text = await response.text();
  const price = selectBestPrice(extractPricesFromText(text), fallbackPrice);
  const unitHints = extractUnitHintsFromText(text);
  return price ? { prices: [price], usedSources: [source.url], unitHints } : { prices: [], usedSources: [], unitHints };
}

async function fetchPriceForTarget(target, fallbackPrice) {
  const source = normalizeSourceTarget(target);
  if (!source?.url) return { prices: [], usedSources: [], unitHints: [] };

  if (source.url.includes("luis.ru/luisapi/catalog/search")) {
    return fetchLuisApiPrice(source, fallbackPrice);
  }
  if (source.url.includes("tinko.ru/search/")) {
    return fetchPriceFromTinkoSearch(source.url, fallbackPrice);
  }
  return fetchPriceFromGenericSource(source, fallbackPrice);
}

function selectFinalPrice(prices, fallbackPrice) {
  const selected = selectAveragedPrice(prices, fallbackPrice) || selectBestPrice(prices, fallbackPrice);
  if (selected) return selected;
  const fallback = Number(fallbackPrice);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

export async function resolveVendorPrices(requests = []) {
  if (!Array.isArray(requests)) {
    throw new Error("requests must be an array");
  }

  return Promise.all(
    requests.map(async (entry) => {
      const { key, sourceUrls, sourceUrl, fallbackPrice } = entry || {};
      const targets = Array.isArray(sourceUrls) ? sourceUrls.filter(Boolean).slice(0, 16) : sourceUrl ? [sourceUrl] : [];

      if (!targets.length) {
        return {
          key,
          price: fallbackPrice ?? null,
          status: "fallback",
          reason: "no_source",
          sourceCount: 0,
          checkedSources: 0,
          usedSources: [],
        };
      }

      const settled = await Promise.allSettled(targets.map((target) => fetchPriceForTarget(target, fallbackPrice)));
      const prices = [];
      const usedSources = [];
      const unitHints = [];

      settled.forEach((result) => {
        if (result.status !== "fulfilled") return;
        prices.push(...(result.value.prices || []));
        usedSources.push(...(result.value.usedSources || []));
        unitHints.push(...(result.value.unitHints || []));
      });

      const selectedPrice = selectFinalPrice(prices, fallbackPrice);
      const uniqueSources = unique(usedSources);
      const uniqueUnits = unique(unitHints.map((item) => normalizeUnitHint(item)).filter(Boolean));
      if (selectedPrice && prices.length > 0) {
        return {
          key,
          price: selectedPrice,
          status: prices.length > 1 ? "fetched_multi" : "fetched",
          sourceCount: uniqueSources.length,
          checkedSources: targets.length,
          usedSources: uniqueSources,
          unitHints: uniqueUnits,
        };
      }

      return {
        key,
        price: fallbackPrice ?? null,
        status: "fallback",
        reason: "price_not_found",
        sourceCount: 0,
        checkedSources: targets.length,
        usedSources: [],
        unitHints: uniqueUnits,
      };
    })
  );
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { requests = [] } = req.body || {};
  if (!Array.isArray(requests)) {
    res.status(400).json({ error: "requests must be an array" });
    return;
  }

  const results = await resolveVendorPrices(requests);
  res.status(200).json({ results, fetchedAt: new Date().toISOString() });
}
