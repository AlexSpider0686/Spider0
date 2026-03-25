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

const POSITION_REGEX = /^\d+(?:\.\d+){0,3}\.?$/u;
const NUMBER_REGEX = /\d+(?:[.,]\d+)?/gu;
const MODEL_REGEX = /[A-Z\u0410-\u042f\u04010-9]{2,}(?:[-/.][A-Z\u0410-\u042f\u04010-9]{1,})+/gu;
const MODEL_TEST_REGEX = /[A-Z\u0410-\u042f\u04010-9]{2,}(?:[-/.][A-Z\u0410-\u042f\u04010-9]{1,})+/u;
const SOFT_MODEL_REGEX = /[A-Z\u0410-\u042f\u0401]{1,8}\s?\d{1,8}[A-Z\u0410-\u042f\u04010-9-]*/gu;
const NOTE_SPLIT_REGEX = /(?:^|\b)(?:\u043f\u0440\u0438\u043c(?:\.|\b)|\u043f\u0440\u0438\u043c\u0435\u0447(?:\u0430\u043d\u0438\u0435|\u0430\u043d\u0438\u044f)?|\u0437\u0430\u043c\u0435\u0447(?:\u0430\u043d\u0438\u0435|\u0430\u043d\u0438\u044f)?|note)(?:\b|:)/iu;

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

const CABLE_KEYWORDS = /(\u043a\u0430\u0431\u0435\u043b|\u043f\u0440\u043e\u0432\u043e\u0434|utp|ftp|sftp|cat\d|rg-?\d|coax|\u043a\u043f\u0441|\u0432\u0432\u0433|\u043f\u0432\u0441|wire|cable)/iu;
const FASTENER_KEYWORDS = /(\u043a\u0440\u0435\u043f\u0435\u0436|\u0434\u044e\u0431\u0435\u043b|\u0441\u0430\u043c\u043e\u0440\u0435\u0437|\u0441\u043a\u043e\u0431|\u0445\u043e\u043c\u0443\u0442|\u0430\u043d\u043a\u0435\u0440|\u0448\u043f\u0438\u043b\u044c\u043a|\u0437\u0430\u0436\u0438\u043c|\u043c\u0435\u0442\u0438\u0437|fastener|anchor|clamp|screw)/iu;
const HEADER_HINT_REGEX =
  /(\u043f\u043e\u0437\u0438\u0446|\u043d\u0430\u0438\u043c\u0435\u043d|\u043c\u0430\u0440\u043a\u0430|\u043c\u043e\u0434\u0435\u043b|\u043e\u0431\u043e\u0437\u043d\u0430\u0447|\u0437\u0430\u0432\u043e\u0434|\u0435\u0434\.?\s*\u0438\u0437\u043c|\u043a\u043e\u043b-?\u0432\u043e|\u043f\u0440\u0438\u043c\u0435\u0447|\u0441\u043f\u0435\u0446\u0438\u0444\u0438\u043a)/iu;
const SPEC_EQUIPMENT_HINT_REGEX =
  /(\u0438\u0437\u0432\u0435\u0449|\u0434\u0430\u0442\u0447\u0438\u043a|\u043f\u0440\u0438\u0431\u043e\u0440|\u043f\u0430\u043d\u0435\u043b|\u0448\u043a\u0430\u0444|\u0431\u043b\u043e\u043a|\u043c\u043e\u0434\u0443\u043b|\u043a\u043e\u043d\u0442\u0440\u043e\u043b|\u043e\u043f\u043e\u0432\u0435\u0449|\u0430\u043a\u0431|\u043a\u0430\u0431\u0435\u043b|\u043f\u0440\u043e\u0432\u043e\u0434|\u043a\u043e\u0440\u043e\u0431|\u0442\u0440\u0443\u0431|\u043b\u043e\u0442\u043e\u043a|\u043a\u0440\u0435\u043f\u0435\u0436|\u0445\u043e\u043c\u0443\u0442|\u0434\u044e\u0431\u0435\u043b|\u0441\u0430\u043c\u043e\u0440\u0435\u0437|detector|panel|controller|module|cable|wire|tray|fastener)/iu;
