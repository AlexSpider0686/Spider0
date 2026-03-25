import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { toNumber } from "./estimate";

const CYR_UPPER = "\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041a\u041b\u041c\u041d\u041e\u041f\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042a\u042b\u042c\u042d\u042e\u042f";
const CYR_LOWER = "\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043a\u043b\u043c\u043d\u043e\u043f\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044a\u044b\u044c\u044d\u044e\u044f";
const EXTRA_CHAR_MAP = {
  "\u0244": "\u0401",
  "\u0245": "\u0401",
  "\u0261": "\u0430",
  "\u0262": "\u0445",
  "\u0266": "\u043c",
  "\u0267": "\u043d",
  "\u0268": "\u043e",
  "\u0269": "\u0439",
  "\u026b": "\u0441",
  "\u026c": "\u0442",
  "\u026d": "\u043b",
};

const POSITION_REGEX = /^\d+(?:\.\d+){1,3}\.?$/u;
const NUMBER_REGEX = /\d+(?:[.,]\d+)?/gu;
const MODEL_REGEX = /[A-Z\u0410-\u042f\u04010-9]{2,}(?:[-/.][A-Z\u0410-\u042f\u04010-9]{1,})+/gu;
const SOFT_MODEL_REGEX = /[A-Z\u0410-\u042f\u0401]{1,8}\s?\d{1,8}[A-Z\u0410-\u042f\u04010-9-]*/gu;

const UNIT = {
  piece: "\u0448\u0442",
  set: "\u043a\u043e\u043c\u043f\u043b",
  meter: "\u043c",
  meter2: "\u043c2",
  kg: "\u043a\u0433",
  liter: "\u043b",
  pack: "\u0443\u043f",
  sheet: "\u043b\u0438\u0441\u0442",
};

const KNOWN_UNITS = new Set(Object.values(UNIT));

const COLUMN = {
  positionEnd: 110,
  nameEnd: 515,
  modelEnd: 770,
  brandEnd: 895,
  unitEnd: 940,
};

const CATEGORY_KEYWORDS = {
  detector: /(\u0438\u0437\u0432\u0435\u0449|\u0434\u0430\u0442\u0447\u0438\u043a|\u0434\u044b\u043c|\u0442\u0435\u043f\u043b|\u043f\u043b\u0430\u043c|\u0438\u043f\u0440|(?:^|[^a-z\u0430-\u044f\u0451])\u0438\u043f\s*\d|detector)/iu,
  panel: /(\u043f\u043f\u043a|\u043f\u0440\u0438\u0435\u043c\u043d\u043e|\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d|\u043f\u0430\u043d\u0435\u043b|\u0448\u043a\u0430\u0444|\u043c\u043e\u0434\u0443\u043b|\u043f\u0440\u0438\u0431\u043e\u0440|\u0431\u043b\u043e\u043a \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f|controller|panel)/iu,
  notification: /(\u043e\u043f\u043e\u0432\u0435\u0449|\u0441\u0438\u0440\u0435\u043d|\u0442\u0430\u0431\u043b\u043e|\u0432\u044b\u0445\u043e\u0434|\u0441\u0432\u0435\u0442\u043e\u0437\u0432\u0443\u043a|\u0433\u0440\u043e\u043c\u043a\u043e\u0433\u043e\u0432\u043e\u0440|siren|speaker)/iu,
  power: /(\u0431\u043b\u043e\u043a\s*\u043f\u0438\u0442\u0430\u043d|\u0430\u043a\u0431|\u0430\u043a\u043a\u0443\u043c|\u0431\u0430\u0442\u0430\u0440\u0435|\u0438\u0431\u043f|\u0440\u0435\u0437\u0435\u0440\u0432\u043d|battery|power)/iu,
  material: /(\u043a\u0430\u0431\u0435\u043b|\u043f\u0440\u043e\u0432\u043e\u0434|\u0433\u043e\u0444\u0440|\u043b\u043e\u0442\u043e\u043a|\u0442\u0440\u0443\u0431|\u043a\u043e\u0440\u043e\u0431|\u043a\u0440\u0435\u043f\u0435\u0436|\u043c\u0435\u0442\u0438\u0437|\u043c\u043e\u043d\u0442\u0430\u0436\u043d|\u043a\u0430\u043d\u0430\u043b|\u0445\u043e\u043c\u0443\u0442|\u0434\u044e\u0431\u0435\u043b|\u0441\u0430\u043c\u043e\u0440\u0435\u0437|\u043f\u0435\u043d\u0430|cable|wire|pipe|tray)/iu,
};

