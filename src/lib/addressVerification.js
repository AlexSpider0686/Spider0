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
    .replace(/\s+/g, " ")
    .trim();
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

function scoreAddressResult(item) {
  const address = item?.address || {};
  let score = Number(item?.importance || 0);
  if (address.house_number) score += 0.35;
  if (address.road) score += 0.2;
  if (address.city || address.town || address.village) score += 0.15;
  if (address.state) score += 0.1;
  return score;
}

function pickBestAddressResult(results = []) {
  return [...results].sort((left, right) => scoreAddressResult(right) - scoreAddressResult(left))[0] || null;
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
    item?.address?.road && item?.address?.house_number
      ? `${item.address.road}, ${item.address.house_number}`
      : item?.address?.road || "",
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

export async function verifyObjectAddress(addressLine) {
  const normalizedQuery = sanitizeAddress(addressLine);
  if (!normalizedQuery) {
    throw new Error("Укажите адрес объекта.");
  }

  const primaryQuery = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
    "accept-language": "ru",
    countrycodes: "ru",
    q: normalizedQuery,
  });

  let results = await fetchJson(
    `https://nominatim.openstreetmap.org/search?${primaryQuery.toString()}`,
    "Не удалось выполнить онлайн-поиск адреса."
  );

  if (!Array.isArray(results) || !results.length) {
    const fallbackQuery = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      "accept-language": "ru",
      q: normalizedQuery,
    });
    results = await fetchJson(
      `https://nominatim.openstreetmap.org/search?${fallbackQuery.toString()}`,
      "Не удалось выполнить онлайн-поиск адреса."
    );
  }

  const bestResult = pickBestAddressResult(results);
  if (!bestResult) {
    throw new Error("Адрес не найден. Уточните дом, улицу или населённый пункт.");
  }

  const matchedRegion = findRegionByStateName(bestResult.address?.state);

  return {
    query: normalizedQuery,
    verifiedLabel: buildVerifiedLabel(bestResult),
    displayName: bestResult.display_name || normalizedQuery,
    district: buildDistrictLabel(bestResult.address),
    regionName: matchedRegion?.name || bestResult.address?.state || "",
    regionCoef: matchedRegion?.coef || null,
    confidence: scoreAddressResult(bestResult),
  };
}
