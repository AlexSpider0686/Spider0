import PptxGenJS from "pptxgenjs";

const COLORS = {
  bg: "EEF4FC",
  panel: "F7FAFF",
  panelSoft: "FFFFFF",
  line: "B7C7DC",
  title: "1E3553",
  text: "2F4A69",
  muted: "6E8098",
  accent: "1E9FC5",
  accentDark: "1F5A99",
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function safeNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function rub(value) {
  return `${CURRENCY_FORMATTER.format(safeNum(value))} ₽`;
}

function num(value, digits = 1) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeNum(value));
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function shortenText(value, max = 96) {
  const text = sanitizeText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(max - 1, 1))}…`;
}

function safeFileName(name) {
  const base = sanitizeText(name || "Объект 1");
  const cleaned = base.replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
  return `${cleaned || "Объект_1"}-presentation.pptx`;
}

function normalizeWidths(widths, totalWidth) {
  const prepared = widths.map((value) => safeNum(value, 0));
  const sum = prepared.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return prepared.map(() => totalWidth / prepared.length);
  if (sum <= 1.001) return prepared.map((value) => value * totalWidth);
  return prepared.map((value) => (value / sum) * totalWidth);
}

function addSlideFrame(slide, title, subtitle, pageNumber) {
  slide.background = { color: COLORS.bg };
  slide.addShape("rect", {
    x: 0.35,
    y: 0.2,
    w: 12.63,
    h: 0.02,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent, pt: 0 },
  });

  slide.addText(sanitizeText(title), {
    x: 0.5,
    y: 0.35,
    w: 9.6,
    h: 0.45,
    fontFace: "Calibri",
    fontSize: 21,
    bold: true,
    color: COLORS.title,
  });

  slide.addText(sanitizeText(subtitle), {
    x: 0.5,
    y: 0.82,
    w: 9.8,
    h: 0.28,
    fontFace: "Calibri",
    fontSize: 11,
    color: COLORS.muted,
  });

  slide.addText(String(pageNumber), {
    x: 12.52,
    y: 7.02,
    w: 0.25,
    h: 0.2,
    align: "right",
    fontFace: "Calibri",
    fontSize: 10,
    color: COLORS.muted,
  });
}

function addMetricCards(slide, cards, x, y, w) {
  const gap = 0.12;
  const cardWidth = (w - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const left = x + index * (cardWidth + gap);
    slide.addShape("roundRect", {
      x: left,
      y,
      w: cardWidth,
      h: 0.9,
      rectRadius: 0.08,
      fill: { color: COLORS.panelSoft, transparency: 4 },
      line: { color: COLORS.line, pt: 1 },
    });
    slide.addText(sanitizeText(card.label), {
      x: left + 0.08,
      y: y + 0.08,
      w: cardWidth - 0.16,
      h: 0.22,
      fontFace: "Calibri",
      fontSize: 9,
      color: COLORS.muted,
    });
    slide.addText(sanitizeText(card.value), {
      x: left + 0.08,
      y: y + 0.3,
      w: cardWidth - 0.16,
      h: 0.4,
      fontFace: "Calibri",
      fontSize: 15,
      bold: true,
      color: COLORS.title,
    });
  });
}

function drawTable(slide, options) {
  const {
    x,
    y,
    w,
    headers = [],
    rows = [],
    widths = [],
    maxRows = 10,
    rowH = 0.34,
    fontSize = 9,
    headerFill = "DFEBF8",
  } = options;

  if (!headers.length) return;

  const columnWidths = normalizeWidths(widths.length ? widths : headers.map(() => 1), w);
  const bodyRows = rows.slice(0, maxRows);
  let currentY = y;

  let currentX = x;
  headers.forEach((header, columnIndex) => {
    const cw = columnWidths[columnIndex];
    slide.addShape("rect", {
      x: currentX,
      y: currentY,
      w: cw,
      h: rowH,
      fill: { color: headerFill },
      line: { color: COLORS.line, pt: 1 },
    });
    slide.addText(sanitizeText(header), {
      x: currentX + 0.04,
      y: currentY + 0.06,
      w: Math.max(cw - 0.08, 0.01),
      h: rowH - 0.08,
      fontFace: "Calibri",
      bold: true,
      fontSize: Math.max(fontSize - 1, 8),
      color: COLORS.title,
      valign: "mid",
    });
    currentX += cw;
  });

  currentY += rowH;
  bodyRows.forEach((row) => {
    currentX = x;
    headers.forEach((_, columnIndex) => {
      const cw = columnWidths[columnIndex];
      const raw = Array.isArray(row) ? row[columnIndex] : "";
      slide.addShape("rect", {
        x: currentX,
        y: currentY,
        w: cw,
        h: rowH,
        fill: { color: COLORS.panelSoft, transparency: 0 },
        line: { color: COLORS.line, pt: 1 },
      });
      slide.addText(sanitizeText(raw), {
        x: currentX + 0.04,
        y: currentY + 0.05,
        w: Math.max(cw - 0.08, 0.01),
        h: rowH - 0.08,
        fontFace: "Calibri",
        fontSize,
        color: COLORS.text,
        valign: "mid",
      });
      currentX += cw;
    });
    currentY += rowH;
  });
}

function chunkArray(list = [], chunkSize = 10) {
  const normalizedSize = Math.max(Math.floor(safeNum(chunkSize, 1)), 1);
  const chunks = [];
  for (let index = 0; index < list.length; index += normalizedSize) {
    chunks.push(list.slice(index, index + normalizedSize));
  }
  return chunks;
}

function buildEquipmentRegistryRows(systemResults = []) {
  const rows = [];

  for (const system of systemResults) {
    const systemName = sanitizeText(system?.systemName || system?.systemType || "—");
    const details = Array.isArray(system?.equipmentData?.details) ? system.equipmentData.details : [];
    const marketEntries = Array.isArray(system?.equipmentData?.marketEntries) ? system.equipmentData.marketEntries : [];
    const linkIndex = new Map();

    for (const entry of marketEntries) {
      const label = sanitizeText(entry?.equipmentLabel || "").toLowerCase();
      const source = sanitizeText((entry?.usedSources || [])[0] || "");
      if (!label || !source || linkIndex.has(label)) continue;
      linkIndex.set(label, source);
    }

    if (!details.length) {
      rows.push([systemName, "—", "—", "—", "—", "—"]);
      continue;
    }

    for (const item of details) {
      const itemName = sanitizeText(item?.name || item?.code || "—");
      const itemModel = sanitizeText(item?.model || "");
      const fullName = itemModel ? `${itemName} (${itemModel})` : itemName;
      const qty = safeNum(item?.qty, 0);
      const unit = sanitizeText(item?.unit || "");
      const unitPrice = safeNum(item?.unitPrice, 0);
      const total = safeNum(item?.total, qty * unitPrice);

      let sourceLink = sanitizeText((item?.usedSources || [])[0] || "");
      if (!sourceLink) {
        const candidates = [fullName, itemName, itemModel].map((value) => sanitizeText(value).toLowerCase()).filter(Boolean);
        const found = candidates.find((candidate) => linkIndex.has(candidate));
        if (found) sourceLink = linkIndex.get(found) || "";
      }

      rows.push([
        systemName,
        shortenText(fullName, 72),
        `${num(qty, 0)} ${unit}`.trim(),
        rub(unitPrice),
        rub(total),
        shortenText(sourceLink || "нет ссылки", 72),
      ]);
    }
  }

  return rows;
}

function buildRecognizedSpecRows(apsProjectExports = []) {
  const rows = [];

  for (const project of apsProjectExports) {
    const systemName = sanitizeText(project?.systemName || project?.systemType || "—");
    const fileName = sanitizeText(project?.fileName || "PDF-спецификация");
    const items = Array.isArray(project?.items) ? project.items : [];

    if (!items.length) {
      rows.push([systemName, fileName, "—", "Нет распознанных позиций", "—", "—", "—"]);
      continue;
    }

    for (const item of items) {
      const itemName = sanitizeText(item?.name || "—");
      const itemModel = sanitizeText(item?.model || item?.brand || "");
      const fullName = itemModel ? `${itemName} (${itemModel})` : itemName;
      const qty = safeNum(item?.qty, 0);
      const unit = sanitizeText(item?.unit || "");
      const unitPrice = safeNum(item?.unitPrice, 0);
      const total = safeNum(item?.total, qty * unitPrice);
      const position = sanitizeText(item?.position || "—");
      rows.push([
        systemName,
        shortenText(fileName, 28),
        position,
        shortenText(fullName, 46),
        `${num(qty, 0)} ${unit}`.trim(),
        rub(unitPrice),
        rub(total),
      ]);
    }
  }

  return rows;
}

function buildUnifiedSpecificationRows(systemResults = [], apsProjectExports = []) {
  const rows = [];
  const apsTypes = new Set(
    apsProjectExports
      .map((project) => sanitizeText(project?.systemType || "").toLowerCase())
      .filter(Boolean)
  );

  for (const system of systemResults) {
    const systemType = sanitizeText(system?.systemType || "").toLowerCase();
    if (apsTypes.has(systemType)) continue;

    const systemName = sanitizeText(system?.systemName || system?.systemType || "—");
    const details = Array.isArray(system?.equipmentData?.details) ? system.equipmentData.details : [];
    const marketEntries = Array.isArray(system?.equipmentData?.marketEntries) ? system.equipmentData.marketEntries : [];
    const linkIndex = new Map();

    for (const entry of marketEntries) {
      const label = sanitizeText(entry?.equipmentLabel || "").toLowerCase();
      const source = sanitizeText((entry?.usedSources || [])[0] || "");
      if (!label || !source || linkIndex.has(label)) continue;
      linkIndex.set(label, source);
    }

    for (const item of details) {
      const itemName = sanitizeText(item?.name || item?.code || "—");
      const itemModel = sanitizeText(item?.model || "");
      const fullName = itemModel ? `${itemName} (${itemModel})` : itemName;
      const qty = safeNum(item?.qty, 0);
      const unit = sanitizeText(item?.unit || "");
      const unitPrice = safeNum(item?.unitPrice, 0);
      const total = safeNum(item?.total, qty * unitPrice);

      let sourceLink = sanitizeText((item?.usedSources || [])[0] || "");
      if (!sourceLink) {
        const candidates = [fullName, itemName, itemModel].map((value) => sanitizeText(value).toLowerCase()).filter(Boolean);
        const found = candidates.find((candidate) => linkIndex.has(candidate));
        if (found) sourceLink = linkIndex.get(found) || "";
      }

      rows.push([
        systemName,
        shortenText(fullName, 54),
        `${num(qty, 0)} ${unit}`.trim(),
        rub(unitPrice),
        rub(total),
        sourceLink || "нет ссылки",
        "—",
      ]);
    }
  }

  for (const project of apsProjectExports) {
    const systemName = sanitizeText(project?.systemName || project?.systemType || "—");
    const items = Array.isArray(project?.items) ? project.items : [];

    for (const item of items) {
      const itemName = sanitizeText(item?.name || "—");
      const itemModel = sanitizeText(item?.model || item?.brand || "");
      const fullName = itemModel ? `${itemName} (${itemModel})` : itemName;
      const qty = safeNum(item?.qty, 0);
      const unit = sanitizeText(item?.unit || "");
      const unitPrice = safeNum(item?.unitPrice, 0);
      const total = safeNum(item?.total, qty * unitPrice);
      const sourceLink = sanitizeText((item?.usedSources || [])[0] || "");
      const position = sanitizeText(item?.position || "—");

      rows.push([
        systemName,
        shortenText(fullName, 54),
        `${num(qty, 0)} ${unit}`.trim(),
        rub(unitPrice),
        rub(total),
        sourceLink || "нет ссылки",
        position,
      ]);
    }
  }

  return rows;
}

function buildProjectRiskRows(projectRisks = []) {
  return (Array.isArray(projectRisks) ? projectRisks : []).map((risk, index) => [
    `${index + 1}. ${sanitizeText(risk?.title || "Риск проекта")}`,
    sanitizeText(risk?.severity === "high" ? "Критичный" : "Повышенный"),
    shortenText(risk?.summary || "—", 120),
    shortenText(risk?.impact || "—", 140),
  ]);
}

function buildTimeline(systemResults, objectData, totals) {
  const systemsCount = Math.max(systemResults.length, 1);
  const area = safeNum(objectData?.totalArea, 0);
  const equipmentMillion = safeNum(totals?.totalEquipment, 0) / 1_000_000;
  const designMonths = Math.max(...systemResults.map((item) => Math.max(Math.ceil(safeNum(item.designDurationMonths, 1)), 1)), 1);
  const executionMonthsFromSystems = Math.max(...systemResults.map((item) => Math.max(Math.ceil(safeNum(item.executionDurationMonths, 0)), 0)), 0);
  const procurementMonths = Math.max(1, Math.min(5, Math.ceil(1 + systemsCount * 0.35 + equipmentMillion * 0.15)));
  const deliveryMonths = Math.max(1, Math.min(5, Math.ceil(1 + systemsCount * 0.3 + equipmentMillion * 0.12)));
  const smrMonths =
    executionMonthsFromSystems > 0
      ? Math.max(1, Math.min(9, executionMonthsFromSystems))
      : Math.max(2, Math.min(9, Math.ceil(1 + area / 12000 + systemsCount * 0.4)));
  const pnrMonths = Math.max(1, Math.min(4, Math.ceil(1 + systemsCount * 0.3)));

  const bars = [
    { label: "Проектирование", start: 1, duration: designMonths, color: "F59E0B" },
    { label: "Закупка и логистика", start: 1, duration: procurementMonths, color: "7C3AED" },
    { label: "Поставка оборудования", start: 2, duration: deliveryMonths, color: "0EA5A8" },
    { label: "Строительно-монтажные работы", start: Math.max(2, designMonths), duration: smrMonths, color: "2563EB" },
    { label: "ПНР и интеграция", start: Math.max(3, designMonths + smrMonths - 1), duration: pnrMonths, color: "16A34A" },
  ];

  const totalMonths = bars.reduce((acc, item) => Math.max(acc, item.start + item.duration - 1), 1);
  return { bars, totalMonths };
}

function addGanttSlide(slide, systemResults, objectData, totals) {
  const { bars, totalMonths } = buildTimeline(systemResults, objectData, totals);
  const chartX = 3.1;
  const chartY = 1.65;
  const chartW = 8.6;
  const rowH = 0.72;
  const monthW = chartW / Math.max(totalMonths, 1);

  slide.addShape("roundRect", {
    x: 0.5,
    y: 1.45,
    w: 11.9,
    h: 5.55,
    rectRadius: 0.08,
    fill: { color: COLORS.panel, transparency: 0 },
    line: { color: COLORS.line, pt: 1 },
  });

  for (let month = 1; month <= totalMonths; month += 1) {
    const x = chartX + (month - 1) * monthW;
    slide.addShape("line", {
      x,
      y: chartY - 0.22,
      w: 0,
      h: bars.length * rowH + 0.22,
      line: { color: "D9E5F3", pt: 1 },
    });
    slide.addText(`M${month}`, {
      x: x + 0.02,
      y: chartY - 0.43,
      w: Math.max(monthW - 0.04, 0.2),
      h: 0.18,
      align: "center",
      fontFace: "Calibri",
      fontSize: 9,
      bold: true,
      color: COLORS.title,
    });
  }

  bars.forEach((item, index) => {
    const y = chartY + index * rowH;
    slide.addText(item.label, {
      x: 0.78,
      y: y + 0.17,
      w: 2.25,
      h: 0.2,
      fontFace: "Calibri",
      fontSize: 11,
      bold: true,
      color: COLORS.title,
    });
    slide.addShape("roundRect", {
      x: chartX + (item.start - 1) * monthW + 0.02,
      y: y + 0.1,
      w: Math.max(item.duration * monthW - 0.04, monthW * 0.45),
      h: 0.34,
      rectRadius: 0.06,
      fill: { color: item.color },
      line: { color: item.color, pt: 1 },
    });
  });

  slide.addShape("roundRect", {
    x: 8.85,
    y: 6.45,
    w: 2.75,
    h: 0.36,
    rectRadius: 0.05,
    fill: { color: COLORS.accentDark },
    line: { color: COLORS.accentDark, pt: 1 },
  });
  slide.addText(`Готовность к сдаче: ${totalMonths} мес.`, {
    x: 8.92,
    y: 6.53,
    w: 2.6,
    h: 0.18,
    align: "center",
    fontFace: "Calibri",
    fontSize: 11,
    bold: true,
    color: "FFFFFF",
  });

  slide.addText(
    `Алгоритм сроков: площадь ${num(safeNum(objectData?.totalArea, 0), 0)} м², ` +
      `${systemResults.length} систем, объём оборудования ${rub(safeNum(totals?.totalEquipment, 0))}.`,
    {
      x: 0.8,
      y: 6.35,
      w: 7.6,
      h: 0.42,
      fontFace: "Calibri",
      fontSize: 9,
      color: COLORS.muted,
    }
  );
}

export async function exportEstimatePptx({ objectData, budget, systemResults, totals, apsProjectExports = [], projectRisks = [] }) {
  const safeObject = objectData || {};
  const safeBudget = budget || {};
  const safeSystems = Array.isArray(systemResults) ? systemResults : [];
  const safeTotals = totals || {};
  const safeApsProjects = Array.isArray(apsProjectExports) ? apsProjectExports : [];
  const safeProjectRisks = Array.isArray(projectRisks) ? projectRisks : [];

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Project.Core™";
  pptx.company = "Project.Core™";
  pptx.subject = "Предварительный расчет бюджета систем безопасности";
  pptx.title = "Project.Core™ — Экспорт ТКП";
  pptx.lang = "ru-RU";

  const slide1 = pptx.addSlide();
  addSlideFrame(
    slide1,
    "Общая бюджетная оценка проекта",
    "Оценка включает оборудование, материалы, СМР/ПНР и проектирование.",
    1
  );
  addMetricCards(
    slide1,
    [
      { label: "Оборудование", value: rub(safeTotals.totalEquipment) },
      { label: "Материалы", value: rub(safeTotals.totalMaterials) },
      { label: "СМР + ПНР", value: rub(safeTotals.totalWork) },
      { label: "Проектирование", value: rub(safeTotals.totalDesign) },
      { label: "Итог проекта", value: rub(safeTotals.total) },
    ],
    0.55,
    1.2,
    12.2
  );

  drawTable(slide1, {
    x: 0.58,
    y: 2.25,
    w: 6.2,
    headers: ["Статья", "Сумма, ₽"],
    widths: [0.67, 0.33],
    rows: [
      ["Оборудование", rub(safeTotals.totalEquipment)],
      ["Материалы", rub(safeTotals.totalMaterials)],
      ["СМР + ПНР", rub(safeTotals.totalWork)],
      ["Проектирование", rub(safeTotals.totalDesign)],
      ["Накладные и начисления", rub(safeTotals.totalOverhead)],
      ["Прибыль", rub(safeTotals.totalProfit)],
      ["НДС", rub(safeTotals.totalVat)],
      ["Итог бюджета проекта", rub(safeTotals.total)],
    ],
    maxRows: 8,
    rowH: 0.43,
    fontSize: 10,
  });

  drawTable(slide1, {
    x: 6.95,
    y: 2.25,
    w: 5.8,
    headers: ["Система", "Оборуд.", "Матер.", "СМР+ПНР", "Проект.", "Итог"],
    widths: [0.34, 0.13, 0.13, 0.14, 0.12, 0.14],
    rows: safeSystems.map((item) => [
      item.systemName || item.systemType || "—",
      rub(item.equipmentCost),
      rub(item.materialCost),
      rub(item.workTotal),
      rub(item.designTotal),
      rub(item.total),
    ]),
    maxRows: 9,
    rowH: 0.56,
    fontSize: 9,
  });

  const slide2 = pptx.addSlide();
  addSlideFrame(
    slide2,
    "Системы и ключевое оборудование",
    "Наименование, объём и стоимость ключевых позиций, влияющих на итоговую цену.",
    2
  );

  const equipmentRows = [];
  safeSystems.forEach((system) => {
    const keyItems = system?.equipmentData?.keyEquipment || [];
    if (!keyItems.length) {
      equipmentRows.push([system.systemName || "—", system.vendor || "—", "Нет ключевой позиции", "—", "—", "—", "—"]);
      return;
    }

    keyItems.forEach((item) => {
      equipmentRows.push([
        system.systemName || "—",
        system.vendor || "—",
        item.name || "—",
        num(item.qty, 0),
        rub(item.unitPrice),
        rub(item.total),
        item.basis || "Расчет по нормативной плотности",
      ]);
    });
  });

  drawTable(slide2, {
    x: 0.55,
    y: 1.2,
    w: 12.2,
    headers: ["Система", "Вендор", "Позиция", "Кол-во", "Цена", "Сумма", "Принцип расчета"],
    widths: [0.18, 0.11, 0.24, 0.08, 0.1, 0.1, 0.19],
    rows: equipmentRows,
    maxRows: 10,
    rowH: 0.53,
    fontSize: 8,
  });

  const sourceRows = safeSystems.map((system) => {
    const entries = system?.equipmentData?.marketEntries || [];
    const usedSources = [...new Set(entries.flatMap((entry) => entry.usedSources || []))];
    return [
      system.systemName || "—",
      entries.length ? String(entries.length) : "0",
      usedSources.length ? String(usedSources.length) : "0",
      usedSources.slice(0, 2).join(" | ") || "нет данных",
    ];
  });

  drawTable(slide2, {
    x: 0.55,
    y: 6.05,
    w: 12.2,
    headers: ["Система", "Проверено источников", "Источников с ценой", "Примеры источников"],
    widths: [0.22, 0.18, 0.16, 0.44],
    rows: sourceRows,
    maxRows: 4,
    rowH: 0.28,
    fontSize: 8,
    headerFill: "D9E9F8",
  });

  const slide3 = pptx.addSlide();
  addSlideFrame(slide3, "Характеристики бюджета", "Коэффициенты и параметры, влияющие на стоимость работ.", 3);

  drawTable(slide3, {
    x: 0.55,
    y: 1.2,
    w: 12.2,
    headers: ["Параметр", "Значение", "Пояснение"],
    widths: [0.3, 0.12, 0.58],
    rows: [
      ["Коэффициент кабельных работ", `x${num(safeBudget.cableCoef, 2)}`, "Учитывает сложность трассировки и дополнительные кабельные резервы."],
      ["Коэффициент стоимости оборудования", `x${num(safeBudget.equipmentCoef, 2)}`, "Используется для рыночной корректировки цен оборудования."],
      ["Коэффициент трудозатрат", `x${num(safeBudget.laborCoef, 2)}`, "Корректирует трудоемкость монтажных и пусконаладочных работ."],
      ["Коэффициент сложности", `x${num(safeBudget.complexityCoef, 2)}`, "Учитывает интеграцию, требования объекта и технологическую сложность."],
      ["Высотность работ", `x${num(safeBudget.heightCoef, 2)}`, "Повышает трудоемкость при работах на высоте."],
      ["Стесненность условий", `x${num(safeBudget.constrainedCoef, 2)}`, "Учитывает ограничения доступа и сложность логистики."],
      ["Работа на действующем объекте", `x${num(safeBudget.operatingFacilityCoef, 2)}`, "Добавляет поправку при монтаже без остановки эксплуатации."],
      ["Ночные работы", `x${num(safeBudget.nightWorkCoef, 2)}`, "Учитывает повышенную стоимость ночных смен."],
      ["Сложность маршрутов", `x${num(safeBudget.routingCoef, 2)}`, "Учитывает длину и сложность прокладки трасс."],
      ["Чистовая отделка", `x${num(safeBudget.finishCoef, 2)}`, "Повышает стоимость из-за аккуратного монтажа в отделке."],
      ["ОПР / накладные расходы", `${num(safeBudget.overheadPercent, 1)}%`, "Начисляются на базовую стоимость работ."],
      ["Отчисления ФОТ", `${num(safeBudget.payrollTaxesPercent, 1)}%`, "Начисляются на стоимость работ до применения регионального коэффициента."],
      ["Утилизация (отпуска, больничные)", `${num(safeBudget.utilizationPercent, 1)}%`, "Учитывает нерабочее время персонала."],
      ["СИЗ и расходники", `${num(safeBudget.ppePercent, 1)}%`, "Добавляются к стоимости работ."],
      ["Административно-хозяйственные расходы", `${num(safeBudget.adminPercent, 1)}%`, "Начисляются после ФОТ/ОПР/утилизации/СИЗ."],
      ["Рентабельность", `${num(safeBudget.profitabilityPercent, 1)}%`, "Маржинальная часть проекта."],
      ["НДС", `${num(safeBudget.vatPercent, 1)}%`, "Налог на добавленную стоимость."],
      ["Региональный коэффициент", `x${num(safeObject.regionCoef, 2)}`, `Регион: ${safeObject.regionName || "—"}. Применяется к стоимости работ.`],
    ],
    maxRows: 18,
    rowH: 0.31,
    fontSize: 8,
  });

  const slide4 = pptx.addSlide();
  addSlideFrame(slide4, "Стоимость проекта по системам", "Разложение стоимости по каждой системе отдельно.", 4);

  addMetricCards(
    slide4,
    [
      { label: "Оборудование", value: rub(safeTotals.totalEquipment) },
      { label: "Материалы", value: rub(safeTotals.totalMaterials) },
      { label: "Работы (СМР+ПНР)", value: rub(safeTotals.totalWork) },
      { label: "Проектирование", value: rub(safeTotals.totalDesign) },
      { label: "Общий бюджет", value: rub(safeTotals.total) },
    ],
    0.55,
    1.2,
    12.2
  );

  drawTable(slide4, {
    x: 0.55,
    y: 2.28,
    w: 12.2,
    headers: ["Система", "Оборуд.", "Матер.", "СМР+ПНР", "Проект.", "Итог", "Доля"],
    widths: [0.32, 0.11, 0.11, 0.12, 0.11, 0.13, 0.1],
    rows: safeSystems.map((item) => {
      const share = safeNum(safeTotals.total, 0) > 0 ? (safeNum(item.total, 0) / safeNum(safeTotals.total, 1)) * 100 : 0;
      return [
        item.systemName || "—",
        rub(item.equipmentCost),
        rub(item.materialCost),
        rub(item.workTotal),
        rub(item.designTotal),
        rub(item.total),
        `${num(share, 1)}%`,
      ];
    }),
    maxRows: 8,
    rowH: 0.6,
    fontSize: 9,
  });

  const unifiedSpecificationRows = buildUnifiedSpecificationRows(safeSystems, safeApsProjects);
  const specificationChunks = chunkArray(
    unifiedSpecificationRows.length ? unifiedSpecificationRows : [["—", "Нет данных", "—", "—", "—", "—", "—"]],
    12
  );

  specificationChunks.forEach((rowsChunk, chunkIndex) => {
    const slide = pptx.addSlide();
    const titleSuffix = specificationChunks.length > 1 ? ` (${chunkIndex + 1}/${specificationChunks.length})` : "";
    addSlideFrame(
      slide,
      `Спецификация оборудования и материалов${titleSuffix}`,
      "Единый перечень по всем системам: оборудование, материалы, количество, цена, сумма, ссылка и позиция из проекта.",
      5 + chunkIndex
    );
    drawTable(slide, {
      x: 0.55,
      y: 1.2,
      w: 12.2,
      headers: ["Система", "Наименование", "Кол-во", "Цена за ед.", "Сумма", "Ссылка", "Поз. в файле"],
      widths: [0.13, 0.24, 0.09, 0.1, 0.1, 0.26, 0.08],
      rows: rowsChunk,
      maxRows: 12,
      rowH: 0.45,
      fontSize: 8,
    });
  });

  const riskRows = buildProjectRiskRows(safeProjectRisks);
  const riskSlide = pptx.addSlide();
  addSlideFrame(
    riskSlide,
    "AI-риски проекта",
    "До пяти самых критичных индивидуальных рисков по текущему объекту: монтаж, спецификация, закупка, координация и сроки.",
    5 + specificationChunks.length
  );
  drawTable(riskSlide, {
    x: 0.55,
    y: 1.2,
    w: 12.2,
    headers: ["Риск", "Уровень", "Почему модуль его выделил", "Что это означает для проекта"],
    widths: [0.24, 0.1, 0.31, 0.35],
    rows: riskRows.length
      ? riskRows
      : [["AI-риски проекта", "Низкий", "На текущем наборе данных модуль не видит выраженных критичных рисков.", "Список обновляется автоматически при любом изменении объекта, систем, обследования и цен."]],
    maxRows: 5,
    rowH: 0.9,
    fontSize: 9,
  });

  const slide6 = pptx.addSlide();
  addSlideFrame(
    slide6,
    "График реализации проекта",
    "Ориентировочные сроки проектирования, поставки, СМР, ПНР и интеграции.",
    6 + specificationChunks.length
  );
  addGanttSlide(slide6, safeSystems, safeObject, safeTotals);

  await pptx.writeFile({
    fileName: safeFileName(safeObject.projectName),
    compression: false,
  });
}
