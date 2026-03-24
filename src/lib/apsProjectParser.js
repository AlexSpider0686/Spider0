import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { toNumber } from "./estimate";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const SPEC_HEADER_REGEX =
  /(спецификац|ведомост|наименовани[ея]|количеств|ед\.?\s*изм|позици[яи]|проект|лист|стадия|раздел|шифр)/iu;
const TRAILING_QTY_UNIT_REGEX =
  /(\d+(?:[.,]\d+)?)\s*(шт\.?|штук|компл\.?|комплект|м\.п\.|мп|м|кг|л|м2|м²|уп\.?|рулон|пачк(?:а|и)?|лист(?:а|ов)?|бухта)\s*$/iu;
const TRAILING_QTY_ONLY_REGEX = /(\d+(?:[.,]\d+)?)\s*$/u;

const CATEGORY_KEYWORDS = {
  detector: /(извещ|датчик|дым|тепл|плам|ипр|ип\s*\d|иП\s*\d)/iu,
  panel: /(ппк|приемно|контрольн|панел|шкаф|модул|прибор|блок управления)/iu,
  notification: /(оповещ|сирен|табло|выход|светозвук|громкоговор)/iu,
  power: /(блок\s*питан|акб|аккум|батаре)/iu,
  material: /(кабел|провод|гофр|лоток|труба|короб|крепеж|клемм|метиз|монтажн|канал)/iu,
};

const BRAND_DICTIONARY = [
  { label: "Болид", variants: ["болид", "bolid"] },
  { label: "Рубеж", variants: ["рубеж", "rubezh"] },
  { label: "Аргус-Спектр", variants: ["аргус", "argus", "аргус-спектр"] },
  { label: "System Sensor", variants: ["system sensor"] },
  { label: "Siemens", variants: ["siemens"] },
  { label: "Esser", variants: ["esser"] },
  { label: "Apollo", variants: ["apollo"] },
  { label: "Риэлта", variants: ["риэлта", "rielta"] },
];

function normalizeUnit(unitRaw) {
  const unit = String(unitRaw || "")
    .toLowerCase()
    .replace(/\./g, "");
  if (["шт", "штук"].includes(unit)) return "шт";
  if (["компл", "комплект"].includes(unit)) return "компл";
  if (["мп", "м"].includes(unit)) return "м";
  if (["м2", "м²"].includes(unit)) return "м²";
  if (["пачка", "пачки"].includes(unit)) return "пачка";
  if (["листа", "листов"].includes(unit)) return "лист";
  return unit || "шт";
}

