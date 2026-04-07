import PptxGenJS from "pptxgenjs";
import { buildProjectPlan, formatRub } from "./projectPlanModel.js";

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
};

const filePart = (v, fallback) => String(v || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80) || fallback;
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

function bg(slide) {
  slide.background = { color: C.bg };
  slide.addShape("rect", { x: 0, y: 0, w: 13.333, h: 0.42, fill: { color: C.blueDark }, line: { color: C.blueDark, pt: 0 } });
  slide.addShape("ellipse", { x: 10.7, y: -1.2, w: 3.7, h: 3.7, fill: { color: "DCEEFF", transparency: 16 }, line: { color: "DCEEFF", transparency: 100, pt: 0 } });
  slide.addShape("ellipse", { x: -0.9, y: 5.7, w: 2.8, h: 2.8, fill: { color: "DFF7F0", transparency: 18 }, line: { color: "DFF7F0", transparency: 100, pt: 0 } });
}

function frame(slide, title, subtitle, page) {
  bg(slide);
  slide.addText("PROJECT.CORE / AI-ПЛАНИРОВАНИЕ", { x: 0.66, y: 0.22, w: 4.8, h: 0.14, fontFace: "Calibri", fontSize: 8, bold: true, color: C.white, charSpace: 0.6 });
  slide.addText(title, { x: 0.74, y: 0.72, w: 8.2, h: 0.4, fontFace: "Calibri", fontSize: 22, bold: true, color: C.ink });
  slide.addText(subtitle, { x: 0.74, y: 1.13, w: 9.9, h: 0.24, fontFace: "Calibri", fontSize: 11, color: C.muted });
  slide.addText(String(page), { x: 12.52, y: 7.02, w: 0.25, h: 0.16, fontFace: "Calibri", fontSize: 10, color: C.muted, align: "right" });
}

