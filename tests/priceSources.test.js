import test from "node:test";
import assert from "node:assert/strict";
import { MANUFACTURER_SOURCES, getVendorNames, getManufacturerSource } from "../src/config/vendorsConfig.js";
import { buildPriceRequests } from "../src/lib/priceCollector.js";
import { buildApsProjectPriceRequests, inferApsProjectVendor } from "../src/lib/apsProjectEstimate.js";

function toHost(url) {
  try {
    return new URL(String(url || "")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function collectRequestHosts(sourceUrls = []) {
  return sourceUrls
    .map((item) => (typeof item === "string" ? item : item?.url))
    .filter(Boolean)
    .map((url) => toHost(url))
    .filter(Boolean);
}

test("standard pricing keeps manufacturer hosts in request lists for all configured vendors", () => {
  const systemTypes = Object.keys(MANUFACTURER_SOURCES);

  for (const systemType of systemTypes) {
    for (const vendorName of getVendorNames(systemType)) {
      const source = getManufacturerSource(systemType, vendorName);
      const manufacturerHost = toHost(source.website);
      if (!manufacturerHost) continue;

      const requests = buildPriceRequests(systemType, vendorName);
      assert.ok(requests.length > 0, `${systemType}/${vendorName}: no price requests generated`);

      for (const request of requests) {
        const hosts = collectRequestHosts(request.sourceUrls);
        assert.ok(
          hosts.includes(manufacturerHost),
          `${systemType}/${vendorName}: manufacturer host ${manufacturerHost} missing in request ${request.key}`
        );
      }

      if (source.preferSearch) {
        const firstHosts = collectRequestHosts(requests[0]?.sourceUrls || []);
        assert.equal(
          firstHosts[0],
          manufacturerHost,
          `${systemType}/${vendorName}: preferred manufacturer host ${manufacturerHost} is not prioritized`
        );
      }
    }
  }
});

test("APS PDF pricing keeps manufacturer hosts in request lists for all APS vendors", () => {
  for (const vendorName of getVendorNames("aps")) {
    const source = getManufacturerSource("aps", vendorName);
    const manufacturerHost = toHost(source.website);
    if (!manufacturerHost) continue;

    const requests = buildApsProjectPriceRequests(
      [
        {
          id: `aps-${vendorName}`,
          position: "1.1",
          name: "Контрольный прибор",
          model: "TEST-123",
          rawLine: `Позиция ${vendorName} TEST-123`,
          mark: vendorName,
          brand: vendorName,
          qty: 1,
          unit: "шт",
          kind: "equipment",
          category: "panel",
        },
      ],
      vendorName
    );

    assert.equal(requests.length, 1, `aps/${vendorName}: unexpected request count`);

    const hosts = collectRequestHosts(requests[0].sourceUrls);
    assert.ok(hosts.includes(manufacturerHost), `aps/${vendorName}: manufacturer host ${manufacturerHost} missing`);

    if (source.preferSearch) {
      assert.equal(
        hosts[0],
        manufacturerHost,
        `aps/${vendorName}: preferred manufacturer host ${manufacturerHost} is not prioritized`
      );
    }
  }
});

test("APS PDF vendor inference can resolve the preferred vendor before repricing", () => {
  const inferred = inferApsProjectVendor(
    [
      {
        id: "aps-bolid-1",
        name: "Прибор приемно-контрольный",
        model: "С2000-М",
        rawLine: "Болид С2000-М",
        mark: "Болид",
        brand: "Болид",
      },
      {
        id: "aps-bolid-2",
        name: "Пульт контроля",
        model: "С2000М",
        rawLine: "Bolid С2000М",
        mark: "Bolid",
        brand: "Bolid",
      },
    ],
    "Базовый"
  );

  assert.equal(inferred, "Болид");
});
