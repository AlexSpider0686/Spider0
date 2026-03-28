const MAX_DIMENSION = 640;
const OCR_TEMPLATE_WIDTH = 18;
const OCR_TEMPLATE_HEIGHT = 24;
const PLAN_CHARSET =
  "0123456789АБВГДЕЁЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯабвгдеёжзийклмнопрстуфхцчшщыэюяABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-/:.";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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

function getTargetSize(image) {
  const width = Number(image?.naturalWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.height || 0);
  const scale = Math.min(MAX_DIMENSION / Math.max(width, 1), MAX_DIMENSION / Math.max(height, 1), 1);

  return {
    width: Math.max(96, Math.round(width * scale)),
    height: Math.max(96, Math.round(height * scale)),
    scale,
  };
}

function computeThreshold(grayscale) {
  const histogram = new Array(256).fill(0);
  for (const value of grayscale) {
    histogram[value] += 1;
  }

  const total = grayscale.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) {
    sum += i * histogram[i];
  }

  let backgroundWeight = 0;
  let backgroundSum = 0;
  let threshold = 128;
  let maxVariance = -1;

  for (let i = 0; i < 256; i += 1) {
    backgroundWeight += histogram[i];
    if (!backgroundWeight) continue;

    const foregroundWeight = total - backgroundWeight;
    if (!foregroundWeight) break;

    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (sum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  return threshold;
}

function getBinarizedRaster(imageData, width, height) {
  const grayscale = new Uint8ClampedArray(width * height);
  for (let index = 0; index < grayscale.length; index += 1) {
    const source = index * 4;
    grayscale[index] = Math.round(
      imageData[source] * 0.299 + imageData[source + 1] * 0.587 + imageData[source + 2] * 0.114
    );
  }

  const threshold = computeThreshold(grayscale);
  const binary = new Uint8Array(width * height);
  let foregroundPixels = 0;

  for (let index = 0; index < grayscale.length; index += 1) {
    const isForeground = grayscale[index] <= threshold;
    binary[index] = isForeground ? 1 : 0;
    if (isForeground) foregroundPixels += 1;
  }

  return {
    grayscale,
    binary,
    threshold,
    foregroundRatio: foregroundPixels / Math.max(binary.length, 1),
  };
}

function collectConnectedComponents(mask, width, height, predicate) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  const queueX = new Int32Array(mask.length);
  const queueY = new Int32Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const startIndex = y * width + x;
      if (visited[startIndex] || !predicate(mask[startIndex], x, y)) continue;

      let head = 0;
      let tail = 0;
      visited[startIndex] = 1;
      queueX[tail] = x;
      queueY[tail] = y;
      tail += 1;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;
      let touchesBorder = false;
      const points = [];

      while (head < tail) {
        const currentX = queueX[head];
        const currentY = queueY[head];
        head += 1;
        const currentIndex = currentY * width + currentX;

        pixelCount += 1;
        points.push(currentIndex);
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);
        if (currentX === 0 || currentY === 0 || currentX === width - 1 || currentY === height - 1) {
          touchesBorder = true;
        }

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1],
        ];

        for (const [nextX, nextY] of neighbors) {
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const nextIndex = nextY * width + nextX;
          if (visited[nextIndex] || !predicate(mask[nextIndex], nextX, nextY)) continue;
          visited[nextIndex] = 1;
          queueX[tail] = nextX;
          queueY[tail] = nextY;
          tail += 1;
        }
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;
      const fillRatio = pixelCount / Math.max(componentWidth * componentHeight, 1);
      components.push({
        minX,
        maxX,
        minY,
        maxY,
        width: componentWidth,
        height: componentHeight,
        pixelCount,
        fillRatio,
        aspectRatio: componentWidth / Math.max(componentHeight, 1),
        touchesBorder,
        points,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      });
    }
  }

  return components;
}

function deriveWallSegments(foregroundComponents, width, height) {
  return foregroundComponents
    .filter((component) => {
      const longEnough = component.width >= width * 0.08 || component.height >= height * 0.08;
      const thinEnough = component.fillRatio <= 0.72 || component.aspectRatio >= 3 || component.aspectRatio <= 1 / 3;
      return component.pixelCount >= 28 && longEnough && thinEnough;
    })
    .map((component) => ({
      ...component,
      orientation:
        component.aspectRatio >= 3 ? "horizontal" : component.aspectRatio <= 1 / 3 ? "vertical" : "mixed",
    }));
}

