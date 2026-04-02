import PptxGenJS from "pptxgenjs";
import { buildProjectTimeline } from "./projectTimeline.js";

const C = {
  bg: "EEF4FA",
  ink: "17324E",
  text: "32506B",
  muted: "6E8398",
  line: "D6E3EF",
  white: "FFFFFF",
  panel: "F8FBFE",
  sky: "EAF4FF",
  blue: "1D88D2",
  blueDark: "165A8E",
  green: "189F6B",
  violet: "785AF8",
  gold: "D6A63D",
  red: "D94A61",
};

const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const n = (v, f = 0) => {
  const p = Number(v);
  return Number.isFinite(p) ? p : f;
};

const txt = (v) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();
const filePart = (v, fallback) => txt(v || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80) || fallback;
const rub = (v) => `${RUB.format(n(v))} ₽`;
const dayRange = (s, d) => (d <= 1 ? `Д${s}` : `Д${s}-Д${s + d - 1}`);

function downloadBlob(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function parseDisposition(v) {
  const raw = String(v || "");
  const utf = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) return decodeURIComponent(utf[1]);
  return raw.match(/filename="?([^"]+)"?/i)?.[1] || null;
}

function splitDuration(total, rows) {
  const safeTotal = Math.max(n(total, 1), 1);
  const parts = rows.filter((r) => n(r.weight) > 0);
  const weight = parts.reduce((s, r) => s + n(r.weight), 0) || 1;
  let left = safeTotal;
  return parts.map((row, i) => {
    if (i === parts.length - 1) return { ...row, duration: Math.max(left, 1) };
    const raw = Math.round((safeTotal * n(row.weight)) / weight);
    const duration = Math.max(1, Math.min(raw, left - (parts.length - i - 1)));
    left -= duration;
    return { ...row, duration };
  });
}

function buildSystemRows(systemResults, timeline) {
  const smr = timeline.phaseMap.smr;
  const pnr = timeline.phaseMap.pnr;
  return (Array.isArray(systemResults) ? systemResults : []).map((item, index) => {
    const smrDuration = Math.max(5, Math.min(Math.ceil(n(item?.executionDurationMonths, 1) * 22), smr.duration));
    const pnrDuration = Math.max(3, Math.min(Math.ceil(smrDuration * 0.35), pnr.duration));
    return {
      name: txt(item?.systemName || item?.systemType || `Система ${index + 1}`),
      vendor: txt(item?.vendor || "Не определен"),
      mode: item?.estimateMode === "project_pdf" ? "По PDF-спецификации" : "По расчетной модели",
      smrStart: Math.max(smr.start, smr.finish - smrDuration + 1),
      smrDuration,
      pnrStart: Math.max(pnr.start, pnr.finish - pnrDuration + 1),
      pnrDuration,
      total: n(item?.total, 0),
    };
  });
}