const MODEL_ALIGNMENT_HINTS = [
  {
    pattern: /(?:\u0441\u0438\u0440\u0438\u0443\u0441|sirius)/iu,
    familyToken: "\u0441\u0438\u0440\u0438\u0443\u0441",
    category: "panel",
    canonicalName: "\u041f\u0440\u0438\u0431\u043e\u0440 \u043f\u0440\u0438\u0435\u043c\u043d\u043e-\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u044b\u0439",
  },
  {
    pattern: /(?:\u0441?2000\s*\u043a\u0434\u043b|c2000\s*kdl)/iu,
    familyToken: "\u043a\u0434\u043b",
    category: "panel",
    canonicalName: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440 \u0430\u0434\u0440\u0435\u0441\u043d\u043e\u0439 \u043b\u0438\u043d\u0438\u0438",
  },
  {
    pattern: /(?:\u0441?2000\s*\u0431\u043a\u0438|c2000\s*bki)/iu,
    familyToken: "\u0431\u043a\u0438",
    category: "panel",
    canonicalName: "\u0411\u043b\u043e\u043a \u0438\u043d\u0434\u0438\u043a\u0430\u0446\u0438\u0438 \u0441 \u043a\u043b\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u043e\u0439",
  },
  {
    pattern: /(?:\u043c\u0438\u043f|mip|\u0440\u0438\u043f|rip|akb|\u0430\u043a\u0431)/iu,
    familyToken: "\u043c\u0438\u043f",
    category: "power",
    canonicalName: "\u041c\u043e\u0434\u0443\u043b\u044c \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0430 \u043f\u0438\u0442\u0430\u043d\u0438\u044f",
  },
  {
    pattern: /(?:\u0434\u0438\u043f|dip|\u0438\u043f\u0440|ipr)/iu,
    familyToken: "\u0438\u043f\u0440",
    category: "detector",
    canonicalName: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u0436\u0430\u0440\u043d\u044b\u0439",
  },
  {
    pattern: /(?:\u043c\u043e\u043b\u043d\u0438\u044f|molniya|\u0442\u0430\u0431\u043b\u043e)/iu,
    familyToken: "\u043c\u043e\u043b\u043d\u0438\u044f",
    category: "notification",
    canonicalName: "\u041e\u043f\u043e\u0432\u0435\u0449\u0430\u0442\u0435\u043b\u044c \u0441\u0432\u0435\u0442\u043e\u0432\u043e\u0439",
  },
];