function buildWallMask(wallSegments, width, height) {
  const wallMask = new Uint8Array(width * height);
  for (const component of wallSegments) {
    for (const point of component.points) {
      wallMask[point] = 1;
      const x = point % width;
      const y = Math.floor(point / width);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nx = x + offsetX;
          const ny = y + offsetY;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          wallMask[ny * width + nx] = 1;
        }
      }
    }
  }
  return wallMask;
}

function deriveSpaceRegions(binary, wallMask, width, height) {
  const openMask = new Uint8Array(width * height);
  for (let index = 0; index < openMask.length; index += 1) {
    openMask[index] = binary[index] === 0 && wallMask[index] === 0 ? 1 : 0;
  }

  const openComponents = collectConnectedComponents(openMask, width, height, (value) => value === 1);
  const minPixels = Math.max(Math.round(width * height * 0.004), 60);

  return openComponents
    .filter((component) => !component.touchesBorder && component.pixelCount >= minPixels)
    .map((component) => {
      const corridorLike =
        component.aspectRatio >= 4 ||
        component.aspectRatio <= 0.25 ||
        (component.pixelCount >= width * height * 0.035 && component.fillRatio < 0.34);

      const stairLike =
        (component.width <= width * 0.18 && component.height <= height * 0.18 && component.pixelCount >= minPixels * 0.6) ||
        (component.width <= width * 0.14 && component.height <= height * 0.26);

      return {
        ...component,
        regionType: stairLike ? "stair" : corridorLike ? "corridor" : "room",
      };
    });
}

function getTemplateCanvas(char) {
  const canvas = document.createElement("canvas");
  canvas.width = OCR_TEMPLATE_WIDTH;
  canvas.height = OCR_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.font = "700 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(char, canvas.width / 2, canvas.height / 2 + 1);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bitmap = new Uint8Array(OCR_TEMPLATE_WIDTH * OCR_TEMPLATE_HEIGHT);
  for (let i = 0; i < bitmap.length; i += 1) {
    const source = i * 4;
    bitmap[i] = data[source] < 180 ? 1 : 0;
  }

  return bitmap;
}

let cachedTemplates = null;

function getTemplates() {
  if (cachedTemplates) return cachedTemplates;
  cachedTemplates = PLAN_CHARSET.split("").map((char) => ({
    char,
    bitmap: getTemplateCanvas(char),
  })).filter((item) => item.bitmap);
  return cachedTemplates;
}

function rasterizeGlyph(component, binary, width) {
  const canvas = document.createElement("canvas");
  canvas.width = OCR_TEMPLATE_WIDTH;
  canvas.height = OCR_TEMPLATE_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";

  const sourceWidth = Math.max(component.width, 1);
  const sourceHeight = Math.max(component.height, 1);
  const scale = Math.min((canvas.width - 2) / sourceWidth, (canvas.height - 2) / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (canvas.width - drawWidth) / 2;
  const offsetY = (canvas.height - drawHeight) / 2;

  for (const point of component.points) {
    const x = point % width;
    const y = Math.floor(point / width);
    if (binary[point] !== 1) continue;
    const targetX = Math.floor(offsetX + (x - component.minX) * scale);
    const targetY = Math.floor(offsetY + (y - component.minY) * scale);
    const w = Math.max(1, Math.ceil(scale));
    const h = Math.max(1, Math.ceil(scale));
    ctx.fillRect(targetX, targetY, w, h);
  }

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bitmap = new Uint8Array(OCR_TEMPLATE_WIDTH * OCR_TEMPLATE_HEIGHT);
  for (let i = 0; i < bitmap.length; i += 1) {
    const source = i * 4;
    bitmap[i] = data[source] < 180 ? 1 : 0;
  }
  return bitmap;
}

function compareBitmaps(a, b) {
  let equal = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) equal += 1;
  }
  return equal / Math.max(a.length, 1);
}

function recognizeGlyph(component, binary, width) {
  const raster = rasterizeGlyph(component, binary, width);
  if (!raster) return { char: "", confidence: 0 };

  let best = { char: "", confidence: 0 };
  for (const template of getTemplates()) {
    const confidence = compareBitmaps(raster, template.bitmap);
    if (confidence > best.confidence) {
      best = { char: template.char, confidence };
    }
  }
  return best;
}

