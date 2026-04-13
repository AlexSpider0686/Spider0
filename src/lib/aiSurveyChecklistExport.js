import { SYSTEM_TYPES } from "../config/estimateConfig";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeFileName(value, fallback = "project_checklist") {
  return (
    String(value || fallback)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || fallback
  );
}

async function saveBlob(fileName, blob) {
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        startIn: "desktop",
        types: [
          {
            description: "Word document",
            accept: {
              "application/msword": [".doc"],
            },
          },
        ],
      });
      const stream = await handle.createWritable();
      await stream.write(blob);
      await stream.close();
      return true;
    } catch (error) {
      if (error?.name === "AbortError") return false;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return true;
}

function getSystemLabel(code) {
  return SYSTEM_TYPES.find((item) => item.code === code)?.name || code || "Система";
}

function buildSystemSummaryRows(systems = [], activeCodes = []) {
  const activeSet = new Set(activeCodes || []);
  return (systems || [])
    .filter(Boolean)
    .map((system) => {
      const requiresSurvey = !system?.hasWorkingDocs;
      const active = activeSet.size ? activeSet.has(system.type) : requiresSurvey;
      return {
        label: getSystemLabel(system?.type),
        vendor: system?.vendor || "Не выбран",
        docs: system?.hasWorkingDocs ? "Есть проект / РД" : "Без проекта / требуется обследование",
        survey: active ? "Да" : "Нет",
      };
    });
}

