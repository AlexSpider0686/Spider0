import PptxGenJS from "pptxgenjs";
import { num } from "./estimate";

const COLORS = {
  bg: "F1F4F9",
  panel: "FFFFFF",
  text: "1F3348",
  muted: "5D6E84",
  line: "CAD5E3",
  accent: "0F4E88",
  teal: "1295A6",
  green: "2E965B",
  orange: "E79A25",
  blue: "357ABD",
  purple: "6B4AC7",
};

function safeCurrency(value) {
  return `${num(value, 0)} ₽`;
}

function addHeader(slide, title, subtitle, pageIndex) {
  slide.background = { color: COLORS.bg };
  slide.addText(title, { x: 0.6, y: 0.35, w: 10.8, h: 0.45, fontSize: 23, bold: true, color: COLORS.text });
  slide.addText(subtitle, { x: 0.6, y: 0.85, w: 11.8, h: 0.3, fontSize: 11, color: COLORS.muted });
  slide.addShape("rect", {
    x: 0.6,
    y: 1.22,
    w: 12.1,
    h: 0.02,
    fill: { color: COLORS.teal },
    line: { color: COLORS.teal, pt: 0 },
  });
  slide.addText(String(pageIndex), { x: 12.75, y: 7.0, w: 0.3, h: 0.2, fontSize: 9, color: COLORS.muted });
}

function addMetric(slide, label, value, x, y, w = 1.9) {
  slide.addShape("rect", {
    x,
    y,
    w,
    h: 0.8,
    fill: { color: COLORS.panel },
    line: { color: COLORS.line, pt: 1 },
  });
  slide.addText(label, { x: x + 0.08, y: y + 0.08, w: w - 0.16, h: 0.2, fontSize: 8, color: COLORS.muted });
  slide.addText(value, { x: x + 0.08, y: y + 0.32, w: w - 0.16, h: 0.3, fontSize: 13, bold: true, color: COLORS.text });
}

function buildTimeline({ objectData, recalculatedArea, systemResults, totals }) {
  const designMonths = Math.max(...systemResults.map((item) => item.designDurationMonths || 1), 1);
  const areaFactor = Math.max(recalculatedArea / 12000, 0.8);
  const systemFactor = Math.max(systemResults.length, 1);
  const regionFactor = objectData.regionCoef || 1;
  const workFactor = Math.max((totals.totalWork + (totals.totalDesign || 0)) / 90_000_000, 0.7);

  const procurementMonths = Math.max(1, Math.ceil(1 + systemFactor * 0.25 + areaFactor * 0.2));
  const deliveryMonths = Math.max(1, Math.ceil(1 + regionFactor * 0.5 + areaFactor * 0.25));
  const smrMonths = Math.max(2, Math.ceil(2 + areaFactor * 1.1 + workFactor * 0.8));
  const pnrMonths = Math.max(1, Math.ceil(1 + systemFactor * 0.2 + workFactor * 0.4));

  const startDesign = 1;
  const startProcurement = 1;
  const startDelivery = Math.max(2, startProcurement + 1);
  const startSmr = Math.max(startDelivery + 1, designMonths);
  const startPnr = startSmr + smrMonths - 1;
  const totalMonths = Math.max(startPnr + pnrMonths - 1, designMonths);

  return {
    totalMonths,
    tracks: [
      { label: "Проектирование", start: startDesign, duration: designMonths, color: COLORS.orange },
      { label: "Закупка и логистика", start: startProcurement, duration: procurementMonths, color: COLORS.purple },
      { label: "Поставка оборудования", start: startDelivery, duration: deliveryMonths, color: COLORS.teal },
      { label: "СМР", start: startSmr, duration: smrMonths, color: COLORS.blue },
      { label: "ПНР и интеграция", start: startPnr, duration: pnrMonths, color: COLORS.green },
    ],
    designBySystem: systemResults.map((item) => ({
      name: item.systemName,
      months: item.designDurationMonths || 1,
      team: item.designTeamSize || 1,
    })),
  };
}

