import { withAiRetry } from "./aiRetry";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[^\p{L}\p{N}\s._:-]/gu, " ")
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

function clampCanvasSize(image, maxSize = 180) {
  const scale = Math.min(
    maxSize / Math.max(image.naturalWidth || 1, 1),
    maxSize / Math.max(image.naturalHeight || 1, 1),
    1
  );
  return {
    width: Math.max(36, Math.round((image.naturalWidth || 1) * scale)),
    height: Math.max(36, Math.round((image.naturalHeight || 1) * scale)),
  };
}

function computeBrightness(r, g, b) {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function analyzeRegion(imageData, width, xStart, xEnd, yStart, yEnd) {
  let pixelCount = 0;
  let sumBrightness = 0;
  let sumBrightnessSq = 0;
  let sumSaturation = 0;
  let edgeCount = 0;
  let verticalEdgeCount = 0;
  let horizontalEdgeCount = 0;

  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const brightness = computeBrightness(r, g, b);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      pixelCount += 1;
      sumBrightness += brightness;
      sumBrightnessSq += brightness * brightness;
      sumSaturation += saturation;

      if (x + 1 < xEnd) {
        const rightIndex = (y * width + (x + 1)) * 4;
        const rightBrightness = computeBrightness(
          imageData[rightIndex],
          imageData[rightIndex + 1],
          imageData[rightIndex + 2]
        );
        const horizontalDiff = Math.abs(brightness - rightBrightness);
        if (horizontalDiff > 30) {
          edgeCount += 1;
          verticalEdgeCount += 1;
        }
      }

      if (y + 1 < yEnd) {
        const bottomIndex = ((y + 1) * width + x) * 4;
        const bottomBrightness = computeBrightness(
          imageData[bottomIndex],
          imageData[bottomIndex + 1],
          imageData[bottomIndex + 2]
        );
        const verticalDiff = Math.abs(brightness - bottomBrightness);
        if (verticalDiff > 30) {
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
    };
  }

  const avgBrightness = sumBrightness / pixelCount;
  const variance = Math.max(sumBrightnessSq / pixelCount - avgBrightness * avgBrightness, 0);

  return {
    brightness: avgBrightness,
    contrast: Math.sqrt(variance),
    saturation: sumSaturation / pixelCount,
    edgeDensity: edgeCount / pixelCount,
    verticalEdgeDensity: verticalEdgeCount / pixelCount,
    horizontalEdgeDensity: horizontalEdgeCount / pixelCount,
  };
}

function analyzeSceneColors(imageData, width, height) {
  let pixelCount = 0;
  let skyLike = 0;
  let vegetationLike = 0;
  let vividLike = 0;
  let neutralLike = 0;
  let warmDecorative = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const r = imageData[index];
      const g = imageData[index + 1];
      const b = imageData[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      pixelCount += 1;

      if (b > r + 18 && b >= g + 8 && b > 100) skyLike += 1;
      if (g > r + 10 && g >= b - 8 && g > 80) vegetationLike += 1;
      if (saturation > 0.42 && max > 120) vividLike += 1;
      if (Math.abs(r - g) < 18 && Math.abs(g - b) < 18 && max > 70 && saturation < 0.12) neutralLike += 1;
      if (r > 130 && saturation > 0.45 && (g > 60 || b > 60)) warmDecorative += 1;
    }
  }

  if (!pixelCount) {
    return {
      skyRatio: 0,
      vegetationRatio: 0,
      vividRatio: 0,
      neutralRatio: 0,
      decorativeRatio: 0,
    };
  }

  return {
    skyRatio: skyLike / pixelCount,
    vegetationRatio: vegetationLike / pixelCount,
    vividRatio: vividLike / pixelCount,
    neutralRatio: neutralLike / pixelCount,
    decorativeRatio: warmDecorative / pixelCount,
  };
}