export function buildProjectPlan(payload = {}) {
  const { objectData = {}, systemResults = [], totals = {}, projectRisks = [], apsProjectExports = [] } = payload;
  const timeline = buildProjectTimeline(systemResults, objectData, totals);
  const phaseMap = timeline.phaseMap;
  const tasks = [];
  let order = 1;
  const push = (phase, rows, owner) => {
    let start = phaseMap[phase].start;
    rows.forEach((row) => {
      tasks.push({ order, phase, name: row.name, start, duration: row.duration, finish: start + row.duration - 1, owner, comment: phaseMap[phase].label });
      start += row.duration;
      order += 1;
    });
  };

  push("design", splitDuration(phaseMap.design.duration, [
    { name: "Старт проекта и верификация исходных данных", weight: 1.1 },
    { name: "AI-обследование и фиксация ограничений", weight: 1.2 },
    { name: "Формирование технической концепции", weight: 1.15 },
    { name: "Утверждение верхнеуровневого графика", weight: 0.95 },
  ]), "PMO / проектный контур");
  push("procurement", splitDuration(phaseMap.procurement.duration, [
    { name: "Подготовка закупочной спецификации", weight: 1.15 },
    { name: "Согласование бюджета и логистики", weight: 0.95 },
  ]), "Закупка");
  push("delivery", splitDuration(phaseMap.delivery.duration, [
    { name: "Комплектация заказа", weight: 1.05 },
    { name: "Поставка на объект и входной контроль", weight: 0.95 },
  ]), "Логистика");
  push("smr", splitDuration(phaseMap.smr.duration, [
    { name: "Подготовка фронта работ", weight: 0.75 },
    { name: "Прокладка трасс и монтаж инфраструктуры", weight: 1.45 },
    { name: "Монтаж оборудования", weight: 1.2 },
    { name: "Локальная проверка готовности", weight: 0.7 },
  ]), "Монтаж");
  push("pnr", splitDuration(phaseMap.pnr.duration, [
    { name: "Пусконаладка и адресация", weight: 1.1 },
    { name: "Интеграция и комплексные испытания", weight: 1.2 },
    { name: "Сдача исполнительных материалов", weight: 0.7 },
  ]), "ПНР / интеграция");

  const systemRows = buildSystemRows(systemResults, timeline);
  systemRows.forEach((row) => {
    tasks.push({ order, phase: "smr", name: `${row.name}: монтаж и трассы`, start: row.smrStart, duration: row.smrDuration, finish: row.smrStart + row.smrDuration - 1, owner: `${row.vendor} / монтаж`, comment: row.mode });
    order += 1;
    tasks.push({ order, phase: "pnr", name: `${row.name}: ПНР и интеграция`, start: row.pnrStart, duration: row.pnrDuration, finish: row.pnrStart + row.pnrDuration - 1, owner: `${row.vendor} / ПНР`, comment: "Финальная настройка и приемка" });
    order += 1;
  });

  const cost = [
    { label: "Оборудование", color: C.blue, value: n(totals?.totalEquipment, 0) },
    { label: "Материалы", color: C.violet, value: n(totals?.totalMaterials, 0) },
    { label: "СМР + ПНР", color: C.green, value: n(totals?.totalLabor, 0) },
    { label: "Проектирование", color: C.gold, value: n(totals?.totalDesign, 0) },
  ].filter((item) => item.value > 0);

  return {
    timeline,
    tasks,
    systemRows,
    cost,
    risks: (Array.isArray(projectRisks) ? projectRisks : []).slice(0, 5).map((item) => ({
      title: txt(item?.title || "Проектный риск"),
      severity: txt(item?.severityLabel || item?.severity || "Средний"),
      summary: txt(item?.summary || item?.impact || "Требует контроля при календарном планировании."),
    })),
    notes: [
      `Тип объекта: ${txt(objectData?.objectTypeLabel || objectData?.objectType || "Объект")}.`,
      `Активных систем: ${timeline.systemsCount}.`,
      apsProjectExports?.length ? `По ${apsProjectExports.length} системам использована проектная PDF-спецификация.` : "План собран по параметрической модели платформы.",
      "Единица измерения сроков: рабочие дни.",
    ],
    summary: {
      generatedAt: new Date().toLocaleDateString("ru-RU"),
      projectName: txt(objectData?.projectName || "Объект 1"),
      address: txt(objectData?.address || "Адрес не указан"),
      objectType: txt(objectData?.objectTypeLabel || objectData?.objectType || "Объект"),
      systemsCount: timeline.systemsCount,
      totalDays: timeline.totalDays,
      totalBudget: n(totals?.total, 0),
    },
    disclaimer:
      "Сроки указаны в рабочих днях и носят предварительный характер. Финальный календарный график уточняется после подтверждения РД, поставок, доступа на объект и подрядного ресурса.",
  };
}

function bg(slide) {
  slide.background = { color: C.bg };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.42, fill: { color: C.blueDark }, line: { color: C.blueDark, pt: 0 } });
  slide.addShape("ellipse", { x: 10.7, y: -1.2, w: 3.7, h: 3.7, fill: { color: "DCEEFF", transparency: 16 }, line: { color: "DCEEFF", transparency: 100, pt: 0 } });
  slide.addShape("ellipse", { x: -0.9, y: 5.7, w: 2.8, h: 2.8, fill: { color: "DFF7F0", transparency: 18 }, line: { color: "DFF7F0", transparency: 100, pt: 0 } });
}

function frame(slide, title, subtitle, page) {
  bg(slide);
  slide.addText("PROJECT.CORE™ / AI-ПЛАНИРОВАНИЕ", { x: 0.66, y: 0.22, w: 4.5, h: 0.14, fontFace: "Calibri", fontSize: 8, bold: true, color: C.white, charSpace: 0.6 });
  slide.addText(title, { x: 0.74, y: 0.72, w: 8.2, h: 0.4, fontFace: "Calibri", fontSize: 22, bold: true, color: C.ink });
  slide.addText(subtitle, { x: 0.74, y: 1.13, w: 9.5, h: 0.24, fontFace: "Calibri", fontSize: 11, color: C.muted });
  slide.addText(String(page), { x: 12.52, y: 7.02, w: 0.25, h: 0.16, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "right" });
}