const STAMP_META_HINT_REGEX =
  /(\u0438\u0437\u043c\.?|\u043a\u043e\u043b\.?\s*\u0443\u0447|N\u0434\u043e\u043a|\u043d\.?\s*\u043a\u043e\u043d\u0442\u0440|\u043b\u0438\u0441\u0442(?:\u043e\u0432)?|\u043f\u043e\u0434\u043f(?:\u0438\u0441\u044c)?|\u0434\u0430\u0442\u0430|\u0441\u0442\u0430\u0434\u0438\u044f|\u0442\u043e\u043c|\u0438\u043d\u0432\.?|^\s*\u0437\u0430\u043c\b|\u0440\u0430\u0437\u0440\u0430\u0431|^\s*\u043f\u0440\u043e\u0435\u043a\u0442\b)/iu;

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

function parseNumericToken(raw) {
  if (raw === null || raw === undefined) return null;
  const token = normalizeText(String(raw)).replace(",", ".").replace(/\s/g, "");
  if (!/^\d+(?:\.\d+)?$/u.test(token)) return null;
  const value = Number(token);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function parseQuantity(text, strategy = "last") {
  const normalized = normalizeText(text);
  if (!normalized) return 0;

  const noNotes = normalized.split(NOTE_SPLIT_REGEX)[0] || normalized;
  const matches = [...noNotes.matchAll(NUMBER_REGEX)];
  if (!matches.length) return 0;

  const selected = strategy === "first" ? matches[0][0] : matches[matches.length - 1][0];
  return Math.max(toNumber(String(selected).replace(",", "."), 0), 0);
}

function parseQtyFromQtyBucket(parts = []) {
  const joined = joinParts(parts);
  if (!joined) return 0;

  const leftOfNotes = joined.split(NOTE_SPLIT_REGEX)[0] || joined;
  const firstCandidate = parseQuantity(leftOfNotes, "first");
  if (firstCandidate > 0) return firstCandidate;

  return parseQuantity(leftOfNotes, "last");
}

function parsePosition(text) {
  const normalized = normalizeText(text).replace(/\s+/g, "");
  const candidate = normalized.match(/\d+(?:\.\d+){0,3}\.?/u)?.[0] || "";
  if (!candidate || !POSITION_REGEX.test(candidate)) return "";
  const sanitized = candidate.replace(/\.$/u, "");
  const parts = sanitized.split(".").map((part) => Number(part));
  if (!parts.length) return "";
  if (!Number.isFinite(parts[0]) || parts[0] <= 0 || parts[0] > 99) return "";
  if (parts.slice(1).some((part) => !Number.isFinite(part) || part <= 0 || part > 999)) return "";
  return sanitized;
}

function parseLeadingPosition(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/^\s*(\d+(?:\.\d+){0,3})\.?(?:\s+|$)/u);
  return match ? parsePosition(match[1]) : "";
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

function rowToPlainText(row) {
  return tidyText((row?.cells || []).map((cell) => tidyText(cell?.text)).filter(Boolean).join(" "));
}

function stripNotesTail(text) {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  const noteStart = normalized.search(NOTE_SPLIT_REGEX);
  const left = noteStart >= 0 ? normalized.slice(0, noteStart) : normalized;
  return tidyText(left);
}

function countStampMetaHits(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return 0;
  const hints = [
    "\u0438\u0437\u043c",
    "\u043a\u043e\u043b \u0443\u0447",
    "n\u0434\u043e\u043a",
    "\u043d \u043a\u043e\u043d\u0442\u0440",
    "\u043f\u043e\u0434\u043f",
    "\u0434\u0430\u0442\u0430",
    "\u0441\u0442\u0430\u0434\u0438\u044f",
    "\u0438\u043d\u0432",
    "\u0440\u0430\u0437\u0440\u0430\u0431",
    "\u043f\u0440\u043e\u0435\u043a\u0442",
    "\u0442\u043e\u043c",
    "\u043b\u0438\u0441\u0442",
  ];
  return hints.reduce((sum, hint) => (normalized.includes(hint) ? sum + 1 : sum), 0);
}

function looksLikeAdministrativeLine(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;

  const lower = normalized.toLowerCase();
  const hasModel = MODEL_TEST_REGEX.test(normalized);
  const hasSpecHint = SPEC_EQUIPMENT_HINT_REGEX.test(lower);
  const hasQtyUnit = Boolean(extractQtyAndUnitFromText(normalized));
  const stampHit = STAMP_META_HINT_REGEX.test(lower);
  const stampHits = countStampMetaHits(normalized);

  if (/\u0438\u0437\u043c\.?\s*\u043a\u043e\u043b\.?\s*\u0443\u0447/iu.test(lower)) return true;
  if (/\u043f\u043e\u0434\u043f(?:\.|\u0438\u0441\u044c)?\s*\u0438\s*\u0434\u0430\u0442\u0430/iu.test(lower)) return true;
  if (!hasSpecHint && !hasModel && !hasQtyUnit && stampHit) return true;
  if (!hasSpecHint && stampHits >= 2) return true;
  if (!hasSpecHint && !hasModel && normalized.length > 120 && stampHits >= 1) return true;

  return false;
}

function isHeaderRowText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (normalized.length < 4) return false;
  if (HEADER_HINT_REGEX.test(normalized)) return true;
  return false;
}

