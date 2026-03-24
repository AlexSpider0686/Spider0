import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toNumber } from "./estimate";

const CYR_UPPER = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const CYR_LOWER = "абвгдежзийклмнопрстуфхцчшщъыьэюя";
const EXTRA_CHAR_MAP = {
  "\u0244": "Ё",
  "\u0245": "Ё",
  "\u0261": "а",
  "\u0262": "х",
  "\u0266": "м",
  "\u0267": "н",
  "\u0268": "о",
  "\u0269": "й",
  "\u026b": "с",
  "\u026c": "т",
  "\u026d": "л",
};

const POSITION_REGEX = /^\d+(?:\.\d+){1,3}\.?$/u;
const SPEC_HEADER_REGEX = /(спецификац|ведомост|наименован|количеств|ед\.?\s*изм|позици|лист|стадия|проект|примечани)/iu;
const SECTION_ROW_REGEX = /^(оборудование|материалы|документация|изделия|комплектующие)$/iu;
const MODEL_REGEX = /[A-ZА-ЯЁ0-9]{2,}(?:[-/.][A-ZА-ЯЁ0-9]{1,})+/gu;
const SOFT_MODEL_REGEX = /[A-ZА-ЯЁ]{1,6}\s?\d{1,5}[A-ZА-ЯЁ0-9-]*/gu;
const NUMBER_REGEX = /\d+(?:[.,]\d+)?/gu;
const KNOWN_UNITS = new Set(["шт", "компл", "м", "м2", "кг", "л", "уп", "лист"]);

const COLUMN = {
  positionEnd: 110,
  nameEnd: 515,
  modelEnd: 770,
  brandEnd: 895,
  unitEnd: 940,
};

const CATEGORY_KEYWORDS = {
  detector: /(извещ|датчик|дым|тепл|плам|ипр|ип\s*\d)/iu,
  panel: /(ппк|приемно|контрольн|панел|шкаф|модул|прибор|блок управления|устройство)/iu,
  notification: /(оповещ|сирен|табло|выход|светозвук|громкоговор|соуэ)/iu,
  power: /(блок\s*питан|акб|аккум|батаре|ибп|резервн)/iu,
  material: /(кабел|провод|гофр|лоток|труб|короб|крепеж|метиз|монтажн|канал|хомут|дюбел|саморез|пена)/iu,
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
  { label: "Promrukav", variants: ["промрукав", "promrukav"] },
];

let workerReady = false;

async function ensurePdfWorker() {
  if (workerReady) return;
  workerReady = true;
  if (typeof window === "undefined") return;

  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  GlobalWorkerOptions.workerSrc = workerModule.default;
}

function decodePseudoCyrillic(text) {
  return [...String(text || "")]
    .map((char) => {
      const code = char.codePointAt(0);
      if (code >= 0x01cb && code <= 0x01ea) return CYR_UPPER[code - 0x01cb] || char;
      if (code >= 0x01eb && code <= 0x020a) return CYR_LOWER[code - 0x01eb] || char;
      return EXTRA_CHAR_MAP[char] || char;
    })
    .join("");
}

function normalizeText(value) {
  return decodePseudoCyrillic(String(value || ""))
    .replace(/\u00a0/g, " ")
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function tidyText(value) {
  return normalizeText(value)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s{2,}/g, " ")
    .replace(/^[,;:.\-]+/u, "")
    .replace(/[,;:.]+$/u, "")
    .trim();
}

function normalizeUnit(raw) {
  const normalized = normalizeText(raw)
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/\./g, "");

  if (["шт", "штук", "ед", "единица", "единиц"].includes(normalized)) return "шт";
  if (["компл", "комплект"].includes(normalized)) return "компл";
  if (["м", "мп", "пм"].includes(normalized)) return "м";
  if (["м2", "м²", "мв"].includes(normalized)) return "м2";
  if (["кг"].includes(normalized)) return "кг";
  if (["л"].includes(normalized)) return "л";
  if (["уп", "упак", "упаковка"].includes(normalized)) return "уп";
  if (["лист", "листа", "листов"].includes(normalized)) return "лист";
  return normalized || "шт";
}

function isKnownUnit(unit) {
  return KNOWN_UNITS.has(unit);
}

function inferUnitFromContext(name, model, sectionMajor = 0, category = "") {
  const text = `${normalizeText(name)} ${normalizeText(model)}`.toLowerCase();
  if (/(кабел|провод|труб|гофр|лоток|короб)/iu.test(text)) return "м";
  if (/(дюбел|саморез|скоб|хомут|пена|извещ|оповещ|блок|модул|панел|аккум|акб)/iu.test(text)) return "шт";
  if (category === "material" && (sectionMajor === 2 || sectionMajor === 3)) return "м";
  if (category === "equipment") return "шт";
  return "";
}