function normalizeLine(line) {
  return String(line || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNamePart(value) {
  return normalizeLine(String(value || "").replace(/^\d+\s*[.)-]?\s*/u, "").replace(/[,;:]+$/u, ""));
}

function detectCategory(name) {
  if (CATEGORY_KEYWORDS.detector.test(name)) return "detector";
  if (CATEGORY_KEYWORDS.notification.test(name)) return "notification";
  if (CATEGORY_KEYWORDS.power.test(name)) return "power";
  if (CATEGORY_KEYWORDS.panel.test(name)) return "panel";
  if (CATEGORY_KEYWORDS.material.test(name)) return "material";
  return "equipment";
}

function detectBrand(name) {
  const text = normalizeLine(name).toLowerCase();
  for (const entry of BRAND_DICTIONARY) {
    if (entry.variants.some((variant) => text.includes(variant))) return entry.label;
  }
  return "";
}

function detectModel(name) {
  const inQuotes = name.match(/[«"](.*?)[»"]/u)?.[1];
  if (inQuotes && /[\d/-]/u.test(inQuotes)) return normalizeLine(inQuotes);

  const candidates = name.match(/[A-ZА-ЯЁ0-9]{2,}(?:[-/.][A-ZА-ЯЁ0-9]{1,})+/gu) || [];
  const strong = candidates.find((item) => /\d/u.test(item) && item.length >= 4);
  if (strong) return strong;

  const fallback = name.match(/[A-ZА-ЯЁ]{2,}\s?\d{1,4}[A-ZА-ЯЁ0-9-]*/u)?.[0];
  return normalizeLine(fallback || "");
}

function parseSpecLine(line, index) {
  const normalized = normalizeLine(line);
  if (!normalized || normalized.length < 7) return null;
  if (SPEC_HEADER_REGEX.test(normalized)) return null;

  const qtyUnitMatch = normalized.match(TRAILING_QTY_UNIT_REGEX);
  const qtyOnlyMatch = normalized.match(TRAILING_QTY_ONLY_REGEX);
  if (!qtyUnitMatch && !qtyOnlyMatch) return null;

  const qtyRaw = qtyUnitMatch ? qtyUnitMatch[1] : qtyOnlyMatch?.[1];
  const unitRaw = qtyUnitMatch ? qtyUnitMatch[2] : "шт";
  const quantity = toNumber(String(qtyRaw || "").replace(",", "."), 0);
  if (quantity <= 0) return null;

  const sliceIndex = qtyUnitMatch ? qtyUnitMatch.index : qtyOnlyMatch?.index;
  const namePart = cleanNamePart(normalized.slice(0, Math.max(sliceIndex ?? 0, 0)));
  if (!namePart || namePart.length < 4) return null;

  const category = detectCategory(namePart);
  const model = detectModel(namePart);
  const brand = detectBrand(namePart);
  const unit = normalizeUnit(unitRaw);

  return {
    id: `aps-spec-${index}`,
    name: namePart,
    model,
    brand,
    category,
    kind: category === "material" ? "material" : "equipment",
    qty: quantity,
    unit,
    rawLine: normalized,
  };
}

function mergeItems(items) {
  const map = new Map();

  items.forEach((item) => {
    const key = `${item.kind}|${item.category}|${item.brand}|${item.model}|${item.name}|${item.unit}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...item });
      return;
    }
    const current = map.get(key);
    current.qty += item.qty;
  });

  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

function buildMetrics(items) {
  const sumBy = (predicate) => items.reduce((sum, item) => (predicate(item) ? sum + toNumber(item.qty, 0) : sum), 0);
  const detectorsQty = sumBy((item) => item.category === "detector");
  const notificationQty = sumBy((item) => item.category === "notification");
  const panelQty = sumBy((item) => item.category === "panel");
  const powerQty = sumBy((item) => item.category === "power");
  const cableLengthM = sumBy((item) => item.kind === "material" && item.unit === "м");
  const materialLines = items.filter((item) => item.kind === "material").length;
  const devicesQty = sumBy((item) => item.kind === "equipment");

  return {
    detectorsQty,
    notificationQty,
    panelQty,
    powerQty,
    cableLengthM,
    materialLines,
    devicesQty,
  };
}

async function extractPageLines(page) {
  const textContent = await page.getTextContent();
  const rowsByY = new Map();

  textContent.items.forEach((item) => {
    const text = normalizeLine(item?.str);
    if (!text) return;
    const x = toNumber(item?.transform?.[4], 0);
    const y = Math.round(toNumber(item?.transform?.[5], 0));

    if (!rowsByY.has(y)) rowsByY.set(y, []);
    rowsByY.get(y).push({ x, text });
  });

  return [...rowsByY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((cell) => cell.text).join(" "))
    .map(normalizeLine)
    .filter(Boolean);
}

export async function parseApsProjectPdf(file) {
  if (!file) throw new Error("PDF-файл не выбран.");

  const data = await file.arrayBuffer();
  const loadingTask = getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const allLines = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const lines = await extractPageLines(page);
    allLines.push(...lines);
  }

  await loadingTask.destroy();

  const parsedItems = allLines.map((line, index) => parseSpecLine(line, index)).filter(Boolean);
  const items = mergeItems(parsedItems);

  if (!items.length) {
    throw new Error("Не удалось выделить строки спецификации. Проверьте, что в PDF есть таблица спецификации.");
  }

  return {
    fileName: file.name,
    parsedAt: new Date().toISOString(),
    pages: pdf.numPages,
    linesScanned: allLines.length,
    items,
    metrics: buildMetrics(items),
  };
}
