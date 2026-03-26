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

const ARTICLE_TOKEN_REGEX = /\d{1,4}(?:[-/.]\d{2,4}){2,}/gu;

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

function normalizeUnitToken(raw) {
  return normalizeUnitHint(raw);
}

function normalizeArticleToken(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]/giu, "");
}

function extractArticleTokens(value) {
  return unique(
    [...String(value || "").matchAll(ARTICLE_TOKEN_REGEX)]
      .map((match) => String(match[0] || "").trim())
      .filter(Boolean)
  );
}

function articleTokensMatch(left, right) {
  const l = normalizeArticleToken(left);
  const r = normalizeArticleToken(right);
  if (!l || !r) return false;
  return l === r || l.endsWith(r) || r.endsWith(l);
}

function isUnitCompatible(requestUnit, unitHints = []) {
  const expected = normalizeUnitToken(requestUnit);
  if (!expected) return true;
  const hints = unique((unitHints || []).map((item) => normalizeUnitToken(item)).filter(Boolean));
  if (!hints.length) return true;
  if (hints.includes(expected)) return true;

  const similarGroups = [
    ["шт", "компл"],
    ["м", "м2"],
  ];
  return similarGroups.some((group) => group.includes(expected) && hints.some((hint) => group.includes(hint)));
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

function normalizeModelToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9-]/giu, "");
}

function scoreModelToken(rawToken) {
  const token = String(rawToken || "");
  if (!token) return -1;
  let score = 0;
  const digitGroups = token.match(/\d+/g) || [];
  const separators = (token.match(/[-/.]/g) || []).length;
  if (digitGroups.length >= 3 && separators >= 2) score += 9;
  if (/^\d/u.test(token)) score += 5;
  if (/\d/u.test(token) && /[a-zа-яё]/iu.test(token)) score += 3;
  if (/^(?:c|с)?2000/iu.test(token)) score += 4;
  if (/\b(?:кдл|bki|бки|сп2|pp|пп|mpn|мпн|dip|ипр|rip|рип)/iu.test(token)) score += 4;
  score += Math.min(token.length, 20) * 0.12;
  return score;
}

function extractPrimaryModelToken(value) {
  const articleCandidates = extractArticleTokens(value)
    .map((token) => normalizeModelToken(token))
    .filter((token) => token.length >= 7);
  if (articleCandidates.length) {
    return articleCandidates.sort((left, right) => scoreModelToken(right) - scoreModelToken(left) || right.length - left.length)[0];
  }

  const explicit = normalizeModelToken(value);
  if (explicit.length >= 7 && /\d/u.test(explicit)) return explicit;

  const candidates = [...String(value || "").matchAll(/[A-Za-zА-Яа-яЁё0-9]+(?:[-/.][A-Za-zА-Яа-яЁё0-9]+)+/gu)]
    .map((match) => normalizeModelToken(match[0]))
    .filter((token) => token.length >= 5 && /\d/u.test(token))
    .sort((left, right) => scoreModelToken(right) - scoreModelToken(left) || right.length - left.length);
  return candidates[0] || "";
}

function extractPrimaryArticleToken(value) {
  const candidates = extractArticleTokens(value)
    .map((token) => normalizeModelToken(token))
    .filter((token) => token.length >= 7);
  if (!candidates.length) return "";
  return candidates.sort((left, right) => right.length - left.length)[0];
}

function extractModelTokenWithArticleBias(value) {
  return extractPrimaryArticleToken(value) || extractPrimaryModelToken(value);
}

function buildArticleCandidates(value) {
  const articles = extractArticleTokens(value);
  const models = [...String(value || "").matchAll(/[A-Za-zА-Яа-яЁё0-9]+(?:[-/.][A-Za-zА-Яа-яЁё0-9]+)+/gu)].map((match) => match[0]);
  return unique([...articles, ...models].map((item) => normalizeModelToken(item)).filter((item) => item.length >= 6));
}