const BRAND_DICTIONARY = [
  { label: "\u0411\u043e\u043b\u0438\u0434", variants: ["\u0431\u043e\u043b\u0438\u0434", "bolid"] },
  { label: "\u0420\u0443\u0431\u0435\u0436", variants: ["\u0440\u0443\u0431\u0435\u0436", "rubezh"] },
  { label: "\u0410\u0440\u0433\u0443\u0441-\u0421\u043f\u0435\u043a\u0442\u0440", variants: ["\u0430\u0440\u0433\u0443\u0441", "argus", "\u0430\u0440\u0433\u0443\u0441-\u0441\u043f\u0435\u043a\u0442\u0440"] },
  { label: "System Sensor", variants: ["system sensor"] },
  { label: "Siemens", variants: ["siemens"] },
  { label: "Esser", variants: ["esser"] },
  { label: "Apollo", variants: ["apollo"] },
  { label: "\u0420\u0438\u044d\u043b\u0442\u0430", variants: ["\u0440\u0438\u044d\u043b\u0442\u0430", "rielta"] },
  { label: "Promrukav", variants: ["\u043f\u0440\u043e\u043c\u0440\u0443\u043a\u0430\u0432", "promrukav"] },
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
    .replace(/[‐‑‒–—]/g, "-")
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

  if (["\u0448\u0442", "\u0448\u0442\u0443\u043a", "\u0435\u0434", "\u0435\u0434\u0438\u043d\u0438\u0446\u0430", "\u0435\u0434\u0438\u043d\u0438\u0446"].includes(normalized)) return UNIT.piece;
  if (["\u043a\u043e\u043c\u043f\u043b", "\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442"].includes(normalized)) return UNIT.set;
  if (["\u043c", "\u043c\u043f", "\u043f\u043c", "m"].includes(normalized)) return UNIT.meter;
  if (["\u043c2", "\u043c\u00b2", "m2"].includes(normalized)) return UNIT.meter2;
  if (["\u043a\u0433", "kg"].includes(normalized)) return UNIT.kg;
  if (["\u043b", "l"].includes(normalized)) return UNIT.liter;
  if (["\u0443\u043f", "\u0443\u043f\u0430\u043a", "\u0443\u043f\u0430\u043a\u043e\u0432\u043a\u0430", "pack"].includes(normalized)) return UNIT.pack;
  if (["\u043b\u0438\u0441\u0442", "\u043b\u0438\u0441\u0442\u0430", "\u043b\u0438\u0441\u0442\u043e\u0432", "sheet"].includes(normalized)) return UNIT.sheet;
  return normalized || UNIT.piece;
}

function isKnownUnit(unit) {
  return KNOWN_UNITS.has(unit);
}

function inferUnitFromContext(name, model, sectionMajor = 0, category = "") {
  const text = `${normalizeText(name)} ${normalizeText(model)}`.toLowerCase();
  if (/(?:\u043a\u0430\u0431\u0435\u043b|\u043f\u0440\u043e\u0432\u043e\u0434|\u0442\u0440\u0443\u0431|\u0433\u043e\u0444\u0440|\u043b\u043e\u0442\u043e\u043a|\u043a\u043e\u0440\u043e\u0431|cable|wire|pipe|tray)/iu.test(text))
    return UNIT.meter;
  if (/(?:\u0434\u044e\u0431\u0435\u043b|\u0441\u0430\u043c\u043e\u0440\u0435\u0437|\u0441\u043a\u043e\u0431|\u0445\u043e\u043c\u0443\u0442|\u043f\u0435\u043d\u0430|\u0438\u0437\u0432\u0435\u0449|\u043e\u043f\u043e\u0432\u0435\u0449|\u0431\u043b\u043e\u043a|\u043c\u043e\u0434\u0443\u043b|\u043f\u0430\u043d\u0435\u043b|\u0430\u043a\u043a\u0443\u043c|\u0430\u043a\u0431)/iu.test(text))
    return UNIT.piece;
  if (category === "material" && (sectionMajor === 2 || sectionMajor === 3)) return UNIT.meter;
  if (category === "equipment") return UNIT.piece;
  return "";
}

function detectCategory(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (CATEGORY_KEYWORDS.material.test(normalized)) return "material";
  if (CATEGORY_KEYWORDS.notification.test(normalized)) return "notification";
  if (CATEGORY_KEYWORDS.power.test(normalized)) return "power";
  if (CATEGORY_KEYWORDS.panel.test(normalized)) return "panel";
  if (CATEGORY_KEYWORDS.detector.test(normalized)) return "detector";
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
  const normalized = normalizeText(text).replace(/\s+/g, "");
  const candidate = normalized.match(/\d+(?:\.\d+){1,3}\.?/u)?.[0] || "";
  if (!candidate || !POSITION_REGEX.test(candidate)) return "";
  const sanitized = candidate.replace(/\.$/u, "");
  const parts = sanitized.split(".").map((part) => Number(part));
  if (!parts.length) return "";
  if (!Number.isFinite(parts[0]) || parts[0] <= 0 || parts[0] > 99) return "";
  if (parts.slice(1).some((part) => !Number.isFinite(part) || part <= 0 || part > 999)) return "";
  return sanitized;
}

