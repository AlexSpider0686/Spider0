const PRICE_FIELD_REGEX = /"price"\s*:\s*"?([\d\s.,]+)"?/gi;
const META_PRICE_REGEX = /itemprop=["']price["'][^>]*content=["']([\d\s.,]+)["']/gi;
const MONEY_REGEX = /(?:₽|руб\.?|RUB|USD|EUR)\s*([\d\s.,]{2,})|([\d\s.,]{2,})\s*(?:₽|руб\.?|RUB|USD|EUR)/giu;
const TINKO_PRODUCT_LINK_REGEX = /\/catalog\/product\/\d+\//gi;

function normalizePrice(raw) {
  if (!raw) return null;
  const compact = String(raw).replace(/&nbsp;/gi, "").replace(/\s/g, "").replace(",", ".");
  const numericMatch = compact.match(/\d+(?:\.\d+)?/);
  if (!numericMatch) return null;
  const value = Number(numericMatch[0]);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 100 || value > 10_000_000) return null;
  return value;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function extractPrices(html) {
  const text = String(html || "");
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

  return prices;
}

function pickPrice(html) {
  const prices = extractPrices(html);
  if (!prices.length) return null;
  const filtered = prices.filter((value) => value >= 500);
  return median(filtered.length ? filtered : prices);
}

async function fetchHtml(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; Spider0PriceBot/5.0)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
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
    if (urls.length >= 3) break;
  }

  return urls;
}

async function fetchPriceFromTinkoSearch(searchUrl) {
  const searchHtml = await fetchHtml(searchUrl, 7000);
  const productUrls = extractTinkoProductUrls(searchHtml);

  if (!productUrls.length) {
    const price = pickPrice(searchHtml);
    return price ? { prices: [price], usedSources: [searchUrl] } : { prices: [], usedSources: [] };
  }

  const settled = await Promise.allSettled(productUrls.slice(0, 2).map((url) => fetchHtml(url, 7000)));
  const prices = [];
  const usedSources = [];

  settled.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const price = pickPrice(result.value);
    if (!price) return;
    prices.push(price);
    usedSources.push(productUrls[index]);
  });

  return { prices, usedSources };
}

async function fetchPriceForUrl(url) {
  if (!url) return { prices: [], usedSources: [] };

  if (url.includes("tinko.ru/search/")) {
    return fetchPriceFromTinkoSearch(url);
  }

  const html = await fetchHtml(url, 4500);
  const price = pickPrice(html);
  return price ? { prices: [price], usedSources: [url] } : { prices: [], usedSources: [] };
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(items) {
  return [...new Set(items)];
}

export async function resolveVendorPrices(requests = []) {
  if (!Array.isArray(requests)) {
    throw new Error("requests must be an array");
  }

  return Promise.all(
    requests.map(async (entry) => {
      const { key, sourceUrls, sourceUrl, fallbackPrice } = entry || {};
      const urls = Array.isArray(sourceUrls) ? sourceUrls.filter(Boolean).slice(0, 3) : sourceUrl ? [sourceUrl] : [];

      if (!urls.length) {
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

      const settled = await Promise.allSettled(urls.map((url) => fetchPriceForUrl(url)));
      const prices = [];
      const usedSources = [];

      settled.forEach((result) => {
        if (result.status !== "fulfilled") return;
        prices.push(...(result.value.prices || []));
        usedSources.push(...(result.value.usedSources || []));
      });

      const avgPrice = average(prices);
      const uniqueSources = unique(usedSources);
      if (avgPrice) {
        return {
          key,
          price: avgPrice,
          status: prices.length > 1 ? "fetched_avg" : "fetched",
          sourceCount: uniqueSources.length,
          checkedSources: urls.length,
          usedSources: uniqueSources,
        };
      }

      return {
        key,
        price: fallbackPrice ?? null,
        status: "fallback",
        reason: "price_not_found",
        sourceCount: 0,
        checkedSources: urls.length,
        usedSources: [],
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
