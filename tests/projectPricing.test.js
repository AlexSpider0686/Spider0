import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BUDGET, DEFAULT_SYSTEM, DEFAULT_ZONE } from "../src/config/estimateConfig.js";
import { buildProjectPriceRequests } from "../src/lib/priceCollector.js";
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