function downloadArrayBuffer(fileName, arrayBuffer) {
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function writePptxFile(pptx, fileName) {
  const data = await pptx.write({ outputType: "arraybuffer", compression: true });
  downloadArrayBuffer(fileName, data);
}

export async function exportEstimatePptx({ objectData, budget, recalculatedArea, systemResults, totals }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Spider0";
  pptx.company = "Spider0";
  pptx.subject = "Смета систем безопасности";
  pptx.title = `Смета: ${objectData.projectName || "Проект"}`;

  const slide1 = pptx.addSlide();
  addHeader(slide1, "Общая бюджетная оценка проекта", "Оценка включает оборудование, материалы, СМР, ПНР и проектирование.", 1);
  addMetric(slide1, "Оборудование", safeCurrency(totals.totalEquipment), 0.6, 1.55);
  addMetric(slide1, "Материалы", safeCurrency(totals.totalMaterials), 2.6, 1.55);
  addMetric(slide1, "СМР + ПНР", safeCurrency(totals.totalWork), 4.6, 1.55);
  addMetric(slide1, "Проектирование", safeCurrency(totals.totalDesign || 0), 6.6, 1.55);
  addMetric(slide1, "Итог проекта", safeCurrency(totals.total), 8.6, 1.55, 2.1);

  slide1.addTable(
    [
      [{ text: "Статья", options: { bold: true } }, { text: "Сумма, ₽", options: { bold: true } }],
      ["Оборудование", num(totals.totalEquipment, 0)],
      ["Материалы", num(totals.totalMaterials, 0)],
      ["СМР + ПНР", num(totals.totalWork, 0)],
      ["Проектирование", num(totals.totalDesign || 0, 0)],
      ["Накладные и начисления", num(totals.totalOverhead, 0)],
      ["Прибыль", num(totals.totalProfit, 0)],
      ["НДС", num(totals.totalVat, 0)],
      ["Итог бюджета проекта", num(totals.total, 0)],
    ],
    {
      x: 0.8,
      y: 2.7,
      w: 5.8,
      h: 3.7,
      border: { color: COLORS.line, pt: 1 },
      fill: COLORS.panel,
      color: COLORS.text,
      fontSize: 10,
      valign: "mid",
      colW: [3.9, 1.9],
    }
  );

  slide1.addTable(
    [
      [
        { text: "Система", options: { bold: true } },
        { text: "Оборуд.", options: { bold: true } },
        { text: "Матер.", options: { bold: true } },
        { text: "СМР+ПНР", options: { bold: true } },
        { text: "Проект.", options: { bold: true } },
        { text: "Итог", options: { bold: true } },
      ],
      ...systemResults.map((item) => [
        item.systemName,
        num(item.equipmentCost, 0),
        num(item.materialCost, 0),
        num(item.workTotal, 0),
        num(item.designTotal || 0, 0),
        num(item.total, 0),
      ]),
    ],
    {
      x: 6.9,
      y: 2.7,
      w: 5.6,
      h: 3.7,
      border: { color: COLORS.line, pt: 1 },
      fill: COLORS.panel,
      color: COLORS.text,
      fontSize: 9,
      valign: "mid",
      colW: [2.1, 0.8, 0.8, 0.8, 0.8, 0.7],
    }
  );

  const slide2 = pptx.addSlide();
  addHeader(slide2, "Системы и ключевое оборудование", "Наименование, количество, стоимость и маркер стоимости за единицу.", 2);
  const rows = [
    [
      { text: "Система", options: { bold: true } },
      { text: "Маркер", options: { bold: true } },
      { text: "За ед., ₽", options: { bold: true } },
      { text: "Ключевое оборудование", options: { bold: true } },
      { text: "Кол-во", options: { bold: true } },
      { text: "Сумма, ₽", options: { bold: true } },
    ],
  ];
  for (const item of systemResults) {
    const keyItems = item.equipmentData?.keyEquipment || [];
    if (!keyItems.length) {
      rows.push([item.systemName, item.unitWorkMarker?.label || "—", num(item.unitWorkMarker?.costPerUnit || 0, 0), "—", "—", "—"]);
      continue;
    }
    keyItems.forEach((eq, idx) => {
      rows.push([
        idx === 0 ? item.systemName : "",
        idx === 0 ? item.unitWorkMarker?.label || "—" : "",
        idx === 0 ? num(item.unitWorkMarker?.costPerUnit || 0, 0) : "",
        eq.name,
        num(eq.qty, 0),
        num(eq.total, 0),
      ]);
    });
  }
  slide2.addTable(rows, {
    x: 0.6,
    y: 1.6,
    w: 12.2,
    h: 5.9,
    border: { color: COLORS.line, pt: 1 },
    fill: COLORS.panel,
    color: COLORS.text,
    fontSize: 9,
    valign: "mid",
    colW: [1.8, 2.2, 1.0, 4.1, 0.9, 1.4],
  });

  const slide3 = pptx.addSlide();
  addHeader(slide3, "Характеристики бюджета", "Коэффициенты и начисления, участвующие в расчете стоимости.", 3);
  slide3.addTable(
    [
      [{ text: "Параметр", options: { bold: true } }, { text: "Значение", options: { bold: true } }, { text: "Комментарий", options: { bold: true } }],
      ["Коэффициент кабельных работ", num(budget.cableCoef, 2), "Трассировка, резерв линий, плотность инженерной среды"],
      ["Коэффициент оборудования", num(budget.equipmentCoef, 2), "Рыночная корректировка оборудования"],
      ["Коэффициент трудозатрат", num(budget.laborCoef, 2), "Монтажные ограничения и доступ"],
      ["Коэффициент сложности", num(budget.complexityCoef, 2), "Интеграционные и технологические требования"],
      ["Ночные работы", num(budget.nightWorkCoef, 2), "Сменность и технологические окна"],
      ["Стесненность", num(budget.constrainedCoef, 2), "Ограничения по доступу и логистике"],
      ["Отчисления ФОТ, %", num(budget.payrollTaxesPercent, 1), "Начисляются на базу работ и проектирования"],
      ["Утилизация, %", num(budget.utilizationPercent, 1), "Отпуска, больничные, потери рабочего времени"],
      ["СИЗ, %", num(budget.ppePercent, 1), "Инструмент, расходники и СИЗ"],
      ["АХР, %", num(budget.adminPercent, 1), "Административно-хозяйственные расходы"],
      ["Региональный коэффициент", `x${num(objectData.regionCoef || 1, 2)}`, "Применяется к работам и проектированию"],
    ],
    {
      x: 0.6,
      y: 1.6,
      w: 12.2,
      h: 5.8,
      border: { color: COLORS.line, pt: 1 },
      fill: COLORS.panel,
      color: COLORS.text,
      fontSize: 9,
      valign: "mid",
      colW: [3.3, 1.4, 7.1],
    }
  );

  const slide4 = pptx.addSlide();
  addHeader(slide4, "Декомпозиция бюджета по системам", "Оборудование, материалы, СМР/ПНР, проектирование и общий итог по каждой системе.", 4);
  slide4.addTable(
    [
      [
        { text: "Система", options: { bold: true } },
        { text: "Оборуд., ₽", options: { bold: true } },
        { text: "Материалы, ₽", options: { bold: true } },
        { text: "СМР+ПНР, ₽", options: { bold: true } },
        { text: "Проектир., ₽", options: { bold: true } },
        { text: "Итог, ₽", options: { bold: true } },
      ],
      ...systemResults.map((item) => [
        item.systemName,
        num(item.equipmentCost, 0),
        num(item.materialCost, 0),
        num(item.workTotal, 0),
        num(item.designTotal || 0, 0),
        num(item.total, 0),
      ]),
      ["ИТОГО", num(totals.totalEquipment, 0), num(totals.totalMaterials, 0), num(totals.totalWork, 0), num(totals.totalDesign || 0, 0), num(totals.total, 0)],
    ],
    {
      x: 0.8,
      y: 1.75,
      w: 8.4,
      h: 5.4,
      border: { color: COLORS.line, pt: 1 },
      fill: COLORS.panel,
      color: COLORS.text,
      fontSize: 10,
      valign: "mid",
      colW: [2.3, 1.2, 1.2, 1.2, 1.2, 1.3],
    }
  );

  slide4.addShape("rect", {
    x: 9.45,
    y: 1.75,
    w: 3.25,
    h: 5.4,
    fill: { color: COLORS.panel },
    line: { color: COLORS.line, pt: 1 },
  });
  slide4.addText("Сводка", { x: 9.65, y: 2.0, w: 2.8, h: 0.3, fontSize: 13, bold: true, color: COLORS.text });
  slide4.addText(`Оборудование: ${safeCurrency(totals.totalEquipment)}`, { x: 9.65, y: 2.45, w: 2.8, h: 0.25, fontSize: 9, color: COLORS.muted });
  slide4.addText(`Материалы: ${safeCurrency(totals.totalMaterials)}`, { x: 9.65, y: 2.72, w: 2.8, h: 0.25, fontSize: 9, color: COLORS.muted });
  slide4.addText(`СМР+ПНР: ${safeCurrency(totals.totalWork)}`, { x: 9.65, y: 2.99, w: 2.8, h: 0.25, fontSize: 9, color: COLORS.muted });
  slide4.addText(`Проектирование: ${safeCurrency(totals.totalDesign || 0)}`, { x: 9.65, y: 3.26, w: 2.8, h: 0.25, fontSize: 9, color: COLORS.muted });
  slide4.addText(`НДС: ${safeCurrency(totals.totalVat)}`, { x: 9.65, y: 3.53, w: 2.8, h: 0.25, fontSize: 9, color: COLORS.muted });
  slide4.addText(`Итог: ${safeCurrency(totals.total)}`, { x: 9.65, y: 4.0, w: 2.8, h: 0.3, fontSize: 12, bold: true, color: COLORS.text });

  const slide5 = pptx.addSlide();
  const timeline = buildTimeline({ objectData, recalculatedArea, systemResults, totals });
  addHeader(slide5, "График реализации проекта", "Сроки по этапам и сроки проектирования по каждой системе.", 5);

  const axisX = 3.05;
  const axisY = 1.95;
  const axisW = 7.35;
  const rowH = 0.74;
  const monthW = axisW / Math.max(timeline.totalMonths, 1);

  for (let month = 1; month <= timeline.totalMonths; month += 1) {
    slide5.addShape("rect", {
      x: axisX + monthW * (month - 1),
      y: 1.45,
      w: monthW - 0.03,
      h: 0.33,
      fill: { color: "E6EDF7" },
      line: { color: "D6DFEC", pt: 0.5 },
    });
    slide5.addText(`M${month}`, {
      x: axisX + monthW * (month - 1),
      y: 1.53,
      w: monthW - 0.03,
      h: 0.16,
      fontSize: 10,
      color: COLORS.text,
      align: "center",
      bold: true,
    });
  }

  timeline.tracks.forEach((track, index) => {
    const y = axisY + rowH * index;
    slide5.addText(track.label, { x: 0.6, y: y + 0.12, w: 2.35, h: 0.3, fontSize: 10, color: COLORS.text, bold: true });
    slide5.addShape("rect", {
      x: axisX,
      y,
      w: axisW,
      h: 0.42,
      fill: { color: "E6EDF7" },
      line: { color: "DCE4F0", pt: 0.5 },
    });
    slide5.addShape("rect", {
      x: axisX + (track.start - 1) * monthW,
      y,
      w: Math.max(track.duration * monthW, 0.25),
      h: 0.42,
      fill: { color: track.color },
      line: { color: track.color, pt: 0.5 },
    });
  });

  slide5.addShape("rect", {
    x: 10.7,
    y: 1.95,
    w: 2.0,
    h: 4.6,
    fill: { color: COLORS.panel },
    line: { color: COLORS.line, pt: 1 },
  });
  slide5.addText("Проектирование\nпо системам", { x: 10.85, y: 2.1, w: 1.7, h: 0.5, fontSize: 11, bold: true, color: COLORS.text, valign: "mid" });

  timeline.designBySystem.slice(0, 6).forEach((item, idx) => {
    slide5.addText(`${item.name}`, { x: 10.85, y: 2.7 + idx * 0.58, w: 1.7, h: 0.18, fontSize: 8, color: COLORS.muted });
    slide5.addText(`${item.months} мес., ~${item.team} чел.`, {
      x: 10.85,
      y: 2.88 + idx * 0.58,
      w: 1.7,
      h: 0.18,
      fontSize: 8,
      bold: true,
      color: COLORS.text,
    });
  });

  slide5.addShape("rect", {
    x: 7.0,
    y: 6.25,
    w: 3.4,
    h: 0.46,
    fill: { color: COLORS.teal },
    line: { color: COLORS.teal, pt: 0.5 },
  });
  slide5.addText(`Готовность к сдаче — ${timeline.totalMonths} месяцев`, {
    x: 7.0,
    y: 6.36,
    w: 3.4,
    h: 0.22,
    fontSize: 11,
    color: "FFFFFF",
    align: "center",
    bold: true,
  });

  const filename = `${objectData.projectName || "estimate"}-presentation.pptx`;
  await writePptxFile(pptx, filename);
}
