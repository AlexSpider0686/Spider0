function normalizeMatchKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function toSourceHost(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

export function isGenericSourceUrl(url) {
  const value = String(url || "").trim();
  if (!value) return true;
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    const query = parsed.search.toLowerCase();
    if (pathname === "/" || pathname === "") return true;
    if (pathname.includes("/search") || pathname.includes("/catalog") || pathname.includes("/products/")) {
      if (query.includes("q=") || query.includes("s=") || pathname.endsWith("/catalog") || pathname.endsWith("/products")) return true;
    }
    if (query.includes("q=") || query.includes("s=") || query.includes("search=")) return true;
    return false;
  } catch {
    return /search|catalog/i.test(value);
  }
}

function scoreSourceUrl(url, manufacturerHosts = []) {
  const host = toSourceHost(url);
  const manufacturerMatch = manufacturerHosts.includes(host);
  const generic = isGenericSourceUrl(url);
  return (manufacturerMatch ? 100 : 0) + (generic ? 0 : 10) + Math.min(String(url || "").length / 50, 5);
}

export function pickBestSourceUrl(candidateUrls = [], manufacturerHosts = []) {
  const unique = [...new Set((candidateUrls || []).map((item) => String(item || "").trim()).filter(Boolean))];
  const exactFirst = unique
    .map((url) => ({ url, score: scoreSourceUrl(url, manufacturerHosts) }))
    .sort((left, right) => right.score - left.score);
  const best = exactFirst.find((item) => !isGenericSourceUrl(item.url)) || exactFirst[0];
  return best?.url || "";
}

export function buildSourceLinkIndex(result, manufacturerHosts = []) {
  const entries = Array.isArray(result?.equipmentData?.marketEntries) ? result.equipmentData.marketEntries : [];
  const index = new Map();

  entries.forEach((entry) => {
    const sourceLink = pickBestSourceUrl(
      [...(entry?.matchedSources || []), ...(entry?.usedSources || []), entry?.sourceUrl],
      manufacturerHosts
    );
    if (!sourceLink) return;
    [entry?.equipmentLabel, entry?.equipmentKey, entry?.projectModel, entry?.projectName, entry?.modelToken]
      .filter(Boolean)
      .forEach((rawKey) => {
        const key = normalizeMatchKey(rawKey);
        if (key && !index.has(key)) {
          index.set(key, sourceLink);
        }
      });
  });

  return index;
}

export function resolvePreferredEquipmentSourceLink(item, result, manufacturerHosts = []) {
  const ownLink = pickBestSourceUrl([...(item?.matchedSources || []), ...(item?.usedSources || []), item?.sourceUrl], manufacturerHosts);
  const linkIndex = buildSourceLinkIndex(result, manufacturerHosts);
  const indexedLink =
    [item?.name, item?.label, item?.model, item?.code]
      .map(normalizeMatchKey)
      .filter(Boolean)
      .map((key) => linkIndex.get(key) || "")
      .find(Boolean) || "";

  return pickBestSourceUrl([indexedLink, ownLink], manufacturerHosts);
}
