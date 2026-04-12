import test from "node:test";
import assert from "node:assert/strict";
import { resolvePreferredEquipmentSourceLink } from "../src/lib/sourceLinks.js";

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
