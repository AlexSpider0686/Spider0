import { getCriticalEquipment } from "../config/equipmentCatalog";
import { getManufacturerSource } from "../config/vendorsConfig";
import { repairUtf8Cp1251Mojibake } from "./textEncoding";

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
  return repairUtf8Cp1251Mojibake(String(value || ""))
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
  ]).slice(0, 2);
}

function trimSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function applySearchTemplate(baseUrl, template, query) {
  if (!baseUrl || !template) return "";
  return `${trimSlash(baseUrl)}${String(template).replace("{query}", encodeURIComponent(query))}`;
}

function buildManufacturerSearchTargets(source, item, searchQuery) {
  const website = trimSlash(source?.website);
  const searchWebsite = trimSlash(source?.searchWebsite || source?.website);
  if (!website && !searchWebsite) return [];

  const searchTemplates = dedupeStrings([
    ...(Array.isArray(source?.searchPathTemplates) ? source.searchPathTemplates : []),
    source?.searchPathTemplate || "",
  ]);

  const directPageUrls = dedupeStrings([
    item?.sourcePath ? `${website}${item.sourcePath}` : "",
    item?.sourcePath && searchWebsite && searchWebsite !== website ? `${searchWebsite}${item.sourcePath}` : "",
  ]);

  const searchUrls = [];
  if (searchWebsite) {
    for (const template of searchTemplates) {
      const candidate = applySearchTemplate(searchWebsite, template, searchQuery);
      if (candidate) searchUrls.push(candidate);
    }
  }

  const encoded = encodeURIComponent(searchQuery);
  const genericSearchUrls = searchWebsite
    ? [
        `${searchWebsite}/search/?q=${encoded}`,
        `${searchWebsite}/search?q=${encoded}`,
        `${searchWebsite}/?s=${encoded}`,
      ]
    : [];

  return dedupeStrings([
    ...(source?.preferSearch ? searchUrls : []),
    ...directPageUrls,
    ...searchUrls,
    ...genericSearchUrls,
    website || "",
  ]);
}

