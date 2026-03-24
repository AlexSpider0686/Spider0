import { toNumber } from "./estimate";
import { getVendorEquipment } from "../config/vendorConfig";

const MARKET_KEY_ALIASES = {
  camera: ["cameras", "camera"],
  recorder: ["nvr", "recorder", "integrationServer"],
  hdd: ["storage", "hdd"],
  switch: ["switch", "switches", "network-core"],
  controller: ["controllers", "controller"],
  sensor: ["sensors", "sensor"],
  detector: ["detectors", "detector"],
  panel: ["panel", "panels", "fire-panels"],
  speaker: ["speakers", "speaker", "notification"],
  amplifier: ["amplifiers", "amplifier"],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getAreaUnits(zones) {
  const safeArea = zones.reduce((sum, zone) => sum + Math.max(toNumber(zone.area), 0), 0);
  return Math.max(safeArea / 1000, 1);
}

function getValue(input, fallback) {
  return input === undefined || input === null || input === "" ? fallback : input;
}

function pushItem(details, item) {
  details.push({
    ...item,
    qty: Math.max(toNumber(item.qty), 1),
    unitPrice: Math.max(toNumber(item.unitPrice), 0),
  });
}

function minHddTbPerCamera(resolutionMp) {
  const perCameraPerDayTb = resolutionMp >= 8 ? 0.08 : resolutionMp >= 4 ? 0.045 : 0.025;
  return perCameraPerDayTb * 30;
}

function buildMarketRatioMap(marketEntries = []) {
  const grouped = new Map();

  for (const entry of marketEntries || []) {
    const equipmentKey = entry?.equipmentKey;
    const fallback = toNumber(entry?.fallbackPrice, 0);
    const price = toNumber(entry?.price, 0);
    if (!equipmentKey || fallback <= 0 || price <= 0) continue;

    const ratio = clamp(price / fallback, 0.65, 1.8);
    if (!grouped.has(equipmentKey)) grouped.set(equipmentKey, []);
    grouped.get(equipmentKey).push(ratio);
  }

  const map = new Map();
  grouped.forEach((values, key) => {
    if (!values.length) return;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    map.set(key, clamp(avg, 0.65, 1.8));
  });

  return map;
}

function pickMarketRatio(marketRatios, aliasKeys) {
  for (const key of aliasKeys || []) {
    if (marketRatios.has(key)) return marketRatios.get(key);
  }
  return 1;
}

function resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, aliasKeys) {
  const ratio = pickMarketRatio(marketRatios, aliasKeys);
  const reference = toNumber(basePrice, 0) || toNumber(fallbackUnitPrice, 0);
  return Math.max(reference * ratio, 0);
}

