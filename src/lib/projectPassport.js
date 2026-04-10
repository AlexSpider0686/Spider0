import { repairTextTree } from "./textEncoding";

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

function safeFileName(value, fallback = "project_passport") {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}

async function serializeSourceFiles(files = []) {
  const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  return Promise.all(
    safeFiles.map(async (file, index) => ({
      name: file?.name || `photo-${index + 1}`,
      type: file?.type || "application/octet-stream",
      lastModified: Number(file?.lastModified || Date.now()),
      size: Number(file?.size || 0),
      dataUrl: await fileToDataUrl(file),
    }))
  );
}

async function serializeAnalysisMap(mapObject = {}) {
  const entries = await Promise.all(
    Object.entries(mapObject || {}).map(async ([key, analysis]) => [
      key,
      {
        ...(analysis || {}),
        sourceFiles: await serializeSourceFiles(analysis?.sourceFiles),
      },
    ])
  );
  return Object.fromEntries(entries);
}

async function serializeTechnicalSolution(technicalSolution = {}) {
  return {
    ...(technicalSolution || {}),
    photoAnalyses: await serializeAnalysisMap(technicalSolution?.photoAnalyses),
    appliedPhotoAnalyses: await serializeAnalysisMap(technicalSolution?.appliedPhotoAnalyses),
  };
}

function countSerializedFiles(analysisMap = {}) {
  return Object.values(analysisMap || {}).reduce((sum, analysis) => sum + (Array.isArray(analysis?.sourceFiles) ? analysis.sourceFiles.length : 0), 0);
}

function collectPhotoRows(technicalSolution = {}) {
  const rows = [];
  const pushFromMap = (analysisMap = {}, scopeLabel) => {
    Object.entries(analysisMap || {}).forEach(([promptId, analysis]) => {
      (Array.isArray(analysis?.sourceFiles) ? analysis.sourceFiles : []).forEach((file, index) => {
        rows.push({
          scopeLabel,
          promptId,
          title: analysis?.fileName || analysis?.summary || promptId,
          name: file?.name || `${promptId}-${index + 1}`,
          dataUrl: file?.dataUrl || "",
        });
      });
    });
  };

  pushFromMap(technicalSolution?.photoAnalyses, "Черновые фото");
  pushFromMap(technicalSolution?.appliedPhotoAnalyses, "Применённые фото");
  return rows;
}

