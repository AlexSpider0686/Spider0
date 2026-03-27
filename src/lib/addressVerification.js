import { RF_SUBJECTS } from "../config/regionsConfig";

function sanitizeAddress(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim();
}

function sanitizeObjectName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
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

function tokenize(value) {
  return normalizeName(value)
    .split(/[^a-zа-я0-9]+/i)
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function scoreNamedImageCandidate(page, objectName, addressCandidate) {
  const nameTokens = tokenize(objectName);
  if (!nameTokens.length) return 0;

  const title = normalizeName(page?.title || "");
  const description = normalizeName(page?.description || "");
  const haystack = `${title} ${description}`.trim();
  if (!haystack) return 0;

  const matchedNameTokens = nameTokens.filter((token) => haystack.includes(token));
  if (!matchedNameTokens.length) return 0;

  let score = matchedNameTokens.length / nameTokens.length;

  const localityTokens = tokenize(
    `${addressCandidate?.address?.city || addressCandidate?.address?.town || ""} ${addressCandidate?.address?.road || ""} ${
      addressCandidate?.address?.house_number || ""
    }`
  );
  const matchedLocality = localityTokens.filter((token) => haystack.includes(token));
  score += Math.min(matchedLocality.length * 0.12, 0.36);

  const coords = page?.coordinates?.[0];
  if (coords?.lat && coords?.lon) {
    const km = distanceKm(Number(addressCandidate.lat), Number(addressCandidate.lon), Number(coords.lat), Number(coords.lon));
    if (km <= 0.6) score += 0.45;
    else if (km <= 1.5) score += 0.25;
    else if (km <= 3) score += 0.1;
    else score -= 0.35;
  }

  if (title.includes(normalizeName(objectName))) score += 0.35;

  return score;
}

async function searchNamedObjectPhoto(addressCandidate, objectName) {
  const normalizedObjectName = sanitizeObjectName(objectName);
  if (!normalizedObjectName) return null;

  const city = addressCandidate?.address?.city || addressCandidate?.address?.town || addressCandidate?.address?.village || "";
  const road = addressCandidate?.address?.road || "";
  const houseNumber = addressCandidate?.address?.house_number || "";
  const searchQueries = [
    `${normalizedObjectName} ${city}`.trim(),
    `${normalizedObjectName} ${road} ${houseNumber}`.trim(),
    `${normalizedObjectName} ${addressCandidate?.address?.state || ""}`.trim(),
  ].filter(Boolean);

  for (const searchQuery of searchQueries) {
    const query = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: searchQuery,
      gsrlimit: "8",
      prop: "pageimages|description|coordinates",
      piprop: "thumbnail",
      pithumbsize: "900",
      format: "json",
      origin: "*",
    });

    for (const endpoint of ["https://ru.wikipedia.org/w/api.php", "https://commons.wikimedia.org/w/api.php"]) {
      try {
        const payload = await fetchJson(`${endpoint}?${query.toString()}`, "Не удалось подобрать изображение объекта.");
        const pages = Object.values(payload?.query?.pages || {}).filter((page) => page?.thumbnail?.source);
        const bestPage = [...pages]
          .map((page) => ({ page, score: scoreNamedImageCandidate(page, normalizedObjectName, addressCandidate) }))
          .sort((left, right) => right.score - left.score)[0];

        if (bestPage?.score >= 1.05) {
          return {
            imageUrl: bestPage.page.thumbnail.source,
            title: bestPage.page.title || normalizedObjectName,
            source: endpoint.includes("commons") ? "Wikimedia Commons" : "Wikipedia",
            isMapFallback: false,
            confidence: bestPage.score,
          };
        }
      } catch {
        // Continue to next source.
      }
    }
  }

  return null;
}

async function resolveNearbyPhoto(lat, lon, addressCandidate, objectName) {
  const namedPhoto = await searchNamedObjectPhoto(addressCandidate, objectName);
  if (namedPhoto) return namedPhoto;

  return {
    imageUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=17&size=720x420&markers=${lat},${lon},red-pushpin`,
    title: "Карта проверенного адреса",
    source: "OpenStreetMap",
    isMapFallback: true,
  };
}

export async function verifyObjectAddress(addressLine, objectName = "") {
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

  const latitude = Number(bestResult.lat);
  const longitude = Number(bestResult.lon);
  const district = buildDistrictLabel(bestResult.address);
  const matchedRegion = findRegionByStateName(bestResult.address?.state);
  const preview = await resolveNearbyPhoto(latitude, longitude, bestResult, objectName);

  return {
    query: normalizedQuery,
    objectName: sanitizeObjectName(objectName),
    verifiedLabel: buildVerifiedLabel(bestResult),
    displayName: bestResult.display_name || normalizedQuery,
    latitude,
    longitude,
    district,
    regionName: matchedRegion?.name || bestResult.address?.state || "",
    regionCoef: matchedRegion?.coef || null,
    confidence: scoreAddressResult(bestResult),
    preview,
  };
}