async function getImageMeta(file) {
  const image = await loadImage(file);
  if (!image) {
    return { width: 0, height: 0, orientation: "unknown", features: null };
  }

  const { width, height } = clampCanvasSize(image, 180);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      width: Number(image.naturalWidth || 0),
      height: Number(image.naturalHeight || 0),
      orientation: image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait",
      features: null,
    };
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height).data;

  return {
    width: Number(image.naturalWidth || 0),
    height: Number(image.naturalHeight || 0),
    orientation: (image.naturalWidth || 0) >= (image.naturalHeight || 0) ? "landscape" : "portrait",
    features: {
      sceneColors: analyzeSceneColors(imageData, width, height),
      topRegion: analyzeRegion(imageData, width, 0, width, 0, Math.max(8, Math.round(height * 0.34))),
      middleRegion: analyzeRegion(imageData, width, Math.round(width * 0.08), Math.round(width * 0.92), Math.round(height * 0.25), Math.round(height * 0.82)),
      bottomRegion: analyzeRegion(imageData, width, 0, width, Math.round(height * 0.66), height),
      wallRegion: analyzeRegion(imageData, width, 0, width, Math.round(height * 0.18), Math.round(height * 0.82)),
    },
  };
}

function detectEvacuationPlan(tokens, meta) {
  const top = meta?.features?.topRegion;
  const middle = meta?.features?.middleRegion;
  const tokenMatch = tokens.some((token) => ["эвак", "план", "evac", "plan", "scheme", "route"].includes(token));
  const documentLike = top && middle && middle.edgeDensity > 0.16 && middle.contrast > 30 && top.brightness > 145;
  return tokenMatch || documentLike;
}

function scoreSurfaceSuitability(tokens, meta) {
  const top = meta?.features?.topRegion;
  const wall = meta?.features?.wallRegion;
  const middle = meta?.features?.middleRegion;
  const bottom = meta?.features?.bottomRegion;
  const sceneColors = meta?.features?.sceneColors;

  if (!top || !wall || !middle || !bottom) {
    return { score: 0, reasons: ["Недостаточно данных изображения."] };
  }

  let score = 0;
  const reasons = [];
  const brightnessGap = Math.abs(top.brightness - wall.brightness);

  if ((meta.width || 0) >= 500 && (meta.height || 0) >= 500) {
    score += 0.08;
    reasons.push("Достаточное разрешение снимка.");
  }
  if (brightnessGap >= 12) {
    score += 0.18;
    reasons.push("Различимы зона потолка и зона стен.");
  }
  if (top.saturation <= wall.saturation + 0.03) {
    score += 0.1;
    reasons.push("Верх кадра похож на потолок.");
  }
  if (wall.edgeDensity >= 0.02 && wall.edgeDensity <= 0.18) {
    score += 0.1;
    reasons.push("Есть фактура поверхности стен.");
  }
  if (top.edgeDensity <= 0.16) {
    score += 0.08;
    reasons.push("Потолочная зона не перегружена лишними деталями.");
  }
  if (middle.verticalEdgeDensity >= 0.015 || middle.horizontalEdgeDensity >= 0.015) {
    score += 0.06;
    reasons.push("Есть конструктивные границы помещения.");
  }
  if (tokens.some((token) => ["office", "ceiling", "wall", "room", "потолок", "стена", "офис", "помещение", "parking", "паркинг"].includes(token))) {
    score += 0.08;
    reasons.push("Имя файла указывает на интерьер.");
  }

  if (wall.saturation > 0.26 && bottom.saturation > 0.24) {
    score -= 0.18;
    reasons.push("Снимок слишком насыщен и похож на нерелевантную сцену.");
  }
  if (top.edgeDensity > 0.22 && middle.edgeDensity > 0.22 && bottom.edgeDensity > 0.22) {
    score -= 0.18;
    reasons.push("Весь кадр перегружен мелкими деталями.");
  }
  if (top.saturation > 0.24 && wall.saturation > 0.24 && brightnessGap < 8) {
    score -= 0.18;
    reasons.push("Не разделяются потолок и стены.");
  }
  if (wall.edgeDensity < 0.01 && top.edgeDensity < 0.01) {
    score -= 0.14;
    reasons.push("Почти нет признаков поверхностей помещения.");
  }

  if (sceneColors) {
    if (sceneColors.skyRatio > 0.14 && sceneColors.vegetationRatio > 0.14) {
      score -= 0.46;
      reasons.push("Кадр похож на уличный пейзаж.");
    }
    if (sceneColors.vegetationRatio > 0.28) {
      score -= 0.28;
      reasons.push("В кадре преобладают признаки растительности.");
    }
    if (sceneColors.vividRatio > 0.5 && sceneColors.neutralRatio < 0.16) {
      score -= 0.24;
      reasons.push("Цветовой профиль похож на открытку, иллюстрацию или декоративную сцену.");
    }
    if (sceneColors.decorativeRatio > 0.22 && sceneColors.neutralRatio < 0.14) {
      score -= 0.18;
      reasons.push("Кадр содержит слишком много декоративных ярких объектов.");
    }
  }

  return { score: Number(score.toFixed(2)), reasons };
}

