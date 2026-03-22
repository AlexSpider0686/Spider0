const PRICE_REGEX = /(?:₽|руб\.?|RUB|\$|USD|€|EUR)\s*([\d\s.,]{2,})|([\d\s.,]{2,})\s*(?:₽|руб\.?|RUB|\$|USD|€|EUR)/gi;

function normalizePrice(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractPrice(html) {
  const matches = [...html.matchAll(PRICE_REGEX)];
  for (const match of matches) {
    const value = normalizePrice(match[1] || match[2]);
    if (value) return value;
  }
  return null;
}

async function fetchPrice(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; Spider0PriceBot/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  return extractPrice(html);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { requests = [] } = req.body || {};
  if (!Array.isArray(requests)) {
    res.status(400).json({ error: "requests must be an array" });
    return;
  }

  const results = await Promise.all(
    requests.map(async (entry) => {
      const { key, sourceUrl, fallbackPrice } = entry;
      if (!sourceUrl) {
        return { key, price: fallbackPrice ?? null, status: "fallback", reason: "no_source" };
      }
      try {
        const fetchedPrice = await fetchPrice(sourceUrl);
        if (fetchedPrice) {
          return { key, price: fetchedPrice, status: "fetched" };
        }
        return { key, price: fallbackPrice ?? null, status: "fallback", reason: "price_not_found" };
      } catch (error) {
        return {
          key,
          price: fallbackPrice ?? null,
          status: "fallback",
          reason: "fetch_error",
          message: error.message,
        };
      }
    })
  );

  res.status(200).json({ results, fetchedAt: new Date().toISOString() });
};