function isMeaningfulChunk(text) {
  return /[A-Za-z\u0410-\u042f\u0430-\u044f\u0401\u04510-9]/u.test(normalizeText(text));
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

function joinParts(parts) {
  return tidyText(parts.join(" "));
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
  if (unit === UNIT.set && qty > 1000) return false;
  if (unit === UNIT.piece && equipmentLike && qty > 5000) return false;
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
  return isKnownUnit(unit);
}

function pickSpecPages(rows) {
  const byPage = new Map();
  for (const row of rows) {
    if (!byPage.has(row.pageNum)) byPage.set(row.pageNum, []);
    byPage.get(row.pageNum).push(row);
  }

  const pages = new Set();
  for (const [pageNum, pageRows] of byPage.entries()) {
    const count = pageRows.reduce((sum, row) => sum + (isLikelySpecRow(splitBuckets(row)) ? 1 : 0), 0);
    if (count >= 3) pages.add(pageNum);
  }

  if (!pages.size) {
    for (const pageNum of byPage.keys()) pages.add(pageNum);
  }
  return pages;
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

  const qty = parseQuantity(joinParts(buckets.qty));
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
  if (!plain) return false;
  if (parsePosition(joinParts(buckets.position))) return false;
  if (parseQuantity(joinParts(buckets.qty)) > 0) return false;
  const hasUnit = isKnownUnit(normalizeUnit(joinParts(buckets.unit)));
  return !hasUnit;
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

function trimLeadingNameFragment(name) {
  const normalized = tidyText(name);
  if (!normalized) return "";
  if (!/^\p{Ll}/u.test(normalized)) return normalized;

  const splitIndex = normalized.search(/\s\p{Lu}[\p{L}\d-]{2,}/u);
  if (splitIndex > 8) {
    const candidate = tidyText(normalized.slice(splitIndex + 1));
    if (candidate.split(/\s+/u).length >= 2) return candidate;
  }
  return normalized;
}

function getModelAlignmentHint(name, model) {
  const sample = `${normalizeText(model)} ${normalizeText(name)}`.toLowerCase();
  return MODEL_ALIGNMENT_HINTS.find((entry) => entry.pattern.test(sample)) || null;
}

function alignNameAndCategory(name, model, category, isMaterialPosition) {
  const cleanedName = trimLeadingNameFragment(name);
  const hint = getModelAlignmentHint(cleanedName, model);
  if (!hint || isMaterialPosition) {
    return {
      name: cleanedName || model || "",
      category,
    };
  }

  const nameCategory = detectCategory(cleanedName || "");
  const hasFamilyInName = hint.familyToken ? cleanedName.toLowerCase().includes(hint.familyToken) : false;
  const categoryMismatch = nameCategory && nameCategory !== "equipment" && nameCategory !== hint.category;
  const shouldReplaceName = !cleanedName || categoryMismatch || !hasFamilyInName;

  return {
    name: shouldReplaceName ? hint.canonicalName : cleanedName,
    category: hint.category || category,
  };
}

function finalizeDraft(draft) {
  let name = tidyText(sortChunks(draft.nameChunks));
  const modelColumn = tidyText(sortChunks(draft.modelChunks));
  const brandColumn = tidyText(sortChunks(draft.brandChunks));
  const model = modelColumn || detectModel(name);
  const brand = brandColumn || detectBrand(`${name} ${model}`);
  let unit = pickLastCandidate(draft.unitCandidates, "");
  const qty = pickLastCandidate(draft.qtyCandidates, 0);

  if (qty <= 0) return null;
  if (!name && !model) return null;

  const major = getSectionMajor(draft.position);
  const isMaterialPosition = major === 2 || major === 3;
  let category = detectCategory(`${name} ${model} ${brand}`);

  const aligned = alignNameAndCategory(name, model, category, isMaterialPosition);
  name = aligned.name || name || model;
  category = aligned.category || category;

  if (isMaterialPosition && category === "equipment") {
    category = "material";
  }
  if ((major === 1 || major === 4) && category === "material") {
    category = "equipment";
  }

  if (!isKnownUnit(unit)) {
    unit = inferUnitFromContext(name, model, major, category) || UNIT.piece;
  }

  const isMaterialUnit = [UNIT.meter, UNIT.meter2, UNIT.kg, UNIT.liter, UNIT.pack, UNIT.sheet].includes(unit);
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
    rawLine: `${name} ${model} ${brand}`.trim(),
  };
}

function mergeItems(items) {
  const seen = new Set();
  const list = [];

  for (const item of items) {
    const key = `${item.position}|${item.name}|${item.model}|${item.mark}|${item.qty}|${item.unit}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }

  const comparePosition = (left, right) => {
    const a = String(left || "")
      .split(".")
      .map((part) => Number(part));
    const b = String(right || "")
      .split(".")
      .map((part) => Number(part));
    const len = Math.max(a.length, b.length);
    for (let index = 0; index < len; index += 1) {
      const av = Number.isFinite(a[index]) ? a[index] : -1;
      const bv = Number.isFinite(b[index]) ? b[index] : -1;
      if (av === bv) continue;
      return av - bv;
    }
    return 0;
  };

  return list.sort((a, b) => comparePosition(a.position, b.position));
}

function buildMetrics(items) {
  const sumBy = (predicate) => items.reduce((sum, item) => (predicate(item) ? sum + toNumber(item.qty, 0) : sum), 0);
  return {
    detectorsQty: sumBy((item) => item.category === "detector"),
    notificationQty: sumBy((item) => item.category === "notification"),
    panelQty: sumBy((item) => item.category === "panel"),
    powerQty: sumBy((item) => item.category === "power"),
    cableLengthM: sumBy((item) => item.kind === "material" && item.unit === UNIT.meter),
    materialLines: items.filter((item) => item.kind === "material").length,
    devicesQty: sumBy((item) => item.kind === "equipment"),
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
    if (!plainRow) continue;

    const position = parsePosition(joinParts(buckets.position));
    if (position) {
      const rowName = joinParts(buckets.name);
      const rowModel = joinParts(buckets.model);
      if (!isMeaningfulChunk(rowName) && !isMeaningfulChunk(rowModel)) continue;

      flushCurrent();
      current = makeDraft(position, buckets, row.pageNum, row.y, draftIndex++);

      const rowNameWordCount = rowName.split(/\s+/u).filter(Boolean).length;
      const hasModelInRow = isMeaningfulChunk(rowModel);
      const hasQtyInRow = parseQuantity(joinParts(buckets.qty)) > 0;
      const hasUnitInRow = isKnownUnit(normalizeUnit(joinParts(buckets.unit)));
      const needPrelude = rowNameWordCount < 3 && !hasModelInRow && (!hasQtyInRow || !hasUnitInRow);

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

    if (current && row.pageNum === current.pageNum && Math.abs(current.rowY - row.y) <= 22) {
      const incomingQty = parseQuantity(joinParts(buckets.qty));
      const incomingUnit = normalizeUnit(joinParts(buckets.unit));
      const incomingName = joinParts(buckets.name);
      const incomingModel = joinParts(buckets.model);
      const incomingLooksLikeContinuation = incomingQty <= 0 && !isKnownUnit(incomingUnit);
      const incomingLooksLikeNewRow = incomingQty > 0 || (isMeaningfulChunk(incomingName) && isMeaningfulChunk(incomingModel));
      const currentHasQty = current.qtyCandidates.length > 0;

      if (currentHasQty && incomingLooksLikeNewRow) {
        if (isPureNamePrelude(buckets)) {
          prelude.push(buckets);
          if (prelude.length > 3) prelude = prelude.slice(-3);
        }
        continue;
      }

      if (incomingLooksLikeContinuation) {
        appendChunks(current, buckets);
        prelude = [];
      }
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
    gostStandard: "ГОСТ 21.110-2013",
    pages: pdf.numPages,
    linesScanned: allRows.length,
    items,
    metrics: buildMetrics(items),
  };
}
