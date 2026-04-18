import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE } from "../src/config/estimateConfig.js";
import { buildProjectPriceRequests, fetchPricesByRequests } from "../src/lib/priceCollector.js";
import { calculateSystemWithBreakdown } from "../src/lib/systemCalculators/index.js";

test("project price requests use exact Bastion product pages for SKUD models", () => {
  const requests = buildProjectPriceRequests(
    { id: "skud-1", type: "skud", vendor: "Bastion" },
    {
      equipmentData: {
        details: [
          {
            code: "CTRL",
            name: "Контроллер доступа (2 точки)",
            model: "SKAT AC 02NET PACS",
            unitPrice: 6000,
            unit: "шт",
            isKey: true,
          },
        ],
      },
    }
  );

  assert.equal(requests.length, 1);
  const urls = requests[0].sourceUrls.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean);
  assert.ok(urls.some((url) => String(url).includes("/products/8885")), "exact Bastion product page is missing");
  assert.ok(urls.some((url) => String(url).includes("bast.ru")), "manufacturer host is missing");
});

test("project price requests keep exact Bastion product pages for multiplied model labels", () => {
  const requests = buildProjectPriceRequests(
    { id: "skud-1", type: "skud", vendor: "Bastion" },
    {
      equipmentData: {
        details: [
          {
            code: "CTRL",
            name: "Контроллер доступа",
            model: "2x SKAT AC 02NET PACS",
            unitPrice: 6000,
            unit: "шт",
            isKey: true,
          },
        ],
      },
    }
  );

  assert.equal(requests.length, 1);
  const urls = requests[0].sourceUrls.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean);
  assert.ok(urls.some((url) => String(url).includes("/products/8885")), "exact Bastion product page is missing for multiplied model");
});

test("APS Bolid requests use exact product pages for verified detector models", () => {
  const requests = buildProjectPriceRequests(
    { id: "aps-1", type: "aps", vendor: "Болид" },
    {
      equipmentData: {
        details: [
          {
            code: "DET",
            name: "Пожарный извещатель",
            model: "ДИП-34А-03",
            unitPrice: 1521,
            unit: "шт",
            isKey: true,
          },
        ],
      },
    }
  );

  assert.equal(requests.length, 1);
  const urls = requests[0].sourceUrls.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean);
  assert.ok(urls.some((url) => String(url).includes("tovar_711608757.html")), "exact Bolid detector page is missing");
});

test("SOUE Roxton requests use exact product pages for verified speaker models", () => {
  const requests = buildProjectPriceRequests(
    { id: "soue-1", type: "soue", vendor: "Roxton" },
    {
      equipmentData: {
        details: [
          {
            code: "SPK",
            name: "Оповещатель СОУЭ",
            model: "PA-620T",
            unitPrice: 3170,
            unit: "шт",
            isKey: true,
          },
        ],
      },
    }
  );

  assert.equal(requests.length, 1);
  const urls = requests[0].sourceUrls.map((item) => (typeof item === "string" ? item : item?.url)).filter(Boolean);
  assert.ok(urls.some((url) => String(url).includes("/katalog/gromkogovoriteli/potolochnye/pa-620t")), "exact Roxton speaker page is missing");
});

test("Bastion SKUD stays in workstation mode for a moderate object", () => {
  const system = {
    ...DEFAULT_SYSTEM(1, "skud"),
    vendor: "Bastion",
    baseVendor: "Bastion",
    selectedEquipmentParams: {
      controllerChannels: 2,
    },
  };
  const zones = [
    DEFAULT_ZONE(1, "Офисы", "office", 4200, 4),
    DEFAULT_ZONE(2, "Лобби", "lobby", 600, 1),
  ];
  const objectData = {
    regionName: "Москва",
    regionCoef: 1,
    objectType: "public",
    buildingStatus: "operational",
    totalArea: 4800,
    floors: 4,
    basementFloors: 0,
  };

  const result = calculateSystemWithBreakdown(system, zones, DEFAULT_BUDGET, objectData);
  const serverRows = (result?.equipmentData?.details || []).filter((item) => item.code === "SRV");

  assert.equal(serverRows.length, 0);
  assert.ok((result?.equipmentData?.details || []).some((item) => item.code === "CTRL" && item.model === "SKAT AC 02NET PACS"));
});

test("price collector preserves API warning while returning fallback-capable results", async () => {
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  global.window = {};
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        fetchedAt: "2026-04-18T00:00:00.000Z",
        warning: "upstream_vendor_timeout",
        results: [
          {
            key: "test-request",
            price: 1234,
            status: "fallback",
            reason: "price_collection_error",
            sourceCount: 0,
            checkedSources: 1,
            usedSources: [],
            matchedSources: [],
            matchedSourceHosts: [],
            unitHints: [],
            selectionStrategy: "fallback_error",
            modelToken: "",
            recheckRequired: false,
            priceConfidence: 0,
          },
        ],
      };
    },
  });

  try {
    const snapshot = await fetchPricesByRequests([
      {
        key: "test-request",
        equipmentKey: "panel",
        equipmentLabel: "Test panel",
        sourceUrls: ["https://example.com/search?q=test"],
        fallbackPrice: 1234,
        influenceWeight: 1,
        searchQuery: "test panel",
        unit: "шт",
        kind: "equipment",
      },
    ]);

    assert.equal(snapshot.warning, "upstream_vendor_timeout");
    assert.equal(snapshot.entries.length, 1);
    assert.equal(snapshot.entries[0].price, 1234);
  } finally {
    global.fetch = originalFetch;
    if (originalWindow === undefined) {
      delete global.window;
    } else {
      global.window = originalWindow;
    }
  }
});