function isSectionHeaderText(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return false;
  const cleaned = normalized.replace(/^[\divxlcdm.\-:\s]+/iu, "").trim();
  return /^(?:\u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435|\u043a\u0430\u0431\u0435\u043b\u044c\u043d\u044b\u0435 \u0438\u0437\u0434\u0435\u043b\u0438\u044f|\u043a\u0430\u0431\u0435\u043b\u0435\u043d\u0435\u0441\u0443\u0449|\u043c\u043e\u043d\u0442\u0430\u0436\u043d\u044b\u0435 \u0438\u0437\u0434\u0435\u043b\u0438\u044f|\u0437\u0438\u043f)\b/iu.test(
    cleaned
  );
}

function removePositionPrefix(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/^\s*\d+(?:\.\d+){1,3}\.?\s*/u);
  return tidyText(match ? normalized.slice(match[0].length) : normalized);
}

function extractQtyAndUnitFromText(text) {
  const source = stripNotesTail(text);
  if (!source) return null;

  const qtyUnitRegex =
    /(\d+(?:[.,]\d+)?)\s*(\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434(?:\u0438\u043d\u0438\u0446[\u0430\u044b]?)?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)(?:\b|$)/giu;
  let match = null;
  let last = null;
  while ((match = qtyUnitRegex.exec(source)) !== null) {
    const qty = parseNumericToken(match[1]);
    if (!qty) continue;
    last = {
      qty,
      unit: normalizeUnit(match[2]),
      start: match.index,
      end: qtyUnitRegex.lastIndex,
    };
  }
  if (last) return last;

  const unitQtyRegex =
    /(\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434(?:\u0438\u043d\u0438\u0446[\u0430\u044b]?)?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)[\s:]{0,3}(\d+(?:[.,]\d+)?)(?:\b|$)/giu;
  while ((match = unitQtyRegex.exec(source)) !== null) {
    const qty = parseNumericToken(match[2]);
    if (!qty) continue;
    last = {
      qty,
      unit: normalizeUnit(match[1]),
      start: match.index,
      end: unitQtyRegex.lastIndex,
    };
  }
  if (last) return last;

  const numberMatches = [...source.matchAll(NUMBER_REGEX)];
  const lastNumber = numberMatches.at(-1);
  if (!lastNumber) return null;
  const qty = parseNumericToken(lastNumber[0]);
  if (!qty) return null;
  const index = lastNumber.index || 0;
  const around = source.slice(Math.max(0, index - 12), Math.min(source.length, index + lastNumber[0].length + 12));
  const unitCandidate = around.match(
    /(\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434(?:\u0438\u043d\u0438\u0446[\u0430\u044b]?)?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)/iu
  );
  if (!unitCandidate) return null;
  return {
    qty,
    unit: normalizeUnit(unitCandidate[1]),
    start: index,
    end: index + String(lastNumber[0]).length,
  };
}

