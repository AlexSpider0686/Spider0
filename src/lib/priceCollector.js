import { getCriticalEquipment } from "../config/equipmentCatalog";
import { getManufacturerSource } from "../config/vendorsConfig";

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

function normalizeSearchText(value) {
  return String(value || "")
    .replace(/[«»"'`]/g, " ")
    .replace(/[(){}\[\],;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function shortenSearchText(value, max = 96) {
  return normalizeSearchText(value).slice(0, max).trim();
}

function dedupeStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeSourceTargets(targets = []) {
  const seen = new Set();
  const result = [];

  for (const target of targets) {
    if (!target) continue;
    const key =
      typeof target === "string"
        ? `GET:${target}`
        : `${String(target.method || "GET").toUpperCase()}:${String(target.url || "")}:${JSON.stringify(target.body || {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(target);
  }

  return result;
}

function buildSearchQueries(vendorName, item) {
  const vendor = shortenSearchText(vendorName, 48);
  const term = shortenSearchText(item?.searchTerm || "", 88);
  const label = shortenSearchText(item?.label || "", 72);
  const modelHint = shortenSearchText(
    (item?.searchTerm || item?.label || "").match(/[A-Za-zА-Яа-яЁё0-9]+(?:[-/.][A-Za-zА-Яа-яЁё0-9]+)+/u)?.[0] || "",
    72
  );

  return dedupeStrings([
    `${vendor} ${term}`.trim(),
    `${vendor} ${label}`.trim(),
    `${term}`.trim(),
    `${label}`.trim(),
    `${modelHint}`.trim(),
    `${vendor} ${modelHint}`.trim(),
  ]).slice(0, 4);
}

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function buildManufacturerUrl(source, item, searchQuery) {
  const website = trimSlash(source?.website);
  if (!website) return "";

  if (item.sourcePath) {
    return `${website}${item.sourcePath}`;
  }

  if (source?.searchPathTemplate) {
    return `${website}${source.searchPathTemplate.replace("{query}", encodeURIComponent(searchQuery))}`;
  }

  return `${website}/search?q=${encodeURIComponent(searchQuery)}`;
}

function buildSourceTargets(source, item, queries, manufacturerUrl) {
  const targets = [];
  if (manufacturerUrl) targets.push(manufacturerUrl);

  for (const query of dedupeStrings(queries).slice(0, 3)) {
    targets.push(buildTinkoSearchUrl(query));
    targets.push(buildLuisSearchUrl(query));
    targets.push(buildGarantSearchUrl(query));
    targets.push(buildGanimedSearchUrl(query));
    if (query.length >= 3) {
      targets.push(buildLuisApiRequest(query));
    }
  }

  if (source?.website && item?.sourcePath) {
    targets.push(`${trimSlash(source.website)}${item.sourcePath}`);
  }

  return dedupeSourceTargets(targets).slice(0, 14);
}

function extractSourceUrl(target) {
  if (!target) return "";
  if (typeof target === "string") return target;
  if (typeof target === "object") return String(target.url || "");
  return "";
}

function toSourceHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function buildPriceRequests(systemType, vendorName) {
  const source = getManufacturerSource(systemType, vendorName);
  const equipment = getCriticalEquipment(systemType);

  return equipment.map((item) => {
    const searchQueries = buildSearchQueries(vendorName, item);
    const searchQuery = searchQueries[0] || `${vendorName} ${item.searchTerm || item.label}`.trim();
    const manufacturerUrl = buildManufacturerUrl(source, item, searchQuery);
    const sourceUrls = buildSourceTargets(source, item, searchQueries, manufacturerUrl);

    return {
      key: `${systemType}:${vendorName}:${item.key}`,
      equipmentKey: item.key,
      equipmentLabel: item.label,
      sourceUrls,
      fallbackPrice: item.fallbackUnitPrice || null,
      influenceWeight: item.influenceWeight,
      searchQuery,
      unit: item.unit || "шт",
      kind: item.kind || "equipment",
    };
  });
}

function buildApiEndpoints() {
  const fromEnv =
    typeof import.meta !== "undefined" && import.meta?.env ? import.meta.env.VITE_PRICE_API_URL : undefined;
  const endpoints = ["/api/vendor-prices", "/vendor-prices", fromEnv];

  if (typeof window !== "undefined" && /localhost|127\.0\.0\.1/i.test(window.location.hostname)) {
    endpoints.push("https://spider0.vercel.app/api/vendor-prices");
  }

  return [...new Set(endpoints.filter(Boolean))];
}

async function requestPriceApi(payload) {
  const endpoints = buildApiEndpoints();
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return await response.json();
      }

      lastError = new Error(`Price API error: ${response.status} (${endpoint})`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Price API error: all endpoints failed");
}

function normalizeFetchedByUnit(request, fetched, fallback) {
  const unit = String(request?.unit || "").trim().toLowerCase();
  const label = `${request?.equipmentLabel || ""} ${request?.equipmentKey || ""}`.toLowerCase();
  const isLinearOrWeight = ["м", "м2", "кг", "л"].includes(unit);
  const isMaterialLike = /material|кабел|труб|короб|лоток|дюбел|саморез|хомут|пена/iu.test(label) || request?.kind === "material";

  if (!isMaterialLike || !isLinearOrWeight || !Number.isFinite(fallback) || fallback <= 0) {
    return fetched;
  }

  const divisors = [1, 2, 5, 10, 20, 25, 50, 100, 200, 300, 500, 1000];
  let best = fetched;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const divisor of divisors) {
    const candidate = fetched / divisor;
    const ratio = candidate / fallback;
    if (ratio < 0.1 || ratio > 25) continue;
    const distance = Math.abs(Math.log(Math.max(ratio, 0.00001)));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

export async function fetchPricesByRequests(requests = []) {
  const payload = await requestPriceApi({ requests });
  const resultsByKey = new Map((payload.results || []).map((entry) => [entry.key, entry]));

  const sanitizePrice = (request, result) => {
    const fallback = Number(request?.fallbackPrice);
    const fetchedRaw = Number(result?.price);
    const fetched = normalizeFetchedByUnit(request, fetchedRaw, fallback);
    if (!Number.isFinite(fetched) || fetched <= 0) {
      return {
        price: Number.isFinite(fallback) ? fallback : null,
        status: "fallback",
        reason: result?.reason || "price_not_found",
        sourceCount: 0,
      };
    }

    if (!Number.isFinite(fallback) || fallback <= 0) {
      return {
        price: fetched,
        status: result?.status || "fetched",
        reason: result?.reason || null,
        sourceCount: result?.sourceCount || 0,
      };
    }

    const label = `${request?.equipmentLabel || ""} ${request?.equipmentKey || ""}`.toLowerCase();
    const isMaterialLike = /material|кабел|труб|короб|лоток|дюбел|саморез|хомут|пена/iu.test(label) || request?.kind === "material";
    const unit = String(request?.unit || "").trim().toLowerCase();
    const isLinearOrWeight = ["м", "м2", "кг", "л"].includes(unit);
    const minRatio = isMaterialLike ? (isLinearOrWeight ? 0.1 : 0.08) : 0.2;
    const maxRatio = isMaterialLike ? (isLinearOrWeight ? 20 : 14) : 12;
    const minAllowed = fallback * minRatio;
    const maxAllowed = fallback * maxRatio;

    if (fetched < minAllowed || fetched > maxAllowed) {
      return {
        price: fallback,
        status: "fallback_outlier",
        reason: "outlier_filtered",
        sourceCount: result?.sourceCount || 0,
      };
    }

    return {
      price: fetched,
      status: result?.status || "fetched",
      reason: result?.reason || null,
      sourceCount: result?.sourceCount || 0,
    };
  };

  return {
    fetchedAt: payload.fetchedAt,
    entries: requests.map((request) => {
      const result = resultsByKey.get(request.key) || {};
      const sanitized = sanitizePrice(request, result);
      const unitHints = Array.isArray(result.unitHints) ? result.unitHints : [];
      const checkedSourceUrls = (request.sourceUrls || []).map(extractSourceUrl).filter(Boolean);
      const checkedSourceHosts = [...new Set(checkedSourceUrls.map(toSourceHost).filter(Boolean))];
      const usedSourceHosts = [...new Set((result.usedSources || []).map(toSourceHost).filter(Boolean))];
      return {
        ...request,
        price: sanitized.price,
        status: sanitized.status,
        reason: sanitized.reason,
        sourceCount: sanitized.sourceCount,
        checkedSources: result.checkedSources || request.sourceUrls?.length || 0,
        checkedSourceUrls,
        checkedSourceHosts,
        usedSources: result.usedSources || [],
        usedSourceHosts,
        unitHints,
      };
    }),
  };
}

export async function fetchVendorPrices(systemType, vendorName) {
  const requests = buildPriceRequests(systemType, vendorName);
  return fetchPricesByRequests(requests);
}
