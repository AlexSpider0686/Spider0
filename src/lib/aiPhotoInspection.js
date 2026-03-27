import { withAiRetry } from "./aiRetry";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadImage(file) {
  if (!file || typeof window === "undefined" || !String(file.type || "").startsWith("image/")) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = reject;
      node.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function rgbToStats(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 510;
  const saturation = max === 0 ? 0 : delta / max;
  return { lightness, saturation };
}

function clampCanvasSize(image, maxSize = 120) {
  const scale = Math.min(maxSize / Math.max(image.naturalWidth || 1, 1), maxSize / Math.max(image.naturalHeight || 1, 1), 1);
  return {
    width: Math.max(24, Math.round((image.naturalWidth || 1) * scale)),
    height: Math.max(24, Math.round((image.naturalHeight || 1) * scale)),
  };
}

function analyzeRegion(imageData, width, xStart, xEnd, yStart, yEnd) {
  let pixelCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumBrightness = 0;
  let sumBrightnessSq = 0;
  let sumSaturation = 0;
  let edgeCount = 0;
  let verticalEdgeCount = 0;
  let horizontalEdgeCount = 0;

  const brightnessAt = (index) => imageData[index] * 0.299 + imageData[index + 1] * 0.587 + imageData[index + 2] * 0.114;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const brightness = brightnessAt(index);
      const { saturation } = rgbToStats(r, g, b);

      pixelCount += 1;
      sumR += r;
      sumG += g;
      sumB += b;
      sumBrightness += brightness;
      sumBrightnessSq += brightness * brightness;
      sumSaturation += saturation;

      if (x + 1 < xEnd) {
        const rightIndex = (y * width + (x + 1)) * 4;
        const horizontalDiff = Math.abs(brightness - brightnessAt(rightIndex));
        if (horizontalDiff > 32) {
          edgeCount += 1;
          verticalEdgeCount += 1;
        }
      }

      if (y + 1 < yEnd) {
        const bottomIndex = ((y + 1) * width + x) * 4;
        const verticalDiff = Math.abs(brightness - brightnessAt(bottomIndex));
        if (verticalDiff > 32) {
          edgeCount += 1;
          horizontalEdgeCount += 1;
        }
      }
    }
  }

  if (!pixelCount) {
    return {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      edgeDensity: 0,
      verticalEdgeDensity: 0,
      horizontalEdgeDensity: 0,
      redBias: 0,
      blueBias: 0,
    };
  }

  const avgBrightness = sumBrightness / pixelCount;
  const variance = Math.max(sumBrightnessSq / pixelCount - avgBrightness * avgBrightness, 0);
  const avgR = sumR / pixelCount;
  const avgG = sumG / pixelCount;
  const avgB = sumB / pixelCount;

  return {
    brightness: avgBrightness,
    contrast: Math.sqrt(variance),
    saturation: sumSaturation / pixelCount,
    edgeDensity: edgeCount / pixelCount,
    verticalEdgeDensity: verticalEdgeCount / pixelCount,
    horizontalEdgeDensity: horizontalEdgeCount / pixelCount,
    redBias: avgR - (avgG + avgB) / 2,
    blueBias: avgB - (avgR + avgG) / 2,
  };
}