function cutSlice(text, start = 0, end = 0) {
  if (!text) return "";
  if (start >= end) return tidyText(text);
  return tidyText(`${text.slice(0, start)} ${text.slice(end)}`);
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
  const qty = parseQtyFromQtyBucket(buckets.qty);
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
  const pageScores = [];
  for (const [pageNum, pageRows] of byPage.entries()) {
    const count = pageRows.reduce((sum, row) => sum + (isLikelySpecRow(splitBuckets(row)) ? 1 : 0), 0);
    pageScores.push({ pageNum, count });
    if (count >= 3) pages.add(pageNum);
  }

  if (!pages.size) {
    pageScores
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .forEach((item) => pages.add(item.pageNum));
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

  const qty = parseQtyFromQtyBucket(buckets.qty);
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
  if (parseQtyFromQtyBucket(buckets.qty) > 0) return false;
  const hasUnit = isKnownUnit(normalizeUnit(joinParts(buckets.unit)));
  return !hasUnit;
}

function isPureNamePrelude(buckets) {
  const hasName = isMeaningfulChunk(joinParts(buckets.name));
  const hasModel = isMeaningfulChunk(joinParts(buckets.model));
  const hasBrand = isMeaningfulChunk(joinParts(buckets.brand));
  const hasUnit = isKnownUnit(normalizeUnit(joinParts(buckets.unit)));
  const hasQty = parseQtyFromQtyBucket(buckets.qty) > 0;
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

function normalizeSpecItem({ id, position, name, model = "", brand = "", qty = 0, unit = "", rawLine = "" }) {
  const cleanPosition = parsePosition(position);
  if (!cleanPosition) return null;

  const numericQty = toNumber(qty, 0);
  if (numericQty <= 0) return null;

  let normalizedName = tidyText(name || "");
  const normalizedModel = tidyText(model || "") || detectModel(normalizedName);
  const normalizedBrand = tidyText(brand || "") || detectBrand(`${normalizedName} ${normalizedModel}`);

  if (!normalizedName && !normalizedModel) return null;
  if (looksLikeAdministrativeLine(`${normalizedName} ${normalizedModel} ${rawLine}`)) return null;

  const major = getSectionMajor(cleanPosition);
  const isTopLevelPosition = !String(cleanPosition).includes(".");
  const nameWords = normalizedName.split(/\s+/u).filter(Boolean);
  const hasEquipmentSignal = SPEC_EQUIPMENT_HINT_REGEX.test(`${normalizedName} ${normalizedModel}`.toLowerCase()) || Boolean(normalizedBrand);
  const weakDateLikeModel = /^\d{1,2}[./]\d{1,2}$/u.test(normalizedModel);
  const lettersInName = (normalizedName.match(/\p{L}/gu) || []).length;
  if (!lettersInName) return null;
  if (lettersInName < 3 && !hasEquipmentSignal) return null;
  if (isTopLevelPosition && nameWords.length > 14 && !hasEquipmentSignal) return null;
  if (isTopLevelPosition && weakDateLikeModel && !hasEquipmentSignal) return null;
  if (isTopLevelPosition && isSectionHeaderText(normalizedName)) return null;

  const isMaterialPosition = major === 2 || major === 3;
  let category = detectCategory(`${normalizedName} ${normalizedModel} ${normalizedBrand}`);

  const aligned = alignNameAndCategory(normalizedName, normalizedModel, category, isMaterialPosition);
  normalizedName = aligned.name || normalizedName || normalizedModel;
  category = aligned.category || category;

  if (isMaterialPosition && category === "equipment") {
    category = "material";
  }
  if ((major === 1 || major === 4) && category === "material") {
    category = "equipment";
  }

  let normalizedUnit = normalizeUnit(unit || "");
  if (!isKnownUnit(normalizedUnit)) {
    normalizedUnit = inferUnitFromContext(normalizedName, normalizedModel, major, category) || UNIT.piece;
  }

  const isMaterialUnit = [UNIT.meter, UNIT.meter2, UNIT.kg, UNIT.liter, UNIT.pack, UNIT.sheet].includes(normalizedUnit);
  const kind = category === "material" || isMaterialUnit || isMaterialPosition ? "material" : "equipment";
  if (!isReasonableQty(cleanPosition, numericQty, normalizedUnit, category)) return null;

  return {
    id,
    position: cleanPosition,
    name: normalizedName || normalizedModel,
    model: normalizedModel || "",
    mark: normalizedBrand || "",
    brand: normalizedBrand || "",
    category,
    kind,
    qty: numericQty,
    unit: normalizedUnit,
    rawLine: tidyText(rawLine || `${normalizedName} ${normalizedModel} ${normalizedBrand}`),
  };
}

function finalizeDraft(draft) {
  const name = tidyText(sortChunks(draft.nameChunks));
  const model = tidyText(sortChunks(draft.modelChunks));
  const brand = tidyText(sortChunks(draft.brandChunks));
  const unit = pickLastCandidate(draft.unitCandidates, "");
  const qty = pickLastCandidate(draft.qtyCandidates, 0);

  return normalizeSpecItem({
    id: draft.id,
    position: draft.position,
    name,
    model,
    brand,
    qty,
    unit,
    rawLine: `${name} ${model} ${brand}`.trim(),
  });
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

  const cleanKeyToken = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  const scoreItem = (item) => {
    const nameLength = String(item.name || "").length;
    const raw = String(item.rawLine || "");
    let score = 0;
    if (nameLength >= 6 && nameLength <= 120) score += 4;
    if (nameLength > 120) score -= 2;
    if (item.model) score += 3;
    if (item.brand || item.mark) score += 2;
    if (SPEC_EQUIPMENT_HINT_REGEX.test(String(item.name || "").toLowerCase())) score += 2;
    if (/[\u0000-\u001f]/u.test(raw)) score -= 3;
    if (looksLikeAdministrativeLine(`${item.name} ${item.model} ${raw}`)) score -= 5;
    return score;
  };

  const strongByPosition = new Map();
  for (const item of list) {
    const modelKey = cleanKeyToken(item.model) || cleanKeyToken(item.name);
    const dedupeKey = `${item.position}|${modelKey}|${item.unit}`;
    const existing = strongByPosition.get(dedupeKey);
    if (!existing) {
      strongByPosition.set(dedupeKey, item);
      continue;
    }
    if (scoreItem(item) > scoreItem(existing)) {
      strongByPosition.set(dedupeKey, item);
    }
  }
  const deduped = [...strongByPosition.values()];
  const bestByPosition = new Map();
  const isMoreSpecific = (next, prev) => {
    const nextModel = String(next.model || "");
    const prevModel = String(prev.model || "");
    if (nextModel && !prevModel) return true;
    if (!nextModel && prevModel) return false;
    if (nextModel.length !== prevModel.length) return nextModel.length > prevModel.length;
    const nextName = String(next.name || "");
    const prevName = String(prev.name || "");
    return nextName.length > prevName.length;
  };
  for (const item of deduped) {
    const existing = bestByPosition.get(item.position);
    if (!existing) {
      bestByPosition.set(item.position, item);
      continue;
    }
    const nextScore = scoreItem(item);
    const prevScore = scoreItem(existing);
    if (nextScore > prevScore || (nextScore === prevScore && isMoreSpecific(item, existing))) {
      bestByPosition.set(item.position, item);
    }
  }
  const positionDeduped = [...bestByPosition.values()];

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

  return positionDeduped.sort((a, b) => comparePosition(a.position, b.position));
}

function buildMetrics(items) {
  const sumBy = (predicate) => items.reduce((sum, item) => (predicate(item) ? sum + toNumber(item.qty, 0) : sum), 0);
  const isCable = (item) => {
    const text = `${item.name || ""} ${item.model || ""} ${item.rawLine || ""}`;
    return CABLE_KEYWORDS.test(text);
  };
  const isFastener = (item) => {
    const text = `${item.name || ""} ${item.model || ""} ${item.rawLine || ""}`;
    return FASTENER_KEYWORDS.test(text);
  };
  const cableLengthM = sumBy((item) => item.kind === "material" && item.unit === UNIT.meter && isCable(item));
  const fastenerQty = sumBy((item) => item.kind === "material" && isFastener(item));

  return {
    detectorsQty: sumBy((item) => item.category === "detector"),
    notificationQty: sumBy((item) => item.category === "notification"),
    panelQty: sumBy((item) => item.category === "panel"),
    powerQty: sumBy((item) => item.category === "power"),
    cableLengthM,
    cableLines: items.filter((item) => item.kind === "material" && isCable(item)).length,
    fastenerQty,
    fastenerLines: items.filter((item) => item.kind === "material" && isFastener(item)).length,
    materialLines: items.filter((item) => item.kind === "material").length,
    devicesQty: sumBy((item) => item.kind === "equipment"),
  };
}

export function buildApsProjectMetrics(items = []) {
  return buildMetrics(items);
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
  const unresolvedRows = [];
  let candidateRows = 0;
  let current = null;
  let draftIndex = 0;
  let prelude = [];

  const flushCurrent = () => {
    if (!current) return;
    const ready = finalizeDraft(current);
    if (ready) {
      parsed.push(ready);
    } else {
      const rawLine = tidyText(`${sortChunks(current.nameChunks)} ${sortChunks(current.modelChunks)} ${sortChunks(current.brandChunks)}`);
      if (looksLikeAdministrativeLine(rawLine) || isHeaderRowText(rawLine) || isSectionHeaderText(rawLine)) {
        current = null;
        return;
      }
      unresolvedRows.push({
        id: `${current.id}-unresolved`,
        position: current.position || "",
        rawLine,
        reason: "validation_failed",
      });
    }
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
      if (looksLikeAdministrativeLine(plainRow)) continue;

      flushCurrent();
      current = makeDraft(position, buckets, row.pageNum, row.y, draftIndex++);
      candidateRows += 1;

      const rowNameWordCount = rowName.split(/\s+/u).filter(Boolean).length;
      const hasModelInRow = isMeaningfulChunk(rowModel);
      const hasQtyInRow = parseQtyFromQtyBucket(buckets.qty) > 0;
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
      const incomingQty = parseQtyFromQtyBucket(buckets.qty);
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
  return {
    items: parsed,
    candidateRows,
    unrecognizedRows: cleanupUnrecognizedRows(unresolvedRows),
  };
}

function buildFallbackItemFromLine(line, index) {
  const sourceText = stripNotesTail(line?.text || "");
  const position = parseLeadingPosition(sourceText || line?.position || "");
  if (!position) {
    return {
      item: null,
      unresolved: {
        id: `aps-unresolved-${index + 1}`,
        position: "",
        rawLine: tidyText(line?.text || ""),
        reason: "position_not_found",
      },
    };
  }

  const descriptor = removePositionPrefix(sourceText);
  if (!descriptor) {
    return {
      item: null,
      unresolved: {
        id: `aps-unresolved-${index + 1}`,
        position,
        rawLine: sourceText,
        reason: "descriptor_missing",
      },
    };
  }

  const qtyAndUnit = extractQtyAndUnitFromText(descriptor);
  if (!qtyAndUnit?.qty) {
    return {
      item: null,
      unresolved: {
        id: `aps-unresolved-${index + 1}`,
        position,
        rawLine: descriptor,
        reason: "qty_or_unit_not_found",
      },
    };
  }

  const body = cutSlice(descriptor, qtyAndUnit.start, qtyAndUnit.end);
  const model = detectModel(body);
  const brand = detectBrand(`${body} ${model}`);
  const item = normalizeSpecItem({
    id: `aps-fallback-${index + 1}`,
    position,
    name: body,
    model,
    brand,
    qty: qtyAndUnit.qty,
    unit: qtyAndUnit.unit,
    rawLine: descriptor,
  });

  if (!item) {
    return {
      item: null,
      unresolved: {
        id: `aps-unresolved-${index + 1}`,
        position,
        rawLine: descriptor,
        reason: "validation_failed",
      },
    };
  }

  return { item, unresolved: null };
}

function cleanupUnrecognizedRows(rows = [], knownPositions = new Set()) {
  const seen = new Set();
  const normalized = [];

  for (const row of rows) {
    const rawLine = tidyText(row?.rawLine || "");
    if (!rawLine) continue;
    if (!/\p{L}/u.test(rawLine)) continue;
    if (looksLikeAdministrativeLine(rawLine) || isSectionHeaderText(rawLine) || isHeaderRowText(rawLine)) continue;
    if (knownPositions.has(String(row?.position || "")) && row?.reason === "validation_failed") continue;
    const key = `${row?.position || ""}|${rawLine}|${row?.reason || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: row?.id || `aps-unresolved-${normalized.length + 1}`,
      position: row?.position || "",
      rawLine,
      reason: row?.reason || "not_parsed",
    });
  }

  return normalized.slice(0, 120);
}

function parseRowsFallback(rows) {
  const specPages = pickSpecPages(rows);
  const pageRows = rows
    .filter((row) => specPages.has(row.pageNum))
    .sort((a, b) => a.pageNum - b.pageNum || b.y - a.y);

  const candidates = [];
  let current = null;

  const flushCurrent = () => {
    if (!current) return;
    candidates.push(current);
    current = null;
  };

  for (const row of pageRows) {
    const plainText = rowToPlainText(row);
    const rowText = stripNotesTail(plainText);
    if (!rowText || isHeaderRowText(rowText)) continue;
    if (looksLikeAdministrativeLine(rowText)) continue;

    const rowPosition = parseLeadingPosition(rowText);
    if (rowPosition) {
      flushCurrent();
      current = {
        position: rowPosition,
        text: rowText,
        pageNum: row.pageNum,
        y: row.y,
      };
      continue;
    }

    if (!current || current.pageNum !== row.pageNum) {
      flushCurrent();
      continue;
    }

    const isCloseRow = Math.abs(current.y - row.y) <= 24;
    const hasOwnQtyAndUnit = Boolean(extractQtyAndUnitFromText(rowText));
    const hasOwnPosition = Boolean(parseLeadingPosition(rowText));

    if (isCloseRow && !hasOwnQtyAndUnit && !hasOwnPosition) {
      current.text = tidyText(`${current.text} ${rowText}`);
      continue;
    }
  }

  flushCurrent();

  const items = [];
  const unresolvedRows = [];

  candidates.forEach((candidate, index) => {
    const result = buildFallbackItemFromLine(candidate, index);
    if (result.item) items.push(result.item);
    if (result.unresolved) unresolvedRows.push(result.unresolved);
  });

  return {
    items,
    candidateRows: candidates.length,
    unrecognizedRows: cleanupUnrecognizedRows(unresolvedRows),
  };
}

function buildParseQuality({ items = [], candidateRows = 0, unrecognizedRows = [] }) {
  const recognizedPositions = items.length;
  const unresolvedPositions = unrecognizedRows.length;
  const denominator = Math.max(candidateRows, recognizedPositions + unresolvedPositions, 1);
  const recognitionRate = recognizedPositions / denominator;

  return {
    candidateRows,
    recognizedPositions,
    unresolvedPositions,
    recognitionRate,
  };
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

  const primaryRows = parseRowsToItems(allRows);
  const fallbackRows = parseRowsFallback(allRows);
  const items = mergeItems([...(primaryRows.items || []), ...fallbackRows.items]);
  const recognizedPositions = new Set(items.map((item) => String(item.position || "")));
  const unrecognizedRows = cleanupUnrecognizedRows(
    [...(primaryRows.unrecognizedRows || []), ...(fallbackRows.unrecognizedRows || [])],
    recognizedPositions
  );
  const parseQuality = buildParseQuality({
    items,
    candidateRows: Math.max(primaryRows.candidateRows || 0, fallbackRows.candidateRows || 0, items.length + unrecognizedRows.length),
    unrecognizedRows,
  });
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
    unrecognizedRows,
    parseQuality,
  };
}