function buildChecklistHtml({ objectData = {}, aiSurveyPlan = {}, systems = [] }) {
  const exportedAt = new Date().toLocaleString("ru-RU");
  const projectName = objectData?.projectName || "Проект";
  const summaryRows = buildSystemSummaryRows(systems, aiSurveyPlan?.activeSystems || []);
  const sections = Array.isArray(aiSurveyPlan?.sections) ? aiSurveyPlan.sections : [];
  const photoPrompts = Array.isArray(aiSurveyPlan?.photoPrompts) ? aiSurveyPlan.photoPrompts : [];
  const promptsBySectionKey = photoPrompts.reduce((acc, prompt) => {
    const key = prompt?.zoneId ? `zone:${prompt.zoneId}` : prompt?.sectionId ? `section:${prompt.sectionId}` : prompt?.systemType ? `system:${prompt.systemType}` : "global";
    if (!acc[key]) acc[key] = [];
    acc[key].push(prompt);
    return acc;
  }, {});

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(projectName)} - чеклист обследования</title>
    <style>
      @page { size: A4; margin: 16mm 14mm; }
      body { font-family: Arial, sans-serif; color: #16314f; margin: 0; }
      .page { padding: 0; }
      .hero {
        border: 1px solid #cddcf0;
        border-radius: 16px;
        padding: 18px 22px;
        background: linear-gradient(180deg, #f9fbff, #f0f6ff);
      }
      .hero small {
        display: block;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #5f7da2;
        font-size: 10px;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 24px; line-height: 1.2; margin-bottom: 8px; }
      .lead { font-size: 12px; line-height: 1.55; color: #4b6482; }
      .meta {
        margin-top: 16px;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .meta-card {
        border: 1px solid #d9e4f3;
        border-radius: 12px;
        padding: 10px 12px;
        background: #ffffff;
      }
      .meta-card strong, .meta-card span {
        display: block;
      }
      .meta-card span {
        font-size: 10px;
        text-transform: uppercase;
        color: #6f87a3;
        margin-bottom: 4px;
      }
      .meta-card strong {
        font-size: 13px;
        color: #153453;
      }
      .section {
        margin-top: 18px;
        border: 1px solid #d9e4f3;
        border-radius: 14px;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .section-head {
        padding: 12px 14px;
        background: linear-gradient(180deg, #f5f9ff, #ebf3ff);
        border-bottom: 1px solid #d9e4f3;
      }
      .section-head h2 {
        font-size: 18px;
        margin-bottom: 4px;
      }
      .section-head p {
        font-size: 11px;
        line-height: 1.5;
        color: #56708f;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid #d9e4f3;
        padding: 8px 9px;
        vertical-align: top;
        font-size: 11px;
        line-height: 1.45;
      }
      th {
        text-align: left;
        background: #f3f8ff;
        color: #21486d;
      }
      .blank {
        min-height: 34px;
        color: #95a8bf;
      }
      .photo-list {
        padding: 12px 14px 14px;
      }
      .photo-item {
        border: 1px dashed #b8cbe4;
        border-radius: 10px;
        padding: 10px 12px;
        margin-top: 8px;
        background: #fbfdff;
      }
      .photo-item strong {
        display: block;
        margin-bottom: 4px;
        font-size: 12px;
      }
      .photo-item span {
        color: #5c7592;
        font-size: 11px;
        line-height: 1.5;
      }
      .system-summary td:first-child { width: 34%; }
      .question-table td:nth-child(1) { width: 48%; }
      .question-table td:nth-child(2) { width: 18%; }
      .question-table td:nth-child(3) { width: 34%; }
      .footer-note {
        margin-top: 16px;
        padding: 12px 14px;
        border-radius: 12px;
        background: #f5f9ff;
        color: #55708e;
        font-size: 11px;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="hero">
        <small>Project.Core</small>
        <h1>Чеклист AI-обследования объекта</h1>
        <p class="lead">
          Документ сформирован как незаполненный шаблон обследования по выбранным системам. Его можно использовать для полевого выезда,
          внутреннего согласования и подготовки к загрузке данных в платформу.
        </p>
        <div class="meta">
          <div class="meta-card">
            <span>Проект</span>
            <strong>${escapeHtml(projectName)}</strong>
          </div>
          <div class="meta-card">
            <span>Адрес объекта</span>
            <strong>${escapeHtml(objectData?.address || "Не указан")}</strong>
          </div>
          <div class="meta-card">
            <span>Дата формирования</span>
            <strong>${escapeHtml(exportedAt)}</strong>
          </div>
          <div class="meta-card">
            <span>Оценка времени обследования</span>
            <strong>${escapeHtml(aiSurveyPlan?.estimatedHours || 0)} ч</strong>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-head">
          <h2>Состав обследования</h2>
          <p>Сводка по системам проекта и тем направлениям, которые должны быть проверены при обследовании.</p>
        </div>
        <table class="system-summary">
          <thead>
            <tr>
              <th>Система</th>
              <th>Вендор</th>
              <th>Статус исходных данных</th>
              <th>Требуется обследование</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows
              .map(
                (row) => `
              <tr>
                <td>${escapeHtml(row.label)}</td>
                <td>${escapeHtml(row.vendor)}</td>
                <td>${escapeHtml(row.docs)}</td>
                <td>${escapeHtml(row.survey)}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>

      ${sections
        .map((section) => {
          const zoneIds = [...new Set((section?.questions || []).map((question) => question?.zoneId).filter(Boolean))];
          const systemTypes = [...new Set((section?.questions || []).map((question) => question?.systemType).filter(Boolean))];
          const linkedPrompts = [
            ...(promptsBySectionKey[`section:${section.id}`] || []),
            ...zoneIds.flatMap((zoneId) => promptsBySectionKey[`zone:${zoneId}`] || []),
            ...systemTypes.flatMap((systemType) => promptsBySectionKey[`system:${systemType}`] || []),
          ].filter((prompt, index, array) => array.findIndex((item) => item.id === prompt.id) === index);

          return `
          <div class="section">
            <div class="section-head">
              <h2>${escapeHtml(section?.title || "Раздел обследования")}</h2>
              <p>${escapeHtml(section?.description || "Параметры для заполнения на объекте.")}</p>
            </div>
            <table class="question-table">
              <thead>
                <tr>
                  <th>Проверяемый параметр</th>
                  <th>Тип ответа</th>
                  <th>Поле для заметок / фиксации</th>
                </tr>
              </thead>
              <tbody>
                ${(section?.questions || [])
                  .filter((question) => !String(question?.id || "").endsWith("-mount-height-limit-enabled"))
                  .map(
                    (question) => `
                  <tr>
                    <td>${escapeHtml(question?.label || "")}${question?.required === false ? " <span style=\"color:#7d93ad\">(необязательно)</span>" : ""}</td>
                    <td>${escapeHtml(
                      question?.type === "boolean"
                        ? "Да / Нет"
                        : question?.type === "multiselect"
                          ? "Выбор вариантов"
                          : question?.type === "number"
                            ? "Число"
                            : "Текст"
                    )}</td>
                    <td class="blank">______________________________________________</td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            ${
              linkedPrompts.length
                ? `
              <div class="photo-list">
                <h3>Фотофиксация по разделу</h3>
                ${linkedPrompts
                  .map(
                    (prompt) => `
                  <div class="photo-item">
                    <strong>${escapeHtml(prompt?.title || "Фотофиксация")}</strong>
                    <span>${escapeHtml(prompt?.hint || "Сделайте фото и приложите его к акту обследования.")}</span>
                  </div>`
                  )
                  .join("")}
              </div>`
                : ""
            }
          </div>`;
        })
        .join("")}

      <div class="footer-note">
        Чеклист сформирован автоматически на основе текущего состава систем, зон и параметров объекта в Project.Core.
        Поля оставлены незаполненными, чтобы использовать документ как чистый шаблон для выездного обследования.
      </div>
    </div>
  </body>
</html>`;
}

export async function exportAiSurveyChecklist(payload = {}) {
  const html = buildChecklistHtml(payload);
  const blob = new Blob([`\ufeff${html}`], { type: "application/msword;charset=utf-8;" });
  const fileName = `${safeFileName(payload?.objectData?.projectName, "project")}_survey_checklist.doc`;
  return saveBlob(fileName, blob);
}
