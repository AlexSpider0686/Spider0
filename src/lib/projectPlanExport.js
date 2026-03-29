import PptxGenJS from "pptxgenjs";
import { buildProjectTimeline } from "./projectTimeline";

const COLORS = {
  bg: "EEF4FC",
  panel: "F7FAFF",
  line: "B7C7DC",
  title: "1E3553",
  text: "2F4A69",
  muted: "6E8098",
  accent: "1E9FC5",
  accentDark: "1F5A99",
  success: "16A34A",
  warning: "F59E0B",
  purple: "7C3AED",
};

const CURRENCY_FORMATTER = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

function safeNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function num(value, digits = 1) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeNum(value));
}

function rub(value) {
  return `${CURRENCY_FORMATTER.format(safeNum(value))} ₽`;
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

function safeFilePart(value, fallback) {
  const cleaned = sanitizeText(value || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80);
  return cleaned || fallback;
}

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

function monthRange(start, duration) {
  const finish = start + duration - 1;
  return duration <= 1 ? `M${start}` : `M${start}-M${finish}`;
}

function phaseDuration(phase, minDuration = 1) {
  return Math.max(minDuration, safeNum(phase?.duration, minDuration));
}

function splitDuration(total, parts) {
  const safeTotal = Math.max(safeNum(total, 0), 1);
  const safeParts = (Array.isArray(parts) ? parts : []).filter((item) => safeNum(item?.weight, 0) > 0);
  const weightSum = safeParts.reduce((sum, item) => sum + safeNum(item.weight, 0), 0) || 1;
  let remaining = safeTotal;

  return safeParts.map((item, index) => {
    if (index === safeParts.length - 1) {
      return { ...item, duration: Math.max(1, remaining) };
    }

    const raw = Math.round((safeTotal * safeNum(item.weight, 0)) / weightSum);
    const duration = Math.max(1, Math.min(raw, remaining - (safeParts.length - index - 1)));
    remaining -= duration;
    return { ...item, duration };
  });
}

function buildSystemPlanningRows(systemResults = [], timeline) {
  const phaseMap = timeline.phaseMap || {};
  const smrPhase = phaseMap.smr;
  const pnrPhase = phaseMap.pnr;

  return (Array.isArray(systemResults) ? systemResults : []).map((item, index) => {
    const executionDuration = Math.max(1, Math.min(safeNum(item?.executionDurationMonths, smrPhase?.duration || 1), smrPhase?.duration || 1));
    const pnrDuration = Math.max(1, Math.min(Math.ceil(executionDuration * 0.35), pnrPhase?.duration || 1));
    const smrStart = Math.max(safeNum(smrPhase?.start, 1), safeNum(smrPhase?.finish, 1) - executionDuration + 1);
    const pnrStart = Math.max(safeNum(pnrPhase?.start, 1), safeNum(pnrPhase?.finish, 1) - pnrDuration + 1);

    return {
      order: index + 1,
      systemName: sanitizeText(item?.systemName || item?.systemType || `Система ${index + 1}`),
      vendor: sanitizeText(item?.vendor || "Не определен"),
      estimateMode: item?.estimateMode === "project_pdf" ? "по проектной спецификации" : "по расчетной модели",
      smrStart,
      smrDuration: executionDuration,
      pnrStart,
      pnrDuration,
      total: safeNum(item?.total, 0),
    };
  });
}

function buildDetailedPlan({ objectData, systemResults, totals, projectRisks }) {
  const timeline = buildProjectTimeline(systemResults, objectData, totals);
  const phaseMap = timeline.phaseMap;
  const designTasks = splitDuration(phaseDuration(phaseMap.design), [
    { name: "Старт проекта и верификация исходных данных", weight: 1.1 },
    { name: "AI-обследование, уточнение маршрутов и инженерных ограничений", weight: 1.3 },
    { name: "Формирование технического решения и фиксация проектных допущений", weight: 1.2 },
    { name: "Утверждение верхнеуровневого плана и координация смежных систем", weight: 0.9 },
  ]);
  const procurementTasks = splitDuration(phaseDuration(phaseMap.procurement), [
    { name: "Подготовка закупочной спецификации и запросы поставщикам", weight: 1.15 },
    { name: "Согласование бюджета, договорных условий и логистики", weight: 0.95 },
  ]);
  const deliveryTasks = splitDuration(phaseDuration(phaseMap.delivery), [
    { name: "Производство и комплектование заказа", weight: 1.1 },
    { name: "Поставка оборудования на объект и входной контроль", weight: 0.9 },
  ]);
  const smrTasks = splitDuration(phaseDuration(phaseMap.smr), [
    { name: "Подготовка фронта работ и мобилизация", weight: 0.7 },
    { name: "Прокладка кабельных трасс и монтаж инфраструктуры", weight: 1.4 },
    { name: "Монтаж оборудования и шкафов", weight: 1.2 },
    { name: "Локальная проверка готовности к ПНР", weight: 0.7 },
  ]);
  const pnrTasks = splitDuration(phaseDuration(phaseMap.pnr), [
    { name: "Пусконаладка и адресация оборудования", weight: 1.1 },
    { name: "Интеграция подсистем, сценарии и комплексные испытания", weight: 1.2 },
    { name: "Сдача исполнительных материалов и выпуск итоговой презентации", weight: 0.7 },
  ]);

  const tasks = [];
  let order = 1;

  function pushSequential(phaseKey, rows) {
    let currentStart = safeNum(phaseMap[phaseKey]?.start, 1);
    rows.forEach((row) => {
      tasks.push({
        id: order,
        order,
        phase: phaseKey,
        name: row.name,
        start: currentStart,
        duration: row.duration,
        finish: currentStart + row.duration - 1,
        owner: "Проектная команда",
        comment: `Фаза ${phaseMap[phaseKey]?.label || phaseKey}.`,
      });
      currentStart += row.duration;
      order += 1;
    });
  }

  pushSequential("design", designTasks);
  pushSequential("procurement", procurementTasks);
  pushSequential("delivery", deliveryTasks);
  pushSequential("smr", smrTasks);
  pushSequential("pnr", pnrTasks);

  const systemRows = buildSystemPlanningRows(systemResults, timeline);
  systemRows.forEach((row) => {
    tasks.push({
      id: order,
      order,
      phase: "smr",
      name: `${row.systemName}: монтаж и трассы`,
      start: row.smrStart,
      duration: row.smrDuration,
      finish: row.smrStart + row.smrDuration - 1,
      owner: `Подсистема / ${row.vendor}`,
      comment: `Режим расчета ${row.estimateMode}. Бюджет по системе ${rub(row.total)}.`,
    });
    order += 1;
    tasks.push({
      id: order,
      order,
      phase: "pnr",
      name: `${row.systemName}: ПНР и интеграция`,
      start: row.pnrStart,
      duration: row.pnrDuration,
      finish: row.pnrStart + row.pnrDuration - 1,
      owner: `Подсистема / ${row.vendor}`,
      comment: `Финальная наладка и сдача по системе.`,
    });
    order += 1;
  });

  const risks = (Array.isArray(projectRisks) ? projectRisks : []).slice(0, 3).map((item) => ({
    title: sanitizeText(item?.title || "Риск проекта"),
    severity: sanitizeText(item?.severityLabel || item?.severity || "повышенный"),
    summary: sanitizeText(item?.summary || item?.impact || ""),
  }));

  return {
    timeline,
    tasks,
    systemRows,
    risks,
    summary: {
      projectName: sanitizeText(objectData?.projectName || "Объект 1"),
      address: sanitizeText(objectData?.address || "Адрес не указан"),
      totalMonths: timeline.totalMonths,
      systemsCount: timeline.systemsCount,
      totalBudget: safeNum(totals?.total, 0),
    },
    disclaimer:
      "Сроки носят предварительный характер и предназначены для верхнеуровневого планирования. Окончательный график требует подтверждения РД, доступов, поставок, подрядных ресурсов и календарных ограничений объекта.",
  };
}

function addFrame(slide, title, subtitle, pageNumber) {
  slide.background = { color: COLORS.bg };
  slide.addShape("rect", {
    x: 0.35,
    y: 0.2,
    w: 12.63,
    h: 0.02,
    fill: { color: COLORS.accent },
    line: { color: COLORS.accent, pt: 0 },
  });
  slide.addText(title, {
    x: 0.5,
    y: 0.35,
    w: 10.2,
    h: 0.42,
    fontFace: "Calibri",
    fontSize: 21,
    bold: true,
    color: COLORS.title,
  });
  slide.addText(subtitle, {
    x: 0.5,
    y: 0.82,
    w: 10.8,
    h: 0.32,
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

function drawTaskTable(slide, rows) {
  const headers = ["#", "Этап", "Период", "Длит.", "Ответственный", "Комментарий"];
  const widths = [0.45, 3.35, 1.05, 0.7, 1.45, 4.2];
  const startX = 0.55;
  const startY = 1.45;
  const rowH = 0.34;

  headers.forEach((header, index) => {
    const x = startX + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
    slide.addShape("rect", {
      x,
      y: startY,
      w: widths[index],
      h: rowH,
      fill: { color: "DCE8F7" },
      line: { color: COLORS.line, pt: 1 },
    });
    slide.addText(header, {
      x: x + 0.04,
      y: startY + 0.08,
      w: widths[index] - 0.08,
      h: 0.16,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: COLORS.title,
      align: index === 0 ? "center" : "left",
    });
  });

  rows.forEach((row, rowIndex) => {
    const y = startY + rowH + rowIndex * rowH;
    const fill = rowIndex % 2 === 0 ? "FFFFFF" : "F7FAFF";
    const values = [
      String(row.order),
      row.name,
      monthRange(row.start, row.duration),
      `${row.duration} мес.`,
      row.owner,
      row.comment,
    ];

    values.forEach((value, index) => {
      const x = startX + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
      slide.addShape("rect", {
        x,
        y,
        w: widths[index],
        h: rowH,
        fill: { color: fill },
        line: { color: COLORS.line, pt: 1 },
      });
      slide.addText(value, {
        x: x + 0.04,
        y: y + 0.08,
        w: widths[index] - 0.08,
        h: 0.16,
        fontFace: "Calibri",
        fontSize: 9,
        color: COLORS.text,
        bold: index === 1 || index === 3,
        align: index === 0 ? "center" : "left",
      });
    });
  });
}

function addTimelineSlide(slide, plan) {
  const { bars, totalMonths } = plan.timeline;
  const chartX = 3.15;
  const chartY = 1.7;
  const chartW = 8.45;
  const rowH = 0.72;
  const monthW = chartW / Math.max(totalMonths, 1);

  slide.addShape("roundRect", {
    x: 0.5,
    y: 1.45,
    w: 11.9,
    h: 5.55,
    rectRadius: 0.08,
    fill: { color: COLORS.panel },
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
    slide.addText(`${item.duration} мес.`, {
      x: chartX + (item.start - 1) * monthW + 0.06,
      y: y + 0.15,
      w: Math.max(item.duration * monthW - 0.1, 0.35),
      h: 0.14,
      fontFace: "Calibri",
      fontSize: 8,
      bold: true,
      color: "FFFFFF",
      align: "center",
    });
  });

  slide.addText(plan.disclaimer, {
    x: 0.78,
    y: 6.28,
    w: 10.8,
    h: 0.42,
    fontFace: "Calibri",
    fontSize: 9,
    color: COLORS.muted,
  });
}

async function exportPlanPptx(plan) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Project.Core™";
  pptx.company = "Project.Core™";
  pptx.subject = "План проекта";
  pptx.title = `Project.Core™ — план проекта ${plan.summary.projectName}`;
  pptx.lang = "ru-RU";

  const slide1 = pptx.addSlide();
  addFrame(
    slide1,
    "План проекта по реализации систем безопасности",
    "Автоматически сформирован по данным объекта, расчету систем и AI-модулям платформы.",
    1
  );
  slide1.addShape("roundRect", {
    x: 0.55,
    y: 1.45,
    w: 5.7,
    h: 2.05,
    rectRadius: 0.08,
    fill: { color: COLORS.panel },
    line: { color: COLORS.line, pt: 1 },
  });
  slide1.addText(
    `Объект: ${plan.summary.projectName}\nАдрес: ${plan.summary.address}\nСистем в плане: ${plan.summary.systemsCount}\nГоризонт плана: ${plan.summary.totalMonths} мес.\nБюджет проекта: ${rub(plan.summary.totalBudget)}`,
    {
      x: 0.78,
      y: 1.73,
      w: 5.05,
      h: 1.45,
      fontFace: "Calibri",
      fontSize: 13,
      color: COLORS.text,
      breakLine: false,
    }
  );
  slide1.addShape("roundRect", {
    x: 6.45,
    y: 1.45,
    w: 5.95,
    h: 2.05,
    rectRadius: 0.08,
    fill: { color: "FFFFFF" },
    line: { color: COLORS.line, pt: 1 },
  });
  slide1.addText("Принятые допущения и оговорка по срокам", {
    x: 6.7,
    y: 1.68,
    w: 5.3,
    h: 0.18,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: COLORS.title,
  });
  plan.timeline.assumptions.forEach((item, index) => {
    slide1.addText(`• ${item}`, {
      x: 6.72,
      y: 1.98 + index * 0.34,
      w: 5.12,
      h: 0.24,
      fontFace: "Calibri",
      fontSize: 10,
      color: COLORS.text,
    });
  });

  slide1.addText("Основные риски, влияющие на последовательность работ", {
    x: 0.58,
    y: 3.8,
    w: 5.2,
    h: 0.2,
    fontFace: "Calibri",
    fontSize: 13,
    bold: true,
    color: COLORS.title,
  });
  const risks = plan.risks.length
    ? plan.risks
    : [{ title: "Критичных рисков не зафиксировано", severity: "контрольный", summary: "План собран по стандартному сценарию без дополнительных ограничений." }];
  risks.forEach((risk, index) => {
    slide1.addShape("roundRect", {
      x: 0.62,
      y: 4.18 + index * 0.76,
      w: 11.72,
      h: 0.58,
      rectRadius: 0.06,
      fill: { color: index % 2 === 0 ? "F7FAFF" : "FFFFFF" },
      line: { color: COLORS.line, pt: 1 },
    });
    slide1.addText(`${risk.title} (${risk.severity})`, {
      x: 0.84,
      y: 4.32 + index * 0.76,
      w: 3.95,
      h: 0.16,
      fontFace: "Calibri",
      fontSize: 10,
      bold: true,
      color: COLORS.title,
    });
    slide1.addText(risk.summary, {
      x: 4.6,
      y: 4.3 + index * 0.76,
      w: 7.25,
      h: 0.18,
      fontFace: "Calibri",
      fontSize: 9,
      color: COLORS.text,
    });
  });

  const slide2 = pptx.addSlide();
  addFrame(
    slide2,
    "Сводный график фаз проекта",
    "Фазы плана калибруются по тем же данным, что и таймлайн в экспортируемом ТКП.",
    2
  );
  addTimelineSlide(slide2, plan);

  const slide3 = pptx.addSlide();
  addFrame(
    slide3,
    "Детальный план проекта",
    "План включает ключевые мероприятия, периоды выполнения и ответственные контуры.",
    3
  );
  drawTaskTable(slide3, plan.tasks.slice(0, 16));

  if (plan.tasks.length > 16) {
    const slide4 = pptx.addSlide();
    addFrame(
      slide4,
      "Детальный план проекта — продолжение",
      "Продолжение списка этапов, синхронизированных с фазами проекта.",
      4
    );
    drawTaskTable(slide4, plan.tasks.slice(16, 32));
  }

  const fileName = `${safeFilePart(plan.summary.projectName, "project")}_project_plan.pptx`;
  await pptx.writeFile({ fileName });
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toProjectDate(monthIndex) {
  const baseDate = new Date(Date.UTC(2026, 0, 1, 8, 0, 0));
  baseDate.setUTCDate(baseDate.getUTCDate() + Math.max(monthIndex - 1, 0) * 30);
  return baseDate.toISOString().replace(".000Z", "");
}

function buildMsProjectXml(plan) {
  const tasksXml = plan.tasks
    .map((task, index) => {
      const outlineLevel = task.phase === "smr" || task.phase === "pnr" ? 2 : 1;
      const durationDays = Math.max(task.duration * 22, 1);
      return `
    <Task>
      <UID>${index + 1}</UID>
      <ID>${index + 1}</ID>
      <Name>${xmlEscape(task.name)}</Name>
      <OutlineLevel>${outlineLevel}</OutlineLevel>
      <Start>${toProjectDate(task.start)}</Start>
      <Duration>PT${durationDays * 8}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <Notes>${xmlEscape(`${task.comment} ${plan.disclaimer}`)}</Notes>
    </Task>`;
    })
    .join("");

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
  <Tasks>${tasksXml}
  </Tasks>
</Project>`;
}

function exportPlanMsProject(plan) {
  const xml = buildMsProjectXml(plan);
  const blob = new Blob([`\uFEFF${xml}`], { type: "application/xml;charset=utf-8;" });
  const fileName = `${safeFilePart(plan.summary.projectName, "project")}_project_plan.xml`;
  downloadBlob(fileName, blob);
}

export async function exportProjectPlan(payload, format = "pptx") {
  const plan = buildDetailedPlan(payload || {});
  if (format === "msproject") {
    exportPlanMsProject(plan);
    return;
  }
  await exportPlanPptx(plan);
}