function buildPassportHtml(snapshot, options = {}) {
  const exportedAt = new Date().toISOString();
  const projectName = snapshot?.objectData?.projectName || "Проект";
  const photoCount =
    countSerializedFiles(snapshot?.technicalSolution?.photoAnalyses) + countSerializedFiles(snapshot?.technicalSolution?.appliedPhotoAnalyses);
  const photoRows = collectPhotoRows(snapshot?.technicalSolution);
  const prettyJson = JSON.stringify(snapshot, null, 2)
    .replace(/</g, "\\u003c")
    .replace(/<\/script/gi, "<\\/script");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <meta name="project-core-passport" content="project-core-passport-v1" />
    <title>${escapeHtml(projectName)} - паспорт проекта</title>
    <style>
      body { font-family: Arial, sans-serif; color: #16314f; }
      h1, h2, p { margin: 0 0 10px; }
      table { border-collapse: collapse; width: 100%; margin-top: 12px; }
      th, td { border: 1px solid #9fb7d7; padding: 6px 8px; font-size: 12px; vertical-align: top; }
      th { background: #e7f0fb; text-align: left; }
      .meta td:first-child { width: 260px; font-weight: 700; background: #f4f8fc; }
      .notes { color: #60738a; font-size: 12px; margin-top: 12px; }
      .raw-json { white-space: pre-wrap; font-family: Consolas, monospace; font-size: 11px; color: #51657c; }
      .photo-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .photo-card { border: 1px solid #d6e3f5; border-radius: 10px; padding: 10px; background: #f9fbff; page-break-inside: avoid; }
      .photo-card img { max-width: 100%; max-height: 220px; object-fit: contain; display: block; margin-top: 8px; border: 1px solid #d6e3f5; background: #fff; }
    </style>
  </head>
  <body>
    <h1>Паспорт проекта</h1>
    <p>Project.Core. Файл содержит экспорт данных проекта для переноса между контурами платформы.</p>
    <table class="meta">
      <tr><td>Проект</td><td>${escapeHtml(projectName)}</td></tr>
      <tr><td>Адрес</td><td>${escapeHtml(snapshot?.objectData?.address || "Не указан")}</td></tr>
      <tr><td>Дата выгрузки</td><td>${escapeHtml(exportedAt)}</td></tr>
      <tr><td>Версия формата</td><td>project-core-passport-v1</td></tr>
      <tr><td>Систем</td><td>${escapeHtml((snapshot?.systems || []).length)}</td></tr>
      <tr><td>Зон</td><td>${escapeHtml((snapshot?.zones || []).length)}</td></tr>
      <tr><td>Фотоматериалов</td><td>${escapeHtml(photoCount)}</td></tr>
      <tr><td>Суточные, руб./чел.</td><td>${escapeHtml(snapshot?.travelEstimate?.perDiemPerPersonDay || 0)}</td></tr>
      <tr><td>Комментарий</td><td>${escapeHtml(options?.note || "Для загрузки обратно в платформу выберите файл паспорта проекта и нажмите «Загрузить паспорт проекта».")}</td></tr>
    </table>

    <table>
      <thead>
        <tr>
          <th>Система</th>
          <th>Вендор</th>
          <th>Режим</th>
          <th>Комментарий</th>
        </tr>
      </thead>
      <tbody>
        ${(snapshot?.systems || [])
          .map(
            (system) => `
              <tr>
                <td>${escapeHtml(system?.type || "")}</td>
                <td>${escapeHtml(system?.vendor || "")}</td>
                <td>${escapeHtml(system?.estimateMode || "algorithm")}</td>
                <td>${escapeHtml(system?.note || "")}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>

    <div class="notes">
      Внутри файла сохранён структурированный JSON-паспорт, включая введённые пользователем данные, расчётные настройки и фотоматериалы.
    </div>

    ${
      photoRows.length
        ? `
      <h2 style="margin-top: 18px;">Фотоматериалы</h2>
      <div class="photo-grid">
        ${photoRows
          .map(
            (photo) => `
          <div class="photo-card">
            <div><strong>${escapeHtml(photo.scopeLabel)}</strong></div>
            <div>${escapeHtml(photo.title || photo.promptId)}</div>
            <div>${escapeHtml(photo.name)}</div>
            <img src="${escapeHtml(photo.dataUrl)}" alt="${escapeHtml(photo.name)}" />
          </div>
        `
          )
          .join("")}
      </div>
    `
        : ""
    }

    <script id="project-passport-data" type="application/json">${prettyJson}</script>
    <div class="raw-json" style="display:none">${escapeHtml(prettyJson)}</div>
  </body>
</html>`;
}

async function dataUrlToFile(descriptor, fallbackName) {
  const dataUrl = String(descriptor?.dataUrl || "");
  if (!dataUrl) return null;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], descriptor?.name || fallbackName || "photo.bin", {
    type: descriptor?.type || blob.type || "application/octet-stream",
    lastModified: Number(descriptor?.lastModified || Date.now()),
  });
}

async function restoreAnalysisMap(mapObject = {}) {
  const entries = await Promise.all(
    Object.entries(mapObject || {}).map(async ([key, analysis]) => [
      key,
      {
        ...(analysis || {}),
        sourceFiles: (
          await Promise.all(
            (Array.isArray(analysis?.sourceFiles) ? analysis.sourceFiles : []).map((descriptor, index) =>
              dataUrlToFile(descriptor, `${key}-${index + 1}.bin`)
            )
          )
        ).filter(Boolean),
      },
    ])
  );
  return Object.fromEntries(entries);
}

async function restoreTechnicalSolution(technicalSolution = {}) {
  return {
    ...(technicalSolution || {}),
    photoAnalyses: await restoreAnalysisMap(technicalSolution?.photoAnalyses),
    appliedPhotoAnalyses: await restoreAnalysisMap(technicalSolution?.appliedPhotoAnalyses),
  };
}

function extractPassportJson(text) {
  const raw = String(text || "");
  const byRegex = raw.match(/<script[^>]*id=["']project-passport-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (byRegex?.[1]) return byRegex[1];

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const node = doc.querySelector("#project-passport-data");
    if (node?.textContent) return node.textContent;
  }

  throw new Error("В выбранном файле не найден паспорт проекта Project.Core.");
}

export async function downloadProjectPassport(snapshot, options = {}) {
  const technicalSolution = await serializeTechnicalSolution(snapshot?.technicalSolution);
  const normalizedSnapshot = {
    version: "project-core-passport-v1",
    exportedAt: new Date().toISOString(),
    objectData: snapshot?.objectData || {},
    zones: Array.isArray(snapshot?.zones) ? snapshot.zones : [],
    systems: Array.isArray(snapshot?.systems) ? snapshot.systems : [],
    budget: snapshot?.budget || {},
    normativeRequirementsApplied: Boolean(snapshot?.normativeRequirementsApplied),
    zonePreset: snapshot?.zonePreset || "business_center",
    lockedZoneIds: Array.isArray(snapshot?.lockedZoneIds) ? snapshot.lockedZoneIds : [],
    addressVerification: snapshot?.addressVerification || { state: "idle", message: "", result: null },
    travelEstimate: snapshot?.travelEstimate || null,
    technicalSolution,
    apsProjectSnapshots: snapshot?.apsProjectSnapshots || {},
    vendorPriceSnapshots: snapshot?.vendorPriceSnapshots || {},
    vendorComparisonsBySystem: snapshot?.vendorComparisonsBySystem || {},
  };

  const html = buildPassportHtml(normalizedSnapshot, options);
  const blob = new Blob([`\ufeff${html}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(`${safeFileName(normalizedSnapshot?.objectData?.projectName, "project")}_passport.xls`, blob);
}

export async function readProjectPassport(file) {
  const text = await file.text();
  const jsonPayload = extractPassportJson(text);
  const parsed = repairTextTree(JSON.parse(jsonPayload));
  const technicalSolution = await restoreTechnicalSolution(parsed?.technicalSolution);

  return {
    ...(parsed || {}),
    technicalSolution,
  };
}