async function getImageMeta(file) {
  const image = await loadImage(file);
  if (!image) {
    return {
      width: 0,
      height: 0,
      features: null,
    };
  }

  const { width, height } = clampCanvasSize(image, 128);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      width: Number(image.naturalWidth || 0),
      height: Number(image.naturalHeight || 0),
      features: null,
    };
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;

  const topRegion = analyzeRegion(imageData, width, 0, width, 0, Math.max(8, Math.round(height * 0.34)));
  const middleRegion = analyzeRegion(
    imageData,
    width,
    Math.round(width * 0.08),
    Math.round(width * 0.92),
    Math.round(height * 0.25),
    Math.round(height * 0.82)
  );
  const leftWallRegion = analyzeRegion(imageData, width, 0, Math.max(10, Math.round(width * 0.38)), Math.round(height * 0.18), height);
  const rightWallRegion = analyzeRegion(imageData, width, Math.round(width * 0.62), width, Math.round(height * 0.18), height);

  const wallRegion = {
    brightness: (leftWallRegion.brightness + rightWallRegion.brightness + middleRegion.brightness) / 3,
    contrast: (leftWallRegion.contrast + rightWallRegion.contrast + middleRegion.contrast) / 3,
    saturation: (leftWallRegion.saturation + rightWallRegion.saturation + middleRegion.saturation) / 3,
    edgeDensity: (leftWallRegion.edgeDensity + rightWallRegion.edgeDensity + middleRegion.edgeDensity) / 3,
    verticalEdgeDensity: (leftWallRegion.verticalEdgeDensity + rightWallRegion.verticalEdgeDensity + middleRegion.verticalEdgeDensity) / 3,
    horizontalEdgeDensity: (leftWallRegion.horizontalEdgeDensity + rightWallRegion.horizontalEdgeDensity + middleRegion.horizontalEdgeDensity) / 3,
    redBias: (leftWallRegion.redBias + rightWallRegion.redBias + middleRegion.redBias) / 3,
    blueBias: (leftWallRegion.blueBias + rightWallRegion.blueBias + middleRegion.blueBias) / 3,
  };

  return {
    width: Number(image.naturalWidth || 0),
    height: Number(image.naturalHeight || 0),
    features: {
      topRegion,
      middleRegion,
      wallRegion,
    },
  };
}

function inferWallMaterialByTokens(tokens) {
  if (tokens.includes("бетон") || tokens.includes("concrete")) return "Бетон";
  if (tokens.includes("кирпич") || tokens.includes("brick")) return "Кирпич";
  if (tokens.includes("гкл") || tokens.includes("gypsum") || tokens.includes("drywall")) return "ГКЛ";
  if (tokens.includes("стекло") || tokens.includes("glass")) return "Стекло";
  if (tokens.includes("сэндвич") || tokens.includes("sandwich")) return "Сэндвич-панели";
  return null;
}

function inferWallMaterialByFeatures(features) {
  const wall = features?.wallRegion;
  if (!wall) return "Смешанный";

  if (wall.redBias > 14 && wall.saturation > 0.18 && wall.contrast > 26) return "Кирпич";
  if (wall.blueBias > 8 && wall.brightness > 150 && wall.saturation < 0.18) return "Стекло";
  if (wall.brightness > 170 && wall.saturation < 0.1 && wall.edgeDensity < 0.09) return "ГКЛ";
  if (wall.brightness > 155 && wall.saturation < 0.11 && wall.horizontalEdgeDensity > 0.09) return "Сэндвич-панели";
  if (wall.brightness >= 95 && wall.brightness <= 165 && wall.saturation < 0.14 && wall.contrast >= 12) return "Бетон";
  return "Смешанный";
}

function inferCeilingTypeByTokens(tokens) {
  if (tokens.includes("armstrong") || tokens.includes("армстронг")) return "Армстронг";
  if (tokens.includes("грильято") || tokens.includes("grilyato")) return "Грильято";
  if (tokens.includes("гкл") || tokens.includes("gypsum") || tokens.includes("drywall")) return "ГКЛ";
  if (tokens.includes("монолит")) return "Монолит";
  if (tokens.includes("open") || tokens.includes("открытый")) return "Открытый";
  return null;
}

