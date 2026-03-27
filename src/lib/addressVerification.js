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

function tokenizeAddress(value) {
  return normalizeName(value)
    .split(/[^a-zа-я0-9]+/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
}

function isStrictPhotoMatch(page, addressCandidate) {
  const road = normalizeName(addressCandidate?.address?.road || "");
  const houseNumber = normalizeName(addressCandidate?.address?.house_number || "");
  const city = normalizeName(addressCandidate?.address?.city || addressCandidate?.address?.town || addressCandidate?.address?.village || "");
  const title = normalizeName(page?.title || "");
  const description = normalizeName(page?.description || "");
  const haystack = `${title} ${description}`.trim();

  if (!haystack) return false;

  const hasRoad = road && haystack.includes(road);
  const hasHouse = houseNumber && haystack.includes(houseNumber);
  const hasCity = city && haystack.includes(city);

  if (hasRoad && hasHouse) return true;
  if (hasRoad && hasCity && houseNumber && title.includes(houseNumber)) return true;

  const addressTokens = tokenizeAddress(buildVerifiedLabel(addressCandidate)).slice(0, 5);
  const matchedTokens = addressTokens.filter((token) => haystack.includes(token));
  return matchedTokens.length >= 3;
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

async function resolveNearbyPhoto(lat, lon, addressCandidate) {
  const radius = 1200;
  const limit = 10;
  const query = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${lat}|${lon}`,
    ggsradius: String(radius),
    ggslimit: String(limit),
    prop: "pageimages|description|coordinates",
    piprop: "thumbnail",
    pithumbsize: "900",
    format: "json",
    origin: "*",
  });

  const endpoints = [
    `https://ru.wikipedia.org/w/api.php?${query.toString()}`,
    `https://commons.wikimedia.org/w/api.php?${query.toString()}`,
  ];

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(endpoint, "Не удалось получить визуальное подтверждение адреса.");
      const pages = Object.values(payload?.query?.pages || {});
      const withThumbnail = pages.find((page) => page?.thumbnail?.source && isStrictPhotoMatch(page, addressCandidate));
      if (withThumbnail) {
        return {
          imageUrl: withThumbnail.thumbnail.source,
          title: withThumbnail.title || "Фото рядом с адресом",
          source: endpoint.includes("commons") ? "Wikimedia Commons" : "Wikipedia",
        };
      }
    } catch {
      // Continue to next endpoint.
    }
  }

  return {
    imageUrl: `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=17&size=720x420&markers=${lat},${lon},red-pushpin`,
    title: "Карта проверенного адреса",
    source: "OpenStreetMap",
    isMapFallback: true,
  };
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

  const latitude = Number(bestResult.lat);
  const longitude = Number(bestResult.lon);
  const district = buildDistrictLabel(bestResult.address);
  const matchedRegion = findRegionByStateName(bestResult.address?.state);
  const preview = await resolveNearbyPhoto(latitude, longitude, bestResult);

  return {
    query: normalizedQuery,
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