function card(slide, x, y, w, title, value, note, accent = C.blue) {
  slide.addShape("roundRect", { x, y, w, h: 1.08, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("rect", { x, y, w: 0.08, h: 1.08, fill: { color: accent }, line: { color: accent, pt: 0 } });
  slide.addText(title, { x: x + 0.18, y: y + 0.16, w: w - 0.3, h: 0.14, fontFace: "Calibri", fontSize: 9, bold: true, color: C.muted });
  slide.addText(value, { x: x + 0.18, y: y + 0.4, w: w - 0.3, h: 0.22, fontFace: "Calibri", fontSize: 18, bold: true, color: C.ink, fit: "shrink" });
  slide.addText(note, { x: x + 0.18, y: y + 0.76, w: w - 0.3, h: 0.14, fontFace: "Calibri", fontSize: 8.4, color: C.muted, fit: "shrink" });
}

function cover(slide, plan) {
  bg(slide);
  slide.addShape("roundRect", { x: 0.68, y: 0.9, w: 7.7, h: 5.85, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 8.68, y: 0.9, w: 3.95, h: 5.85, rectRadius: 0.12, fill: { color: C.sky }, line: { color: C.line, pt: 1 } });
  slide.addText("PROJECT.CORE", { x: 0.96, y: 1.14, w: 2.5, h: 0.16, fontFace: "Calibri", fontSize: 9, bold: true, color: C.blue, charSpace: 0.8 });
  slide.addText("План проекта по реализации систем безопасности", { x: 0.96, y: 1.48, w: 6.8, h: 0.98, fontFace: "Calibri", fontSize: 26, bold: true, color: C.ink, fit: "shrink" });
  slide.addText(`Объект: ${plan.summary.projectName}`, { x: 0.96, y: 2.6, w: 6.1, h: 0.22, fontFace: "Calibri", fontSize: 14, bold: true, color: C.text, fit: "shrink" });
  slide.addText(plan.summary.address, { x: 0.96, y: 2.9, w: 6.2, h: 0.38, fontFace: "Calibri", fontSize: 11, color: C.muted, fit: "shrink" });
  slide.addText("Документ автоматически сформирован на основе данных объекта, состава систем, AI-аналитики, трудозатрат и бюджета проекта.", { x: 0.96, y: 3.38, w: 6.5, h: 0.48, fontFace: "Calibri", fontSize: 11, color: C.text, fit: "shrink" });
  card(slide, 0.96, 4.26, 1.95, "Систем в плане", String(plan.summary.systemsCount), "Подсистемы");
  card(slide, 3.05, 4.26, 1.95, "Горизонт", `${plan.summary.totalDays} дн.`, "Рабочие дни", C.green);
  card(slide, 5.14, 4.26, 2.22, "Бюджет", formatRub(plan.summary.totalBudget), "По текущей модели", C.violet);
  slide.addText("Паспорт плана", { x: 8.98, y: 1.22, w: 2.1, h: 0.18, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  [["Тип объекта", plan.summary.objectType], ["Дата генерации", plan.summary.generatedAt], ["Формат сроков", "Рабочие дни"], ["Источник", "AI-планирование Project.Core"]].forEach(([a, b], i) => {
    slide.addText(a, { x: 8.98, y: 1.68 + i * 0.8, w: 2.6, h: 0.14, fontFace: "Calibri", fontSize: 9, bold: true, color: C.muted });
    slide.addText(b, { x: 8.98, y: 1.92 + i * 0.8, w: 3.0, h: 0.22, fontFace: "Calibri", fontSize: 13, bold: true, color: C.ink, fit: "shrink" });
  });
  slide.addText(plan.disclaimer, { x: 0.96, y: 6.08, w: 11.2, h: 0.32, fontFace: "Calibri", fontSize: 8.8, color: C.muted, fit: "shrink" });
}

function dashboard(slide, plan) {
  frame(slide, "Исполнительное резюме и ключевые параметры плана", "Сводка по охвату проекта, бюджету и детальному ресурсу реализации.", 2);
  card(slide, 0.74, 1.62, 2.46, "Итоговый бюджет", formatRub(plan.summary.totalBudget), "Общий бюджет проекта");
  card(slide, 3.34, 1.62, 2.0, "Системы", String(plan.summary.systemsCount), "Количество подсистем", C.green);
  card(slide, 5.48, 1.62, 2.0, "Срок", `${plan.summary.totalDays} дн.`, "Рабочие дни", C.violet);
  card(slide, 7.62, 1.62, 2.0, "Пик СМР", `${plan.summary.peakFieldTeam || 0} чел.`, "Полевой ресурс", C.gold);
  card(slide, 9.76, 1.62, 2.8, "Проектный контур", `${plan.summary.peakDesignTeam || 0} чел.`, "Проектная группа", C.blueDark);

  slide.addShape("roundRect", { x: 0.74, y: 3.02, w: 4.7, h: 3.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 5.64, y: 3.02, w: 3.18, h: 3.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 9.02, y: 3.02, w: 3.5, h: 3.35, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });

  slide.addText("Контур планирования", { x: 1.02, y: 3.24, w: 2.8, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  plan.notes.slice(0, 5).forEach((item, i) => {
    slide.addText(`• ${item}`, { x: 1.04, y: 3.62 + i * 0.48, w: 4.08, h: 0.26, fontFace: "Calibri", fontSize: 9.7, color: C.text, fit: "shrink" });
  });

  slide.addText("Состав бригад", { x: 5.92, y: 3.24, w: 2.1, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  [
    `СМР: ${plan.crewPlan.field.roles.map((item) => `${item.label} ${item.count}`).join(", ") || "нет"}.`,
    `ПНР: ${plan.crewPlan.field.roles.filter((item) => item.role === "commissioning").map((item) => `${item.label} ${item.count}`).join(", ") || "нет"}.`,
    `Проектирование: ${plan.crewPlan.design.roles.map((item) => `${item.label} ${item.count}`).join(", ") || "нет"}.`,
  ].forEach((item, i) => {
    slide.addText(`• ${item}`, { x: 5.94, y: 3.62 + i * 0.78, w: 2.6, h: 0.52, fontFace: "Calibri", fontSize: 9.3, color: C.text, fit: "shrink" });
  });

  slide.addText("Расчет по системам", { x: 9.3, y: 3.24, w: 2.3, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  plan.crewPlan.systemCrewRows.slice(0, 4).forEach((row, i) => {
    slide.addText(`• ${row.systemName}: пик ${row.peakCrew} чел., ${row.durationDays} дн., ${row.leadRoles}.`, {
      x: 9.22,
      y: 3.62 + i * 0.68,
      w: 3.02,
      h: 0.44,
      fontFace: "Calibri",
      fontSize: 8.7,
      color: C.text,
      fit: "shrink",
    });
  });
}

function roadmap(slide, plan) {
  frame(slide, "Дорожная карта проекта и календарный контур", "Фазы синхронизированы по рабочим дням и готовы к переносу в MS Project.", 3);
  slide.addShape("roundRect", { x: 0.74, y: 1.56, w: 11.94, h: 5.52, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  const x0 = 3.42;
  const y0 = 2.02;
  const w = 8.78;
  const h = 0.72;
  const total = Math.max(plan.timeline.totalDays, 1);
  const step = total > 160 ? 20 : total > 90 ? 10 : 5;
  const dayW = w / total;

  for (let day = 1; day <= total; day += step) {
    const x = x0 + (day - 1) * dayW;
    slide.addShape("line", { x, y: y0 - 0.2, w: 0, h: plan.timeline.bars.length * h + 0.2, line: { color: "E6EEF7", pt: 1 } });
    slide.addText(`Д${day}`, { x: x - 0.08, y: y0 - 0.44, w: 0.35, h: 0.14, fontFace: "Calibri", fontSize: 8, color: C.muted, align: "center" });
  }

  plan.timeline.bars.forEach((row, i) => {
    const y = y0 + i * h;
    slide.addText(row.label, { x: 1.0, y: y + 0.16, w: 2.15, h: 0.16, fontFace: "Calibri", fontSize: 11, bold: true, color: C.ink, fit: "shrink" });
    slide.addText(dayRange(row.start, row.duration), { x: 2.2, y: y + 0.16, w: 0.9, h: 0.16, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right" });
    slide.addShape("roundRect", { x: x0 + (row.start - 1) * dayW, y: y + 0.08, w: Math.max(row.duration * dayW, 0.24), h: 0.34, rectRadius: 0.06, fill: { color: row.color }, line: { color: row.color, pt: 1 } });
    slide.addText(`${row.duration} дн.`, { x: x0 + (row.start - 1) * dayW + 0.04, y: y + 0.15, w: Math.max(row.duration * dayW - 0.08, 0.4), h: 0.12, fontFace: "Calibri", fontSize: 8, bold: true, color: C.white, align: "center", fit: "shrink" });
  });

  slide.addText("Контрольные точки", { x: 1.0, y: 5.86, w: 2.0, h: 0.16, fontFace: "Calibri", fontSize: 13, bold: true, color: C.ink });
  plan.timeline.bars.slice(0, 5).forEach((row, i) => {
    const x = 3.25 + i * 1.82;
    slide.addShape("roundRect", { x, y: 5.74, w: 1.58, h: 0.88, rectRadius: 0.06, fill: { color: C.panel }, line: { color: C.line, pt: 1 } });
    slide.addText(row.label, { x: x + 0.1, y: 5.88, w: 1.38, h: 0.16, fontFace: "Calibri", fontSize: 8.2, bold: true, color: C.text, align: "center", fit: "shrink" });
    slide.addText(`Финиш Д${row.finish}`, { x: x + 0.12, y: 6.2, w: 1.34, h: 0.12, fontFace: "Calibri", fontSize: 8.6, color: C.ink, align: "center" });
  });
}

function budget(slide, plan) {
  frame(slide, "Структура бюджета, графики и системный приоритет", "Стоимость раскладывается по бюджетным блокам и наиболее влияющим подсистемам.", 4);
  slide.addShape("roundRect", { x: 0.74, y: 1.58, w: 5.72, h: 5.5, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 6.68, y: 1.58, w: 6.04, h: 5.5, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addText("Бюджетные блоки", { x: 1.02, y: 1.8, w: 2.1, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  const total = Math.max(plan.summary.totalBudget, 1);
  plan.cost.forEach((item, i) => {
    const y = 2.28 + i * 0.88;
    const ratio = item.value / total;
    slide.addText(item.label, { x: 1.04, y, w: 1.6, h: 0.14, fontFace: "Calibri", fontSize: 10, bold: true, color: C.text });
    slide.addText(`${formatRub(item.value)} / ${Math.round(ratio * 100)}%`, { x: 3.78, y, w: 1.95, h: 0.14, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right", fit: "shrink" });
    slide.addShape("roundRect", { x: 1.04, y: y + 0.28, w: 4.7, h: 0.18, rectRadius: 0.04, fill: { color: "ECF2F8" }, line: { color: "ECF2F8", pt: 0 } });
    slide.addShape("roundRect", { x: 1.04, y: y + 0.28, w: Math.max(4.7 * ratio, 0.08), h: 0.18, rectRadius: 0.04, fill: { color: item.color }, line: { color: item.color, pt: 0 } });
  });
  const top = [...plan.systemRows].sort((a, b) => b.total - a.total).slice(0, 6);
  const maxSys = Math.max(...top.map((item) => item.total), 1);
  slide.addText("Системы с наибольшим влиянием на бюджет", { x: 6.96, y: 1.8, w: 3.7, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  top.forEach((row, i) => {
    const y = 2.28 + i * 0.72;
    const ratio = row.total / maxSys;
    const color = i % 2 === 0 ? C.blue : C.green;
    slide.addText(row.name, { x: 6.96, y, w: 2.55, h: 0.14, fontFace: "Calibri", fontSize: 9.2, bold: true, color: C.text, fit: "shrink" });
    slide.addText(formatRub(row.total), { x: 11.0, y, w: 1.25, h: 0.14, fontFace: "Calibri", fontSize: 9, color: C.muted, align: "right", fit: "shrink" });
    slide.addShape("roundRect", { x: 6.96, y: y + 0.22, w: 5.32, h: 0.18, rectRadius: 0.04, fill: { color: "ECF2F8" }, line: { color: "ECF2F8", pt: 0 } });
    slide.addShape("roundRect", { x: 6.96, y: y + 0.22, w: Math.max(5.32 * ratio, 0.1), h: 0.18, rectRadius: 0.04, fill: { color }, line: { color, pt: 0 } });
    slide.addText(`${row.vendor} / ${row.mode}`, { x: 6.96, y: y + 0.44, w: 4.5, h: 0.12, fontFace: "Calibri", fontSize: 8.2, color: C.muted, fit: "shrink" });
  });
}

function governance(slide, plan) {
  frame(slide, "Риски, зависимости и следующий управленческий шаг", "Финальный слайд предназначен для согласования дорожной карты и точек контроля.", 5);
  slide.addShape("roundRect", { x: 0.74, y: 1.6, w: 4.18, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 5.08, y: 1.6, w: 3.64, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addShape("roundRect", { x: 8.94, y: 1.6, w: 3.78, h: 5.45, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.line, pt: 1 } });
  slide.addText("Ключевые риски", { x: 1.02, y: 1.84, w: 2.2, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  const risks = plan.risks.length ? plan.risks.slice(0, 3) : [{ title: "Критичных рисков не выявлено", severity: "Контрольный", summary: "План собран по стандартному сценарию без дополнительных ограничений." }];
  risks.forEach((r, i) => {
    slide.addShape("roundRect", { x: 1.02, y: 2.18 + i * 1.12, w: 3.62, h: 0.92, rectRadius: 0.06, fill: { color: i % 2 === 0 ? C.panel : C.white }, line: { color: C.line, pt: 1 } });
    slide.addText(r.title, { x: 1.16, y: 2.3 + i * 1.12, w: 3.3, h: 0.16, fontFace: "Calibri", fontSize: 8.8, bold: true, color: C.ink, fit: "shrink" });
    slide.addText(`${r.severity}. ${r.summary}`, { x: 1.16, y: 2.52 + i * 1.12, w: 3.26, h: 0.38, fontFace: "Calibri", fontSize: 7.9, color: C.text, fit: "shrink" });
  });
  slide.addText("Следующие шаги", { x: 5.34, y: 1.84, w: 2.1, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  [
    "Подтвердить исходные данные, ограничения и состав систем.",
    "Утвердить закупочный контур, поставщиков и логистику.",
    "Закрепить фронт монтажных работ и подрядный ресурс.",
    "Подтвердить окно ПНР, приемки и исполнительной документации.",
  ].forEach((item, i) => {
    slide.addShape("roundRect", { x: 5.34, y: 2.2 + i * 0.92, w: 3.08, h: 0.62, rectRadius: 0.06, fill: { color: C.sky }, line: { color: C.line, pt: 1 } });
    slide.addText(`${i + 1}. ${item}`, { x: 5.48, y: 2.36 + i * 0.92, w: 2.76, h: 0.28, fontFace: "Calibri", fontSize: 8.3, color: C.text, fit: "shrink" });
  });
  slide.addText("Управленческая рамка", { x: 9.18, y: 1.84, w: 2.4, h: 0.16, fontFace: "Calibri", fontSize: 14, bold: true, color: C.ink });
  ["Единица сроков — рабочие дни.", "План готов для переноса в MS Project.", "Таймлайн синхронизирован с бюджетной логикой Project.Core.", "Перед выпуском в производство нужно подтвердить РД, поставки, доступы и подрядный контур."].forEach((item, i) => {
    slide.addText(`• ${item}`, { x: 9.2, y: 2.24 + i * 0.64, w: 3.06, h: 0.3, fontFace: "Calibri", fontSize: 8.7, color: C.text, fit: "shrink" });
  });
  slide.addText(plan.disclaimer, { x: 9.2, y: 5.72, w: 3.02, h: 0.68, fontFace: "Calibri", fontSize: 8.1, color: C.muted, fit: "shrink" });
}

async function exportPptx(plan) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Project.Core";
  pptx.company = "Project.Core";
  pptx.subject = "План проекта";
  pptx.title = `Project.Core - план проекта ${plan.summary.projectName}`;
  pptx.lang = "ru-RU";
  cover(pptx.addSlide(), plan);
  dashboard(pptx.addSlide(), plan);
  roadmap(pptx.addSlide(), plan);
  budget(pptx.addSlide(), plan);
  governance(pptx.addSlide(), plan);
  await pptx.writeFile({ fileName: `${filePart(plan.summary.projectName, "project")}_project_plan.pptx` });
}

async function exportMpp(payload) {
  const res = await fetch("/api/project-plan-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "mpp", payload }),
  });

  if (!res.ok) {
    let message = "Не удалось сформировать MPP-файл.";
    try {
      const raw = await res.text();
      if (raw) {
        try {
          message = JSON.parse(raw)?.error || message;
        } catch {
          message = raw;
        }
      }
    } catch {
      // Keep the default message when response parsing fails.
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const name =
    parseDisposition(res.headers.get("content-disposition")) ||
    `${filePart(payload?.objectData?.projectName, "project")}_project_plan.mpp`;
  downloadBlob(name, blob);
}

export async function exportProjectPlan(payload, format = "pptx") {
  if (format === "mpp" || format === "msproject") return exportMpp(payload);
  return exportPptx(buildProjectPlan(payload));
}
