import PptxGenJS from "pptxgenjs";
import { num } from "./estimate";

export async function exportEstimatePptx({ objectData, recalculatedArea, systemResults, totals }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Spider0";
  pptx.company = "Spider0";
  pptx.subject = "Смета систем безопасности";
  pptx.title = `Смета: ${objectData.projectName || "Проект"}`;

  const slide1 = pptx.addSlide();
  slide1.background = { color: "EEF4FF" };
  slide1.addText("Калькулятор сметы систем безопасности", { x: 0.6, y: 0.3, w: 8.5, h: 0.4, fontSize: 20, bold: true, color: "1F3A56" });
  slide1.addText(`Проект: ${objectData.projectName || "—"}`, { x: 0.6, y: 1.0, w: 4.8, h: 0.3, fontSize: 13, color: "2B4A68" });
  slide1.addText(`Тип объекта: ${objectData.objectTypeLabel || objectData.objectType || "—"}`, { x: 0.6, y: 1.35, w: 6.2, h: 0.3, fontSize: 12, color: "2B4A68" });
  slide1.addText(`Субъект РФ: ${objectData.regionName || "—"}`, { x: 0.6, y: 1.7, w: 5.8, h: 0.3, fontSize: 12, color: "2B4A68" });
  slide1.addText(`Региональный коэффициент: x${num(objectData.regionCoef || 1, 2)}`, { x: 0.6, y: 2.05, w: 5.8, h: 0.3, fontSize: 12, color: "2B4A68" });
  slide1.addText(`Площадь по зонам: ${num(recalculatedArea, 0)} м²`, { x: 0.6, y: 2.4, w: 5.8, h: 0.3, fontSize: 12, color: "2B4A68" });

  slide1.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 3.0,
    w: 3.0,
    h: 1.0,
    fill: { color: "FFFFFF", transparency: 0 },
    line: { color: "C9D8EA", pt: 1 },
    radius: 0.08,
    shadow: { color: "93A7C2", angle: 45, blur: 2, distance: 1, opacity: 0.2 },
  });
  slide1.addText(`Итог сметы\n${num(totals.total, 0)} ₽`, {
    x: 0.8,
    y: 3.25,
    w: 2.6,
    h: 0.7,
    fontSize: 14,
    bold: true,
    color: "1F3A56",
    align: "center",
  });

  const slide2 = pptx.addSlide();
  slide2.background = { color: "EEF4FF" };
  slide2.addText("Системы и ключевые показатели", { x: 0.6, y: 0.3, w: 8.5, h: 0.4, fontSize: 18, bold: true, color: "1F3A56" });

  const tableRows = [
    [
      { text: "Система", options: { bold: true } },
      { text: "Вендор", options: { bold: true } },
      { text: "Кабель, м", options: { bold: true } },
      { text: "Ед.", options: { bold: true } },
      { text: "Итого, ₽", options: { bold: true } },
    ],
    ...systemResults.map((item) => [
      item.systemName,
      item.vendor,
      num(item.cable, 0),
      num(item.units, 0),
      num(item.total, 0),
    ]),
  ];

  slide2.addTable(tableRows, {
    x: 0.6,
    y: 0.9,
    w: 12.0,
    h: 4.8,
    border: { color: "D2DEEE", pt: 1 },
    fill: "FFFFFF",
    color: "203B57",
    fontSize: 11,
    valign: "mid",
    colW: [2.2, 2.2, 1.8, 1.2, 2.0],
  });

  const slide3 = pptx.addSlide();
  slide3.background = { color: "EEF4FF" };
  slide3.addText("Итоговая структура бюджета", { x: 0.6, y: 0.3, w: 8.0, h: 0.4, fontSize: 18, bold: true, color: "1F3A56" });

  const summaryRows = [
    ["Материалы", num(totals.totalMaterials, 0)],
    ["Труд", num(totals.totalLabor, 0)],
    ["Накладные+СИЗ+ФОТ+АХР", num(totals.totalOverhead, 0)],
    ["Прибыль", num(totals.totalProfit, 0)],
    ["НДС", num(totals.totalVat, 0)],
    ["ИТОГО", num(totals.total, 0)],
  ];

  slide3.addTable(
    [
      [{ text: "Статья", options: { bold: true } }, { text: "Сумма, ₽", options: { bold: true } }],
      ...summaryRows,
    ],
    {
      x: 0.6,
      y: 1.0,
      w: 6.2,
      h: 4.5,
      border: { color: "D2DEEE", pt: 1 },
      fill: "FFFFFF",
      color: "203B57",
      fontSize: 12,
      valign: "mid",
      colW: [4.2, 2.0],
    }
  );

  const filename = `${objectData.projectName || "estimate"}-presentation.pptx`;
  await pptx.writeFile({ fileName: filename });
}