function card(slide, x, y, w, title, value, note, accent = C.blue) {
  slide.addShape("roundRect", { x, y, w, h: 1.08, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("rect", { x, y, w: 0.08, h: 1.08, fill: { color: accent }, line: { color: accent, pt: 0 } });
  slide.addText(title, { x: x + 0.18, y: y + 0.16, w: w - 0.3, h: 0.14, fontFace: "Calibri", fontSize: 9, bold: true, color: C.muted });
  slide.addText(value, { x: x + 0.18, y: y + 0.4, w: w - 0.3, h: 0.22, fontFace: "Calibri", fontSize: 18, bold: true, color: C.ink });
  slide.addText(note, { x: x + 0.18, y: y + 0.76, w: w - 0.3, h: 0.14, fontFace: "Calibri", fontSize: 8.4, color: C.muted });
}

function cover(slide, plan) {
  bg(slide);
  slide.addShape("roundRect", { x: 0.68, y: 0.9, w: 7.7, h: 5.85, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 8.68, y: 0.9, w: 3.95, h: 5.85, rectRadius: 0.12, fill: { color: C.sky }, line: { color: C.line, pt: 1 } });
  slide.addText("PROJECT.CORE™", { x: 0.96, y: 1.14, w: 2.5, h: 0.16, fontFace: "Calibri", fontSize: 9, bold: true, color: C.blue, charSpace: 0.8 });
  slide.addText("План проекта по реализации систем безопасности", { x: 0.96, y: 1.48, w: 6.8, h: 0.98, fontFace: "Calibri", fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText(`Объект: ${plan.summary.projectName}`, { x: 0.96, y: 2.6, w: 6.1, h: 0.22, fontFace: "Calibri", fontSize: 14, bold: true, color: C.text });
  slide.addText(plan.summary.address, { x: 0.96, y: 2.9, w: 6.2, h: 0.38, fontFace: "Calibri", fontSize: 11, color: C.muted });
  slide.addText("Документ автоматически сформирован на основе данных объекта, состава систем, AI-аналитики, трудозатрат и бюджета проекта.", { x: 0.96, y: 3.38, w: 6.5, h: 0.48, fontFace: "Calibri", fontSize: 11, color: C.text });
  card(slide, 0.96, 4.26, 1.95, "Систем в плане", String(plan.summary.systemsCount), "Подсистемы");
  card(slide, 3.05, 4.26, 1.95, "Горизонт", `${plan.summary.totalDays} дн.`, "Рабочие дни", C.green);
  card(slide, 5.14, 4.26, 2.22, "Бюджет", rub(plan.summary.totalBudget), "По текущей модели", C.violet);
  slide.addText("Паспорт плана", { x: 8.98, y: 1.22, w: 2.1, h: 0.18, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  [["Тип объекта", plan.summary.objectType], ["Дата генерации", plan.summary.generatedAt], ["Формат сроков", "Рабочие дни"], ["Источник", "AI-планирование Project.Core™"]].forEach(([a, b], i) => {
    slide.addText(a, { x: 8.98, y: 1.68 + i * 0.8, w: 2.6, h: 0.14, fontFace: "Calibri", fontSize: 9, bold: true, color: C.muted });
    slide.addText(b, { x: 8.98, y: 1.92 + i * 0.8, w: 3.0, h: 0.22, fontFace: "Calibri", fontSize: 13, bold: true, color: C.ink });
  });
  slide.addText(plan.disclaimer, { x: 0.96, y: 6.08, w: 11.2, h: 0.32, fontFace: "Calibri", fontSize: 8.8, color: C.muted });
}

function dashboard(slide, plan) {
  frame(slide, "Исполнительное резюме и ключевые параметры плана", "Сводка по охвату проекта, бюджету и предпосылкам календарного контура.", 2);
  card(slide, 0.74, 1.62, 2.46, "Итоговый бюджет", rub(plan.summary.totalBudget), "Общий бюджет проекта");
  card(slide, 3.34, 1.62, 2.0, "Системы", String(plan.summary.systemsCount), "Количество подсистем", C.green);
  card(slide, 5.48, 1.62, 2.0, "Срок", `${plan.summary.totalDays} дн.`, "Рабочие дни", C.violet);
  card(slide, 7.62, 1.62, 2.0, "Риски", String(plan.risks.length), "AI-контур", C.gold);
  card(slide, 9.76, 1.62, 2.8, "Структура плана", `${plan.tasks.length} задач`, "WBS верхнего уровня", C.blueDark);
  slide.addShape("roundRect", { x: 0.74, y: 3.02, w: 5.72, h: 3.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 6.66, y: 3.02, w: 5.86, h: 3.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addText("Что вошло в контур планирования", { x: 1.02, y: 3.24, w: 3.2, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  plan.notes.forEach((item, i) => slide.addText(`• ${item}`, { x: 1.04, y: 3.62 + i * 0.48, w: 5.0, h: 0.26, fontFace: "Calibri", fontSize: 10.2, color: C.text }));
  slide.addText("Принятые допущения", { x: 6.94, y: 3.24, w: 2.6, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  plan.timeline.assumptions.slice(0, 3).forEach((item, i) => slide.addText(`• ${item}`, { x: 6.96, y: 3.62 + i * 0.62, w: 5.2, h: 0.42, fontFace: "Calibri", fontSize: 10, color: C.text }));
}

function roadmap(slide, plan) {
  frame(slide, "Дорожная карта проекта и календарный контур", "Фазы синхронизированы по рабочим дням и готовы к переносу в MS Project.", 3);
  slide.addShape("roundRect", { x: 0.74, y: 1.56, w: 11.94, h: 5.52, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  const x0 = 3.42, y0 = 2.02, w = 8.78, h = 0.72, total = Math.max(plan.timeline.totalDays, 1), step = total > 160 ? 20 : total > 90 ? 10 : 5, dayW = w / total;
  for (let day = 1; day <= total; day += step) {
    const x = x0 + (day - 1) * dayW;
    slide.addShape("line", { x, y: y0 - 0.2, w: 0, h: plan.timeline.bars.length * h + 0.2, line: { color: "E6EEF7", pt: 1 } });
    slide.addText(`Д${day}`, { x: x - 0.08, y: y0 - 0.44, w: 0.35, h: 0.14, fontFace: "Calibri", fontSize: 8, color: C.muted, align: "center" });
  }
  plan.timeline.bars.forEach((row, i) => {
    const y = y0 + i * h;
    slide.addText(row.label, { x: 1.0, y: y + 0.16, w: 2.15, h: 0.16, fontFace: "Calibri", fontSize: 11, bold: true, color: C.ink });
    slide.addText(dayRange(row.start, row.duration), { x: 2.2, y: y + 0.16, w: 0.9, h: 0.16, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right" });
    slide.addShape("roundRect", { x: x0 + (row.start - 1) * dayW, y: y + 0.08, w: Math.max(row.duration * dayW, 0.24), h: 0.34, rectRadius: 0.06, fill: { color: row.color }, line: { color: row.color, pt: 1 } });
    slide.addText(`${row.duration} дн.`, { x: x0 + (row.start - 1) * dayW + 0.04, y: y + 0.15, w: Math.max(row.duration * dayW - 0.08, 0.4), h: 0.12, fontFace: "Calibri", fontSize: 8, bold: true, color: C.white, align: "center" });
  });
  slide.addText("Контрольные точки", { x: 1.0, y: 5.86, w: 2.0, h: 0.16, fontFace: "Calibri", fontSize: 13, bold: true, color: C.ink });
  plan.timeline.bars.slice(0, 5).forEach((row, i) => {
    const x = 3.25 + i * 1.82;
    slide.addShape("roundRect", { x, y: 5.74, w: 1.58, h: 0.88, rectRadius: 0.06, fill: { color: C.panel }, line: { color: C.line, pt: 1 } });
    slide.addText(row.label, { x: x + 0.1, y: 5.88, w: 1.38, h: 0.16, fontFace: "Calibri", fontSize: 8.4, bold: true, color: C.text, align: "center" });
    slide.addText(`Финиш Д${row.finish}`, { x: x + 0.12, y: 6.2, w: 1.34, h: 0.12, fontFace: "Calibri", fontSize: 8.8, color: C.ink, align: "center" });
  });
}

function budget(slide, plan) {
  frame(slide, "Структура бюджета, графики и системный приоритет", "Стоимость раскладывается по бюджетным блокам и наиболее влияющим подсистемам.", 4);
  slide.addShape("roundRect", { x: 0.74, y: 1.58, w: 5.72, h: 5.5, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 6.68, y: 1.58, w: 6.04, h: 5.5, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addText("Бюджетные блоки", { x: 1.02, y: 1.8, w: 2.1, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  const total = Math.max(plan.summary.totalBudget, 1);
  plan.cost.forEach((item, i) => {
    const y = 2.28 + i * 0.88, ratio = item.value / total;
    slide.addText(item.label, { x: 1.04, y, w: 1.6, h: 0.14, fontFace: "Calibri", fontSize: 10, bold: true, color: C.text });
    slide.addText(`${rub(item.value)} / ${Math.round(ratio * 100)}%`, { x: 3.78, y, w: 1.95, h: 0.14, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right" });
    slide.addShape("roundRect", { x: 1.04, y: y + 0.28, w: 4.7, h: 0.18, rectRadius: 0.04, fill: { color: "ECF2F8" }, line: { color: "ECF2F8", pt: 0 } });
    slide.addShape("roundRect", { x: 1.04, y: y + 0.28, w: Math.max(4.7 * ratio, 0.08), h: 0.18, rectRadius: 0.04, fill: { color: item.color }, line: { color: item.color, pt: 0 } });
  });
  const top = [...plan.systemRows].sort((a, b) => b.total - a.total).slice(0, 6);
  const maxSys = Math.max(...top.map((item) => item.total), 1);
  slide.addText("Системы с наибольшим влиянием на бюджет", { x: 6.96, y: 1.8, w: 3.7, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  top.forEach((row, i) => {
    const y = 2.28 + i * 0.72, ratio = row.total / maxSys, color = i % 2 === 0 ? C.blue : C.green;
    slide.addText(row.name, { x: 6.96, y, w: 2.55, h: 0.14, fontFace: "Calibri", fontSize: 9.4, bold: true, color: C.text });
    slide.addText(rub(row.total), { x: 11.0, y, w: 1.25, h: 0.14, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right" });
    slide.addShape("roundRect", { x: 6.96, y: y + 0.22, w: 5.32, h: 0.18, rectRadius: 0.04, fill: { color: "ECF2F8" }, line: { color: "ECF2F8", pt: 0 } });
    slide.addShape("roundRect", { x: 6.96, y: y + 0.22, w: Math.max(5.32 * ratio, 0.1), h: 0.18, rectRadius: 0.04, fill: { color }, line: { color, pt: 0 } });
    slide.addText(`${row.vendor} / ${row.mode}`, { x: 6.96, y: y + 0.44, w: 4.5, h: 0.12, fontFace: "Calibri", fontSize: 8.4, color: C.muted });
  });
}

function governance(slide, plan) {
  frame(slide, "Риски, зависимости и следующий управленческий шаг", "Финальный слайд предназначен для согласования дорожной карты и точек контроля.", 5);
  slide.addShape("roundRect", { x: 0.74, y: 1.6, w: 4.06, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 4.98, y: 1.6, w: 3.64, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 8.82, y: 1.6, w: 3.9, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addText("Ключевые риски", { x: 1.02, y: 1.84, w: 2.2, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  const risks = plan.risks.length ? plan.risks : [{ title: "Критичных рисков не выявлено", severity: "Контрольный", summary: "План собран по стандартному сценарию без дополнительных ограничений." }];
  risks.slice(0, 4).forEach((r, i) => {
    slide.addShape("roundRect", { x: 1.02, y: 2.2 + i * 1.0, w: 3.48, h: 0.76, rectRadius: 0.06, fill: { color: i % 2 === 0 ? C.panel : C.white }, line: { color: C.line, pt: 1 } });
    slide.addText(r.title, { x: 1.16, y: 2.32 + i * 1.0, w: 2.9, h: 0.12, fontFace: "Calibri", fontSize: 9.4, bold: true, color: C.ink });
    slide.addText(`${r.severity} · ${r.summary}`, { x: 1.16, y: 2.54 + i * 1.0, w: 3.0, h: 0.24, fontFace: "Calibri", fontSize: 8.6, color: C.text });
  });
  slide.addText("Следующие шаги", { x: 5.26, y: 1.84, w: 2.1, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  [
    "Подтвердить исходные данные, ограничения и состав систем.",
    "Утвердить закупочный контур, поставщиков и логистику.",
    "Закрепить фронт монтажных работ и подрядный ресурс.",
    "Подтвердить окно ПНР, приемки и исполнительной документации.",
  ].forEach((item, i) => {
    slide.addShape("roundRect", { x: 5.26, y: 2.2 + i * 0.9, w: 3.0, h: 0.58, rectRadius: 0.06, fill: { color: C.sky }, line: { color: C.line, pt: 1 } });
    slide.addText(`${i + 1}. ${item}`, { x: 5.38, y: 2.35 + i * 0.9, w: 2.72, h: 0.24, fontFace: "Calibri", fontSize: 8.8, color: C.text });
  });
  slide.addText("Управленческая рамка", { x: 9.1, y: 1.84, w: 2.4, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  ["Единица сроков — рабочие дни.", "План готов для переноса в MS Project.", "Таймлайн синхронизирован с бюджетной логикой Project.Core™.", "Перед выпуском в производство нужно подтвердить РД, поставки, доступы и подрядный контур."].forEach((item, i) => {
    slide.addText(`• ${item}`, { x: 9.12, y: 2.26 + i * 0.56, w: 3.1, h: 0.24, fontFace: "Calibri", fontSize: 9, color: C.text });
  });
  slide.addText(plan.disclaimer, { x: 9.12, y: 5.56, w: 3.08, h: 0.82, fontFace: "Calibri", fontSize: 8.5, color: C.muted });
}

async function exportPptx(plan) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Project.Core™";
  pptx.company = "Project.Core™";
  pptx.subject = "План проекта";
  pptx.title = `Project.Core™ — план проекта ${plan.summary.projectName}`;
  pptx.lang = "ru-RU";
  cover(pptx.addSlide(), plan);
  dashboard(pptx.addSlide(), plan);
  roadmap(pptx.addSlide(), plan);
  budget(pptx.addSlide(), plan);
  governance(pptx.addSlide(), plan);
  await pptx.writeFile({ fileName: `${filePart(plan.summary.projectName, "project")}_project_plan.pptx` });
}

function xmlEscape(v) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function toProjectDate(day) {
  const base = new Date(Date.UTC(2026, 0, 1, 8, 0, 0));
  base.setUTCDate(base.getUTCDate() + Math.max(day - 1, 0));
  return base.toISOString().replace(".000Z", "");
}

export function buildMsProjectXml(plan) {
  const tasks = plan.tasks.map((task, i) => `
    <Task>
      <UID>${i + 1}</UID>
      <ID>${i + 1}</ID>
      <Name>${xmlEscape(task.name)}</Name>
      <OutlineLevel>${task.phase === "smr" || task.phase === "pnr" ? 2 : 1}</OutlineLevel>
      <Start>${toProjectDate(task.start)}</Start>
      <Finish>${toProjectDate(task.finish + 1)}</Finish>
      <Duration>P${Math.max(Math.round(task.duration), 1)}D</Duration>
      <DurationFormat>7</DurationFormat>
      <Notes>${xmlEscape(`${task.comment}. ${plan.disclaimer}`)}</Notes>
    </Task>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${xmlEscape(`Project.Core план — ${plan.summary.projectName}`)}</Name>
  <Title>${xmlEscape(`План проекта ${plan.summary.projectName}`)}</Title>
  <Subject>${xmlEscape("Автоматически сформированный план проекта по системам безопасности")}</Subject>
  <Author>Project.Core™</Author>
  <Manager>Project.Core™</Manager>
  <Company>Project.Core™</Company>
  <Comments>${xmlEscape(plan.disclaimer)}</Comments>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>2026-01-01T08:00:00</StartDate>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>22</DaysPerMonth>
  <DefaultStartTime>08:00:00</DefaultStartTime>
  <DefaultFinishTime>17:00:00</DefaultFinishTime>
  <Tasks>${tasks}
  </Tasks>
</Project>`;
}

async function exportMpp(payload) {
  const res = await fetch("/api/project-plan-export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: "mpp", payload }) });
  if (!res.ok) {
    let message = "Не удалось сформировать MPP-файл.";
    try { message = (await res.json())?.error || message; } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  const name = parseDisposition(res.headers.get("content-disposition")) || `${filePart(payload?.objectData?.projectName, "project")}_project_plan.mpp`;
  downloadBlob(name, blob);
}

export async function exportProjectPlan(payload, format = "pptx") {
  if (format === "mpp" || format === "msproject") return exportMpp(payload);
  return exportPptx(buildProjectPlan(payload));
}
