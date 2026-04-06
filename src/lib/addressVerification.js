import { RF_SUBJECTS } from "../config/regionsConfig";

function sanitizeAddress(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"]/g, "")
    .replace(/\b(ул|улица|пр-кт|проспект|д|дом|корп|корпус|стр|строение)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeAddress(value) {
  return normalizeName(value)
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function findRegionByStateName(stateName) {
  const normalizedState = normalizeName(stateName);
  if (!normalizedState) return null;

  return (
    RF_SUBJECTS.find((region) => normalizeName(region.name) === normalizedState) ||
    RF_SUBJECTS.find((region) => normalizeName(region.name).includes(normalizedState)) ||
    RF_SUBJECTS.find((region) => normalizedState.includes(normalizeName(region.name))) ||
    null
  );
}

function scoreAddressResult(item, queryTokens) {
  const address = item?.address || {};
  const resultText = [
    item?.display_name || "",
    address.road || "",
    address.house_number || "",
    address.city || address.town || address.village || "",
    address.state || "",
  ].join(" ");
  const resultTokens = new Set(tokenizeAddress(resultText));
  const overlap = queryTokens.filter((token) => resultTokens.has(token)).length;
  const overlapScore = queryTokens.length ? overlap / queryTokens.length : 0;

  let score = Number(item?.importance || 0);
  if (address.house_number) score += 0.45;
  if (address.road) score += 0.25;
  if (address.city || address.town || address.village) score += 0.18;
  if (address.state) score += 0.12;
  score += overlapScore * 0.8;

  return score;
}

function pickBestAddressResult(results = [], queryTokens = []) {
  return [...results].sort((left, right) => scoreAddressResult(right, queryTokens) - scoreAddressResult(left, queryTokens))[0] || null;
}

function buildDistrictLabel(address = {}) {
  return (
    address.city_district ||
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.borough ||
    address.county ||
    address.city ||
    address.town ||
    address.village ||
    ""
  );
}

function buildVerifiedLabel(item) {
  const parts = [
    item?.address?.road && item?.address?.house_number ? `${item.address.road}, ${item.address.house_number}` : item?.address?.road || "",
    item?.address?.suburb || item?.address?.city_district || item?.address?.neighbourhood || "",
    item?.address?.city || item?.address?.town || item?.address?.village || "",
    item?.address?.state || "",
  ].filter(Boolean);

  return parts.join(", ") || item?.display_name || "";
}

async function fetchJson(url, message) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(message);
  }

  return response.json();
}

function buildSearchVariants(normalizedQuery) {
  return [
    normalizedQuery,
    `${normalizedQuery}, Россия`,
    normalizedQuery.replace(/[«»"]/g, ""),
  ].filter(Boolean);
}

export async function verifyObjectAddress(addressLine) {
  const normalizedQuery = sanitizeAddress(addressLine);
  if (!normalizedQuery) {
    throw new Error("Укажите адрес объекта.");
  }

  const queryTokens = tokenizeAddress(normalizedQuery);
  let results = [];

  for (const query of buildSearchVariants(normalizedQuery)) {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      "accept-language": "ru",
      countrycodes: "ru",
      q: query,
    });

    const nextResults = await fetchJson(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      "Не удалось выполнить онлайн-поиск адреса."
    );

    if (Array.isArray(nextResults) && nextResults.length) {
      results = nextResults;
      break;
    }
  }

  if (!results.length) {
    throw new Error("Адрес не найден. Уточните дом, улицу или населенный пункт.");
  }

  const bestResult = pickBestAddressResult(results, queryTokens);
  if (!bestResult) {
    throw new Error("Адрес не найден. Уточните дом, улицу или населенный пункт.");
  }

  const matchedRegion = findRegionByStateName(bestResult.address?.state);
  const confidence = scoreAddressResult(bestResult, queryTokens);

  return {
    query: normalizedQuery,
    verifiedLabel: buildVerifiedLabel(bestResult),
    displayName: bestResult.display_name || normalizedQuery,
    district: buildDistrictLabel(bestResult.address),
    regionName: matchedRegion?.name || bestResult.address?.state || "",
    regionCoef: matchedRegion?.coef || null,
    lat: bestResult.lat || "",
    lon: bestResult.lon || "",
    confidence,
  };
}
