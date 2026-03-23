import { getCriticalEquipment } from "../config/equipmentCatalog";
import { getManufacturerSource } from "../config/vendorsConfig";

export function buildPriceRequests(systemType, vendorName) {
  const source = getManufacturerSource(systemType, vendorName);
  const equipment = getCriticalEquipment(systemType);

  return equipment.map((item) => ({
    key: `${systemType}:${vendorName}:${item.key}`,
    equipmentKey: item.key,
    equipmentLabel: item.label,
    sourceUrl: source.website ? `${source.website}${item.sourcePath || ""}` : "",
    fallbackPrice: item.fallbackUnitPrice || null,
    influenceWeight: item.influenceWeight,
  }));
}

export async function fetchVendorPrices(systemType, vendorName) {
  const requests = buildPriceRequests(systemType, vendorName);
  const response = await fetch("/api/vendor-prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });

  if (!response.ok) {
    throw new Error(`Price API error: ${response.status}`);
  }

  const payload = await response.json();
  const resultsByKey = new Map((payload.results || []).map((entry) => [entry.key, entry]));

  return {
    fetchedAt: payload.fetchedAt,
    entries: requests.map((request) => {
      const result = resultsByKey.get(request.key) || {};
      return {
        ...request,
        price: result.price ?? request.fallbackPrice,
        status: result.status || "fallback",
        reason: result.reason || null,
      };
    }),
  };
}
