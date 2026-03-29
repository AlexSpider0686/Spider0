import { SYSTEM_TYPES } from "../config/estimateConfig";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

export function downloadSystemSpecificationExcel({ objectData, system, systemResult, recommendation, zones = [] }) {
  const systemName = SYSTEM_TYPES.find((item) => item.code === system?.type)?.name || system?.type || "Система";
  const rows = recommendation?.specRows || [];
  const zoneNames = (zones || []).map((item) => item.name).join(", ");
  const modeLabel = systemResult?.estimateMode === "project_pdf" ? "По проектной спецификации" : "По расчетной модели";

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #9fb7d7; padding: 6px 8px; font-size: 12px; }
          th { background: #e7f0fb; text-align: left; }
          h1, h2, p { font-family: Arial, sans-serif; }
          .meta td:first-child { width: 220px; font-weight: 700; background: #f4f8fc; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(systemName)}</h1>
        <p>Project.Core™. Выгрузка рассчитанной спецификации оборудования и материалов.</p>
        <table class="meta">
          <tr><td>Объект</td><td>${escapeHtml(objectData?.projectName || "Без названия")}</td></tr>
          <tr><td>Адрес</td><td>${escapeHtml(objectData?.address || "Не указан")}</td></tr>
          <tr><td>Площадь</td><td>${escapeHtml(objectData?.totalArea || 0)} м²</td></tr>
          <tr><td>Система</td><td>${escapeHtml(systemName)}</td></tr>
          <tr><td>Вендор</td><td>${escapeHtml(system?.vendor || "Базовый")}</td></tr>
          <tr><td>Режим расчета</td><td>${escapeHtml(modeLabel)}</td></tr>
          <tr><td>Зоны объекта</td><td>${escapeHtml(zoneNames || "Не заданы")}</td></tr>
        </table>
        <br />
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Позиция</th>
              <th>Основание</th>
              <th>Кол-во</th>
              <th>Ед. изм.</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${escapeHtml(row.basis)}</td>
                    <td>${escapeHtml(row.qty)}</td>
                    <td>${escapeHtml(row.unit)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const safeProjectName = String(objectData?.projectName || "project").replace(/[\\/:*?"<>|]+/g, "_");
  const safeSystemName = String(system?.type || "system").replace(/[\\/:*?"<>|]+/g, "_");
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(`${safeProjectName}_${safeSystemName}_spec.xls`, blob);
}