function extractTextBlocks(foregroundComponents, binary, width, height) {
  const glyphCandidates = foregroundComponents.filter((component) => {
    const maxGlyphWidth = Math.max(Math.round(width * 0.08), 8);
    const maxGlyphHeight = Math.max(Math.round(height * 0.08), 10);
    return (
      component.width >= 2 &&
      component.height >= 4 &&
      component.width <= maxGlyphWidth &&
      component.height <= maxGlyphHeight &&
      component.pixelCount >= 6 &&
      component.fillRatio <= 0.7
    );
  });

  const sorted = [...glyphCandidates].sort((a, b) => (a.minY === b.minY ? a.minX - b.minX : a.minY - b.minY));
  const lines = [];

  for (const glyph of sorted) {
    const centerY = glyph.centerY;
    const targetLine = lines.find(
      (line) => Math.abs(line.centerY - centerY) <= Math.max(glyph.height, line.avgHeight) * 0.8
    );

    if (!targetLine) {
      lines.push({
        centerY,
        avgHeight: glyph.height,
        glyphs: [glyph],
      });
      continue;
    }

    targetLine.glyphs.push(glyph);
    targetLine.centerY = (targetLine.centerY * (targetLine.glyphs.length - 1) + centerY) / targetLine.glyphs.length;
    targetLine.avgHeight =
      (targetLine.avgHeight * (targetLine.glyphs.length - 1) + glyph.height) / targetLine.glyphs.length;
  }

  return lines
    .map((line) => {
      const glyphs = line.glyphs.sort((a, b) => a.minX - b.minX);
      const avgGap =
        glyphs.length > 1
          ? glyphs.slice(1).reduce((sum, glyph, index) => sum + (glyph.minX - glyphs[index].maxX), 0) / (glyphs.length - 1)
          : 0;

      let text = "";
      let confidenceSum = 0;
      glyphs.forEach((glyph, index) => {
        if (index > 0) {
          const gap = glyph.minX - glyphs[index - 1].maxX;
          if (gap > Math.max(avgGap * 1.8, line.avgHeight * 0.55)) {
            text += " ";
          }
        }

        const recognized = recognizeGlyph(glyph, binary, width);
        text += recognized.char || "";
        confidenceSum += recognized.confidence;
      });

      const cleanedText = text.replace(/\s+/g, " ").trim();
      const confidence = glyphs.length ? confidenceSum / glyphs.length : 0;
      const minX = Math.min(...glyphs.map((glyph) => glyph.minX));
      const maxX = Math.max(...glyphs.map((glyph) => glyph.maxX));
      const minY = Math.min(...glyphs.map((glyph) => glyph.minY));
      const maxY = Math.max(...glyphs.map((glyph) => glyph.maxY));

      return {
        text: cleanedText,
        confidence: round(confidence, 2),
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
      };
    })
    .filter((line) => line.text.length >= 2 && line.confidence >= 0.48);
}

function extractScaleHint(textBlocks) {
  const joined = textBlocks.map((block) => block.text).join(" ");
  const scaleMatch = joined.match(/1\s*[:]\s*(\d{2,4})/);
  const areaMatch = joined.match(/(\d{2,5})\s*(?:м2|м²)/i);

  return {
    drawingScale: scaleMatch ? Number(scaleMatch[1]) : null,
    areaLabelM2: areaMatch ? Number(areaMatch[1]) : null,
  };
}

function classifyRoomLabel(text) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return "generic";
  if (normalized.includes("лест")) return "stair";
  if (normalized.includes("корид")) return "corridor";
  if (normalized.includes("выход")) return "egress";
  if (normalized.includes("холл") || normalized.includes("вестиб")) return "public";
  if (normalized.includes("сервер") || normalized.includes("щит") || normalized.includes("пост")) return "technical";
  if (normalized.includes("склад")) return "storage";
  if (normalized.includes("офис") || normalized.includes("каб")) return "office";
  return "generic";
}

function attachLabelsToRegions(spaceRegions, textBlocks) {
  return spaceRegions.map((region) => {
    const label = textBlocks
      .filter(
        (block) =>
          block.centerX >= region.minX &&
          block.centerX <= region.maxX &&
          block.centerY >= region.minY &&
          block.centerY <= region.maxY
      )
      .sort((a, b) => b.confidence - a.confidence)[0];

    return {
      ...region,
      labelText: label?.text || "",
      labelConfidence: label?.confidence || 0,
      labelType: classifyRoomLabel(label?.text || ""),
    };
  });
}

