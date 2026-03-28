import { withAiRetry } from "./aiRetry";
import { MIN_ACCEPTABLE_PLAN_QUALITY, recognizeEvacuationPlanLayout } from "./evacuationPlanRecognition";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[^\p{L}\p{N}\s.,_:-]/gu, " ")
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

function clampCanvasSize(image, maxSize = 140) {
  const scale = Math.min(maxSize / Math.max(image.naturalWidth || 1, 1), maxSize / Math.max(image.naturalHeight || 1, 1), 1);
  return {
    width: Math.max(28, Math.round((image.naturalWidth || 1) * scale)),
    height: Math.max(28, Math.round((image.naturalHeight || 1) * scale)),
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
      orientation: "unknown",
      features: null,
    };
  }

  const { width, height } = clampCanvasSize(image, 140);
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
  const bottomRegion = analyzeRegion(imageData, width, 0, width, Math.round(height * 0.66), height);

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
    orientation: (image.naturalWidth || 0) >= (image.naturalHeight || 0) ? "landscape" : "portrait",
    features: {
      topRegion,
      middleRegion,
      bottomRegion,
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

function scoreSurfaceShotSuitability(tokens, meta) {
  const top = meta?.features?.topRegion;
  const wall = meta?.features?.wallRegion;
  const middle = meta?.features?.middleRegion;
  const bottom = meta?.features?.bottomRegion;

  if (!top || !wall || !middle || !bottom) {
    return { score: 0, reasons: ["Недостаточно визуальных данных для проверки снимка."] };
  }

  let score = 0;
  const reasons = [];
  const indoorHintTokens = [
    "office",
    "ceiling",
    "wall",
    "room",
    "corridor",
    "hall",
    "потолок",
    "стена",
    "офис",
    "коридор",
    "помещение",
  ];

  if ((meta.width || 0) >= 500 && (meta.height || 0) >= 500) {
    score += 0.08;
    reasons.push("Разрешение достаточно для анализа поверхности.");
  }

  const brightnessGap = Math.abs((top.brightness || 0) - (wall.brightness || 0));
  if (brightnessGap >= 10) {
    score += 0.16;
    reasons.push("Есть различие между потолочной и стеновой зонами.");
  }

  if ((top.saturation || 0) <= (wall.saturation || 0) + 0.03) {
    score += 0.1;
    reasons.push("Верхняя часть кадра похожа на потолок.");
  }

  if ((wall.edgeDensity || 0) >= 0.02 && (wall.edgeDensity || 0) <= 0.18) {
    score += 0.1;
    reasons.push("Стеновая зона содержит допустимую фактуру поверхности.");
  }

  if ((top.edgeDensity || 0) <= 0.16) {
    score += 0.08;
    reasons.push("Верхняя зона не похожа на случайную перегруженную сцену.");
  }

  if ((middle.verticalEdgeDensity || 0) >= 0.015 || (middle.horizontalEdgeDensity || 0) >= 0.015) {
    score += 0.07;
    reasons.push("В кадре есть конструктивные границы помещения.");
  }

  if (tokens.some((token) => indoorHintTokens.includes(token))) {
    score += 0.08;
    reasons.push("Имя файла указывает на интерьерный снимок.");
  }

  if ((wall.saturation || 0) > 0.26 && (bottom.saturation || 0) > 0.24) {
    score -= 0.18;
    reasons.push("Кадр слишком насыщен и похож на нерелевантную сцену.");
  }

  if ((top.edgeDensity || 0) > 0.22 && (middle.edgeDensity || 0) > 0.22 && (bottom.edgeDensity || 0) > 0.22) {
    score -= 0.18;
    reasons.push("Весь кадр перегружен деталями и не похож на типовой снимок поверхности.");
  }

  if ((top.saturation || 0) > 0.24 && (wall.saturation || 0) > 0.24 && brightnessGap < 8) {
    score -= 0.18;
    reasons.push("Кадр не разделяется на зоны потолка и стены.");
  }

  if ((wall.edgeDensity || 0) < 0.01 && (top.edgeDensity || 0) < 0.01) {
    score -= 0.14;
    reasons.push("В снимке почти нет признаков поверхностей помещения.");
  }

  return {
    score: Number(score.toFixed(2)),
    reasons,
  };
}

function summarizeConfidence(primary, fallbackType) {
  if (primary) return 0.86;
  if (fallbackType === "Смешанный") return 0.48;
  return 0.71;
}

function parseHeightFromTokens(tokens) {
  const joined = tokens.join(" ");
  const match = joined.match(/(?:h|height|высота|потолок|ceiling)?\s*([2-9](?:[.,]\d{1,2})?)\s*(?:м|m|метр)/i);
  if (!match) return null;
  const value = Number(String(match[1]).replace(",", "."));
  if (!Number.isFinite(value) || value < 2 || value > 18) return null;
  return {
    value: Number(value.toFixed(1)),
    confidence: 0.95,
    source: "token",
  };
}

function estimateHeightByFeatures(meta, ceilingType) {
  const top = meta?.features?.topRegion;
  const middle = meta?.features?.middleRegion;
  const bottom = meta?.features?.bottomRegion;
  if (!top || !middle || !bottom) return null;

  let height = 3.2;
  let confidence = 0.42;

  switch (ceilingType) {
    case "Армстронг":
      height = 3.0;
      confidence = 0.68;
      break;
    case "ГКЛ":
      height = 3.1;
      confidence = 0.63;
      break;
    case "Монолит":
      height = 3.5;
      confidence = 0.58;
      break;
    case "Грильято":
      height = 3.9;
      confidence = 0.72;
      break;
    case "Открытый":
      height = 4.8;
      confidence = 0.76;
      break;
    default:
      height = 3.4;
      confidence = 0.4;
      break;
  }

  if (meta.orientation === "portrait" && meta.height >= meta.width * 1.2) {
    height += 0.4;
    confidence += 0.08;
  }

  if (top.brightness < 122 && top.contrast > 34) {
    height += 0.5;
    confidence += 0.05;
  }

  if (top.edgeDensity > 0.21 || middle.verticalEdgeDensity > 0.11) {
    height += 0.3;
    confidence += 0.04;
  }

  if (bottom.edgeDensity < 0.08 && top.brightness > 170 && top.edgeDensity < 0.09) {
    height -= 0.2;
    confidence += 0.02;
  }

  if (ceilingType === "Смешанный") {
    confidence -= 0.08;
  }

  const boundedHeight = Math.min(Math.max(height, 2.4), 9.5);
  const boundedConfidence = Math.min(Math.max(confidence, 0), 0.9);

  if (boundedConfidence < 0.64) return null;

  return {
    value: Number(boundedHeight.toFixed(1)),
    confidence: Number(boundedConfidence.toFixed(2)),
    source: "image",
  };
}

function buildSurfaceSummary(wallMaterial, ceilingType, heightEstimate) {
  if (heightEstimate) {
    return `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}, высота помещения — около ${heightEstimate.value} м.`;
  }
  return `Определены вероятные типы конструкций: стены — ${wallMaterial}, потолок — ${ceilingType}. Высоту помещения по этому фото лучше подтвердить вручную.`;
}

function buildPlanRecognitionSummary(planRecognition) {
  const zoneSummaries = (planRecognition?.systems || [])
    .map((item) => `${item.systemLabel}: ${item.zoneCount} ${item.zoneTerm}`)
    .join(", ");

  const areaComparison = planRecognition?.areaComparison;
  const areaText = areaComparison
    ? ` Сравнение площадей: введено ${areaComparison.userTotalArea} м², по планировкам/фото прогнозируется ${areaComparison.predictedTotalArea} м².`
    : "";

  return `План эвакуации распознан. Планировка: ${planRecognition.layoutType.toLowerCase()}, оценка качества съемки: ${planRecognition.captureQuality.label.toLowerCase()}, зоны определены дифференцированно и перепроверены по данным объекта (${zoneSummaries}).${areaText}`;
}

async function executeAnalysis({ file, prompt, zones, systems, objectData, photoAnalyses, floorIndex }) {
  const normalizedName = normalizeText(file?.name || "");
  const tokens = normalizedName.split(/[\s._-]+/).filter(Boolean);
  const meta = await getImageMeta(file);

  if (prompt?.type === "evacuation_plan") {
    const planDetected = inferEvacuationPlan(tokens, meta);
    if (!planDetected) {
      return {
        accepted: false,
        confidence: 0.22,
        summary: "Загруженное фото не похоже на план эвакуации или маршрутную схему. Данные не приняты в чек-лист.",
        detections: ["Фото не соответствует требуемому типу: нужен план эвакуации"],
        suggestedAnswers: [],
      };
    }

    const planRecognition = recognizeEvacuationPlanLayout({
      prompt,
      zones,
      systems,
      meta,
      objectData,
      floorIndex,
      relatedPhotoAnalyses: photoAnalyses,
    });

    if ((planRecognition?.captureQuality?.score || 0) < MIN_ACCEPTABLE_PLAN_QUALITY) {
      return {
        accepted: false,
        confidence: Math.min(0.69, planRecognition.captureQuality?.score || 0.4),
        summary: `Фото плана отклонено: пригодность ${Math.round((planRecognition.captureQuality?.score || 0) * 100)}%, а требуется не ниже 70%.`,
        detections: [
          `Пригодность снимка: ${Math.round((planRecognition.captureQuality?.score || 0) * 100)}%`,
          ...(planRecognition.captureQuality?.improvements || []).slice(0, 4),
        ],
        suggestedAnswers: [],
        planRecognition: {
          ...planRecognition,
          accepted: false,
        },
      };
    }

    return {
      accepted: true,
      confidence: Math.min(0.94, 0.74 + (planRecognition.captureQuality?.score || 0) * 0.18),
      summary: buildPlanRecognitionSummary(planRecognition),
      detections: [
        "План эвакуации подтвержден",
        `Планировка: ${planRecognition.layoutType}`,
        `Качество съемки: ${planRecognition.captureQuality.label}`,
        `Эвакуационных выходов/маршрутов: ~${planRecognition.egressCount}`,
        `Оценочная площадь этажа: ${planRecognition.geometry?.floorAreaEstimated || 0} м²`,
        ...planRecognition.systems.map((item) => `${item.systemLabel}: выделено ${item.zoneCount} ${item.zoneTerm}`),
      ],
      suggestedAnswers: prompt.targetQuestionIds.map((questionId) => ({
        questionId,
        value: true,
      })),
      planRecognition,
    };
  }

  if (prompt?.type === "surface_scan") {
    if (looksLikeDocumentOrPlan(meta) && !looksLikeRealSurfaceShot(meta)) {
      return {
        accepted: false,
        confidence: 0.24,
        summary: "Загруженное фото похоже на документ, схему или план. Здесь нужен снимок реальной стены и потолка, поэтому данные не приняты в чек-лист.",
        detections: ["Фото отклонено: загружен не фрагмент реального помещения"],
        suggestedAnswers: [],
      };
    }

    const wallByTokens = inferWallMaterialByTokens(tokens);
    const ceilingByTokens = inferCeilingTypeByTokens(tokens);
    const wallMaterial = wallByTokens || inferWallMaterialByFeatures(meta.features);
    const ceilingType = ceilingByTokens || inferCeilingTypeByFeatures(meta);
    const tokenHeight = parseHeightFromTokens(tokens);
    const featureHeight = tokenHeight ? null : estimateHeightByFeatures(meta, ceilingType);
    const heightEstimate = tokenHeight || featureHeight;
    const confidence = Math.min(
      summarizeConfidence(Boolean(wallByTokens), wallMaterial) * 0.4 +
        summarizeConfidence(Boolean(ceilingByTokens), ceilingType) * 0.35 +
        (heightEstimate?.confidence || 0.48) * 0.25,
      0.93
    );

    const detections = [
      `Стены: ${wallMaterial}`,
      `Потолок: ${ceilingType}`,
      heightEstimate
        ? `Высота помещения: около ${heightEstimate.value} м (${heightEstimate.source === "token" ? "по подсказке из имени файла" : "по анализу изображения"})`
        : "Высота помещения: автоопределение недостаточно надежно, нужен ручной ввод",
      wallByTokens || ceilingByTokens ? "Использованы подсказки из имени файла и анализ изображения" : "Использован анализ самого изображения",
      "Защита активна: неподходящие фото не попадают в чек-лист",
    ];

    const suggestedAnswers = [
      {
        questionId: prompt.targetQuestionIds[0],
        value: [wallMaterial],
      },
      {
        questionId: prompt.targetQuestionIds[1],
        value: [ceilingType],
      },
    ];

    if (heightEstimate && prompt.targetQuestionIds[2]) {
      suggestedAnswers.push({
        questionId: prompt.targetQuestionIds[2],
        value: heightEstimate.value,
      });
    }

    return {
      accepted: true,
      confidence,
      summary: buildSurfaceSummary(wallMaterial, ceilingType, heightEstimate),
      detections,
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