function buildSourceTargets(source, item, queries, manufacturerUrls) {
  const targets = [];
  for (const manufacturerUrl of (manufacturerUrls || []).slice(0, 5)) {
    if (manufacturerUrl) targets.push(manufacturerUrl);
  }

  for (const query of dedupeStrings(queries).slice(0, 2)) {
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

  return dedupeSourceTargets(targets).slice(0, 10);
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function chunkBySize(items = [], size = 1) {
  const normalizedSize = Math.max(Number(size) || 1, 1);
  const chunks = [];
  for (let index = 0; index < items.length; index += normalizedSize) {
    chunks.push(items.slice(index, index + normalizedSize));
  }
  return chunks;
}

function buildPriceApiTimeoutMs(requestCount = 0) {
  const base = 45000;
  const requestPenalty = Math.max(requestCount - 4, 0) * 6000;
  return clamp(base + requestPenalty, 45000, 180000);
}

export function summarizePriceSnapshot(snapshot) {
  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
  const checkedHosts = [...new Set(entries.flatMap((item) => item.checkedSourceHosts || []).filter(Boolean))];
  const pricedHosts = [
    ...new Set(
      entries.flatMap((item) => item.matchedSourceHosts || item.usedSourceHosts || []).filter(Boolean)
    ),
  ];
  const pricedEntries = entries.filter((item) => Number(item?.sourceCount || 0) > 0);
  const recheckRequiredCount = entries.filter((item) => item?.recheckRequired).length;
  const avgEntryConfidence = entries.length
    ? entries.reduce((sum, item) => sum + Number(item?.priceConfidence || 0), 0) / entries.length
    : 0;
  const avgPricedConfidence = pricedEntries.length
    ? pricedEntries.reduce((sum, item) => sum + Number(item?.priceConfidence || 0), 0) / pricedEntries.length
    : 0;
  const pricedCoverage = entries.length ? pricedEntries.length / entries.length : 0;
  const hostCoverage = checkedHosts.length ? pricedHosts.length / checkedHosts.length : 0;
  const recheckPenalty = pricedEntries.length ? recheckRequiredCount / pricedEntries.length : entries.length ? 1 : 0;
  const confidenceBase = avgPricedConfidence || avgEntryConfidence || 0;
  const confidencePercent = clamp(confidenceBase * 0.55 + pricedCoverage * 0.3 + hostCoverage * 0.15 - recheckPenalty * 0.2, 0, 0.98);

  return {
    checkedSourceCount: checkedHosts.length,
    pricedSourceCount: pricedHosts.length,
    checkedSourceHosts: checkedHosts,
    pricedSourceHosts: pricedHosts,
    recheckRequiredCount,
    avgEntryConfidence,
    avgPricedConfidence,
    pricedEntryCount: pricedEntries.length,
    totalEntryCount: entries.length,
    confidencePercent: Number(confidencePercent.toFixed(2)),
  };
}

export function buildPriceRequests(systemType, vendorName) {
  const source = getManufacturerSource(systemType, vendorName);
  const equipment = getCriticalEquipment(systemType);

  return equipment.map((item) => {
    const searchQueries = buildSearchQueries(vendorName, item);
    const searchQuery = searchQueries[0] || `${vendorName} ${item.searchTerm || item.label}`.trim();
    const manufacturerUrls = buildManufacturerSearchTargets(source, item, searchQuery);
    const sourceUrls = buildSourceTargets(source, item, searchQueries, manufacturerUrls);

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
  const endpoints = [fromEnv, isBrowser ? "/api/vendor-prices" : ""];

  if (isBrowser) {
    const currentHost = String(window.location.hostname || "").toLowerCase();
    if (currentHost !== "spider0.vercel.app") {
      endpoints.push("https://spider0.vercel.app/api/vendor-prices");
    }
  }

  return [...new Set(endpoints.map((item) => String(item || "").trim()).filter(Boolean))];
}

function createTimeoutError(timeoutMs) {
  const error = new Error(`Price API timeout after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const externalSignal = options?.signal;
  let timeoutError = null;
  const abortFromExternalSignal = () => {
    try {
      controller.abort(externalSignal?.reason);
    } catch {
      controller.abort();
    }
  };
  const timeoutId = setTimeout(() => {
    timeoutError = createTimeoutError(timeoutMs);
    controller.abort(timeoutError);
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
    }
  }

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (timeoutError && error?.name === "AbortError") {
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  }
}

async function requestPriceApi(payload, options = {}) {
  const endpoints = buildApiEndpoints();
  const errors = [];
  const requestCount = Array.isArray(payload?.requests) ? payload.requests.length : 0;
  const timeoutMs = Number(options?.timeoutMs) || buildPriceApiTimeoutMs(requestCount);

  for (const endpoint of endpoints) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: options.signal,
      }, timeoutMs);

      if (response.ok) {
        return await response.json();
      }

      errors.push(`HTTP ${response.status} @ ${endpoint}`);
    } catch (error) {
      errors.push(`${endpoint}: ${error?.message || "unknown error"}`);
    }
  }

  throw new Error(`Price API error: all endpoints failed. ${errors.join("; ")}`);
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

export async function fetchPricesByRequests(requests = [], options = {}) {
  const totalRequests = Array.isArray(requests) ? requests.length : 0;
  const batchSize =
    Number(options?.batchSize) > 0
      ? Number(options.batchSize)
      : totalRequests > 12
        ? 4
        : totalRequests > 6
          ? 5
          : totalRequests || 1;
  const batches = chunkBySize(requests, batchSize);
  const resultRows = [];
  let fetchedAt = new Date().toISOString();

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const payload = await requestPriceApi(
      { requests: batch },
      {
        ...options,
        timeoutMs: Number(options?.timeoutMs) || buildPriceApiTimeoutMs(batch.length),
      }
    );
    fetchedAt = payload?.fetchedAt || fetchedAt;
    resultRows.push(...(payload?.results || []));
    if (typeof options?.onProgress === "function") {
      options.onProgress({
        completedBatches: index + 1,
        totalBatches: batches.length,
        completedRequests: Math.min((index + 1) * batchSize, totalRequests),
        totalRequests,
      });
    }
  }

  const payload = { fetchedAt, results: resultRows };
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
        if ((fetched > fallback * 1.9 || fetched < fallback * 0.55) && !fromManufacturerSource) {
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
    const confidence = Math.max(Number(result?.priceConfidence || 0), 0);
    const weakEvidence = Boolean(result?.recheckRequired) || Number(result?.sourceCount || 0) < 2 || confidence < 0.58;
    const minRatio = isMaterialLike ? (isLinearOrWeight ? 0.42 : 0.35) : weakEvidence ? 0.62 : 0.5;
    const maxRatio = isMaterialLike ? (isLinearOrWeight ? 2.8 : 2.4) : fromManufacturerSource ? 2.25 : weakEvidence ? 1.45 : 1.8;
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

    if (weakEvidence && Math.abs(fetched / fallback - 1) > 0.28 && !fromManufacturerSource) {
      return {
        price: fallback,
        status: "fallback_low_confidence",
        reason: "low_confidence_variation",
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
      const matchedSources = Array.isArray(result.matchedSources) ? result.matchedSources.filter(Boolean) : [];
      const matchedSourceHosts = [
        ...new Set((Array.isArray(result.matchedSourceHosts) ? result.matchedSourceHosts : matchedSources.map(toSourceHost)).filter(Boolean)),
      ];
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
        matchedSources,
        matchedSourceHosts,
        unitHints,
      };
    }),
  };
}

export async function fetchVendorPrices(systemType, vendorName, options = {}) {
  const requests = buildPriceRequests(systemType, vendorName);
  const isAlarmSystem = systemType === "sots" || systemType === "aps" || systemType === "soue";
  const snapshot = await fetchPricesByRequests(requests, {
    ...options,
    timeoutMs: Number(options?.timeoutMs) || (isAlarmSystem ? 120000 : 90000),
    batchSize: Number(options?.batchSize) || Math.min(requests.length || 1, isAlarmSystem ? 2 : 3),
  });
  return {
    ...snapshot,
    systemType,
    vendorName,
  };
}