function detectCategory(text) {
  if (CATEGORY_KEYWORDS.detector.test(text)) return "detector";
  if (CATEGORY_KEYWORDS.notification.test(text)) return "notification";
  if (CATEGORY_KEYWORDS.power.test(text)) return "power";
  if (CATEGORY_KEYWORDS.panel.test(text)) return "panel";
  if (CATEGORY_KEYWORDS.material.test(text)) return "material";
  return "equipment";
}

function detectBrand(text) {
  const sample = normalizeText(text).toLowerCase();
  for (const entry of BRAND_DICTIONARY) {
    if (entry.variants.some((variant) => sample.includes(variant))) return entry.label;
  }
  return "";
}

function detectModel(text) {
  const normalized = normalizeText(text);
  const strict = normalized.match(MODEL_REGEX) || [];
  const strong = strict.find((item) => /\d/u.test(item) && item.length >= 4);
  if (strong) return strong;

  const soft = normalized.match(SOFT_MODEL_REGEX) || [];
  const candidate = soft.find((item) => /\d/u.test(item));
  return candidate ? tidyText(candidate) : "";
}

function parseQuantity(text) {
  const matches = [...normalizeText(text).matchAll(NUMBER_REGEX)];
  if (!matches.length) return 0;
  const raw = matches[matches.length - 1][0];
  return Math.max(toNumber(raw.replace(",", "."), 0), 0);
}

function parsePosition(text) {
  const value = normalizeText(text).replace(/\s+/g, "");
  if (!POSITION_REGEX.test(value)) return "";
  const sanitized = value.replace(/\.$/u, "");
  const parts = sanitized.split(".").map((part) => Number(part));
  if (!parts.length) return "";
  if (!Number.isFinite(parts[0]) || parts[0] <= 0 || parts[0] > 99) return "";
  if (parts.slice(1).some((part) => !Number.isFinite(part) || part <= 0 || part > 999)) return "";
  return sanitized;
}

function isMeaningfulChunk(text) {
  return /[A-Za-zА-Яа-яЁё0-9]/u.test(normalizeText(text));
}

function isSectionOrHeaderRow(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  if (SPEC_HEADER_REGEX.test(normalized)) return true;
  if (SECTION_ROW_REGEX.test(normalized)) return true;
  if (/^\d(?:\s+\d){4,}$/u.test(normalized)) return true;
  return false;
}

function assignColumn(x) {
  if (x < COLUMN.positionEnd) return "position";
  if (x < COLUMN.nameEnd) return "name";
  if (x < COLUMN.modelEnd) return "model";
  if (x < COLUMN.brandEnd) return "brand";
  if (x < COLUMN.unitEnd) return "unit";
  return "qty";
}

function splitBuckets(row) {
  const buckets = {
    y: row.y,
    pageNum: row.pageNum,
    position: [],
    name: [],
    model: [],
    brand: [],
    unit: [],
    qty: [],
  };

  for (const cell of row.cells) {
    const text = tidyText(cell.text);
    if (!text) continue;
    buckets[assignColumn(cell.x)].push(text);
  }

  return buckets;
}

function getSectionMajor(position) {
  const major = Number(String(position || "").split(".")[0]);
  return Number.isFinite(major) ? major : 0;
}

function isReasonableQty(position, qty, unit, category) {
  if (!Number.isFinite(qty) || qty <= 0) return false;
  if (qty > 1_000_000) return false;

  const major = getSectionMajor(position);
  const equipmentLike = major === 1 || major === 4 || category !== "material";
  if (equipmentLike && qty > 15_000) return false;
  if (unit === "компл" && qty > 1000) return false;
  if (unit === "шт" && equipmentLike && qty > 5000) return false;

  return true;
}

function isLikelySpecRow(buckets) {
  const position = parsePosition(joinParts(buckets.position));
  if (!position) return false;

  const name = joinParts(buckets.name);
  if (!isMeaningfulChunk(name)) return false;

  const qty = parseQuantity(joinParts(buckets.qty));
  if (qty <= 0) return false;

  const unit = normalizeUnit(joinParts(buckets.unit));
  if (!isKnownUnit(unit)) return false;

  return true;
}

