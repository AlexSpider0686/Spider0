import { buildProjectTimeline } from "./projectTimeline.js";

const RUB = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const n = (v, f = 0) => {
  const p = Number(v);
  return Number.isFinite(p) ? p : f;
};

const txt = (v) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim();

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
    { label: "Оборудование", color: "1D88D2", value: n(totals?.totalEquipment, 0) },
    { label: "Материалы", color: "785AF8", value: n(totals?.totalMaterials, 0) },
    { label: "СМР + ПНР", color: "189F6B", value: n(totals?.totalLabor, 0) },
    { label: "Проектирование", color: "D6A63D", value: n(totals?.totalDesign, 0) },
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

export function formatRub(value) {
  return `${RUB.format(n(value))} ₽`;
}
