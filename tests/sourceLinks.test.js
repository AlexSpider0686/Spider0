import test from "node:test";
import assert from "node:assert/strict";
import { resolvePreferredEquipmentSourceLink, toBrowserSourceUrl } from "../src/lib/sourceLinks.js";

test("preferred equipment source link chooses exact product page over generic search link", () => {
  const item = {
    name: "Контроллер доступа (2 точки)",
    model: "SKAT AC 02NET PACS",
    sourceUrl: "https://g1.bast.ru/catalog/kontrol-dostupa/?q=SKAT%20AC%2002NET%20PACS",
  };

  const result = {
    equipmentData: {
      marketEntries: [
        {
          projectModel: "SKAT AC 02NET PACS",
          usedSources: ["https://g1.bast.ru/products/8885"],
        },
      ],
    },
  };

  const link = resolvePreferredEquipmentSourceLink(item, result, ["bast.ru", "g1.bast.ru"]);
  assert.equal(link, "https://g1.bast.ru/products/8885");
});

test("API source url is converted to browser-safe Luis search page", () => {
  const browserUrl = toBrowserSourceUrl("https://luis.ru/luisapi/catalog/search", "520-887-052");
  assert.equal(browserUrl, "https://luis.ru/search/?q=520-887-052");
});

test("preferred equipment source link avoids raw Luis API endpoints", () => {
  const item = {
    name: "Прибор приемно-контрольный",
    model: "520-887-052",
    usedSources: ["https://luis.ru/luisapi/catalog/search"],
  };

  const result = {
    equipmentData: {
      marketEntries: [
        {
          equipmentLabel: "Прибор приемно-контрольный",
          searchQuery: "520-887-052",
          usedSources: ["https://luis.ru/luisapi/catalog/search"],
        },
      ],
    },
  };

  const link = resolvePreferredEquipmentSourceLink(item, result, ["luis.ru"]);
  assert.equal(link, "https://luis.ru/search/?q=520-887-052");
});