function pickSpecPages(rows) {
  const byPage = new Map();
  for (const row of rows) {
    if (!byPage.has(row.pageNum)) byPage.set(row.pageNum, []);
    byPage.get(row.pageNum).push(row);
  }

  const candidates = new Set();
  for (const [pageNum, pageRows] of byPage.entries()) {
    let strongRows = 0;
    let headerRows = 0;
    for (const row of pageRows) {
      const buckets = splitBuckets(row);
      const plain = joinParts([
        ...buckets.position,
        ...buckets.name,
        ...buckets.model,
        ...buckets.brand,
        ...buckets.unit,
        ...buckets.qty,
      ]);
      if (SPEC_HEADER_REGEX.test(plain)) headerRows += 1;
      if (isLikelySpecRow(buckets)) strongRows += 1;
    }

    if (strongRows >= 4 || (strongRows >= 2 && headerRows >= 1)) {
      candidates.add(pageNum);
    }
  }

  if (!candidates.size) {
    for (const pageNum of byPage.keys()) candidates.add(pageNum);
  }

  return candidates;
}

function joinParts(parts) {
  return tidyText(parts.join(" "));
}

function appendChunks(draft, buckets) {
  const pushChunk = (key, value) => {
    if (!isMeaningfulChunk(value)) return;
    draft[key].push({ text: tidyText(value), y: buckets.y, order: draft.order++ });
  };

  pushChunk("nameChunks", joinParts(buckets.name));
  pushChunk("modelChunks", joinParts(buckets.model));
  pushChunk("brandChunks", joinParts(buckets.brand));

  const unitText = joinParts(buckets.unit);
  if (unitText) draft.unitCandidates.push({ value: normalizeUnit(unitText), y: buckets.y, order: draft.order++ });

  const qtyText = joinParts(buckets.qty);
  const qty = parseQuantity(qtyText);
  if (qty > 0) draft.qtyCandidates.push({ value: qty, y: buckets.y, order: draft.order++ });
}

function sortChunks(chunks = []) {
  return [...chunks]
    .sort((a, b) => b.y - a.y || a.order - b.order)
    .map((item) => item.text)
    .join(" ");
}

function pickLastCandidate(candidates = [], defaultValue) {
  if (!candidates.length) return defaultValue;
  return [...candidates].sort((a, b) => a.order - b.order).at(-1).value;
}

function isContinuationCandidate(buckets) {
  const plain = [joinParts(buckets.name), joinParts(buckets.model), joinParts(buckets.brand)].join(" ").trim();
  if (!plain || isSectionOrHeaderRow(plain)) return false;
  if (parsePosition(joinParts(buckets.position))) return false;
  if (parseQuantity(joinParts(buckets.qty)) > 0) return false;
  return true;
}

function isPureNamePrelude(buckets) {
  const hasName = isMeaningfulChunk(joinParts(buckets.name));
  const hasModel = isMeaningfulChunk(joinParts(buckets.model));
  const hasBrand = isMeaningfulChunk(joinParts(buckets.brand));
  const hasUnit = isKnownUnit(normalizeUnit(joinParts(buckets.unit)));
  const hasQty = parseQuantity(joinParts(buckets.qty)) > 0;
  return hasName && !hasModel && !hasBrand && !hasUnit && !hasQty;
}

function makeDraft(position, buckets, pageNum, rowY, index) {
  const draft = {
    id: `aps-row-${index + 1}`,
    position,
    pageNum,
    rowY,
    order: 0,
    nameChunks: [],
    modelChunks: [],
    brandChunks: [],
    unitCandidates: [],
    qtyCandidates: [],
  };
  appendChunks(draft, buckets);
  return draft;
}

function finalizeDraft(draft) {
  const name = tidyText(sortChunks(draft.nameChunks));
  const modelColumn = tidyText(sortChunks(draft.modelChunks));
  const brandColumn = tidyText(sortChunks(draft.brandChunks));
  const model = modelColumn || detectModel(name);
  const brand = brandColumn || detectBrand(`${name} ${model}`);
  let unit = pickLastCandidate(draft.unitCandidates, "");
  const qty = pickLastCandidate(draft.qtyCandidates, 0);

  if (qty <= 0) return null;
  if (!name && !model) return null;

  const summaryText = `${name} ${model} ${brand}`.trim();
  let category = detectCategory(summaryText);
  const major = getSectionMajor(draft.position);
  const isMaterialPosition = major === 2 || major === 3;
  if (isMaterialPosition && category === "equipment") {
    category = "material";
  }
  if ((major === 1 || major === 4) && category === "material") {
    category = "equipment";
  }
  if (!isKnownUnit(unit)) {
    unit = inferUnitFromContext(name, model, major, category) || "шт";
  }
  const isMaterialUnit = ["м", "м2", "кг", "л", "уп", "лист"].includes(unit);
  const kind = category === "material" || isMaterialUnit || isMaterialPosition ? "material" : "equipment";
  if (!isReasonableQty(draft.position, qty, unit, category)) return null;

  return {
    id: draft.id,
    position: draft.position,
    name: name || model,
    model: model || "",
    mark: brand || "",
    brand: brand || "",
    category,
    kind,
    qty,
    unit,
    rawLine: summaryText,
  };
}