function inferCeilingTypeByFeatures(meta) {
  const ceiling = meta?.features?.topRegion;
  if (!ceiling) return "Смешанный";

  if (ceiling.brightness > 150 && ceiling.verticalEdgeDensity > 0.08 && ceiling.horizontalEdgeDensity > 0.08) return "Армстронг";
  if (ceiling.edgeDensity > 0.2 && ceiling.contrast > 32) return "Грильято";
  if (ceiling.brightness < 120 && ceiling.contrast > 34) return "Открытый";
  if (ceiling.brightness > 175 && ceiling.saturation < 0.09 && ceiling.edgeDensity < 0.08) return "ГКЛ";
  if (ceiling.brightness >= 120 && ceiling.brightness <= 170 && ceiling.saturation < 0.1 && ceiling.edgeDensity < 0.1) return "Монолит";
  if (meta.height > meta.width && meta.height > 1400) return "Открытый";
  return "Смешанный";
}

function inferEvacuationPlan(tokens, meta) {
  if (tokens.some((token) => ["эвак", "план", "plan", "scheme", "route"].includes(token))) {
    return true;
  }
  const middle = meta?.features?.middleRegion;
  const top = meta?.features?.topRegion;
  if (!middle || !top) return meta.width > 1200 && meta.height > 800;
  return (middle.edgeDensity > 0.16 && middle.contrast > 34 && top.brightness > 150) || (meta.width > 1200 && meta.height > 800);
}

function looksLikeDocumentOrPlan(meta) {
  const middle = meta?.features?.middleRegion;
  const top = meta?.features?.topRegion;
  if (!middle || !top) return false;
  return middle.edgeDensity > 0.16 && middle.contrast > 34 && top.brightness > 145;
}

function looksLikeRealSurfaceShot(meta) {
  const wall = meta?.features?.wallRegion;
  const ceiling = meta?.features?.topRegion;
  if (!wall || !ceiling) return false;
  return wall.edgeDensity < 0.2 || wall.saturation > 0.06 || ceiling.contrast < 40;
}

function summarizeConfidence(primary, fallbackType) {
  if (primary) return 0.86;
  if (fallbackType === "Смешанный") return 0.48;
  return 0.71;
}

async function executeAnalysis({ file, prompt }) {
  const normalizedName = normalizeText(file?.name || "");
  const tokens = normalizedName.split(/[\s._-]+/).filter(Boolean);
  const meta = await getImageMeta(file);

  if (prompt?.type === "evacuation_plan") {
    const planDetected = inferEvacuationPlan(tokens, meta);
    if (!planDetected) {
      return {
        accepted: false,
        confidence: 0.22,
        summary: "Загруженное фото не похоже на план эвакуации или схему маршрутов. Данные не приняты в чек-лист.",
        detections: ["Фото не соответствует требуемому типу: нужен план эвакуации"],
        suggestedAnswers: [],
      };
    }
    return {
      accepted: true,
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
    if (looksLikeDocumentOrPlan(meta) && !looksLikeRealSurfaceShot(meta)) {
      return {
        accepted: false,
        confidence: 0.24,
        summary: "Загруженное фото похоже на документ, схему или план, а здесь нужен снимок реальной стены и потолка. Данные не приняты в чек-лист.",
        detections: ["Фото не соответствует требуемому типу: нужен фрагмент конструкций на объекте"],
        suggestedAnswers: [],
      };
    }

    const wallByTokens = inferWallMaterialByTokens(tokens);
    const ceilingByTokens = inferCeilingTypeByTokens(tokens);
    const wallMaterial = wallByTokens || inferWallMaterialByFeatures(meta.features);
    const ceilingType = ceilingByTokens || inferCeilingTypeByFeatures(meta);
    const confidence = Math.min(
      summarizeConfidence(Boolean(wallByTokens), wallMaterial) * 0.5 + summarizeConfidence(Boolean(ceilingByTokens), ceilingType) * 0.5,
      0.92
    );

    return {
      accepted: true,
      confidence,
      summary: `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}.`,
      detections: [
        `Стены: ${wallMaterial}`,
        `Потолок: ${ceilingType}`,
        wallByTokens || ceilingByTokens ? "Использованы признаки из имени файла" : "Использован анализ самого изображения",
      ],
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
    accepted: false,
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