function inferWall(tokens, meta) {
  if (tokens.includes("бетон") || tokens.includes("concrete")) return "Бетон";
  if (tokens.includes("кирпич") || tokens.includes("brick")) return "Кирпич";
  if (tokens.includes("гкл") || tokens.includes("gypsum") || tokens.includes("drywall")) return "ГКЛ";
  if (tokens.includes("стекло") || tokens.includes("glass")) return "Стекло";
  if (tokens.includes("сэндвич") || tokens.includes("sandwich")) return "Сэндвич-панели";

  const wall = meta?.features?.wallRegion;
  if (!wall) return "Смешанный";
  if (wall.brightness > 170 && wall.saturation < 0.1 && wall.edgeDensity < 0.09) return "ГКЛ";
  if (wall.brightness >= 95 && wall.brightness <= 165 && wall.saturation < 0.14 && wall.contrast >= 12) return "Бетон";
  return "Смешанный";
}

function inferCeiling(tokens, meta) {
  if (tokens.includes("armstrong") || tokens.includes("армстронг")) return "Армстронг";
  if (tokens.includes("грильято") || tokens.includes("grilyato")) return "Грильято";
  if (tokens.includes("гкл") || tokens.includes("gypsum") || tokens.includes("drywall")) return "ГКЛ";
  if (tokens.includes("монолит")) return "Монолит";
  if (tokens.includes("open") || tokens.includes("открытый")) return "Открытый";

  const top = meta?.features?.topRegion;
  if (!top) return "Смешанный";
  if (top.brightness > 150 && top.verticalEdgeDensity > 0.08 && top.horizontalEdgeDensity > 0.08) return "Армстронг";
  if (top.edgeDensity > 0.2 && top.contrast > 32) return "Грильято";
  if (top.brightness < 120 && top.contrast > 34) return "Открытый";
  if (top.brightness > 175 && top.saturation < 0.09 && top.edgeDensity < 0.08) return "ГКЛ";
  return "Смешанный";
}

function estimateHeight(tokens, meta, ceilingType) {
  const joined = tokens.join(" ");
  const match = joined.match(/(?:h|height|высота|потолок|ceiling)?\s*([2-9](?:[.,]\d{1,2})?)\s*(?:м|m|метр)/i);
  if (match) {
    const value = Number(String(match[1]).replace(",", "."));
    if (Number.isFinite(value) && value >= 2 && value <= 18) {
      return { value: Number(value.toFixed(1)), confidence: 0.95 };
    }
  }

  const top = meta?.features?.topRegion;
  if (!top) return null;

  let height = ceilingType === "Открытый" ? 4.8 : ceilingType === "Грильято" ? 3.9 : ceilingType === "Монолит" ? 3.5 : 3.1;
  let confidence = ceilingType === "Смешанный" ? 0.42 : 0.68;

  if (meta.orientation === "portrait" && meta.height >= meta.width * 1.2) {
    height += 0.4;
    confidence += 0.08;
  }
  if (top.brightness < 122 && top.contrast > 34) {
    height += 0.5;
    confidence += 0.05;
  }
  if (top.edgeDensity > 0.21) {
    height += 0.3;
    confidence += 0.04;
  }

  if (confidence < 0.64) return null;
  return { value: Number(Math.min(Math.max(height, 2.4), 9.5).toFixed(1)), confidence: Number(confidence.toFixed(2)) };
}