function mergeItems(items) {
  const map = new Map();

  for (const item of items) {
    const key = `${item.kind}|${item.category}|${item.mark}|${item.model}|${item.name}|${item.unit}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...item });
      continue;
    }
    const current = map.get(key);
    current.qty += item.qty;
  }

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

async function extractPageRows(page, pageNum) {
  const textContent = await page.getTextContent();
  const positioned = textContent.items
    .map((item) => ({
      x: toNumber(item?.transform?.[4], 0),
      y: toNumber(item?.transform?.[5], 0),
      text: tidyText(item?.str),
    }))
    .filter((item) => item.text);

  positioned.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  for (const item of positioned) {
    const last = rows.at(-1);
    if (last && Math.abs(last.y - item.y) <= 2) {
      last.cells.push({ x: item.x, text: item.text });
      continue;
    }
    rows.push({
      y: item.y,
      pageNum,
      cells: [{ x: item.x, text: item.text }],
    });
  }

  rows.forEach((row) => row.cells.sort((a, b) => a.x - b.x));
  return rows;
}

function parseRowsToItems(rows) {
  const parsed = [];
  let current = null;
  let draftIndex = 0;
  let prelude = [];

  const flushCurrent = () => {
    if (!current) return;
    const ready = finalizeDraft(current);
    if (ready) parsed.push(ready);
    current = null;
  };

  const specPages = pickSpecPages(rows);
  for (const row of rows) {
    if (!specPages.has(row.pageNum)) continue;
    const buckets = splitBuckets(row);
    const plainRow = joinParts([
      ...buckets.position,
      ...buckets.name,
      ...buckets.model,
      ...buckets.brand,
      ...buckets.unit,
      ...buckets.qty,
    ]);

    if (!plainRow || isSectionOrHeaderRow(plainRow)) continue;

    const position = parsePosition(joinParts(buckets.position));
    if (position) {
      const rowQty = parseQuantity(joinParts(buckets.qty));
      const rowUnit = normalizeUnit(joinParts(buckets.unit));
      const rowName = joinParts(buckets.name);
      const rowModel = joinParts(buckets.model);
      const rowMajor = getSectionMajor(position);
      if (!isMeaningfulChunk(rowName) && !isMeaningfulChunk(rowModel)) continue;
      if (rowQty <= 0) continue;
      if (!isKnownUnit(rowUnit)) {
        const guessedUnit = inferUnitFromContext(rowName, rowModel, rowMajor);
        if (!isKnownUnit(guessedUnit)) continue;
      }

      flushCurrent();
      current = makeDraft(position, buckets, row.pageNum, row.y, draftIndex++);

      const rowNameWordCount = rowName.split(/\s+/u).filter(Boolean).length;
      const needPrelude = rowNameWordCount < 3;
      const attachPrelude = prelude
        .filter((candidate) => candidate.pageNum === row.pageNum && candidate.y >= row.y && candidate.y - row.y <= 14)
        .filter((candidate) => isPureNamePrelude(candidate))
        .filter(() => needPrelude)
        .sort((a, b) => b.y - a.y);

      for (const candidate of attachPrelude) {
        appendChunks(current, candidate);
      }

      prelude = [];
      continue;
    }

    if (current && row.pageNum === current.pageNum && Math.abs(current.rowY - row.y) <= 30 && !SPEC_HEADER_REGEX.test(plainRow)) {
      appendChunks(current, buckets);
      prelude = [];
      continue;
    }

    if (isContinuationCandidate(buckets)) {
      prelude.push(buckets);
      if (prelude.length > 3) prelude = prelude.slice(-3);
    }
  }

  flushCurrent();
  return parsed;
}

export async function parseApsProjectPdf(file) {
  if (!file) throw new Error("PDF-файл не выбран.");

  await ensurePdfWorker();
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const allRows = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const rows = await extractPageRows(page, pageNum);
    allRows.push(...rows);
  }

  await loadingTask.destroy();

  const parsedRows = parseRowsToItems(allRows);
  const items = mergeItems(parsedRows);

  if (!items.length) {
    throw new Error("Не удалось распознать строки спецификации в PDF. Проверьте, что документ содержит табличную спецификацию.");
  }

  return {
    fileName: file.name,
    parsedAt: new Date().toISOString(),
    pages: pdf.numPages,
    linesScanned: allRows.length,
    items,
    metrics: buildMetrics(items),
  };
}
