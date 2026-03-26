const UNIT_SET = new Set([
  "\u0448\u0442",
  "\u043a\u043e\u043c\u043f\u043b",
  "\u043c",
  "\u043c2",
  "\u043a\u0433",
  "\u043b",
  "\u0443\u043f",
  "\u043b\u0438\u0441\u0442",
]);

const MODEL_TOKEN_REGEX = /[A-Z\u0410-\u042f\u04010-9]{2,}(?:[-/.][A-Z\u0410-\u042f\u04010-9]{1,})+/gu;

const CATEGORY_SIGNAL = {
  detector: /(\u0438\u0437\u0432\u0435\u0449|\u0434\u0430\u0442\u0447\u0438\u043a|\u0438\u043f\u0440|sensor|detector)/iu,
  panel: /(\u043f\u043f\u043a|\u043f\u0440\u0438\u0435\u043c\u043d\u043e|\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u043b|\u043f\u0430\u043d\u0435\u043b|\u0448\u043a\u0430\u0444|\u043c\u043e\u0434\u0443\u043b|\u043f\u0440\u0438\u0431|controller|panel)/iu,
  notification: /(\u043e\u043f\u043e\u0432\u0435\u0449|\u0442\u0430\u0431\u043b\u043e|\u0441\u0438\u0440\u0435\u043d|speaker|strobe)/iu,
  power: /(\u0440\u0438\u043f|\u0430\u043a\u0431|\u0431\u0430\u0442\u0430\u0440|\u0438\u0431\u043f|\u043f\u0438\u0442\u0430\u043d\u0438|power|battery)/iu,
  material: /(\u043a\u0430\u0431\u0435\u043b|\u043f\u0440\u043e\u0432\u043e\u0434|\u043b\u043e\u0442\u043e\u043a|\u043a\u043e\u0440\u043e\u0431|\u0442\u0440\u0443\u0431|\u0433\u043e\u0444\u0440|\u043a\u0440\u0435\u043f\u0435\u0436|\u043c\u0435\u0442\u0438\u0437|wire|cable|tray)/iu,
};

const NOTE_INLINE_START_REGEX =
  /(?:^|[\s,;:()[\]{}-])(?:\u043d\u0435\s+\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*|\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*|\u043f\u043e\s+\u043c\u0435\u0441\u0442\u0443|\u0432\s+\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442\u0435|\u0441\u043c\.?|\u0441\u043c\u043e\u0442\u0440\u0438|\u043f\u0440\u0438\u043c(?:\.|\s|$)|\u043f\u0440\u0438\u043c\u0435\u0447(?:\u0430\u043d\u0438\u0435|\u0430\u043d\u0438\u044f)?|\u0437\u0430\u043c\u0435\u043d[\u0430\u044b]?|\u0440\u0435\u0437\u0435\u0440\u0432|note)(?=$|[\s,;:()[\]{}-])/iu;
const NOTE_TAIL_REGEX =
  /(?:^|[\s,;:()[\]{}-])(?:\u043d\u0435\s+\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*|\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*|\u043f\u043e\s+\u043c\u0435\u0441\u0442\u0443|\u0432\s+\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442\u0435|\u0441\u043c\.?|\u0441\u043c\u043e\u0442\u0440\u0438|\u043f\u0440\u0438\u043c(?:\.|\s|$)|\u043f\u0440\u0438\u043c\u0435\u0447(?:\u0430\u043d\u0438\u0435|\u0430\u043d\u0438\u044f)?|\u0437\u0430\u043c\u0435\u043d[\u0430\u044b]?|\u0440\u0435\u0437\u0435\u0440\u0432|note)\s*.*$/iu;
const NOTE_QTY_TAIL_REGEX =
  /(?:^|[\s,;:()[\]{}-])\d+(?:[.,]\d+)?\s*(?:\u0448\u0442|\u0435\u0434|\u043a\u043e\u043c\u043f\u043b)?\s*(?:\u043d\u0435\s+)?\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*\s*.*$/iu;
const LEADING_MODEL_NOISE_REGEX = /^\s*\d+\s+(?=[A-Z\u0410-\u042f\u04010-9]{2,}(?:[-/.][A-Z\u0410-\u042f\u04010-9]{1,})+)/u;
const TRAILING_UNIT_TOKEN_REGEX =
  /\s+(?:\u0448\u0442(?:\u0443\u043a)?|\u0435\u0434(?:\u0438\u043d\u0438\u0446[\u0430\u044b]?)?|\u043a\u043e\u043c\u043f\u043b(?:\u0435\u043a\u0442)?|\u043c2|\u043c\u00b2|\u043c|\u043a\u0433|\u043b|\u0443\u043f(?:\u0430\u043a)?|\u043b\u0438\u0441\u0442(?:\u043e\u0432|\u0430)?)(?=$|[\s,;:()[\]{}-])/iu;