function summarizeSegmentation(regions, width, height, scaleHint, objectAreaHint) {
  const roomRegions = regions.filter((region) => region.regionType === "room");
  const corridorRegions = regions.filter((region) => region.regionType === "corridor");
  const stairRegions = regions.filter((region) => region.regionType === "stair" || region.labelType === "stair");
  const egressLabels = regions.filter((region) => region.labelType === "egress");

  const interiorPixelArea = regions.reduce((sum, region) => sum + region.pixelCount, 0);
  const objectArea = objectAreaHint > 0 ? objectAreaHint : scaleHint.areaLabelM2 || 0;
  const metersPerPixel = objectArea > 0 && interiorPixelArea > 0 ? Math.sqrt(objectArea / interiorPixelArea) : null;

  const roomAreasM2 = roomRegions.map((region) =>
    metersPerPixel ? round(region.pixelCount * metersPerPixel * metersPerPixel, 1) : null
  );
  const avgRoomAreaM2 =
    roomAreasM2.filter((value) => value != null).length > 0
      ? round(
          roomAreasM2.filter((value) => value != null).reduce((sum, value) => sum + value, 0) /
            roomAreasM2.filter((value) => value != null).length,
          1
        )
      : null;

  return {
    roomCount: roomRegions.length,
    corridorCount: corridorRegions.length,
    stairCount: stairRegions.length,
    egressCount: Math.max(egressLabels.length, stairRegions.length ? 1 : 0),
    labeledRooms: roomRegions.filter((region) => region.labelText).map((region) => ({
      label: region.labelText,
      type: region.labelType,
      confidence: region.labelConfidence,
    })),
    metersPerPixel: metersPerPixel ? round(metersPerPixel, 4) : null,
    averageRoomAreaM2: avgRoomAreaM2,
    interiorPixelArea,
    segmentationConfidence: round(
      clamp((regions.length / 12) * 0.25 + (roomRegions.length / 10) * 0.3 + (corridorRegions.length > 0 ? 0.18 : 0), 0.22, 0.93),
      2
    ),
  };
}

export async function extractDeepPlanVision({ file, objectAreaHint = 0 }) {
  if (typeof document === "undefined") {
    return null;
  }

  const image = await loadImage(file);
  if (!image) {
    return null;
  }

  const { width, height } = getTargetSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const raster = getBinarizedRaster(imageData, width, height);
  const foregroundComponents = collectConnectedComponents(raster.binary, width, height, (value) => value === 1);
  const wallSegments = deriveWallSegments(foregroundComponents, width, height);
  const wallMask = buildWallMask(wallSegments, width, height);
  const spaceRegions = attachLabelsToRegions(
    deriveSpaceRegions(raster.binary, wallMask, width, height),
    extractTextBlocks(foregroundComponents, raster.binary, width, height)
  );
  const textBlocks = extractTextBlocks(foregroundComponents, raster.binary, width, height);
  const scaleHint = extractScaleHint(textBlocks);
  const segmentation = summarizeSegmentation(spaceRegions, width, height, scaleHint, objectAreaHint);

  return {
    width,
    height,
    threshold: raster.threshold,
    foregroundRatio: round(raster.foregroundRatio, 3),
    wallSegments: wallSegments.map((item) => ({
      minX: item.minX,
      minY: item.minY,
      maxX: item.maxX,
      maxY: item.maxY,
      orientation: item.orientation,
      pixelCount: item.pixelCount,
    })),
    textBlocks,
    spaceRegions: spaceRegions.map((item) => ({
      minX: item.minX,
      minY: item.minY,
      maxX: item.maxX,
      maxY: item.maxY,
      width: item.width,
      height: item.height,
      pixelCount: item.pixelCount,
      regionType: item.regionType,
      labelText: item.labelText,
      labelType: item.labelType,
      labelConfidence: item.labelConfidence,
    })),
    scaleHint,
    segmentation,
    quality: {
      segmentationConfidence: segmentation.segmentationConfidence,
      ocrConfidence: textBlocks.length
        ? round(textBlocks.reduce((sum, item) => sum + item.confidence, 0) / textBlocks.length, 2)
        : 0,
      geometryConfidence: segmentation.metersPerPixel ? 0.78 : scaleHint.areaLabelM2 ? 0.66 : 0.48,
    },
  };
}