export function calculateEquipment(system, zones, selectedParams = {}, fallbackUnitPrice = 0, marketEntries = []) {
  const areaUnits = getAreaUnits(zones);
  const vendorMeta = getVendorEquipment(system.type, system.vendor);
  const marketRatios = buildMarketRatioMap(marketEntries);

  if (!vendorMeta) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
      keyEquipment: [],
    };
  }

  const details = [];

  if (vendorMeta.camera) {
    const placement = getValue(selectedParams.cameraPlacement, vendorMeta.camera.placement[0]);
    const resolution = Number(getValue(selectedParams.cameraResolution, vendorMeta.camera.resolution[1] || vendorMeta.camera.resolution[0]));
    const key = `${placement}_${resolution}`;
    const basePrice = vendorMeta.camera.basePrices[key] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.camera);
    const qty = Math.max(Math.round(areaUnits * 6.5), 1);
    pushItem(details, {
      code: "CAM",
      name: `Камеры (${placement}, ${resolution} Мп)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество камер рассчитывается по нормативной плотности на 1000 м².",
    });
  }

  if (vendorMeta.recorder) {
    const channels = Number(getValue(selectedParams.recorderChannels, vendorMeta.recorder.channels[2] || vendorMeta.recorder.channels[0]));
    const basePrice = vendorMeta.recorder.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.recorder);
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = Math.max(Math.ceil(cameraQty / Math.max(channels, 1)), 1);
    pushItem(details, {
      code: "NVR",
      name: `Регистратор (${channels} каналов)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество регистраторов = количество камер / канальность регистратора, с округлением вверх.",
    });
  }

  if (vendorMeta.hdd) {
    const hddTb = Number(getValue(selectedParams.hddTb, vendorMeta.hdd.tb[1] || vendorMeta.hdd.tb[0]));
    const basePrice = vendorMeta.hdd.basePrices[hddTb] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.hdd);
    const recorderQty = details.find((item) => item.code === "NVR")?.qty || 1;
    const cameraResolution = Number(getValue(selectedParams.cameraResolution, 4));
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const minTb = Math.max(cameraQty * minHddTbPerCamera(cameraResolution), 8);
    const qty = Math.max(Math.ceil(minTb / Math.max(hddTb, 1)), recorderQty * 2);
    pushItem(details, {
      code: "HDD",
      name: `HDD ${hddTb} ТБ (архив 30 дней)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: `Минимальная емкость архива 30 дней: ${Math.ceil(minTb)} ТБ. Количество HDD подбирается автоматически.`,
    });
  }

  if (vendorMeta.switch) {
    const ports = Number(getValue(selectedParams.switchPorts, vendorMeta.switch.ports[2] || vendorMeta.switch.ports[0]));
    const poe = Boolean(getValue(selectedParams.switchPoe, true));
    const key = `${ports}_${poe}`;
    const basePrice = vendorMeta.switch.basePrices[key] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.switch);
    const cameraQty = details.find((item) => item.code === "CAM")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = Math.max(Math.ceil(cameraQty / Math.max(ports, 1)), 1);
    pushItem(details, {
      code: "SW",
      name: `Коммутатор ${ports} портов (${poe ? "PoE" : "без PoE"})`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество коммутаторов зависит от числа подключаемых устройств и выбранной емкости.",
    });
  }

  if (vendorMeta.controller) {
    const channels = Number(getValue(selectedParams.controllerChannels, vendorMeta.controller.channels[1] || vendorMeta.controller.channels[0]));
    const basePrice = vendorMeta.controller.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.controller);
    const qty = Math.max(Math.round(areaUnits), 1);
    pushItem(details, {
      code: "CTRL",
      name: `Контроллер доступа (${channels} точки)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество контроллеров рассчитывается укрупненно по плотности точек доступа.",
    });
  }

  if (vendorMeta.sensor) {
    const kind = getValue(selectedParams.sensorKind, vendorMeta.sensor.kind[0]);
    const basePrice = vendorMeta.sensor.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.sensor);
    const qty = Math.max(Math.round(areaUnits * 9), 1);
    pushItem(details, {
      code: "SEN",
      name: `Охранный датчик (${kind})`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество датчиков считается по нормативной плотности для системы.",
    });
  }

  if (vendorMeta.detector) {
    const kind = getValue(selectedParams.detectorKind, vendorMeta.detector.kind[0]);
    const basePrice = vendorMeta.detector.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.detector);
    const qty = Math.max(Math.round(areaUnits * 24), 1);
    pushItem(details, {
      code: "DET",
      name: `Извещатель (${kind})`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество извещателей берется по нормативной плотности для АПС.",
    });
  }

  if (vendorMeta.panel) {
    const loops = Number(getValue(selectedParams.panelLoops, vendorMeta.panel.loops[1] || vendorMeta.panel.loops[0]));
    const basePrice = vendorMeta.panel.basePrices[loops] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.panel);
    const detectorsQty =
      details.find((item) => item.code === "DET")?.qty || details.find((item) => item.code === "SEN")?.qty || Math.max(Math.round(areaUnits * 20), 1);
    const qty = Math.max(Math.ceil(detectorsQty / Math.max(loops * 64, 1)), 1);
    pushItem(details, {
      code: "PANEL",
      name: `Панель / ППКП (${loops} шлейфа)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество панелей зависит от емкости шлейфов и суммарного числа датчиков.",
    });
  }

  if (vendorMeta.speaker) {
    const kind = getValue(selectedParams.speakerKind, vendorMeta.speaker.kind[0]);
    const basePrice = vendorMeta.speaker.basePrices[kind] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.speaker);
    const qty = Math.max(Math.round(areaUnits * 7), 1);
    pushItem(details, {
      code: "SPK",
      name: `Оповещатель СОУЭ (${kind})`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество оповещателей считается по акустической плотности на 1000 м².",
    });
  }

  if (vendorMeta.amplifier) {
    const channels = Number(getValue(selectedParams.amplifierChannels, vendorMeta.amplifier.channels[1] || vendorMeta.amplifier.channels[0]));
    const basePrice = vendorMeta.amplifier.basePrices[channels] || 0;
    const unitPrice = resolveUnitPrice(basePrice, fallbackUnitPrice, marketRatios, MARKET_KEY_ALIASES.amplifier);
    const speakerQty = details.find((item) => item.code === "SPK")?.qty || Math.max(Math.round(areaUnits * 6), 1);
    const qty = Math.max(Math.ceil(speakerQty / Math.max(channels * 8, 1)), 1);
    pushItem(details, {
      code: "AMP",
      name: `Усилитель СОУЭ (${channels} канала)`,
      qty,
      unitPrice,
      total: qty * unitPrice,
      isKey: true,
      basis: "Количество усилителей определяется по числу линий оповещения и требуемому резерву.",
    });
  }

  if (!details.length) {
    return {
      units: areaUnits,
      unitPrice: fallbackUnitPrice,
      totalEquipmentCost: fallbackUnitPrice * areaUnits,
      selectionKey: "fallback",
      mode: "fallback",
      details: [],
      keyEquipment: [],
    };
  }

  const totalEquipmentCost = details.reduce((sum, item) => sum + item.total, 0);
  const keyEquipment = details.filter((item) => item.isKey);
  const normalizedUnits = Math.max(keyEquipment[0]?.qty || areaUnits, 1);

  return {
    units: normalizedUnits,
    unitPrice: totalEquipmentCost / normalizedUnits,
    totalEquipmentCost,
    selectionKey: keyEquipment.map((item) => item.code).join("+"),
    mode: marketEntries?.length ? "vendor-market-parametric" : "vendor-parametric",
    details,
    keyEquipment,
  };
}