function hostFromUrl(url) {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function buildModelTokenFromEntry(entry = {}) {
  const explicit = extractModelTokenWithArticleBias(entry?.modelToken || entry?.primaryArticleToken || "");
  if (explicit) return explicit;
  return extractModelTokenWithArticleBias(entry?.searchQuery || "");
}

function isModelTokenInText(modelToken, value) {
  if (!modelToken) return false;
  const normalized = normalizeModelToken(value);
  if (!normalized) return false;
  return normalized.includes(modelToken) || modelToken.includes(normalized);
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
  const modelToken = extractModelTokenWithArticleBias(query);
  const queryArticleCandidates = buildArticleCandidates(query);
  const candidates = items
    .map((item) => ({
      score: scoreLuisItem(item, queryTokens),
      price: normalizePrice(item?.price),
      article: item?.article || "",
      model: item?.model || "",
      articleMatched: queryArticleCandidates.some((queryArticle) =>
        [item?.article, item?.model].some((value) => articleTokensMatch(queryArticle, value))
      ),
    }))
    .filter((item) => item.price);

  if (!candidates.length) return { prices: [], usedSources: [], unitHints: [] };

  candidates.sort((a, b) => {
    if (a.articleMatched !== b.articleMatched) return a.articleMatched ? -1 : 1;
    return b.score - a.score || b.price - a.price;
  });
  const articleMatchedPool = candidates.filter((item) => item.articleMatched);
  const topByScore = articleMatchedPool.length
    ? articleMatchedPool
    : candidates.filter((item) => item.score >= Math.max(candidates[0].score - 2, 0));
  const selectedRaw = topByScore.map((item) => item.price);
  const selected =
    selectClosestToFallback(selectedRaw, fallbackPrice) ||
    selectBestPrice(selectedRaw, fallbackPrice) ||
    selectFinalPrice(selectedRaw, fallbackPrice);
  if (!selected) return { prices: [], usedSources: [], unitHints: [] };

  const winner = topByScore.find((item) => item.price === selected) || topByScore[0];
  const hint = winner?.article || winner?.model || query;
  const winnerTokenSource = normalizeModelToken(`${winner?.article || ""} ${winner?.model || ""}`);
  const modelTokenMatched = modelToken ? winnerTokenSource.includes(modelToken) : false;
  const unitHints = unique(
    items
      .map((item) => normalizeUnitHint(item?.unit || item?.baseUnit || item?.measure || item?.uom))
      .filter(Boolean)
  );
  return {
    prices: [selected],
    usedSources: [`${source.url}#${hint}`],
    unitHints,
    selectionMeta: {
      sourceKind: "luis_api",
      modelToken,
      modelTokenMatched,
      articleMatched: Boolean(winner?.articleMatched),
      winner: hint,
    },
  };
}

async function fetchPriceFromTinkoSearch(searchUrl, fallbackPrice) {
  let queryModelToken = "";
  try {
    const parsed = new URL(searchUrl);
    queryModelToken = extractModelTokenWithArticleBias(decodeURIComponent(parsed.searchParams.get("q") || ""));
  } catch {
    queryModelToken = extractModelTokenWithArticleBias(searchUrl);
  }

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
    return price
      ? {
          prices: [price],
          usedSources: [searchUrl],
          unitHints,
          selectionMeta: {
            sourceKind: "tinko_search",
            modelToken: queryModelToken,
            modelTokenMatched: isModelTokenInText(queryModelToken, searchUrl),
          },
        }
      : { prices: [], usedSources: [], unitHints };
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
  const winnerUrl = usedSources.length ? usedSources[0] : searchUrl;
  return {
    prices: [finalPrice],
    usedSources: [winnerUrl],
    unitHints: unique(unitHints),
    selectionMeta: {
      sourceKind: "tinko_search",
      modelToken: queryModelToken,
      modelTokenMatched: isModelTokenInText(queryModelToken, winnerUrl),
    },
  };
}

async function fetchPriceFromGenericSource(source, fallbackPrice) {
  const queryModelToken = extractModelTokenWithArticleBias(source?.url || "");
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
      ? {
          prices: [price],
          usedSources: [source.url],
          unitHints: unique(unitHints),
          selectionMeta: {
            sourceKind: "generic",
            modelToken: queryModelToken,
            modelTokenMatched: isModelTokenInText(queryModelToken, source.url),
          },
        }
      : { prices: [], usedSources: [], unitHints: unique(unitHints) };
  }

  const text = await response.text();
  const price = selectBestPrice(extractPricesFromText(text), fallbackPrice);
  const unitHints = extractUnitHintsFromText(text);
  return price
    ? {
        prices: [price],
        usedSources: [source.url],
        unitHints,
        selectionMeta: {
          sourceKind: "generic",
          modelToken: queryModelToken,
          modelTokenMatched: isModelTokenInText(queryModelToken, source.url) || isModelTokenInText(queryModelToken, text.slice(0, 6000)),
        },
      }
    : { prices: [], usedSources: [], unitHints };
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

function selectClosestToFallback(prices, fallbackPrice) {
  const fallback = Number(fallbackPrice);
  const sensible = (prices || []).filter((value) => Number.isFinite(value) && value > 0);
  if (!sensible.length) return null;
  if (!Number.isFinite(fallback) || fallback <= 0) return selectBestPrice(sensible, fallbackPrice);
  return [...sensible].sort((left, right) => Math.abs(Math.log(left / fallback)) - Math.abs(Math.log(right / fallback)))[0];
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

      const modelToken = buildModelTokenFromEntry(entry);
      const settled = await Promise.allSettled(targets.map((target) => fetchPriceForTarget(target, fallbackPrice)));
      const candidateRows = [];

      settled.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const value = result.value || {};
        const source = normalizeSourceTarget(targets[index]);
        const prices = (value.prices || []).filter((item) => Number.isFinite(item) && item > 0);
        if (!prices.length) return;
        const usedSources = (value.usedSources || []).filter(Boolean);
        const sourceUrl = source?.url || usedSources[0] || "";
        const sourceHost = hostFromUrl(sourceUrl);
        const sourceName = source?.sourceName || value?.selectionMeta?.sourceKind || sourceHost || "";
        const inferredModelMatch = modelToken
          ? [sourceUrl, ...usedSources].some((url) => isModelTokenInText(modelToken, url))
          : false;
        const modelTokenMatched = Boolean(value?.selectionMeta?.modelTokenMatched) || inferredModelMatch;
        const articleMatched = Boolean(value?.selectionMeta?.articleMatched);
        const unitHints = (value.unitHints || []).map((item) => normalizeUnitHint(item)).filter(Boolean);

        for (const price of prices) {
          candidateRows.push({
            price,
            sourceName,
            sourceHost,
            usedSources: usedSources.length ? usedSources : sourceUrl ? [sourceUrl] : [],
            unitHints,
            modelTokenMatched,
            articleMatched,
          });
        }
      });

      const unitCompatibleRows = candidateRows.filter((item) => isUnitCompatible(entry?.unit, item.unitHints));
      const baseRows = unitCompatibleRows.length ? unitCompatibleRows : candidateRows;
      const luisRows = baseRows.filter((item) => item.sourceName === "luis_api" || item.sourceHost === "luis.ru");
      const articleRows = baseRows.filter((item) => item.articleMatched);
      const modelRows = modelToken ? baseRows.filter((item) => item.modelTokenMatched) : [];
      const luisExactRows = luisRows.filter((item) => item.modelTokenMatched);
      const manufacturerHost = hostFromUrl(entry?.manufacturerWebsite || "");
      const manufacturerRows = manufacturerHost ? baseRows.filter((item) => item.sourceHost === manufacturerHost) : [];

      let selectionStrategy = "average_all_sources";
      let selectionPool = baseRows;

      if (articleRows.length) {
        selectionPool = articleRows;
        selectionStrategy = "article_exact_match";
      } else if (modelToken && modelRows.length) {
        selectionPool = modelRows;
        selectionStrategy = "model_token_match";
      } else if (modelToken && luisExactRows.length) {
        selectionPool = luisExactRows;
        selectionStrategy = "luis_api_exact_model";
      } else if (modelToken && luisRows.length) {
        selectionPool = luisRows;
        selectionStrategy = "luis_api_model_bias";
      } else if (modelToken && manufacturerRows.length) {
        selectionPool = manufacturerRows;
        selectionStrategy = "manufacturer_source_bias";
      }

      const poolPrices = selectionPool.map((item) => item.price);
      const preferFallbackAnchoredSelection =
        selectionStrategy === "article_exact_match" ||
        selectionStrategy === "model_token_match" ||
        selectionStrategy === "luis_api_exact_model" ||
        selectionStrategy === "luis_api_model_bias";

      let selectedPrice = preferFallbackAnchoredSelection
        ? selectClosestToFallback(poolPrices, fallbackPrice) || selectBestPrice(poolPrices, fallbackPrice) || selectFinalPrice(poolPrices, fallbackPrice)
        : selectFinalPrice(poolPrices, fallbackPrice);

      const fallback = Number(fallbackPrice);
      if (Number.isFinite(fallback) && fallback > 0 && Number.isFinite(selectedPrice) && selectedPrice > 0) {
        const tooHigh = selectedPrice > fallback * 4;
        const tooLow = selectedPrice < fallback * 0.2;
        if (tooHigh || tooLow) {
          const corridorRows = baseRows.filter((item) => item.price >= fallback * 0.22 && item.price <= fallback * 4.2);
          if (corridorRows.length) {
            selectionPool = corridorRows;
            const corridorPrices = selectionPool.map((item) => item.price);
            selectedPrice = preferFallbackAnchoredSelection
              ? selectClosestToFallback(corridorPrices, fallback) || selectBestPrice(corridorPrices, fallback) || selectFinalPrice(corridorPrices, fallback)
              : selectFinalPrice(corridorPrices, fallback);
            selectionStrategy = `${selectionStrategy}_fallback_guard`;
          } else {
            selectedPrice = fallback;
            selectionStrategy = `${selectionStrategy}_fallback_guard`;
          }
        }
      }

      const spreadBase = selectionPool.map((item) => item.price).filter((item) => Number.isFinite(item) && item > 0);
      const spread = spreadBase.length > 1 ? Math.max(...spreadBase) / Math.max(Math.min(...spreadBase), 1) : 1;
      const hasUnitMismatchRisk = !unitCompatibleRows.length && candidateRows.length > 0;
      const recheckRequired = (spread >= 6 && selectionPool.length > 1) || hasUnitMismatchRisk;
      const closestRows = selectedPrice
        ? selectionPool.filter((item) => Math.abs(item.price - selectedPrice) <= Math.max(1, selectedPrice * 0.03))
        : [];
      const selectedRows = closestRows.length ? closestRows : selectionPool;

      const selectedUsedSources = unique(selectedRows.flatMap((item) => item.usedSources || []).filter(Boolean));
      const selectedUnits = unique(selectedRows.flatMap((item) => item.unitHints || []).filter(Boolean));

      if (selectedPrice && candidateRows.length > 0) {
        const baseConfidence =
          selectionStrategy === "article_exact_match"
            ? 0.97
            : selectionPool.length === 1
              ? 0.92
              : spread <= 2
                ? 0.88
                : spread <= 4
                  ? 0.72
                  : 0.55;
        return {
          key,
          price: selectedPrice,
          status: selectionPool.length > 1 ? "fetched_multi" : "fetched",
          sourceCount: selectedUsedSources.length,
          checkedSources: targets.length,
          usedSources: selectedUsedSources,
          unitHints: selectedUnits,
          selectionStrategy,
          modelToken,
          recheckRequired,
          priceConfidence: Number(baseConfidence.toFixed(2)),
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
        unitHints: [],
        selectionStrategy,
        modelToken,
        recheckRequired: false,
        priceConfidence: 0,
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