const MODEL_HINTS = [
  {
    pattern: /(?:\u0441\u0438\u0440\u0438\u0443\u0441|sirius|1-520-887-052)/iu,
    family: "\u0441\u0438\u0440\u0438\u0443\u0441",
    canonicalName: "\u041f\u0440\u0438\u0431\u043e\u0440 \u043f\u0440\u0438\u0435\u043c\u043d\u043e-\u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c\u043d\u044b\u0439",
    category: "panel",
  },
  {
    pattern: /(?:\u04412000-?\u043a\u0434\u043b|c2000-?kdl)/iu,
    family: "\u043a\u0434\u043b",
    canonicalName: "\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440 \u0430\u0434\u0440\u0435\u0441\u043d\u043e\u0439 \u043b\u0438\u043d\u0438\u0438",
    category: "panel",
  },
  {
    pattern: /(?:\u04412000-?\u0431\u043a\u0438|c2000-?bki)/iu,
    family: "\u0431\u043a\u0438",
    canonicalName: "\u0411\u043b\u043e\u043a \u0438\u043d\u0434\u0438\u043a\u0430\u0446\u0438\u0438 \u0441 \u043a\u043b\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u043e\u0439",
    category: "panel",
  },
  {
    pattern: /(?:\u04412000-?\u0441\u043f|c2000-?sp)/iu,
    family: "\u0441\u043f",
    canonicalName: "\u0411\u043b\u043e\u043a \u0441\u0438\u0433\u043d\u0430\u043b\u044c\u043d\u043e-\u043f\u0443\u0441\u043a\u043e\u0432\u043e\u0439 \u0430\u0434\u0440\u0435\u0441\u043d\u044b\u0439",
    category: "panel",
  },
  {
    pattern: /(?:\u0438\u043f\u0440|dip|ipr)/iu,
    family: "\u0438\u043f\u0440",
    canonicalName: "\u0418\u0437\u0432\u0435\u0449\u0430\u0442\u0435\u043b\u044c \u043f\u043e\u0436\u0430\u0440\u043d\u044b\u0439",
    category: "detector",
  },
  {
    pattern: /(?:\u043c\u043e\u043b\u043d\u0438\u044f|molniya)/iu,
    family: "\u043c\u043e\u043b\u043d\u0438\u044f",
    canonicalName: "\u041e\u043f\u043e\u0432\u0435\u0449\u0430\u0442\u0435\u043b\u044c",
    category: "notification",
  },
];

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDescriptor(value) {
  let normalized = normalizeText(value);
  if (!normalized) return "";
  normalized = normalized.replace(/\s+\d+(?:[.,]\d+)?\s*(?=(?:\u043d\u0435\s+)?\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*)/giu, " ");
  const inlineNoteStart = normalized.search(NOTE_INLINE_START_REGEX);
  const withoutInlineNote = inlineNoteStart >= 0 ? normalized.slice(0, inlineNoteStart) : normalized;
  const trimmed = withoutInlineNote
    .replace(NOTE_QTY_TAIL_REGEX, "")
    .replace(NOTE_TAIL_REGEX, "")
    .replace(LEADING_MODEL_NOISE_REGEX, "")
    .replace(/(?:^|[\s,;:()[\]{}-])(?:\u043d\u0435\s+)?\u043f\u0440\u0438\u0448\u043b[\u0430-\u044f\u0451]*\s*.*$/iu, "");
  return trimmed
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripTrailingUnitToken(value) {
  return sanitizeDescriptor(value).replace(TRAILING_UNIT_TOKEN_REGEX, "").trim();
}

function detectModel(text) {
  const normalized = normalizeText(text);
  const strict = normalized.match(MODEL_TOKEN_REGEX) || [];
  const best = strict.find((token) => /\d/u.test(token) && token.length >= 4);
  return best ? sanitizeDescriptor(best) : "";
}

function detectCategory(text) {
  const sample = normalizeText(text).toLowerCase();
  if (CATEGORY_SIGNAL.material.test(sample)) return "material";
  if (CATEGORY_SIGNAL.notification.test(sample)) return "notification";
  if (CATEGORY_SIGNAL.power.test(sample)) return "power";
  if (CATEGORY_SIGNAL.panel.test(sample)) return "panel";
  if (CATEGORY_SIGNAL.detector.test(sample)) return "detector";
  return "equipment";
}

function computeConfidence(item, flags) {
  let score = 0;
  if ((item.name || "").length >= 6) score += 0.18;
  if ((item.name || "").length >= 12) score += 0.08;
  if (item.model) score += 0.22;
  if (item.qty > 0) score += 0.2;
  if (UNIT_SET.has(String(item.unit || "").toLowerCase())) score += 0.12;
  if (item.category && item.category !== "equipment") score += 0.12;
  if ((item.rawLine || "").length <= 160) score += 0.06;
  if (flags.noteTrimmed) score -= 0.08;
  if (flags.genericName) score -= 0.14;
  if ((item.name || "").length > 150) score -= 0.12;
  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function refineSingleItem(item) {
  const originalName = sanitizeDescriptor(item?.name || "");
  const originalModel = sanitizeDescriptor(item?.model || "");
  const rawLine = sanitizeDescriptor(item?.rawLine || `${originalName} ${originalModel}`.trim());
  const extractedModel = originalModel || detectModel(`${originalName} ${rawLine}`);
  const hint = MODEL_HINTS.find((entry) => entry.pattern.test(`${originalName} ${extractedModel}`));

  let name = stripTrailingUnitToken(originalName);
  let model = extractedModel;
  let category = item?.category || detectCategory(`${name} ${model}`);
  const flags = {
    noteTrimmed: rawLine !== normalizeText(item?.rawLine || ""),
    genericName: false,
    canonicalized: false,
  };

  if (hint) {
    const hasFamily = hint.family ? name.toLowerCase().includes(hint.family) : false;
    if (!name || name.length < 6 || !hasFamily) {
      name = stripTrailingUnitToken(hint.canonicalName);
      flags.canonicalized = true;
    }
    category = hint.category || category;
  }

  const genericName =
    !name ||
    /^(?:\u0438\u0437\u0434\u0435\u043b\u0438\u0435|\u043f\u043e\u0437\u0438\u0446\u0438\u044f|\u043e\u0431\u043e\u0440\u0443\u0434\u043e\u0432\u0430\u043d\u0438\u0435|\u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u043e|\u0431\u043b\u043e\u043a|\u043c\u043e\u0434\u0443\u043b\u044c)\b/iu.test(name) ||
    ((name.match(/\p{L}/gu) || []).length < 4 && !hint);
  flags.genericName = genericName;

  if (genericName && model && hint?.canonicalName) {
    name = stripTrailingUnitToken(hint.canonicalName);
    flags.canonicalized = true;
  }

  if (!name && model) {
    name = stripTrailingUnitToken(model);
  }

  if (!category || category === "equipment") {
    category = detectCategory(`${name} ${model}`);
  }

  const refined = {
    ...item,
    name: stripTrailingUnitToken(name || item?.name || ""),
    model: sanitizeDescriptor(model || item?.model || ""),
    rawLine,
    category,
  };

  const confidence = computeConfidence(refined, flags);
  const changed =
    refined.name !== (item?.name || "") ||
    refined.model !== (item?.model || "") ||
    refined.category !== (item?.category || "");

  return {
    item: {
      ...refined,
      aiConfidence: confidence,
      reviewRequired: confidence < 0.45 || item?.reviewRequired,
      reviewReason: confidence < 0.45 ? "low_ai_confidence" : item?.reviewReason,
    },
    changed,
    flags,
  };
}

export function applyApsAiRefinement({ items = [], unrecognizedRows = [], parseQuality = {} } = {}) {
  const refinedItems = [];
  let correctedItems = 0;
  let lowConfidenceItems = 0;
  let noteTrimmedItems = 0;
  let canonicalizedItems = 0;

  for (const item of items) {
    const refined = refineSingleItem(item);
    refinedItems.push(refined.item);
    if (refined.changed) correctedItems += 1;
    if (refined.item.aiConfidence < 0.45) lowConfidenceItems += 1;
    if (refined.flags.noteTrimmed) noteTrimmedItems += 1;
    if (refined.flags.canonicalized) canonicalizedItems += 1;
  }

  const candidateRows = Number(parseQuality?.candidateRows || refinedItems.length + unrecognizedRows.length || 1);
  const resolvedRows = refinedItems.length + unrecognizedRows.length;
  const algorithmRecognitionRate = Number(parseQuality?.recognitionRate || 0);
  const aiRecognitionRate = candidateRows > 0 ? refinedItems.length / Math.max(candidateRows, resolvedRows, 1) : 0;

  return {
    items: refinedItems,
    unrecognizedRows,
    aiQuality: {
      enabled: true,
      provider: "semantic_rules_v1",
      pipeline: ["algorithm", "ai_semantic", "final"],
      correctedItems,
      lowConfidenceItems,
      noteTrimmedItems,
      canonicalizedItems,
      algorithmRecognitionRate,
      aiRecognitionRate,
    },
  };
}
