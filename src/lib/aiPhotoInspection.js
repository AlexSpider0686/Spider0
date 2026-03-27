import { withAiRetry } from "./aiRetry";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getImageMeta(file) {
  if (!file || typeof window === "undefined" || !String(file.type || "").startsWith("image/")) {
    return { width: 0, height: 0 };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = reject;
      node.src = objectUrl;
    });
    return {
      width: Number(image.naturalWidth || 0),
      height: Number(image.naturalHeight || 0),
    };
  } catch {
    return { width: 0, height: 0 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function inferWallMaterial(tokens) {
  if (tokens.includes("бетон") || tokens.includes("concrete")) return "Бетон";
  if (tokens.includes("кирпич") || tokens.includes("brick")) return "Кирпич";
  if (tokens.includes("гкл") || tokens.includes("gypsum")) return "ГКЛ";
  if (tokens.includes("стекло") || tokens.includes("glass")) return "Стекло";
  if (tokens.includes("сэндвич") || tokens.includes("sandwich")) return "Сэндвич-панели";
  return "Смешанный";
}

function inferCeilingType(tokens, meta) {
  if (tokens.includes("armstrong")) return "Армстронг";
  if (tokens.includes("грильято") || tokens.includes("grilyato")) return "Грильято";
  if (tokens.includes("гкл") || tokens.includes("gypsum")) return "ГКЛ";
  if (tokens.includes("монолит")) return "Монолит";
  if (tokens.includes("open") || tokens.includes("откры")) return "Открытый";
  if (meta.height > meta.width && meta.height > 1400) return "Открытый";
  return "Смешанный";
}

function inferEvacuationPlan(tokens, meta) {
  if (tokens.some((token) => ["эвак", "план", "plan", "scheme", "route"].includes(token))) {
    return true;
  }
  return meta.width > 1200 && meta.height > 800;
}

async function executeAnalysis({ file, prompt }) {
  const normalizedName = normalizeText(file?.name || "");
  const tokens = normalizedName.split(/[\s._-]+/).filter(Boolean);
  const meta = await getImageMeta(file);

  if (prompt?.type === "evacuation_plan") {
    const planDetected = inferEvacuationPlan(tokens, meta);
    return {
      confidence: planDetected ? 0.84 : 0.42,
      summary: planDetected
        ? "Обнаружены признаки плана эвакуации или маршрутной схемы."
        : "На фото не удалось уверенно подтвердить план эвакуации.",
      detections: [planDetected ? "План эвакуации" : "Требуется ручная проверка"],
      suggestedAnswers: prompt.targetQuestionIds.map((questionId) => ({
        questionId,
        value: planDetected,
      })),
    };
  }

  if (prompt?.type === "surface_scan") {
    const wallMaterial = inferWallMaterial(tokens);
    const ceilingType = inferCeilingType(tokens, meta);
    return {
      confidence: 0.76,
      summary: `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}.`,
      detections: [`Стены: ${wallMaterial}`, `Потолок: ${ceilingType}`],
      suggestedAnswers: [
        {
          questionId: prompt.targetQuestionIds[0],
          value: [wallMaterial],
        },
        {
          questionId: prompt.targetQuestionIds[1],
          value: [ceilingType],
        },
      ],
    };
  }

  return {
    confidence: 0.35,
    summary: "AI-анализ не смог извлечь полезные признаки из фото.",
    detections: ["Нет уверенных признаков"],
    suggestedAnswers: [],
  };
}

export async function analyzeInspectionPhoto(input) {
  return withAiRetry(() => executeAnalysis(input), {
    retries: 5,
    baseDelayMs: 300,
    factor: 2,
    maxDelayMs: 3500,
  });
}
