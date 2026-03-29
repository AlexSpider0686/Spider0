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

  if (source?.preferSearch && source?.searchPathTemplate) {
    return `${website}${source.searchPathTemplate.replace("{query}", encodeURIComponent(searchQuery))}`;
  }

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

  if (source?.website && item?.sourcePath && !source?.preferSearch) {
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
      manufacturerWebsite: source?.website || "",
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
  const isBrowser = typeof window !== "undefined";
  const endpoints = [fromEnv, isBrowser ? "/api/vendor-prices" : "", isBrowser ? "/vendor-prices" : ""];

  if (isBrowser && /localhost|127\.0\.0\.1/i.test(window.location.hostname)) {
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

function normalizeModelToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9-]/giu, "");
}

function extractArticleTokens(value) {
  return [...String(value || "").matchAll(/\d{1,4}(?:[-/.]\d{2,4}){2,}/gu)].map((match) => normalizeModelToken(match[0]));
}

function extractModelToken(request) {
  const explicit = normalizeModelToken(request?.modelToken || request?.primaryArticleToken || "");
  if (explicit.length >= 7) return explicit;

  const articleTokens = extractArticleTokens(`${request?.searchQuery || ""} ${request?.equipmentLabel || ""}`).filter(
    (token) => token.length >= 7
  );
  if (articleTokens.length) {
    return articleTokens.sort((left, right) => right.length - left.length)[0];
  }

  const sample = `${request?.searchQuery || ""} ${request?.equipmentLabel || ""}`;
  const matches = [...String(sample).matchAll(/[A-Za-zА-Яа-яЁё0-9]+(?:[-/.][A-Za-zА-Яа-яЁё0-9]+)+/gu)]
    .map((match) => normalizeModelToken(match[0]))
    .filter((token) => token.length >= 5 && /\d/u.test(token));

  if (!matches.length) return "";
  return matches.sort((left, right) => right.length - left.length)[0];
}

export async function fetchPricesByRequests(requests = []) {
  const payload = await requestPriceApi({ requests });
  const resultsByKey = new Map((payload.results || []).map((entry) => [entry.key, entry]));

  const sanitizePrice = (request, result) => {
    const strictModelToken = extractModelToken(request);
    const isStrictModelPrice = Boolean(strictModelToken);
    const fallback = Number(request?.fallbackPrice);
    const fetchedRaw = Number(result?.price);
    const fetched = normalizeFetchedByUnit(request, fetchedRaw, fallback);
    const manufacturerHost = toSourceHost(request?.manufacturerWebsite || "");
    const usedSourceHosts = [...new Set((result?.usedSources || []).map(toSourceHost).filter(Boolean))];
    const fromManufacturerSource =
      (result?.selectionStrategy || "").includes("manufacturer_source_bias") ||
      (manufacturerHost && usedSourceHosts.includes(manufacturerHost));
    if (!Number.isFinite(fetched) || fetched <= 0) {
      return {
        price: Number.isFinite(fallback) ? fallback : null,
        status: "fallback",
        reason: result?.reason || "price_not_found",
        sourceCount: 0,
      };
    }

    if (isStrictModelPrice) {
      if (Number.isFinite(fallback) && fallback > 0) {
        if ((fetched > fallback * 4 || fetched < fallback * 0.2) && !fromManufacturerSource) {
          return {
            price: fallback,
            status: "fallback",
            reason: "strict_model_outlier",
            sourceCount: result?.sourceCount || 0,
          };
        }
      }
      return {
        price: fetched,
        status: result?.status || "fetched",
        reason: result?.reason || null,
        sourceCount: result?.sourceCount || 0,
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

    if ((fetched < minAllowed || fetched > maxAllowed) && !fromManufacturerSource) {
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
        selectionStrategy: result?.selectionStrategy || "",
        modelToken: result?.modelToken || extractModelToken(request) || "",
        recheckRequired: Boolean(result?.recheckRequired),
        priceConfidence: Number(result?.priceConfidence || 0),
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
