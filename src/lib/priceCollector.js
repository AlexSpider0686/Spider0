import { getCriticalEquipment } from "../config/equipmentCatalog";
import { getManufacturerSource } from "../config/vendorsConfig";

function buildTinkoSearchUrl(query) {
  return `https://www.tinko.ru/search/?q=${encodeURIComponent(query)}`;
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

export function buildPriceRequests(systemType, vendorName) {
  const source = getManufacturerSource(systemType, vendorName);
  const equipment = getCriticalEquipment(systemType);

  return equipment.map((item) => {
    const searchQuery = `${vendorName} ${item.searchTerm || item.label}`.trim();
    const manufacturerUrl = buildManufacturerUrl(source, item, searchQuery);
    const sourceUrls = [manufacturerUrl, buildTinkoSearchUrl(searchQuery)].filter(Boolean);

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
      return {
        ...request,
        price: sanitized.price,
        status: sanitized.status,
        reason: sanitized.reason,
        sourceCount: sanitized.sourceCount,
        checkedSources: result.checkedSources || request.sourceUrls?.length || 0,
        usedSources: result.usedSources || [],
      };
    }),
  };
}

export async function fetchVendorPrices(systemType, vendorName) {
  const requests = buildPriceRequests(systemType, vendorName);
  return fetchPricesByRequests(requests);
}