function buildSurfaceSummary(wallMaterial, ceilingType, heightEstimate) {
  if (heightEstimate) {
    return `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}, высота помещения — около ${heightEstimate.value} м.`;
  }
  return `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}. Высоту помещения по этому фото лучше подтвердить вручную.`;
}

async function executeAnalysis({ file, prompt }) {
  const tokens = normalizeText(file?.name || "").split(/[\s._-]+/).filter(Boolean);
  const meta = await getImageMeta(file);

  if (prompt?.type === "evacuation_plan") {
    const accepted = detectEvacuationPlan(tokens, meta);
    if (!accepted) {
      return {
        accepted: false,
        confidence: 0.22,
        summary: "Загруженное фото не похоже на план эвакуации или маршрутную схему. Данные не приняты в чек-лист.",
        detections: ["Фото отклонено: нужен план эвакуации или маршрутная схема"],
        suggestedAnswers: [],
      };
    }

    return {
      accepted: true,
      confidence: 0.84,
      summary: "Обнаружены признаки плана эвакуации или маршрутной схемы.",
      detections: ["План эвакуации подтвержден"],
      suggestedAnswers: prompt.targetQuestionIds.map((questionId) => ({ questionId, value: true })),
    };
  }

  if (prompt?.type === "surface_scan") {
    const suitability = scoreSurfaceSuitability(tokens, meta);
    const sceneColors = meta?.features?.sceneColors;
    const obviousOutdoor =
      !!sceneColors &&
      ((sceneColors.skyRatio > 0.14 && sceneColors.vegetationRatio > 0.14) ||
        sceneColors.vegetationRatio > 0.28 ||
        (sceneColors.vividRatio > 0.5 && sceneColors.neutralRatio < 0.16));

    if (obviousOutdoor || suitability.score < 0.22) {
      return {
        accepted: false,
        confidence: 0.16,
        summary: "Фото не похоже на корректный снимок участка помещения. Для этого блока нужен реальный фрагмент стены и потолка внутри зоны.",
        detections: ["Фото отклонено: снимок не подтверждает внутренние поверхности помещения", ...suitability.reasons.slice(0, 4)],
        suggestedAnswers: [],
      };
    }

    const wallMaterial = inferWall(tokens, meta);
    const ceilingType = inferCeiling(tokens, meta);
    const heightEstimate = estimateHeight(tokens, meta, ceilingType);

    if (wallMaterial === "Смешанный" && ceilingType === "Смешанный" && !heightEstimate && suitability.score < 0.34) {
      return {
        accepted: false,
        confidence: 0.2,
        summary: "Фото не дало надежных признаков для определения конструкций помещения. Данные в чек-лист не загружены.",
        detections: ["Фото отклонено: AI не нашел надежных признаков помещения", ...suitability.reasons.slice(0, 4)],
        suggestedAnswers: [],
      };
    }

    const suggestedAnswers = [
      { questionId: prompt.targetQuestionIds[0], value: [wallMaterial] },
      { questionId: prompt.targetQuestionIds[1], value: [ceilingType] },
    ];
    if (heightEstimate && prompt.targetQuestionIds[2]) {
      suggestedAnswers.push({ questionId: prompt.targetQuestionIds[2], value: heightEstimate.value });
    }

    return {
      accepted: true,
      confidence: Math.min(0.93, 0.45 + suitability.score + (heightEstimate?.confidence || 0) * 0.15),
      summary: buildSurfaceSummary(wallMaterial, ceilingType, heightEstimate),
      detections: [
        `Стены: ${wallMaterial}`,
        `Потолок: ${ceilingType}`,
        heightEstimate ? `Высота помещения: около ${heightEstimate.value} м` : "Высота помещения: нужен ручной ввод",
        `Оценка пригодности снимка: ${suitability.score}`,
        "Защита активна: неподходящие фото не попадают в чек-лист",
      ],
      suggestedAnswers,
      estimatedCeilingHeight: heightEstimate?.value ?? null,
      estimatedCeilingHeightConfidence: heightEstimate?.confidence ?? null,
      needsManualCeilingHeight: !heightEstimate,
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
